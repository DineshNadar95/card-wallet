"""Supabase JWT verification. Every /me/* route gets the user id from here and nowhere else."""

import uuid
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.config import get_settings

ASYMMETRIC = {"ES256", "RS256"}  # Supabase JWT signing keys, published as JWKS
AUDIENCE = "authenticated"


class CurrentUser(BaseModel):
    id: uuid.UUID
    email: str | None = None


class AuthError(Exception):
    pass


@lru_cache
def _jwks_client(supabase_url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(
        f"{supabase_url}/auth/v1/.well-known/jwks.json", cache_keys=True, lifespan=600
    )


def verify_token(token: str) -> CurrentUser:
    settings = get_settings()
    if not settings.supabase_url:
        raise AuthError("auth is not configured")
    base = settings.supabase_url.rstrip("/")

    try:
        alg = jwt.get_unverified_header(token).get("alg")
        if alg in ASYMMETRIC:
            key = _jwks_client(base).get_signing_key_from_jwt(token).key
        elif alg == "HS256" and settings.supabase_jwt_secret:
            key = settings.supabase_jwt_secret  # legacy shared-secret projects
        else:
            raise AuthError(f"unsupported token algorithm: {alg}")

        claims = jwt.decode(
            token,
            key,
            algorithms=[alg],
            audience=AUDIENCE,
            issuer=f"{base}/auth/v1",
            options={"require": ["exp", "sub", "aud", "iss"]},
        )
        return CurrentUser(id=uuid.UUID(claims["sub"]), email=claims.get("email"))
    except AuthError:
        raise
    except (jwt.PyJWTError, ValueError, KeyError) as e:
        raise AuthError(str(e)) from e


_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentUser:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Not signed in", {"WWW-Authenticate": "Bearer"}
        )
    try:
        return verify_token(creds.credentials)
    except AuthError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Invalid or expired token", {"WWW-Authenticate": "Bearer"}
        ) from None


User = Annotated[CurrentUser, Depends(get_current_user)]
