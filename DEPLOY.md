# Deploying Card Wallet

Everything deploys from GitHub: the web app to **Vercel**, the API and both cron jobs to
**Render** (from `render.yaml`), data and sign-in on **Supabase**. Do the steps in order; each
one needs a value from the step before.

## 1. Supabase (database + Google sign-in)

1. Create a project. Note the **project URL** and the **anon / publishable key**
   (Project Settings → API). Both are public by design.
2. **Google provider:** Google Cloud Console → Credentials → OAuth client ID ("Web
   application"). Authorized redirect URI: the callback shown in Supabase → Authentication →
   Sign In / Providers → Google. Paste the client ID and secret there and enable it.
3. Copy the **database connection string** (Project Settings → Database, "Session pooler").
   Use it with the `postgresql+psycopg://` prefix.
4. Redirect URLs (Authentication → URL Configuration) are added in step 3 below, once the
   Vercel URL exists.

## 2. Render (API + reminder cron + scraper cron)

1. Render → New → **Blueprint** → pick this repo. It creates `card-wallet-api` (free plan:
   sleeps when idle, first request after a while takes ~1 min), `card-wallet-reminders` (daily)
   and `card-wallet-scraper` (Sundays, Docker). Cron jobs have no free plan; they use the
   smallest paid instance, billed by runtime.
2. Fill in the env vars it asks for (they're `sync: false`, so they never live in git):

   | Var | Value |
   |---|---|
   | `DATABASE_URL` | Supabase connection string from 1.3 |
   | `SUPABASE_URL` | Supabase project URL |
   | `SUPABASE_JWT_SECRET` | only if the project still uses the legacy JWT secret |
   | `CORS_ORIGINS` | your Vercel URL (step 3), e.g. `https://card-wallet.vercel.app` |
   | `WEB_APP_URL` | same Vercel URL (used in reminder emails) |
   | `ANTHROPIC_API_KEY` | for photo reading and the scraper |
   | `SMTP_*`, `EMAIL_FROM` | any SMTP provider, for reminders and scraper alerts |
   | `OWNER_EMAIL` | scraper: gets flagged-row emails; contact in the bot's user agent |
   | `EXPO_ACCESS_TOKEN` | only if Expo enhanced push security is on |

3. The API runs `alembic upgrade head` on every start, so the schema (and Row Level Security
   on Supabase) is created on the first deploy.
4. **Load the card catalog once:** `card-wallet-api` → Shell →
   `uv run python -m app.catalog.tccp`
5. Check `https://<api>.onrender.com/health` returns `{"status":"ok",...}`.

## 3. Vercel (web app)

1. Vercel → Add New → Project → this repo. **Root Directory: `apps/web`** (Vercel installs the
   npm workspaces from the repo root automatically; `vercel.json` sets the rest).
2. Environment variables:
   - `VITE_API_URL` = the Render API URL
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` = from 1.1
3. Deploy, then:
   - put the Vercel URL in Render's `CORS_ORIGINS` and `WEB_APP_URL` (redeploy the API);
   - add `https://<your-vercel-url>/**` to Supabase → Authentication → Redirect URLs.

Preview deployments get their own URLs; add them to `CORS_ORIGINS` (comma-separated) and the
Supabase redirect list if you want sign-in to work on previews.

## 4. Mobile (Expo)

1. `cd apps/mobile && npx eas-cli init` (adds the EAS project id that push notifications need).
2. Set `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   (EAS environment variables or `apps/mobile/.env`).
3. Supabase redirect URLs: add `cardwallet://auth/callback` (and `exp://**` for Expo Go).
4. `npx eas-cli build --profile preview --platform ios` (or android) for a device build.

## 5. Scraper, first run

From the Render dashboard, trigger `card-wallet-scraper` manually with the command
`uv run --no-sync python -m scraper --fetch-only` to confirm all issuer pages are reachable,
then once with `--no-promote` and review `card_earn_rates_staging` before letting the weekly
schedule promote rates.

## 6. Smoke test

- Landing page loads; "Try the demo" shows the demo banner and sample recommendations.
- Card catalog lists ~650 cards with "CFPB TCCP" as the source.
- Continue with Google → back on `/app/cards` signed in; add a card with last 4 digits.
- Add an offer by typing and from a screenshot; it appears under Ending soon if due soon.
- `GET /me/cards` without a token returns 401.
