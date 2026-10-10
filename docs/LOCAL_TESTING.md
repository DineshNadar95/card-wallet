# Testing locally without a Supabase project

Everything below uses fake data and a fake sign-in on localhost. No real card terms, no real
accounts.

## 1. Database with demo data

```bash
cd backend
export DATABASE_URL=sqlite:///local.db        # any path; gitignored
uv run alembic upgrade head
uv run python -m app.catalog.tccp --file /path/to/tccp.xlsx   # optional: real CFPB catalog
uv run python scripts/seed_demo.py           # 4 fake cards, a wallet, 5 offers for the test user
```

## 2. API with a local sign-in

```bash
export SUPABASE_URL=http://127.0.0.1:54321    # any localhost URL; nothing listens there
export SUPABASE_JWT_SECRET=$(openssl rand -hex 32)
uv run uvicorn app.main:app --port 8000
```

Mint a token for the test user (`dev@example.test`) and call the API:

```bash
TOKEN=$(uv run python scripts/dev_session.py)
curl -s localhost:8000/me/recommend?category=dining -H "Authorization: Bearer $TOKEN"
```

Without a token, `/me/*` returns 401; `/demo/*` and `/catalog/*` need none.

## 3. Web app signed in as the test user

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=local npm run dev:web
```

Open http://localhost:5173, then in the browser console paste the output of

```bash
uv run python scripts/dev_session.py --browser
```

The app reloads signed in. Remove it again with `localStorage.clear()`.

Demo mode needs none of this: http://localhost:5173/demo.

## 4. Phone layout

Resize the window below 768px (or use the browser's device toolbar at 375px): bottom tabs
replace the sidebar.

## What this doesn't cover
- Google sign-in itself, Supabase Row Level Security, email and push delivery, geofences,
  and reading offers from photos (needs `ANTHROPIC_API_KEY`). The test suites cover their logic
  with fakes.
