"""Per-user routes. Every query filters by `user.id` from the verified token, never the request."""

from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app import recommend as rec
from app.auth import User
from app.db.models import Card, Category, Offer, Profile, PushToken, UserCard
from app.db.session import get_db
from app.deps import get_today
from app.schemas import (
    EarnRateOut,
    OfferBrief,
    PickOut,
    ProfileUpdate,
    PushTokenIn,
    Recommendation,
    UserCardCreate,
    UserCardDetail,
    UserCardOut,
)
from app.schemas import Profile as ProfileOut

router = APIRouter(prefix="/me", tags=["me"])

Db = Annotated[Session, Depends(get_db)]


def _own_card(db: Session, user: User, user_card_id: int) -> UserCard:
    uc = db.scalar(select(UserCard).where(UserCard.id == user_card_id, UserCard.user_id == user.id))
    if uc is None:  # also for other users' cards: don't reveal that the id exists
        raise HTTPException(404, "Card not in your wallet")
    return uc


def _profile(db: Session, user: User) -> Profile:
    profile = db.get(Profile, user.id)
    if profile is None:
        profile = Profile(user_id=user.id, point_value_cents=Decimal("1.0"), email=user.email)
        db.add(profile)
        db.commit()
    elif user.email and profile.email != user.email:
        profile.email = user.email  # keep the reminder address current
        db.commit()
    return profile


def _profile_out(profile: Profile, user: User) -> ProfileOut:
    return ProfileOut.model_validate(profile).model_copy(update={"email": user.email})


@router.get("", response_model=ProfileOut)
def get_me(user: User, db: Db) -> ProfileOut:
    return _profile_out(_profile(db, user), user)


@router.patch("", response_model=ProfileOut)
def update_me(body: ProfileUpdate, user: User, db: Db) -> ProfileOut:
    profile = _profile(db, user)
    changes = body.model_dump(exclude_unset=True)
    if "display_name" in changes:
        profile.display_name = changes["display_name"]
    if changes.get("point_value_cents") is not None:
        profile.point_value_cents = Decimal(str(changes["point_value_cents"]))
    db.commit()
    return _profile_out(profile, user)


@router.get("/recommend", response_model=Recommendation)
def recommend_card(
    category: Category,
    user: User,
    db: Db,
    today: Annotated[date, Depends(get_today)],
    merchant: str | None = None,
) -> Recommendation:
    """Rank the user's cards for a purchase category (see app/recommend.py)."""
    point_value = _profile(db, user).point_value_cents
    owned = list(db.scalars(select(UserCard).where(UserCard.user_id == user.id)).unique())
    offers = list(
        db.scalars(
            select(Offer).where(
                Offer.user_id == user.id,
                Offer.user_card_id.is_not(None),
                or_(Offer.expires_at.is_(None), Offer.expires_at >= today),
            )
        )
    )

    wallet = [
        rec.WalletCard(
            user_card_id=uc.id,
            name=uc.card.name,
            issuer=uc.card.issuer,
            last4=uc.last4,
            nickname=uc.nickname,
            rates=[
                rec.Rate(
                    category=r.category.value,
                    rate=r.rate,
                    unit=r.unit.value,
                    annual_cap=r.annual_cap,
                    conditions=r.conditions,
                )
                for r in uc.card.earn_rates
            ],
        )
        for uc in owned
    ]
    # The pure module works on plain values; keep a way back to the rows for the response.
    plain_offers = [
        rec.Offer(
            user_card_id=o.user_card_id,
            merchant=o.merchant,
            kind=o.kind.value,
            value=o.value,
            category=o.category.value if o.category else None,
            expires_at=o.expires_at,
            code=o.code,
        )
        for o in offers
    ]
    row_for = {id(p): row for p, row in zip(plain_offers, offers, strict=True)}

    picks = rec.recommend(
        wallet,
        category.value,
        point_value_cents=point_value,
        today=today,
        merchant=merchant,
        offers=plain_offers,
    )

    by_id = {uc.id: uc for uc in owned}
    out = []
    for p in picks:
        uc = by_id[p.user_card_id]
        rate_row = next(
            (r for r in uc.card.earn_rates if p.rate and r.category.value == p.rate.category), None
        )
        out.append(
            PickOut(
                user_card_id=uc.id,
                card_id=uc.card_id,
                name=p.name,
                issuer=p.issuer,
                last4=p.last4,
                nickname=p.nickname,
                rate=EarnRateOut.model_validate(rate_row) if rate_row else None,
                effective_cents=float(p.effective_cents) if p.effective_cents is not None else None,
                matched_category=p.matched_category,
                reason=p.reason,
                offers=[OfferBrief.model_validate(row_for[id(o)]) for o in p.offers],
            )
        )
    return Recommendation(
        category=category, merchant=merchant, point_value_cents=float(point_value), picks=out
    )


@router.get("/cards", response_model=list[UserCardOut])
def list_my_cards(user: User, db: Db) -> list[UserCard]:
    return list(
        db.scalars(
            select(UserCard).where(UserCard.user_id == user.id).order_by(UserCard.id)
        ).unique()
    )


@router.get("/cards/{user_card_id}", response_model=UserCardDetail)
def get_my_card(user_card_id: int, user: User, db: Db) -> UserCard:
    return _own_card(db, user, user_card_id)


@router.post("/cards", response_model=UserCardOut, status_code=status.HTTP_201_CREATED)
def add_my_card(body: UserCardCreate, user: User, db: Db) -> UserCard:
    if db.get(Card, body.card_id) is None:
        raise HTTPException(404, "Card not found in catalog")
    uc = UserCard(user_id=user.id, **body.model_dump())
    db.add(uc)
    db.commit()
    db.refresh(uc)
    return uc


@router.delete("/cards/{user_card_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_my_card(user_card_id: int, user: User, db: Db) -> Response:
    db.delete(_own_card(db, user, user_card_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/push-tokens", status_code=status.HTTP_204_NO_CONTENT)
def register_push_token(body: PushTokenIn, user: User, db: Db) -> Response:
    """Called by the mobile app after notification permission is granted."""
    row = db.scalar(select(PushToken).where(PushToken.token == body.token))
    if row is None:
        db.add(PushToken(user_id=user.id, token=body.token, platform=body.platform))
    else:
        row.user_id = user.id  # same device, now signed in as this user
        row.platform = body.platform or row.platform
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/push-tokens", status_code=status.HTTP_204_NO_CONTENT)
def unregister_push_token(body: PushTokenIn, user: User, db: Db) -> Response:
    """Called on sign-out so a shared device stops getting this user's reminders."""
    db.execute(delete(PushToken).where(PushToken.token == body.token, PushToken.user_id == user.id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
