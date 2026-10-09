"""Read-only demo data for the landing page's "Try the demo" (no sign-in).

Fake cards only (CLAUDE.md rule 1): "Demo Card A".."D" from "Demo Bank", with made-up rates,
labelled "Demo data (not real)". Same response shapes as /me/*, and recommendations go
through the real ranking module so the demo shows the actual product behaviour.
"""

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal as D
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app import recommend as rec
from app.db.models import Category
from app.deps import get_today
from app.routers.offers import offer_status
from app.schemas import (
    CardDetail,
    EarnRateOut,
    OfferCard,
    OfferOut,
    OfferStatus,
    PickOut,
    Profile,
    Recommendation,
    UserCardDetail,
    UserCardOut,
)

router = APIRouter(prefix="/demo", tags=["demo"])
Today = Annotated[date, Depends(get_today)]

SOURCE = "Demo data (not real)"
SOURCE_URL = "https://card-wallet.example/demo"
CHECKED = datetime(2026, 10, 4, 6, 0, tzinfo=UTC)
POINT_VALUE = D("1.0")
DEMO_USER = uuid.UUID(int=0)

# (category, rate, unit, annual_cap, conditions)
_CARDS = [
    {
        "name": "Demo Card A",
        "network": "Visa",
        "last4": "1234",
        "annual_fee": 95,
        "fx_fee": 0,
        "rates": [
            ("dining", "4", "points", None, None),
            ("travel", "3", "points", None, None),
            ("groceries", "2", "points", None, None),
            ("other", "1", "points", None, None),
        ],
    },
    {
        "name": "Demo Card B",
        "network": "Mastercard",
        "last4": "5678",
        "annual_fee": 0,
        "fx_fee": 3,
        "rates": [
            ("groceries", "6", "percent", D("6000"), None),
            ("online", "5", "percent", None, "Rotating category; activate each quarter"),
            ("other", "1", "percent", None, None),
        ],
    },
    {
        "name": "Demo Card C",
        "network": "Visa",
        "last4": "9012",
        "annual_fee": 0,
        "fx_fee": 0,
        "rates": [("travel", "5", "miles", None, None), ("other", "2", "miles", None, None)],
    },
    {
        "name": "Demo Card D",
        "network": "Mastercard",
        "last4": "3456",
        "annual_fee": 0,
        "fx_fee": 3,
        "rates": [("gas", "3", "percent", None, None), ("other", "1.5", "percent", None, None)],
    },
]

# (id, user_card_id, merchant, kind, value, days_from_today, category, notes, source)
_OFFERS = [
    (
        1,
        1,
        "Demo Bistro",
        "percent_back",
        10,
        3,
        "dining",
        "Spend $50+, up to $15 back",
        "screenshot",
    ),
    (2, None, "Demo Phone Co.", "amount_off", 100, 4, None, "Upgrade coupon", "screenshot"),
    (3, 2, "Demo Market", "points", 5, 6, "groceries", "Activated offer", "typed"),
    (
        4,
        None,
        "Demo Clothing",
        "percent_back",
        25,
        40,
        None,
        "In-store or online, one use",
        "typed",
    ),
    (5, 1, "Dining credit", "amount_off", 10, None, "dining", "Resets monthly", "card_benefit"),
    (6, 4, "Demo Hardware", "amount_off", 15, -2, None, None, "typed"),
]


def _rates(spec) -> list[EarnRateOut]:
    return [
        EarnRateOut(
            category=c,
            rate=float(r),
            unit=u,
            annual_cap=float(cap) if cap else None,
            conditions=cond,
            source_url=SOURCE_URL,
            checked_at=CHECKED,
        )
        for c, r, u, cap, cond in spec
    ]


def _card(i: int, spec: dict, today: date) -> CardDetail:
    return CardDetail(
        id=i,
        issuer="Demo Bank",
        name=spec["name"],
        network=spec["network"],
        annual_fee=spec["annual_fee"],
        fx_fee=spec["fx_fee"],
        purchase_apr_min=20.24,
        purchase_apr_max=28.24,
        rewards_types="Cashback rewards; Travel-related rewards",
        credit_tiers="Credit score of 720 or greater",
        secured=False,
        source=SOURCE,
        as_of=today,
        earn_rates=_rates(spec["rates"]),
        late_fee=40,
        cash_advance_apr_min=29.99,
        cash_advance_apr_max=29.99,
        availability="National",
        website=None,
        source_url=SOURCE_URL,
    )


def _wallet(today: date) -> list[UserCardDetail]:
    return [
        UserCardDetail(
            id=i,
            card_id=i,
            last4=spec["last4"],
            nickname=None,
            created_at=CHECKED,
            card=_card(i, spec, today),
        )
        for i, spec in enumerate(_CARDS, start=1)
    ]


