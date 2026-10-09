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

## Database (Supabase)

1. Create a Supabase project and enable the Google auth provider.
2. Put the Postgres connection string in `backend/.env` as `DATABASE_URL`
   (`postgresql+psycopg://…`).
3. `cd backend && uv run alembic upgrade head`

The initial migration creates every table in the data model and, on Supabase, turns on Row Level
Security (owner-only policies on user tables, read-only on the catalog, none on internal tables).

After changing `backend/app/db/models.py`:

```bash
cd backend && uv run alembic revision --autogenerate -m "describe change"
```

`tests/test_migrations.py` fails if the models and migrations drift apart.

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
