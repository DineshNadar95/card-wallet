import time
import uuid

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app import auth
from app.config import Settings
from app.main import app

SUPABASE_URL = "https://demo-project.supabase.test"
ISSUER = f"{SUPABASE_URL}/auth/v1"
SECRET = "test-secret-at-least-32-bytes-long!!"
USER_ID = uuid.UUID("11111111-2222-3333-4444-555555555555")

EC_KEY = ec.generate_private_key(ec.SECP256R1())
OTHER_KEY = ec.generate_private_key(ec.SECP256R1())


def _claims(**over):
    now = int(time.time())
    c = {
        "sub": str(USER_ID),
        "email": "demo@example.test",
        "aud": "authenticated",
        "role": "authenticated",
        "iss": ISSUER,
        "iat": now,
        "exp": now + 3600,
    }
    c.update(over)
    return {k: v for k, v in c.items() if v is not None}


def es256(key=EC_KEY, **over):
    return jwt.encode(_claims(**over), key, algorithm="ES256", headers={"kid": "k1"})


def hs256(secret=SECRET, **over):
    return jwt.encode(_claims(**over), secret, algorithm="HS256")


class FakeJwks:
    """Stands in for PyJWKClient: always returns our test public key."""

    def get_signing_key_from_jwt(self, token):
        return jwt.PyJWK.from_dict(
            {**jwt.algorithms.ECAlgorithm.to_jwk(EC_KEY.public_key(), as_dict=True), "kid": "k1"},
            algorithm="ES256",
        )


@pytest.fixture
def settings(monkeypatch):
    s = Settings(supabase_url=SUPABASE_URL, supabase_jwt_secret=SECRET)
    monkeypatch.setattr(auth, "get_settings", lambda: s)
    monkeypatch.setattr(auth, "_jwks_client", lambda url: FakeJwks())
    return s


def test_accepts_asymmetric_supabase_token(settings):
    user = auth.verify_token(es256())
    assert user.id == USER_ID
    assert user.email == "demo@example.test"


def test_accepts_legacy_hs256_token(settings):
    assert auth.verify_token(hs256()).id == USER_ID


@pytest.mark.parametrize(
    "token",
    [
        pytest.param(lambda: es256(key=OTHER_KEY), id="wrong-signing-key"),
        pytest.param(lambda: hs256(secret="x" * 40), id="wrong-hs-secret"),
        pytest.param(lambda: es256(exp=int(time.time()) - 10), id="expired"),
        pytest.param(lambda: es256(aud="anon"), id="wrong-audience"),
        pytest.param(lambda: es256(iss="https://evil.test/auth/v1"), id="wrong-issuer"),
        pytest.param(lambda: es256(sub=None), id="no-subject"),
        pytest.param(lambda: es256(sub="not-a-uuid"), id="bad-subject"),
        pytest.param(
            lambda: jwt.encode(_claims(), key=None, algorithm="none"),  # type: ignore[arg-type]
            id="alg-none",
        ),
        pytest.param(lambda: "not.a.jwt", id="garbage"),
    ],
)
def test_rejects_bad_tokens(settings, token):
    with pytest.raises(auth.AuthError):
        auth.verify_token(token())


def test_hs256_rejected_when_no_secret_configured(settings, monkeypatch):
    monkeypatch.setattr(settings, "supabase_jwt_secret", "")
    with pytest.raises(auth.AuthError):
        auth.verify_token(hs256())


def test_rejects_everything_when_supabase_not_configured(settings, monkeypatch):
    monkeypatch.setattr(settings, "supabase_url", "")
    with pytest.raises(auth.AuthError):
        auth.verify_token(es256())


def test_me_requires_bearer_token(settings, client: TestClient):
    res = client.get("/me")
    assert res.status_code == 401
    assert res.headers["www-authenticate"] == "Bearer"

    res = client.get("/me", headers={"Authorization": f"Bearer {es256(key=OTHER_KEY)}"})
    assert res.status_code == 401


def test_me_with_valid_token_creates_profile(settings, client: TestClient):
    res = client.get("/me", headers={"Authorization": f"Bearer {es256()}"})
    assert res.status_code == 200
    body = res.json()
    assert body["user_id"] == str(USER_ID)
    assert body["email"] == "demo@example.test"
    assert body["point_value_cents"] == 1.0
    assert app.dependency_overrides  # client fixture wired the test DB