def _offers(today: date) -> list[OfferOut]:
    cards = {uc.id: uc for uc in _wallet(today)}
    out = []
    for oid, ucid, merchant, kind, value, days, cat, notes, source in _OFFERS:
        expires = today + timedelta(days=days) if days is not None else None
        st, left = offer_status(expires, today)
        uc = cards.get(ucid) if ucid else None
        out.append(
            OfferOut(
                id=oid,
                user_card_id=ucid,
                card=OfferCard(
                    user_card_id=uc.id,
                    card_id=uc.card_id,
                    name=uc.card.name,
                    nickname=None,
                    last4=uc.last4,
                )
                if uc
                else None,
                merchant=merchant,
                kind=kind,
                value=value,
                max_back=15 if oid == 1 else None,
                min_spend=50 if oid == 1 else None,
                code="UPG100" if oid == 2 else None,
                expires_at=expires,
                category=cat,
                notes=notes,
                source=source,
                remind_days=3,
                reminded_at=None,
                created_at=CHECKED,
                status=st,
                days_left=left,
            )
        )
    return out


@router.get("/me", response_model=Profile)
def demo_me() -> Profile:
    return Profile(user_id=DEMO_USER, email=None, display_name="Demo user", point_value_cents=1.0)


@router.get("/cards", response_model=list[UserCardOut])
def demo_cards(today: Today) -> list[UserCardDetail]:
    return _wallet(today)


@router.get("/cards/{user_card_id}", response_model=UserCardDetail)
def demo_card(user_card_id: int, today: Today) -> UserCardDetail:
    for uc in _wallet(today):
        if uc.id == user_card_id:
            return uc
    raise HTTPException(404, "Card not in the demo wallet")


@router.get("/offers", response_model=list[OfferOut])
def demo_offers(
    today: Today, status: OfferStatus | None = None, user_card_id: int | None = None
) -> list[OfferOut]:
    rows = _offers(today)
    if user_card_id is not None:
        rows = [o for o in rows if o.user_card_id == user_card_id]
    if status == "active":
        rows = [o for o in rows if o.status != "expired"]
    elif status:
        rows = [o for o in rows if o.status == status]
    rows.sort(key=lambda o: (o.expires_at is None, o.expires_at or date.max, o.id))
    return rows


@router.get("/offers/{offer_id}", response_model=OfferOut)
def demo_offer(offer_id: int, today: Today) -> OfferOut:
    for o in _offers(today):
        if o.id == offer_id:
            return o
    raise HTTPException(404, "Offer not found")


@router.get("/recommend", response_model=Recommendation)
def demo_recommend(category: Category, today: Today, merchant: str | None = None) -> Recommendation:
    wallet = _wallet(today)
    offers = [o for o in _offers(today) if o.user_card_id and o.status != "expired"]
    plain = [
        rec.Offer(
            user_card_id=o.user_card_id,
            merchant=o.merchant,
            kind=o.kind.value,
            value=D(str(o.value)) if o.value is not None else None,
            category=o.category.value if o.category else None,
            expires_at=o.expires_at,
            code=o.code,
        )
        for o in offers
    ]
    row_for = {id(p): o for p, o in zip(plain, offers, strict=True)}
    picks = rec.recommend(
        [
            rec.WalletCard(
                user_card_id=uc.id,
                name=uc.card.name,
                issuer=uc.card.issuer,
                last4=uc.last4,
                rates=[
                    rec.Rate(
                        category=r.category.value,
                        rate=D(str(r.rate)),
                        unit=r.unit.value,
                        annual_cap=D(str(r.annual_cap)) if r.annual_cap else None,
                        conditions=r.conditions,
                    )
                    for r in uc.card.earn_rates
                ],
            )
            for uc in wallet
        ],
        category.value,
        point_value_cents=POINT_VALUE,
        today=today,
        merchant=merchant,
        offers=plain,
    )
    by_id = {uc.id: uc for uc in wallet}
    return Recommendation(
        category=category,
        merchant=merchant,
        point_value_cents=float(POINT_VALUE),
        picks=[
            PickOut(
                user_card_id=p.user_card_id,
                card_id=by_id[p.user_card_id].card_id,
                name=p.name,
                issuer=p.issuer,
                last4=p.last4,
                nickname=None,
                rate=next(
                    (
                        r
                        for r in by_id[p.user_card_id].card.earn_rates
                        if p.rate and r.category.value == p.rate.category
                    ),
                    None,
                ),
                effective_cents=float(p.effective_cents) if p.effective_cents is not None else None,
                matched_category=p.matched_category,
                reason=p.reason,
                offers=[
                    {
                        "id": row_for[id(o)].id,
                        "merchant": o.merchant,
                        "kind": o.kind,
                        "value": float(o.value) if o.value is not None else None,
                        "code": o.code,
                        "expires_at": o.expires_at,
                    }
                    for o in p.offers
                ],
            )
            for p in picks
        ],
    )
