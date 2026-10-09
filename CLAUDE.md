# Card Wallet

A web app and a mobile app that answer one question: **which of my own credit cards should I use for this purchase?** They also track **offers and coupons**. These can be card-linked offers or plain store coupons (phone carrier, clothing store…). Users add them from a photo or by typing, and get a reminder before each one expires.

This is a portfolio project. The landing page and a no-sign-up **demo mode** are first-class features.

## Out of scope (decided)
- No bank or card connections (no Plaid). No transaction or spend tracking. No "how much I earned" dashboards.
- Never store full card numbers. Store last 4 digits only.

## Repo layout (monorepo)
```
card-wallet/
  CLAUDE.md
  design/            approved screens, reference only (see table below)
  data/              build_cc_dataset.py: CFPB TCCP catalog import
  backend/           Python API (FastAPI)
  scraper/           weekly rewards-refresh job (Python)
  apps/web/          React web app (Vite + TypeScript), mobile-first and responsive
  apps/mobile/       Expo React Native app (TypeScript, Expo Router)
  packages/shared/   TS types + typed API client generated from the backend's OpenAPI
```
The web and mobile apps share types, the API client and data hooks through `packages/shared`. Each app has its own UI layer.

## Stack
- **Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 + Alembic, pytest, `uv`.
- **Database + auth:** Supabase (Postgres + Supabase Auth with Google sign-in). The backend verifies the Supabase JWT on every request and gets `user_id` from it.
- **Web:** Vite + React + TypeScript + React Router + TanStack Query. On a phone browser it must look and feel like the app (bottom tabs below 768px, sidebar above).
- **Mobile:** Expo + React Native + TypeScript + Expo Router + TanStack Query.
- **AI (screenshot parsing + scraper extraction):** Anthropic Python SDK, backend/scraper only. The model name comes from the env var `ANTHROPIC_MODEL`. Never call it from the clients.
- **Deploy:** Vercel (web), Render web service (backend), Render cron jobs (scraper, reminders), Supabase (DB/auth). All deploy from GitHub.

## Design reference (`design/*.dc.html`)
Read the markup for layout, copy and colors. The `<x-dc>`, `<sc-for>` and `<sc-if>` tags are a prototyping format and must not be ported.

| File | Screen | Web route | Mobile route |
|---|---|---|---|
| Landing.dc.html | Portfolio landing, demo CTA, Google sign-in | `/` | — |
| WebApp.dc.html | Desktop home: which card + ending soon + my cards, demo banner | `/app` | — |
| WebCatalog.dc.html | Catalog table, add to wallet, compare tray (max 3) | `/app/catalog` | — |
| Main.dc.html | Home: category chips → best card + 2 alternatives | `/app` (mobile width) | `(tabs)/index` |
| Wallet.dc.html | My cards | `/app/cards` | `(tabs)/cards` |
| Card.dc.html | Card detail | `/app/cards/:id` | `cards/[id]` |
| Offers.dc.html | Offers & coupons: Active / Ending soon / Expired | `/app/offers` | `(tabs)/offers` |
| AddOffer.dc.html | Add offer: photo or typed, card optional, reminder Off/3/5/7 days | `/app/offers/new` | `offers/new` (modal) |
| Compare.dc.html | Two or three cards side by side, better value in green | `/app/compare` | `(tabs)/compare` |

Tokens: IBM Plex Sans. Ground `#F4F5F7`, surface `#FFFFFF`, text `#14181F`, secondary text `#4A5361`, border `#DDE1E7`, accent `#0B6E73`, offer text `#8A3F0E` on `#FCEFE4`, better value `#1F6B3A` on `#E7F4EC`, urgent `#A3261E`. Touch targets ≥ 44px.

## Data model
**Shared catalog (read-only to users):**
- `cards`: issuer, name, network, annual_fee, purchase_apr_min/max, fx_fee, late_fee, cash_advance_apr… plus `source` and `as_of` (from CFPB TCCP).
- `card_earn_rates`: card_id, category, rate, unit (`percent` | `points` | `miles`), annual_cap, conditions (text), `source_url`, `checked_at`.
- `card_earn_rates_staging`: same shape plus run_id, validation_status, validation_notes.
- `card_earn_rates_history`: previous values, for audit and rollback.
- `scrape_runs`: started_at, finished_at, status, counts, errors.

