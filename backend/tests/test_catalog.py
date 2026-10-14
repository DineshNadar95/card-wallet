from decimal import Decimal

from app.db.models import Category, RateUnit
from tests.factories import add_rate, make_card


def names(res):
    assert res.status_code == 200, res.text
    return [c["name"] for c in res.json()["items"]]


def test_catalog_is_public_and_paginated(client, db):
    for i in range(5):
        make_card(db, f"Demo Card {i}")
    res = client.get("/catalog/cards", params={"limit": 2, "offset": 2})
    assert names(res) == ["Demo Card 2", "Demo Card 3"]
    assert res.json()["total"] == 5


def test_search_matches_issuer_and_name_words(client, db):
    make_card(db, "Demo Platinum Rewards", issuer="Example Credit Union")
    make_card(db, "Demo Cash Card", issuer="Demo Bank")
    assert names(client.get("/catalog/cards", params={"q": "example platinum"})) == [
        "Demo Platinum Rewards"
    ]
    assert names(client.get("/catalog/cards", params={"q": "CASH"})) == ["Demo Cash Card"]
    assert names(client.get("/catalog/cards", params={"q": "100%_"})) == []  # LIKE chars escaped


def test_filters(client, db):
    make_card(db, "Free Cash", annual_fee=Decimal("0"), fx_fee=Decimal("3"))
    make_card(
        db,
        "Fee Travel",
        annual_fee=Decimal("95"),
        fx_fee=Decimal("0"),
        rewards_types="Travel-related rewards",
        credit_tiers="Credit scores from 620 to 719",
    )
    make_card(
        db, "Unknown Fee", annual_fee=None, fx_fee=None, rewards_types=None, credit_tiers=None
    )

    get = lambda **p: names(client.get("/catalog/cards", params=p))  # noqa: E731
    assert get(no_annual_fee=True) == ["Free Cash"]
    assert get(no_fx_fee=True) == ["Fee Travel"]
    assert get(rewards="cashback") == ["Free Cash"]
    assert get(rewards="travel") == ["Fee Travel"]
    assert get(credit_tier="excellent") == ["Free Cash"]


def test_card_detail_includes_terms_rates_and_source(client, db):
    card = make_card(db, cash_advance_apr_max=Decimal("29.99"))
    add_rate(db, card, Category.dining, "4", RateUnit.points)

    res = client.get(f"/catalog/cards/{card.id}")
    assert res.status_code == 200
    body = res.json()
    assert body["annual_fee"] == 0
    assert body["purchase_apr_max"] == 28.9
    assert body["cash_advance_apr_max"] == 29.99
    assert body["source"] == "CFPB TCCP Jul–Dec 2025"
    assert body["as_of"] == "2025-12-31"
    assert body["earn_rates"] == [
        {
            "category": "dining",
            "rate": 4.0,
            "unit": "points",
            "annual_cap": None,
            "conditions": None,
            "source_url": "https://demo-bank.test/cards/a",
            "checked_at": "2026-10-04T00:00:00Z",
        }
    ]


def test_card_detail_404(client):
    assert client.get("/catalog/cards/999").status_code == 404


def test_card_image_link_is_returned_when_known(client, db):
    with_art = make_card(db, "Demo Card A", image_url="https://demo-bank.test/art/a.png")
    make_card(db, "Demo Card B")
    items = {c["name"]: c for c in client.get("/catalog/cards").json()["items"]}
    assert items["Demo Card A"]["image_url"] == "https://demo-bank.test/art/a.png"
    assert items["Demo Card B"]["image_url"] is None
    assert client.get(f"/catalog/cards/{with_art.id}").json()["image_url"].endswith("/a.png")
