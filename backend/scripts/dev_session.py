"""Mint a local sign-in for manual testing without a Supabase project.

The API accepts HS256 tokens when SUPABASE_JWT_SECRET is set, so a locally signed token for a
fake user works against a local API started with the same secret. Nothing here touches a real
Supabase project; the issuer is a localhost URL.

Usage (from backend/), with the same two variables the API was started with:
    SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_JWT_SECRET=<32+ random chars> \
        uv run python scripts/dev_session.py            # prints the bearer token
    ... dev_session.py --browser                         # localStorage snippet for the web app

See docs/LOCAL_TESTING.md.
"""

import argparse
import json
import os
import sys
import time
import uuid

import jwt

DEV_USER = uuid.UUID("00000000-0000-0000-0000-00000000d3e0")  # same as scripts/seed_demo.py


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument(
        "--browser", action="store_true", help="print a localStorage snippet for the web app"
    )
    ap.add_argument("--hours", type=int, default=12)
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    secret = os.environ.get("SUPABASE_JWT_SECRET", "")
    if not url.startswith("http://127.0.0.1") and not url.startswith("http://localhost"):
        sys.exit("SUPABASE_URL must be a localhost URL: this script is for local testing only")
    if len(secret) < 32:
        sys.exit("SUPABASE_JWT_SECRET must be at least 32 characters")

    now = int(time.time())
    claims = {
        "sub": str(DEV_USER),
        "email": "dev@example.test",
        "aud": "authenticated",
        "role": "authenticated",
        "iss": f"{url}/auth/v1",
        "iat": now,
        "exp": now + args.hours * 3600,
    }
    token = jwt.encode(claims, secret, algorithm="HS256")
    if not args.browser:
        print(token)
        return

    # supabase-js keys its stored session by the first label of the project host: "127" here.
    key = "sb-" + url.split("//")[1].split(":")[0].split(".")[0] + "-auth-token"
    session = {
        "access_token": token,
        "refresh_token": "local-dev",
        "token_type": "bearer",
        "expires_in": args.hours * 3600,
        "expires_at": claims["exp"],
        "user": {
            "id": str(DEV_USER),
            "aud": "authenticated",
            "role": "authenticated",
            "email": "dev@example.test",
            "app_metadata": {},
            "user_metadata": {"full_name": "Dev Tester"},
            "created_at": "2026-10-09T00:00:00Z",
        },
    }
    stored = json.dumps(json.dumps(session))
    print(f"localStorage.setItem({json.dumps(key)}, {stored}); location.reload();")


if __name__ == "__main__":
    main()
