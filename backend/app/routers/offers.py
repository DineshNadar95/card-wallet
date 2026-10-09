"""Offers & coupons. Queries are scoped to the token's user; linked cards must be their own."""

from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import User
from app.db.models import Offer, UserCard
from app.db.session import get_db
from app.deps import get_today
from app.offer_parser import (
    MAX_IMAGE_BYTES,
    OfferParser,
    ParseFailed,
    ParseUnavailable,
    allow_call,
    get_offer_parser,
    sniff_image_type,
)
from app.schemas import (
    ENDING_SOON_DAYS,
    OfferCard,
    OfferCreate,
    OfferDraft,
    OfferOut,
    OfferStatus,
    OfferUpdate,
)

router = APIRouter(prefix="/me/offers", tags=["offers"])

Db = Annotated[Session, Depends(get_db)]
Today = Annotated[date, Depends(get_today)]


def offer_status(expires_at: date | None, today: date) -> tuple[OfferStatus, int | None]:
    if expires_at is None:
        return "active", None  # e.g. a monthly card benefit
    days = (expires_at - today).days
    if days < 0:
        return "expired", days
    return ("ending_soon" if days <= ENDING_SOON_DAYS else "active"), days


def to_out(o: Offer, today: date) -> OfferOut:
    st, days = offer_status(o.expires_at, today)
    uc = o.user_card
    return OfferOut(
        id=o.id,
        user_card_id=o.user_card_id,
        card=OfferCard(
            user_card_id=uc.id,
            card_id=uc.card_id,
            name=uc.card.name,
            nickname=uc.nickname,
            last4=uc.last4,
        )
        if uc
        else None,
        merchant=o.merchant,
        kind=o.kind,
        value=float(o.value) if o.value is not None else None,
        max_back=float(o.max_back) if o.max_back is not None else None,
        min_spend=float(o.min_spend) if o.min_spend is not None else None,
        code=o.code,
        expires_at=o.expires_at,
        category=o.category,
        notes=o.notes,
        source=o.source,
        remind_days=o.remind_days,
        reminded_at=o.reminded_at,
        created_at=o.created_at,
        status=st,
        days_left=days,
    )


def _own_offer(db: Session, user: User, offer_id: int) -> Offer:
    o = db.scalar(select(Offer).where(Offer.id == offer_id, Offer.user_id == user.id))
    if o is None:
        raise HTTPException(404, "Offer not found")
    return o


def _check_card(db: Session, user: User, user_card_id: int | None) -> None:
    if user_card_id is None:
        return
    owned = db.scalar(
        select(UserCard.id).where(UserCard.id == user_card_id, UserCard.user_id == user.id)
    )
    if owned is None:
        raise HTTPException(404, "Card not in your wallet")


@router.get("", response_model=list[OfferOut])
def list_offers(
    user: User,
    db: Db,
    today: Today,
    status: OfferStatus | None = None,
    user_card_id: int | None = None,
) -> list[OfferOut]:
    """`active` = not expired (includes ending soon); `ending_soon` = ends within 7 days."""
    q = select(Offer).where(Offer.user_id == user.id)
    if user_card_id is not None:
        q = q.where(Offer.user_card_id == user_card_id)
    rows = [to_out(o, today) for o in db.scalars(q)]

    if status == "active":
        rows = [r for r in rows if r.status != "expired"]
    elif status is not None:
        rows = [r for r in rows if r.status == status]

    if status == "expired":
        rows.sort(key=lambda r: (r.expires_at or date.min, r.id), reverse=True)
    else:
        # Soonest first; offers without an end date last.
        rows.sort(key=lambda r: (r.expires_at is None, r.expires_at or date.max, r.id))
    return rows


@router.post("/parse-image", response_model=OfferDraft)
async def parse_offer_image(
    image: UploadFile,
    user: User,
    today: Today,
    parser: Annotated[OfferParser, Depends(get_offer_parser)],
) -> OfferDraft:
    """Image in, draft offer out (each field with a confidence). Saves nothing."""
    data = await image.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image is over 5 MB. Try a screenshot or a smaller photo.")
    media_type = sniff_image_type(data)
    if media_type is None:
        raise HTTPException(415, "Upload a JPEG, PNG, WebP or GIF image.")
    if not allow_call(str(user.id)):
        raise HTTPException(429, "Too many photos in the last hour. Type this one in instead.")
    try:
        return await parser.parse(data, media_type, today)
    except ParseUnavailable as e:
        raise HTTPException(503, str(e)) from None
    except ParseFailed:
        raise HTTPException(
            422, "We couldn't read that image. Try a clearer photo, or type it in."
        ) from None


@router.get("/{offer_id}", response_model=OfferOut)
def get_offer(offer_id: int, user: User, db: Db, today: Today) -> OfferOut:
    return to_out(_own_offer(db, user, offer_id), today)


@router.post("", response_model=OfferOut, status_code=status.HTTP_201_CREATED)
def create_offer(body: OfferCreate, user: User, db: Db, today: Today) -> OfferOut:
    _check_card(db, user, body.user_card_id)
    o = Offer(user_id=user.id, **body.model_dump())
    db.add(o)
    db.commit()
    db.refresh(o)
    return to_out(o, today)


@router.patch("/{offer_id}", response_model=OfferOut)
def update_offer(offer_id: int, body: OfferUpdate, user: User, db: Db, today: Today) -> OfferOut:
    o = _own_offer(db, user, offer_id)
    current = {
        f: float(v) if isinstance(v, Decimal) else v
        for f in OfferCreate.model_fields
        for v in [getattr(o, f)]
    }
    merged = {**current, **body.model_dump(exclude_unset=True)}
    try:
        valid = OfferCreate.model_validate(merged)
    except ValidationError as e:
        raise HTTPException(
            422, e.errors(include_url=False, include_context=False, include_input=False)
        ) from None

    _check_card(db, user, valid.user_card_id)
    if (valid.expires_at, valid.remind_days) != (o.expires_at, o.remind_days):
        o.reminded_at = None  # new date or lead time: remind again
    for k, v in valid.model_dump().items():
        setattr(o, k, v)
    db.commit()
    db.refresh(o)
    return to_out(o, today)


@router.delete("/{offer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_offer(offer_id: int, user: User, db: Db) -> Response:
    db.delete(_own_offer(db, user, offer_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
