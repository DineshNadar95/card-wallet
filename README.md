# Card Wallet

Which of my own credit cards should I use for this purchase? Plus offers & coupons with expiry reminders.
Web (Vite + React) and mobile (Expo) apps on a FastAPI backend. See [CLAUDE.md](CLAUDE.md) for the full spec.

**Live:** https://card-wallet-sigma.vercel.app · API https://card-wallet-api.onrender.com/health

Live setup: see [DEPLOY.md](DEPLOY.md). Try it without an account via **Try the demo** on the
landing page (read-only sample data from `GET /demo/*`).

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
cd scraper && uv run pytest -q
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

## How "which card" works

`GET /me/recommend?category=dining` ranks the signed-in user's cards by cents earned per dollar
(`backend/app/recommend.py`, a pure module covered by `tests/test_recommend.py`):

- Cash back counts as-is (3% = 3¢). Points and miles are multiplied by the user's point value,
  1¢ by default, changeable on the Home screen (`PATCH /me`).
- A card without a bonus in that category falls back to its "everything else" rate.
- Annual caps and conditions are spelled out in the reason; active offers on a card are mentioned.
  Neither changes the order, since we don't track spending.
- Cards with no rates on file rank last. Earn rates come only from the weekly scraper.

## Offers, photos and reminders

- `GET/POST/PATCH/DELETE /me/offers` (`?status=active|ending_soon|expired`; "ending soon" = 7 days
  or less, and "active" includes those). Card-linked offers must point at the user's own card.
- `POST /me/offers/parse-image` sends the photo to Claude (`backend/app/offer_parser.py`, model
  from `ANTHROPIC_MODEL`) and returns a **draft** with a confidence per field. Nothing is saved;
  the user confirms in the form, and low-confidence fields are flagged "Check this". Clients
  re-encode photos to JPEG (max 2000px) first, which also strips EXIF/GPS. Limits: 5 MB,
  JPEG/PNG/WebP/GIF, 20 photos per user per hour.
- Reminders: `uv run python -m app.jobs.reminders` (daily GitHub Actions workflow; add
  `--dry-run` to preview). Sends one email (SMTP) and one Expo push per user, then sets
  `reminded_at`. A skipped day catches up the next day; nothing is marked unless delivered.
- Push needs an EAS project id in the mobile app (`npx eas-cli init` in `apps/mobile`) and a
  development or production build: Expo Go can't receive push on Android.

## Weekly rewards scraper (`scraper/`)

Earn rates come only from issuer product pages (`scraper/targets.yaml`, 29 cards). Each Sunday:

1. **Fetch** with headless Chromium as `CardWalletBot`, honoring robots.txt (incl. Crawl-delay),
   ≥10 s between requests per host. CAPTCHAs, login walls and bot blocks are logged and
   skipped, never worked around. Aggregator domains are refused at load time.
2. **Extract, verify, tie-break** with Claude (Haiku 5.5 by default) from the page text only (no
   web search, no prior knowledge). One call extracts rates with verbatim quotes, a second checks
   each rate against the page, and a third settles any disagreement or holds the rate back
   (`scraper/review.py`). Models: repo variables `SCRAPER_EXTRACT_MODEL`, `SCRAPER_VERIFY_MODEL`,
   `SCRAPER_TIEBREAK_MODEL`.
3. **Stage** every row in `card_earn_rates_staging` with its quote, URL and time.
4. **Validate**: complete, plausible (≤12% / ≤20x), quote really on the page and containing the
   rate, unit unchanged, and not more than 2x (or under half) the live value.
5. **Promote** passing rows in one transaction, old values to `card_earn_rates_history`. If
   fewer than half the cards refresh, or anything throws, nothing is promoted. Flagged rows
   stay in staging and the owner (`OWNER_EMAIL`) gets an email with the quote and page link.
6. Everything is recorded in `scrape_runs`.

```bash
cd scraper && uv sync && uv run playwright install chromium
uv run python -m scraper --fetch-only            # are all pages reachable and allowed?
uv run python -m scraper --only "Sapphire" --no-promote   # stage + validate one card
uv run python -m scraper                         # full run
uv run pytest -q
```

It runs weekly on GitHub Actions (`.github/workflows/scraper.yml`). `scraper/Dockerfile` is
kept for hosts that run containers (e.g. a Render cron, which needs a paid plan).

## Location alerts (mobile, Phase 7)

Offers can carry an optional **store pin** ("Pin this store: use my current location"). The
user's own location never goes to the server; only pins they choose to save. All matching
happens on the device (`packages/shared/src/geo.ts`).

- **Scan where I am** (iOS + Android, foreground): one location read, shows pinned offers
  within ~400 m and the best card for what you're buying.
- **Remind me near saved offers** (iOS only, opt-in in Settings): background geofences.
- **Android has no background location.** The manifest blocks `ACCESS_BACKGROUND_LOCATION`;
  nearby offers are foreground only.

Platform limits, checked October 2026:

| | iOS | Android |
|---|---|---|
| Monitored regions | 20 per app, all types ([Apple](https://developer.apple.com/tutorials/data/documentation/corelocation/monitoring-the-user-s-proximity-to-geographic-regions.md)) | 100 per app ([Android](https://developer.android.com/develop/sensors-and-location/location/geofencing)) |
| Radius | — | ≥ 100–150 m recommended; we default to 150 m (allowed 100–2,000) |
| App closed | iOS relaunches the app for region events | Expo doesn't restart a killed app for geofence events ([Expo](https://docs.expo.dev/versions/v57.0.0/sdk/location/)) |
| Store policy | "Always" needs a clear purpose string | Play generally rejects background location for offers/convenience ([Play policy](https://support.google.com/googleplay/android-developer/answer/9799150)) |

To stay under iOS's 20, the app watches the **19 nearest** pinned offers plus one "refresh"
region around you; leaving it re-picks the nearest 19. Alerts repeat at most once per 12 h per
offer. Background location needs a development or production build (not Expo Go).

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
