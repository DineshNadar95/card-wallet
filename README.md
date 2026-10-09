# Card Wallet

Which of my own credit cards should I use for this purchase? Plus offers & coupons with expiry reminders.
Web (Vite + React) and mobile (Expo) apps on a FastAPI backend. See [CLAUDE.md](CLAUDE.md) for the full spec.

## Prerequisites

- Node 24 LTS (`nvm install --lts`)
- [uv](https://docs.astral.sh/uv/) (installs Python 3.12 for you)

## Setup

```bash
npm install                       # web, mobile, shared (npm workspaces)
cd backend && uv sync && cd ..    # API
```

Copy the `.env.example` files in `backend/`, `apps/web/` and `apps/mobile/` to `.env` and fill them in.

## Run

```bash
npm run dev:api      # http://localhost:8000  (docs at /docs)
npm run dev:web      # http://localhost:5173
npm run dev:mobile   # Expo dev server; press i / a, or scan with Expo Go
```

## Test & check

```bash
npm test             # web (vitest) + backend (pytest)
npm run typecheck    # all TS packages
cd backend && uv run ruff check .
```

## Supabase setup (database + Google sign-in)

1. Create a Supabase project.
2. **Google sign-in:** create an OAuth client in Google Cloud Console (type "Web application"),
   with the authorized redirect URI shown in Supabase → Authentication → Sign In / Providers → Google.
   Paste the client ID and secret into that Supabase page and enable the provider.
3. **Redirect URLs** (Supabase → Authentication → URL Configuration), add:
   - `http://localhost:5173/**` and your deployed web URL + `/**`
   - `cardwallet://auth/callback` (mobile builds)
   - `exp://**` (Expo Go during development)
4. **Env files** (copy each `.env.example` to `.env`):
   - `backend/.env`: `DATABASE_URL` (Project Settings → Database → connection string, with the
     `postgresql+psycopg://` prefix) and `SUPABASE_URL`. Only set `SUPABASE_JWT_SECRET` if the
     project still uses the legacy JWT secret.
   - `apps/web/.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `apps/mobile/.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

   The anon / publishable key is public by design. The service-role key and JWT secret are not:
   never put them in a client app.
5. Create the tables and load the card catalog:

```bash
cd backend
uv run alembic upgrade head
uv run python -m app.catalog.tccp     # downloads the CFPB TCCP release and upserts ~657 cards
```

The initial migration creates every table in the data model and, on Supabase, turns on Row Level
Security (owner-only policies on user tables, read-only on the catalog, none on internal tables).
The importer is idempotent: rerun it when the CFPB publishes a new release (pass `--url`).

After changing `backend/app/db/models.py`:

```bash
cd backend && uv run alembic revision --autogenerate -m "describe change"
```

`tests/test_migrations.py` fails if the models and migrations drift apart.

## Auth model

Clients sign in with Supabase (Google) and send the access token as `Authorization: Bearer …`.
The API verifies it against the project's JWKS (`app/auth.py`) and takes the user id only from
the token. Every `/me/*` query filters by it; Row Level Security is a second layer.

## Shared API client

`packages/shared` holds TS types generated from the backend's OpenAPI schema, a typed
`openapi-fetch` client, TanStack Query hooks, and design tokens. After changing an endpoint:

```bash
npm run gen:api
```

## Layout

```
backend/           FastAPI app, SQLAlchemy models, Alembic migrations, pytest
apps/web/          Vite + React + React Router; sidebar ≥ 768px, bottom tabs below
apps/mobile/       Expo + Expo Router; 4 tabs (Home, Cards, Offers, Compare)
packages/shared/   generated types + API client + hooks + tokens
design/            approved screens (reference only)
data/              CFPB TCCP catalog import
```
