"""Which of my cards should I use? Pure ranking logic: no database, no I/O.

Cards are ranked by effective cents per dollar for the chosen category:
- `percent` rates count as-is (3% = 3¢ per $1);
- `points` / `miles` rates are multiplied by the user's point value (an assumption they can change).
A card with no rate for the category falls back to its "other" (everything else) rate.
Annual caps and conditions don't change the ranking (we don't track spend), but they're spelled
out in the reason. Active offers on a card are mentioned, never used to re-rank.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Literal

CATEGORIES = ("dining", "groceries", "travel", "gas", "online", "other")

Unit = Literal["percent", "points", "miles"]
OfferKind = Literal["percent_back", "amount_off", "points", "code"]

# How a category reads inside a sentence ("6% back on groceries").
_IN_SENTENCE = {
    "dining": "dining",
    "groceries": "groceries",
    "travel": "travel",
    "gas": "gas",
    "online": "online shopping",
    "other": "everything",
}


@dataclass(frozen=True)
class Rate:
    category: str
    rate: Decimal
    unit: Unit
    annual_cap: Decimal | None = None
    conditions: str | None = None


@dataclass(frozen=True)
class WalletCard:
    user_card_id: int
    name: str
    issuer: str
    rates: list[Rate]
    last4: str | None = None
    nickname: str | None = None


@dataclass(frozen=True)
class Offer:
    user_card_id: int | None  # None = store coupon, not tied to a card
    merchant: str
    kind: OfferKind
    value: Decimal | None = None
    category: str | None = None
    expires_at: date | None = None
    code: str | None = None


@dataclass(frozen=True)
class Pick:
    user_card_id: int
    name: str
    issuer: str
    last4: str | None
    nickname: str | None
    rate: Rate | None  # the rate used: the category's, or the fallback "other" rate
    effective_cents: Decimal | None  # cents per $1; None when no rate is on file
    matched_category: bool  # False when the fallback rate was used
    reason: str
    offers: list[Offer] = field(default_factory=list)


# ------------------------------------------------------------------ formatting


def _num(d: Decimal) -> str:
    """6 -> "6", 1.50 -> "1.5", 1.25 -> "1.25"."""
    s = format(d.normalize(), "f")
    return s


def _money(d: Decimal) -> str:
    return f"${d:,.0f}" if d == d.to_integral_value() else f"${d:,.2f}"


def _short_rate(r: Rate) -> str:
    return f"{_num(r.rate)}%" if r.unit == "percent" else f"{_num(r.rate)}x {r.unit}"


def _rate_phrase(r: Rate, point_value: Decimal) -> str:
    where = _IN_SENTENCE[r.category]
    if r.unit == "percent":
        return f"{_num(r.rate)}% back on {where}"
    each = "a point" if r.unit == "points" else "a mile"
    cents = _num(r.rate * point_value)
    return f"{_num(r.rate)}x {r.unit} on {where} (≈{cents}¢ per $1 at {_num(point_value)}¢ {each})"


def _offer_phrase(o: Offer, today: date) -> str:
    match o.kind:
        case "percent_back" if o.value is not None:
            what = f"gives {_num(o.value)}% back"
        case "amount_off" if o.value is not None:
            what = f"gives {_money(o.value)} off"
        case "points" if o.value is not None:
            what = f"gives {_num(o.value)}x points"
        case "code":
            what = f"has code {o.code}" if o.code else "has a code"
        case _:
            what = "applies"
    text = f"Also: your {o.merchant} offer {what}"
    if o.expires_at is not None:
        days = (o.expires_at - today).days
        when = "today" if days == 0 else "tomorrow" if days == 1 else f"in {days} days"
        text += f", ends {when}"
    return text


# ------------------------------------------------------------------ ranking


def _matching_offers(
    card: WalletCard, offers: Sequence[Offer], category: str, merchant: str | None, today: date
) -> list[Offer]:
    want = merchant.strip().casefold() if merchant else None
    hits = [
        o
        for o in offers
        if o.user_card_id == card.user_card_id
        and (o.expires_at is None or o.expires_at >= today)
        and (o.category == category or (want is not None and o.merchant.strip().casefold() == want))
    ]
    # Soonest-ending first; open-ended offers last.
    return sorted(hits, key=lambda o: (o.expires_at is None, o.expires_at or today))


def _score(
    card: WalletCard,
    category: str,
    point_value: Decimal,
    offers: list[Offer],
    today: date,
) -> Pick:
    by_cat = {r.category: r for r in card.rates}
    rate = by_cat.get(category)
    matched = rate is not None
    if rate is None:
        rate = by_cat.get("other")

    parts: list[str] = []
    effective: Decimal | None = None
    if rate is None:
        parts.append("No reward rate on file yet for this card")
    else:
        effective = rate.rate if rate.unit == "percent" else rate.rate * point_value
        if not matched:
            parts.append(f"No {_IN_SENTENCE[category]} bonus")
        parts.append(_rate_phrase(rate, point_value))
        if rate.annual_cap is not None:
            base = by_cat.get("other") if rate.category != "other" else None
            after = _short_rate(base) if base else "a lower rate"
            parts.append(f"up to {_money(rate.annual_cap)} a year, then {after}")
        if rate.conditions:
            parts.append(rate.conditions)
    parts.extend(_offer_phrase(o, today) for o in offers)

    return Pick(
        user_card_id=card.user_card_id,
        name=card.name,
        issuer=card.issuer,
        last4=card.last4,
        nickname=card.nickname,
        rate=rate,
        effective_cents=effective,
        matched_category=matched,
        reason=" · ".join(parts),
        offers=offers,
    )


def recommend(
    cards: Sequence[WalletCard],
    category: str,
    *,
    point_value_cents: Decimal,
    today: date,
    merchant: str | None = None,
    offers: Sequence[Offer] = (),
    limit: int = 3,
) -> list[Pick]:
    """Rank the user's cards for `category`; return the best plus the next `limit - 1`."""
    if category not in CATEGORIES:
        raise ValueError(f"unknown category: {category}")
    if point_value_cents <= 0:
        raise ValueError("point value must be positive")

    picks = [
        _score(
            c,
            category,
            point_value_cents,
            _matching_offers(c, offers, category, merchant, today),
            today,
        )
        for c in cards
    ]
    picks.sort(
        key=lambda p: (
            p.effective_cents is None,  # unknown rates last
            -(p.effective_cents or 0),  # higher value first
            not p.matched_category,  # a real bonus beats the fallback rate on ties
            p.name.casefold(),
            p.user_card_id,
        )
    )
    return picks[:limit]
