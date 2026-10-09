import pytest

from tests.conftest import USER_A, USER_B
from tests.factories import make_card


def test_requires_sign_in(client):
    assert client.get("/me/cards").status_code == 401
    assert client.post("/me/cards", json={"card_id": 1}).status_code == 401
    assert client.delete("/me/cards/1").status_code == 401


def test_add_list_remove(login, db):
    card = make_card(db)
    api = login(USER_A)

    res = api.post("/me/cards", json={"card_id": card.id, "last4": "1234", "nickname": "Groceries"})
    assert res.status_code == 201, res.text
    added = res.json()
    assert added["last4"] == "1234"
    assert added["card"]["name"] == "Demo Card A"

    assert [c["id"] for c in api.get("/me/cards").json()] == [added["id"]]
    assert api.get(f"/me/cards/{added['id']}").json()["card"]["late_fee"] == 40

    assert api.delete(f"/me/cards/{added['id']}").status_code == 204
    assert api.get("/me/cards").json() == []


def test_users_only_see_their_own_cards(login, db):
    card = make_card(db)
    mine = login(USER_A).post("/me/cards", json={"card_id": card.id}).json()

    other = login(USER_B)
    assert other.get("/me/cards").json() == []
    assert other.get(f"/me/cards/{mine['id']}").status_code == 404
    assert other.delete(f"/me/cards/{mine['id']}").status_code == 404

    assert len(login(USER_A).get("/me/cards").json()) == 1


def test_user_id_in_body_is_ignored(login, db):
    card = make_card(db)
    res = login(USER_A).post("/me/cards", json={"card_id": card.id, "user_id": str(USER_B.id)})
    assert res.status_code == 422  # unknown fields are rejected outright
    assert login(USER_B).get("/me/cards").json() == []


@pytest.mark.parametrize("last4", ["123", "12345", "abcd", "4111111111111111", "12 4"])
def test_last4_must_be_exactly_four_digits(login, db, last4):
    card = make_card(db)
    res = login(USER_A).post("/me/cards", json={"card_id": card.id, "last4": last4})
    assert res.status_code == 422


def test_unknown_catalog_card(login):
    assert login(USER_A).post("/me/cards", json={"card_id": 999}).status_code == 404


def test_same_card_twice_is_allowed(login, db):
    card = make_card(db)
    api = login(USER_A)
    api.post("/me/cards", json={"card_id": card.id, "last4": "1111"})
    api.post("/me/cards", json={"card_id": card.id, "last4": "2222"})
    assert [c["last4"] for c in api.get("/me/cards").json()] == ["1111", "2222"]
