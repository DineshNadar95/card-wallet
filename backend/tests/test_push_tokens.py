import pytest

from app.db.models import PushToken
from tests.conftest import USER_A, USER_B

TOKEN = "ExponentPushToken[abc123]"


def test_register_is_idempotent_and_moves_between_users(login, db):
    a = login(USER_A)
    assert a.post("/me/push-tokens", json={"token": TOKEN, "platform": "ios"}).status_code == 204
    assert a.post("/me/push-tokens", json={"token": TOKEN, "platform": "ios"}).status_code == 204
    assert db.query(PushToken).count() == 1

    # Same phone, different account: the token follows the signed-in user.
    login(USER_B).post("/me/push-tokens", json={"token": TOKEN})
    (row,) = db.query(PushToken).all()
    assert row.user_id == USER_B.id


def test_unregister_only_own_token(login, db):
    login(USER_A).post("/me/push-tokens", json={"token": TOKEN})
    login(USER_B).request("DELETE", "/me/push-tokens", json={"token": TOKEN})
    assert db.query(PushToken).count() == 1
    login(USER_A).request("DELETE", "/me/push-tokens", json={"token": TOKEN})
    assert db.query(PushToken).count() == 0


@pytest.mark.parametrize("token", ["", "not-a-token", "ExponentPushToken[]", "x" * 300])
def test_rejects_malformed_tokens(login, token):
    assert login(USER_A).post("/me/push-tokens", json={"token": token}).status_code == 422


def test_requires_sign_in(client):
    assert client.post("/me/push-tokens", json={"token": TOKEN}).status_code == 401
