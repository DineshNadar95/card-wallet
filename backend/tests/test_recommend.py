"""Spec for the pure recommendation module (written before the implementation).

All cards here are fake ("Demo Card A"); no real card terms.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.recommend import Offer, Rate, WalletCard, recommend

TODAY = date(2026, 10, 9)
ONE_CENT = Decimal("1.0")


def card(uid: int, name: str, *rates: Rate, last4: str | None = None, nickname=None) -> WalletCard:
    return WalletCard(
        user_card_id=uid,
        name=name,
        issuer="Demo Bank",
        last4=last4,
        nickname=nickname,
        rates=list(rates),
    )


def pct(category: str, rate: str, **kw) -> Rate:
    return Rate(category=category, rate=Decimal(rate), unit="percent", **kw)


def pts(category: str, rate: str, unit: str = "points", **kw) -> Rate:
    return Rate(category=category, rate=Decimal(rate), unit=unit, **kw)


def offer(uid: int | None, merchant: str, **kw) -> Offer:
    base = {
        "kind": "percent_back",
        "value": Decimal("10"),
        "category": None,
        "expires_at": TODAY + timedelta(days=3),
    }
    base.update(kw)
    return Offer(user_card_id=uid, merchant=merchant, **base)


def rec(cards, category="dining", **kw):
    kw.setdefault("point_value_cents", ONE_CENT)
    kw.setdefault("today", TODAY)
    return recommend(cards, category, **kw)


def ids(picks):
    return [p.user_card_id for p in picks]


# ------------------------------------------------------------------ ranking


def test_empty_wallet_returns_nothing():
    assert rec([]) == []


def test_percent_is_cents_per_dollar_as_is():
    picks = rec([card(1, "Demo Card A", pct("dining", "3"))])
    assert picks[0].effective_cents == Decimal("3")


def test_points_and_miles_use_the_point_value():
    a = card(1, "Demo Card A", pts("dining", "4"))
    b = card(2, "Demo Card B", pts("dining", "3", unit="miles"))
    picks = rec([a, b], point_value_cents=Decimal("1.5"))
    assert [p.effective_cents for p in picks] == [Decimal("6.0"), Decimal("4.5")]


def test_point_value_can_flip_the_ranking():
    points = card(1, "Demo Points", pts("dining", "3"))
    cash = card(2, "Demo Cash", pct("dining", "4"))
    assert ids(rec([points, cash], point_value_cents=Decimal("1.0"))) == [2, 1]
    assert ids(rec([points, cash], point_value_cents=Decimal("1.5"))) == [1, 2]


def test_returns_top_card_plus_next_two():
    cards = [card(i, f"Demo Card {i}", pct("dining", str(i))) for i in range(1, 6)]
    picks = rec(cards)
    assert ids(picks) == [5, 4, 3]


def test_fewer_than_three_cards():
    assert ids(rec([card(1, "Demo Card A", pct("dining", "2"))])) == [1]


def test_falls_back_to_the_everything_else_rate():
    flat = card(1, "Demo Flat", pct("other", "2"))
    bonus = card(2, "Demo Bonus", pct("dining", "3"), pct("other", "1"))
    picks = rec([flat, bonus], "dining")
    assert ids(picks) == [2, 1]
    assert picks[1].matched_category is False
    assert picks[1].effective_cents == Decimal("2")
    assert picks[0].matched_category is True


def test_other_category_only_uses_the_base_rate():
    a = card(1, "Demo Card A", pct("dining", "5"), pct("other", "1"))
    b = card(2, "Demo Card B", pct("other", "2"))
    assert ids(rec([a, b], "other")) == [2, 1]


def test_cards_without_any_known_rate_rank_last():
    unknown = card(1, "Demo Unknown")
    known = card(2, "Demo Known", pct("other", "1"))
    picks = rec([unknown, known])
    assert ids(picks) == [2, 1]
    assert picks[1].effective_cents is None
    assert picks[1].rate is None
    assert "No reward rate on file" in picks[1].reason


def test_ties_prefer_a_real_category_bonus_then_name():
    fallback = card(1, "Demo A", pct("other", "3"))
    bonus = card(2, "Demo Z", pct("dining", "3"))
    assert ids(rec([fallback, bonus])) == [2, 1]

    b = card(3, "Demo B", pct("dining", "2"))
    a = card(4, "Demo A", pct("dining", "2"))
    assert ids(rec([b, a])) == [4, 3]


def test_same_card_twice_is_ranked_independently():
    a1 = card(1, "Demo Card A", pct("dining", "3"), last4="1111")
    a2 = card(2, "Demo Card A", pct("dining", "3"), last4="2222")
    assert ids(rec([a2, a1])) == [1, 2]  # stable: name tie, then wallet order (id)


def test_unknown_category_is_rejected():
    with pytest.raises(ValueError):
        rec([card(1, "Demo Card A")], "furniture")


def test_point_value_must_be_positive():
    with pytest.raises(ValueError):
        rec([card(1, "Demo Card A")], point_value_cents=Decimal("0"))


# ------------------------------------------------------------------ reasons


def test_reason_for_percent_bonus():
    (p,) = rec([card(1, "Demo Card A", pct("groceries", "6"))], "groceries")
    assert p.reason == "6% back on groceries"


def test_reason_for_points_states_the_assumed_value():
    (p,) = rec([card(1, "Demo Card A", pts("dining", "4"))], point_value_cents=Decimal("1.25"))
    assert p.reason == "4x points on dining (≈5¢ per $1 at 1.25¢ a point)"


def test_reason_for_miles():
    (p,) = rec([card(1, "Demo Card A", pts("travel", "5", unit="miles"))], "travel")
    assert p.reason == "5x miles on travel (≈5¢ per $1 at 1¢ a mile)"


def test_reason_for_fallback_rate():
    (p,) = rec([card(1, "Demo Card A", pct("other", "1.5"))], "gas")
    assert p.reason == "No gas bonus · 1.5% back on everything"


def test_reason_mentions_annual_cap_and_what_comes_after():
    c = card(1, "Demo Card A", pct("groceries", "6", annual_cap=Decimal("6000")), pct("other", "1"))
    (p,) = rec([c], "groceries")
    assert p.reason == "6% back on groceries · up to $6,000 a year, then 1%"


def test_reason_mentions_cap_without_known_base_rate():
    c = card(1, "Demo Card A", pct("groceries", "6", annual_cap=Decimal("1500.50")))
    (p,) = rec([c], "groceries")
    assert p.reason == "6% back on groceries · up to $1,500.50 a year, then a lower rate"


def test_reason_mentions_conditions():
    c = card(
        1, "Demo Card A", pct("online", "5", conditions="Rotating category; activate each quarter")
    )
    (p,) = rec([c], "online")
    assert p.reason == "5% back on online shopping · Rotating category; activate each quarter"


def test_reason_labels_everything_else():
    (p,) = rec([card(1, "Demo Card A", pts("other", "2"))], "other")
    assert p.reason.startswith("2x points on everything")


# ------------------------------------------------------------------ offers


def test_mentions_an_active_offer_linked_to_the_card_in_this_category():
    a = card(1, "Demo Card A", pts("dining", "4"))
    o = offer(1, "Demo Bistro", category="dining")
    (p,) = rec([a], offers=[o])
    assert p.offers == [o]
    assert p.reason.endswith("· Also: your Demo Bistro offer gives 10% back, ends in 3 days")


def test_offer_matches_merchant_case_insensitively():
    a = card(1, "Demo Card A", pct("other", "1"))
    o = offer(1, "Demo Shoes", category=None)
    assert rec([a], "other", merchant="demo shoes", offers=[o])[0].offers == [o]
    assert rec([a], "other", merchant="Other Store", offers=[o])[0].offers == []


def test_ignores_offers_on_other_cards_store_coupons_other_categories_and_expired():
    a = card(1, "Demo Card A", pct("dining", "3"))
    offers = [
        offer(2, "Other Card Offer", category="dining"),
        offer(None, "Store Coupon", category="dining"),  # not card-linked
        offer(1, "Wrong Category", category="travel"),
        offer(1, "Expired", category="dining", expires_at=TODAY - timedelta(days=1)),
    ]
    (p,) = rec([a], offers=offers)
    assert p.offers == []
    assert "Also" not in p.reason


def test_offer_expiring_today_and_without_expiry():
    a = card(1, "Demo Card A", pct("dining", "3"))
    today = offer(1, "Demo Today", category="dining", expires_at=TODAY)
    forever = offer(
        1,
        "Demo Forever",
        category="dining",
        expires_at=None,
        kind="amount_off",
        value=Decimal("20"),
    )
    (p,) = rec([a], offers=[today, forever])
    assert p.reason.endswith(
        "· Also: your Demo Today offer gives 10% back, ends today"
        " · Also: your Demo Forever offer gives $20 off"
    )


@pytest.mark.parametrize(
    ("kind", "value", "code", "text"),
    [
        ("percent_back", "10", None, "gives 10% back"),
        ("amount_off", "25.5", None, "gives $25.50 off"),
        ("points", "5", None, "gives 5x points"),
        ("code", None, "SAVE10", "has code SAVE10"),
        ("code", None, None, "has a code"),
    ],
)
def test_offer_value_wording(kind, value, code, text):
    a = card(1, "Demo Card A", pct("dining", "3"))
    o = offer(
        1,
        "Demo Bistro",
        category="dining",
        kind=kind,
        value=value and Decimal(value),
        code=code,
        expires_at=None,
    )
    (p,) = rec([a], offers=[o])
    assert p.reason.endswith(f"· Also: your Demo Bistro offer {text}")


def test_offers_never_change_the_ranking():
    a = card(1, "Demo Card A", pct("dining", "2"))
    b = card(2, "Demo Card B", pct("dining", "3"))
    picks = rec([a, b], offers=[offer(1, "Demo Bistro", category="dining", value=Decimal("50"))])
    assert ids(picks) == [2, 1]
    assert picks[1].offers  # still mentioned on the card it belongs to


def test_tomorrow_wording():
    a = card(1, "Demo Card A", pct("dining", "3"))
    o = offer(1, "Demo Bistro", category="dining", expires_at=TODAY + timedelta(days=1))
    assert rec([a], offers=[o])[0].reason.endswith("ends tomorrow")
