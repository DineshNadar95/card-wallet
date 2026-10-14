from datetime import date, timedelta

from app.db.models import Category, Offer, OfferKind, OfferSource, RateUnit, UserCard
from tests.conftest import USER_A, USER_B
from tests.factories import add_rate, make_card


def wallet(db, user, card, last4=None) -> UserCard:
    uc = UserCard(user_id=user.id, card_id=card.id, last4=last4)
    db.add(uc)
    db.commit()
    return uc


def test_requires_sign_in(client):
    assert client.get("/me/recommend", params={"category": "dining"}).status_code == 401


def test_rejects_unknown_category(login):
    assert login(USER_A).get("/me/recommend", params={"category": "furniture"}).status_code == 422


def test_ranks_the_users_cards(login, db):
    points = make_card(db, "Demo Points")
    add_rate(db, points, Category.dining, "4", RateUnit.points)
    cash = make_card(db, "Demo Cash")
    add_rate(db, cash, Category.dining, "3", RateUnit.percent)
    flat = make_card(db, "Demo Flat")
    add_rate(db, flat, Category.other, "2", RateUnit.percent)
    bare = make_card(db, "Demo Bare")
    for c in (cash, bare, flat, points):
        wallet(db, USER_A, c, last4="1234")

    body = login(USER_A).get("/me/recommend", params={"category": "dining"}).json()
    assert body["category"] == "dining"
    assert body["point_value_cents"] == 1.0
    picks = body["picks"]
    assert [p["name"] for p in picks] == ["Demo Points", "Demo Cash", "Demo Flat"]

    top = picks[0]
    assert top["effective_cents"] == 4.0
    assert top["last4"] == "1234"
    assert top["card_id"] == points.id
    assert top["reason"] == "4x points on dining (≈4¢ per $1 at 1¢ a point)"
    assert top["rate"]["source_url"] == "https://demo-bank.test/cards/a"
    assert top["rate"]["checked_at"] == "2026-10-04T00:00:00Z"
    assert picks[2]["matched_category"] is False


def test_only_this_users_cards(login, db):
    mine = make_card(db, "Demo Mine")
    theirs = make_card(db, "Demo Theirs")
    add_rate(db, theirs, Category.dining, "9", RateUnit.percent)
    wallet(db, USER_A, mine)
    wallet(db, USER_B, theirs)
    picks = login(USER_A).get("/me/recommend", params={"category": "dining"}).json()["picks"]
    assert [p["name"] for p in picks] == ["Demo Mine"]


def test_point_value_from_profile(login, db):
    points = make_card(db, "Demo Points")
    add_rate(db, points, Category.dining, "3", RateUnit.points)
    cash = make_card(db, "Demo Cash")
    add_rate(db, cash, Category.dining, "4", RateUnit.percent)
    wallet(db, USER_A, points)
    wallet(db, USER_A, cash)
    api = login(USER_A)

    def get():
        res = api.get("/me/recommend", params={"category": "dining"})
        return [p["name"] for p in res.json()["picks"]]

    assert get() == ["Demo Cash", "Demo Points"]

    res = api.patch("/me", json={"point_value_cents": 1.5})
    assert res.status_code == 200
    assert res.json()["point_value_cents"] == 1.5
    assert get() == ["Demo Points", "Demo Cash"]


def test_patch_me_validates_and_ignores_user_id(login):
    api = login(USER_A)
    assert api.patch("/me", json={"point_value_cents": 0}).status_code == 422
    assert api.patch("/me", json={"point_value_cents": 50}).status_code == 422
    assert api.patch("/me", json={"user_id": str(USER_B.id)}).status_code == 422
    assert api.patch("/me", json={"display_name": "Demo"}).json()["display_name"] == "Demo"


def test_mentions_active_linked_offers(login, db):
    card = make_card(db, "Demo Card A")
    add_rate(db, card, Category.dining, "4", RateUnit.points)
    uc = wallet(db, USER_A, card)
    today = date.today()
    db.add_all(
        [
            Offer(
                user_id=USER_A.id,
                user_card_id=uc.id,
                merchant="Demo Bistro",
                category=Category.dining,
                kind=OfferKind.percent_back,
                value=10,
                expires_at=today + timedelta(days=3),
                source=OfferSource.typed,
            ),
            Offer(
                user_id=USER_A.id,
                user_card_id=uc.id,
                merchant="Demo Old",
                category=Category.dining,
                kind=OfferKind.percent_back,
                value=10,
                expires_at=today - timedelta(days=1),
                source=OfferSource.typed,
            ),
            # Another user's offer pointing at this user_card id must never leak in.
            Offer(
                user_id=USER_B.id,
                user_card_id=uc.id,
                merchant="Demo Leak",
                category=Category.dining,
                kind=OfferKind.amount_off,
                value=5,
                source=OfferSource.typed,
            ),
        ]
    )
    db.commit()

    (pick,) = login(USER_A).get("/me/recommend", params={"category": "dining"}).json()["picks"]
    assert [o["merchant"] for o in pick["offers"]] == ["Demo Bistro"]
    assert pick["reason"].endswith("· Also: your Demo Bistro offer gives 10% back, ends in 3 days")


def test_merchant_param_matches_offers(login, db):
    card = make_card(db, "Demo Card A")
    uc = wallet(db, USER_A, card)
    db.add(
        Offer(
            user_id=USER_A.id,
            user_card_id=uc.id,
            merchant="Demo Shoes",
            kind=OfferKind.code,
            code="SAVE10",
            source=OfferSource.screenshot,
        )
    )
    db.commit()
    (pick,) = (
        login(USER_A)
        .get("/me/recommend", params={"category": "other", "merchant": "demo shoes"})
        .json()["picks"]
    )
    assert pick["reason"].endswith("Also: your Demo Shoes offer has code SAVE10")


def test_empty_wallet(login):
    assert login(USER_A).get("/me/recommend", params={"category": "gas"}).json()["picks"] == []


def test_picks_carry_the_card_image_link(login, db):
    card = make_card(db, "Demo Art", image_url="https://demo-bank.test/art/a.png")
    add_rate(db, card, Category.dining, "3", RateUnit.percent)
    wallet(db, USER_A, card)
    body = login(USER_A).get("/me/recommend", params={"category": "dining"}).json()
    assert body["picks"][0]["image_url"] == "https://demo-bank.test/art/a.png"