**Per user (always scoped by `user_id` from the JWT):**
- `profiles`: user_id, display_name, point_value_cents (default 1.0).
- `user_cards`: user_id, card_id, last4, nickname.
- `offers`: user_id, **user_card_id (nullable, for store coupons)**, merchant, kind (`percent_back` | `amount_off` | `points` | `code`), value, max_back, min_spend, code, expires_at, source (`screenshot` | `typed` | `card_benefit`), image_path, remind_days (0/3/5/7), reminded_at.

Categories enum: `dining, groceries, travel, gas, online, other`.

**Scoping rule:** every user-owned query filters by the `user_id` taken from the verified token. Never take a user id from the request body or query string. Enable Supabase Row Level Security on user tables as a second layer.

## Core logic: recommendation
`GET /me/recommend?category=` ranks the user's cards by effective cents per dollar:
- `percent` → the rate as-is. `points`/`miles` → rate × the user's `point_value_cents` (an assumption the user can change; show it in the UI).
- Respect annual caps and conditions where known, and show them in the reason text.
- If an active offer is linked to that card and matches the category or merchant, mention it.
- Return the top card plus the next two, each with a reason. This lives in a pure module with thorough unit tests. Write the tests first.

## API (v1)
- `GET /health`
- `GET /catalog/cards?q=&filters…`, `GET /catalog/cards/{id}`
- `GET/POST/DELETE /me/cards`
- `GET /me/recommend?category=`
- `GET/POST/PATCH/DELETE /me/offers?status=active|ending_soon|expired`
- `POST /me/offers/parse-image`: image in, **draft** offer JSON out (merchant, value, kind, expiry, code, min_spend), each field with a confidence. It saves nothing; the user confirms in the UI.
- `GET /demo/*`: read-only demo data for the landing page demo mode (no auth).

## Weekly rewards scraper (`scraper/`)
Runs **every Sunday** as a Render cron job.
1. Build the list of cards to refresh from the catalog, starting with ~30 popular cards. Each card has an issuer product-page URL.
2. Fetch each page with **Playwright** (headless browser; many pages render with JS). Be polite: respect robots.txt, rate-limit, identify the bot, and **never bypass CAPTCHAs, logins or anti-bot protection**. If a page is blocked, log it and skip it.
3. Send **only the fetched page text** to the LLM and ask it to extract earn rates into a strict JSON schema. The LLM must never answer from its own knowledge. If a value isn't on the page, it returns null.
4. Write the results to `card_earn_rates_staging` with `source_url` and `checked_at`.
5. **Validate:** rates within plausible bounds, units valid, required fields present, and no unexplained jumps compared to current values (e.g. a rate more than 2x its last value gets flagged).
6. **Promote** only rows that pass validation into `card_earn_rates`, moving the old values to history. Flagged rows stay in staging and trigger an email to the owner for review. If the whole run fails, the live data is left untouched.
7. Record everything in `scrape_runs`.

Issuer pages are the primary source. Do not scrape aggregator sites (NerdWallet, The Points Guy, etc.).

## Reminders
A daily Render cron finds offers where `expires_at − remind_days` is today and `reminded_at` is null. It notifies by email (web) and Expo push (mobile), then sets `reminded_at`.

## Rules
1. **Never invent real card terms.** Every real number needs a source URL and a date. Seeds and tests use fake cards ("Demo Card A").
2. CFPB TCCP has no per-category earn rates; those come only from the scraper.
3. No secrets in the clients. All AI calls and service keys stay on the server.
4. Every screen that shows card terms also shows their source and as-of date, plus "Not financial advice."
5. Work one phase at a time, keep everything runnable, write backend tests, and commit after each phase.

## Phases
1. **Scaffold:** monorepo, FastAPI `/health` with a test, Supabase project + Alembic migrations, Vite web shell (landing + `/app` with responsive nav), Expo shell with 4 tabs, `packages/shared` with the generated client.
2. **Catalog + auth:** import the TCCP catalog, Supabase Google sign-in on web and mobile, JWT verification, `/me/cards`.
3. **Recommendation:** the pure module with tests first, then the endpoint, then the Home screens on web and mobile.
4. **Offers & coupons:** CRUD, typed entry, then `parse-image` + the photo flow, then the reminder cron.
5. **Scraper:** start with 3 cards end to end (fetch → extract → stage → validate → promote), then scale to ~30, then schedule it.
6. **Demo mode + polish:** demo data, landing page, compare, deploy to Vercel/Render.
7. *(Later, mobile only)* Location-based alerts via geofencing. Verify current iOS and Android region limits before building.
