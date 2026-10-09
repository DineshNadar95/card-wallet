from datetime import date, timedelta

import pytest

from app.deps import get_today
from app.main import app
from tests.conftest import USER_A, USER_B
from tests.factories import make_card

TODAY = date(2026, 10, 9)


@pytest.fixture(autouse=True)
def fixed_today():
    app.dependency_overrides[get_today] = lambda: TODAY
    yield


def body(**kw):
    b = {
        "merchant": "Demo Bistro",
        "kind": "percent_back",
        "value": 10,
        "expires_at": str(TODAY + timedelta(days=20)),
    }
    b.update(kw)
    return b


def add_card(api, db):
    card = make_card(db, "Demo Card A")
    return api.post("/me/cards", json={"card_id": card.id, "last4": "1234"}).json()


def test_requires_sign_in(client):
    assert client.get("/me/offers").status_code == 401
    assert client.post("/me/offers", json=body()).status_code == 401


def test_create_store_coupon_and_card_offer(login, db):
    api = login(USER_A)
    uc = add_card(api, db)

    coupon = api.post(
        "/me/offers", json=body(merchant="Demo Phone Co.", kind="amount_off", value=100)
    )
    assert coupon.status_code == 201, coupon.text
    assert coupon.json()["card"] is None
    assert coupon.json()["source"] == "typed"

    linked = api.post(
        "/me/offers",
        json=body(user_card_id=uc["id"], max_back=15, min_spend=50, remind_days=3, notes="One use"),
    ).json()
    assert linked["card"] == {
        "user_card_id": uc["id"],
        "card_id": uc["card_id"],
        "name": "Demo Card A",
        "nickname": None,
        "last4": "1234",
    }
    assert linked["status"] == "active"
    assert linked["days_left"] == 20
    assert linked["remind_days"] == 3
    assert linked["notes"] == "One use"


def test_cannot_link_another_users_card(login, db):
    uc = add_card(login(USER_A), db)
    res = login(USER_B).post("/me/offers", json=body(user_card_id=uc["id"]))
    assert res.status_code == 404


@pytest.mark.parametrize(
    "bad",
    [
        {"merchant": ""},
        {"kind": "percent_back", "value": None},
        {"kind": "percent_back", "value": 0},
        {"kind": "percent_back", "value": 150},
        {"kind": "amount_off", "value": -5},
        {"kind": "points", "value": None},
        {"kind": "code", "value": None, "code": None},
        {"remind_days": 4},
        {"min_spend": -1},
        {"user_id": "00000000-0000-0000-0000-00000000000b"},
        {"reminded_at": "2026-10-01T00:00:00Z"},
    ],
)
def test_validation(login, bad):
    assert login(USER_A).post("/me/offers", json=body(**bad)).status_code == 422


def test_code_only_offer(login):
    res = login(USER_A).post(
        "/me/offers", json=body(kind="code", value=None, code="SAVE10", expires_at=None)
    )
    assert res.status_code == 201
    assert res.json()["code"] == "SAVE10"
    assert res.json()["days_left"] is None


def test_status_tabs(login):
    api = login(USER_A)
    for merchant, days in [
        ("Later", 30),
        ("Soon", 3),
        ("Today", 0),
        ("Gone", -1),
        ("Week", 7),
        ("Eight", 8),
    ]:
        api.post(
            "/me/offers", json=body(merchant=merchant, expires_at=str(TODAY + timedelta(days=days)))
        )
    api.post(
        "/me/offers",
        json=body(merchant="Benefit", kind="amount_off", expires_at=None, source="card_benefit"),
    )

    def names(status):
        return [o["merchant"] for o in api.get("/me/offers", params={"status": status}).json()]

    assert names("active") == [
        "Today",
        "Soon",
        "Week",
        "Eight",
        "Later",
        "Benefit",
    ]  # soonest first, no-expiry last
    assert names("ending_soon") == ["Today", "Soon", "Week"]
    assert names("expired") == ["Gone"]
    assert len(api.get("/me/offers").json()) == 7

    statuses = {o["merchant"]: o["status"] for o in api.get("/me/offers").json()}
    assert statuses["Soon"] == "ending_soon"
    assert statuses["Later"] == "active"
    assert statuses["Gone"] == "expired"
    assert statuses["Benefit"] == "active"


def test_filter_by_card(login, db):
    api = login(USER_A)
    uc = add_card(api, db)
    api.post("/me/offers", json=body(merchant="On card", user_card_id=uc["id"]))
    api.post("/me/offers", json=body(merchant="Coupon"))
    res = api.get("/me/offers", params={"user_card_id": uc["id"]}).json()
    assert [o["merchant"] for o in res] == ["On card"]


def test_users_only_see_their_own_offers(login):
    mine = login(USER_A).post("/me/offers", json=body()).json()
    other = login(USER_B)
    assert other.get("/me/offers").json() == []
    assert other.get(f"/me/offers/{mine['id']}").status_code == 404
    assert other.patch(f"/me/offers/{mine['id']}", json={"merchant": "Hijack"}).status_code == 404
    assert other.delete(f"/me/offers/{mine['id']}").status_code == 404
    assert login(USER_A).get(f"/me/offers/{mine['id']}").json()["merchant"] == "Demo Bistro"


def test_patch_and_revalidate(login, db):
    from app.db.models import Offer

    api = login(USER_A)
    o = api.post("/me/offers", json=body(remind_days=3)).json()

    # Pretend the reminder already went out.
    row = db.get(Offer, o["id"])
    row.reminded_at = date(2026, 10, 1)
    db.commit()

    res = api.patch(f"/me/offers/{o['id']}", json={"merchant": "Demo Cafe"})
    assert res.json()["merchant"] == "Demo Cafe"
    assert res.json()["reminded_at"] is not None  # unrelated edit keeps it

    res = api.patch(f"/me/offers/{o['id']}", json={"expires_at": str(TODAY + timedelta(days=40))})
    assert res.json()["reminded_at"] is None  # new date: remind again

    # Patches are validated against the merged offer.
    assert api.patch(f"/me/offers/{o['id']}", json={"kind": "code"}).status_code == 422
    assert api.patch(f"/me/offers/{o['id']}", json={"value": None}).status_code == 422


def test_delete(login):
    api = login(USER_A)
    o = api.post("/me/offers", json=body()).json()
    assert api.delete(f"/me/offers/{o['id']}").status_code == 204
    assert api.get("/me/offers").json() == []
