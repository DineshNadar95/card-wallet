from datetime import date

import pytest

from app.deps import get_today
from app.main import app

TODAY = date(2026, 10, 9)


@pytest.fixture(autouse=True)
def fixed_today():
    app.dependency_overrides[get_today] = lambda: TODAY
    yield
    app.dependency_overrides.pop(get_today, None)


def test_demo_needs_no_sign_in(client):
    for path in ["/demo/me", "/demo/cards", "/demo/offers", "/demo/recommend?category=dining"]:
        assert client.get(path).status_code == 200, path


def test_demo_cards_are_fake_and_sourced(client):
    cards = client.get("/demo/cards").json()
    assert [c["card"]["name"] for c in cards] == [
        "Demo Card A",
        "Demo Card B",
        "Demo Card C",
        "Demo Card D",
    ]
    for c in cards:
        assert c["card"]["issuer"] == "Demo Bank"
        assert c["card"]["source"] == "Demo data (not real)"
        assert c["card"]["earn_rates"], "every demo card has rates so the demo is useful"
    detail = client.get(f"/demo/cards/{cards[0]['id']}").json()
    assert detail["card"]["late_fee"] is not None
    assert client.get("/demo/cards/999").status_code == 404


def test_demo_recommendation_uses_the_real_ranking(client):
    body = client.get("/demo/recommend", params={"category": "groceries"}).json()
    top = body["picks"][0]
    assert top["name"] == "Demo Card B"
    assert top["reason"].startswith("6% back on groceries · up to $6,000 a year, then 1%")
    assert "Also: your Demo Market offer gives 5x points" in top["reason"]
    assert len(body["picks"]) == 3
    dining = client.get("/demo/recommend", params={"category": "dining"}).json()["picks"][0]
    assert dining["name"] == "Demo Card A"
    assert "Also: your Demo Bistro offer gives 10% back, ends in 3 days" in dining["reason"]


def test_demo_offers_are_relative_to_today(client):
    soon = client.get("/demo/offers", params={"status": "ending_soon"}).json()
    assert soon and all(o["status"] == "ending_soon" for o in soon)
    assert soon[0]["days_left"] == 3
    expired = client.get("/demo/offers", params={"status": "expired"}).json()
    assert [o["status"] for o in expired] == ["expired"]
    by_card = client.get("/demo/offers", params={"user_card_id": 1}).json()
    assert by_card and all(o["user_card_id"] == 1 for o in by_card)
    one = client.get(f"/demo/offers/{soon[0]['id']}").json()
    assert one["merchant"] == soon[0]["merchant"]


def test_demo_is_read_only(client):
    assert client.post("/demo/cards", json={"card_id": 1}).status_code == 405
    assert client.patch("/demo/me", json={"point_value_cents": 2}).status_code == 405
    assert client.delete("/demo/offers/1").status_code == 405
