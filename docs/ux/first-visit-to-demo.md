# Flow: first visit → demo

Who: someone who has never seen Card Wallet (recruiter, friend, reviewer). Goal: understand what
the product does and see every screen with sample data, without signing up.

Designs: `design/Landing.dc.html` (step 1), `design/WebApp.dc.html` (steps 2–3, desktop),
`design/Main.dc.html` (step 2 at phone width), then the per-screen designs listed in CLAUDE.md.

Walked on 2026-10-10 against `apps/web` at desktop and 375px, signed out, demo via
`http://localhost:5173/demo`.

## Steps

### 1. Landing `/` — `Landing.dc.html`
State: signed out. No data needed except the catalog count (`GET /catalog/cards?limit=1`).

Copy (exact, as built and as designed):
- Header: brand "Card Wallet"; nav "How it's built" (anchor `#how`), "Card catalog" (`/app/catalog`),
  "Sign in" (outlined, 44px). At < 600px the two text links are hidden; "Sign in" stays.
- Pill: "Free · works on phone and desktop"
- H1: "Know which card to use.⏎Never miss a coupon."
- Lede: "Add the cards you already own. Pick what you're buying, and Card Wallet tells you which
  card earns the most. Snap a photo of any offer or coupon and get reminded before it expires."
- CTAs: primary "Try the demo — no sign-up" (52px, accent) → `/demo`; secondary
  "Continue with Google" (52px, outlined) → Supabase OAuth, `next=/app/cards`.
- Fine print: "We never ask for card numbers or bank logins. Only the last 4 digits, so you can tell
  your cards apart."
- Phone mock (decorative, `aria-hidden`): "Which card should you use?", chips Dining/Groceries/
  Travel, "Best for dining / Demo Card A / 4x", "Demo Phone Co. · $100 off / 4 days left".
- Stats (built, not in design; keep): "{total} US cards in the catalog", "6 spending categories
  ranked", "Weekly rewards refresh from issuer pages". Falls back to "600+" while loading.
- `#how` cards: "Best card, per purchase" / "Offers & coupons, from a photo" / "Sourced, refreshed
  weekly" with the bodies from `Landing.dc.html`.
- Footer: "Fees and APRs: {source}. Reward rates from issuer pages, each shown with its source and
  date. Not financial advice." · "Card Wallet is a portfolio project. It never asks for card
  numbers or bank logins. · Privacy · Terms".

States:
- "Continue with Google" / "Sign in" are `disabled` with `title="Sign-in isn't configured yet (see
  README)"` when `VITE_SUPABASE_*` is unset. The demo CTA always works.
- No loading or error state for the catalog count: show "600+" until the number arrives; on error
  keep "600+".

What the user knows: what it does, that it's free, that it never asks for card numbers, and that
there are two doors (demo, Google).

### 2. "Try the demo" → `/demo` → `/app` — `WebApp.dc.html` / `Main.dc.html`
What changes: `sessionStorage["card-wallet.demo"]="1"`; every `/me/*` hook reads `/demo/*`
instead; `useIsDemo()` is true; the route replaces to `/app`.

Screen: Home with the demo banner at the top of the content column (desktop) or above the page
title (phone):
- Banner (`#FCEFE4` / `#8A3F0E`, `role="status"`): "**Demo mode** · sample cards and offers.
  Nothing you do here is saved." Actions: "Sign in to use your own cards" (starts Google OAuth,
  `next=/app/cards`) and "Exit demo".
- Sidebar account block: "Demo user / Sample data" + API status pill "API connected" /
  "API offline" / "Checking API…".
- Everything else is the Pick-a-card flow (`docs/ux/pick-a-card.md`) with Demo Card A–D.

Demo data (from `backend/app/routers/demo.py`): cards Demo Card A (Visa, •••• 1234, $95), B
(Mastercard, •••• 5678, $0), C (Visa, •••• 9012, $0), D (Mastercard, •••• 3456, $0); offers Demo
Bistro 10% back (A, ends in 3 days), Demo Phone Co. $100 off (coupon, 4 days), Demo Market 5x pts
(B, 6 days), Demo Clothing 25% (coupon, Nov 19), Dining credit $10 (A, card benefit), Demo
Hardware $15 off (D, expired).

### 3. Touring the demo (every screen must show sample data)
| Screen | Route | Design | Demo state as built | Gap |
|---|---|---|---|---|
| Home | `/app` | WebApp / Main | full data, chips work | reason text stacks two "Also:" clauses (BUG-022); "Ending soon" rows link to a dead-end gate (BUG-014); the dashed "+ Add offer or coupon · drop a screenshot" link is hidden in demo (BUG-013) |
| My cards | `/app/cards` | Wallet | "4 cards · 5 active offers", 4 cards with earn chips, add tile "Add from 661 US cards" | tile and "+ Add card" lead to a catalog with no add action (BUG-015) |
| Card detail | `/app/cards/1` | Card | art, Earns, 2 offers, Fees & rates, Compare | "+ Add" and "Remove card" hidden in demo (ok); no h1 (BUG-020); Compare ignores card (BUG-004) |
| Offers | `/app/offers` | Offers | 5 active, 3 ending soon, 1 expired; items are not links in demo | "+ Add offer" hidden in demo (BUG-013); "25% back" on a store coupon (BUG-021) |
| Add offer | `/app/offers/new` | AddOffer | gate only: "This is the demo / Demo data is read-only. Sign in with Google to add offers with your own cards. / Continue with Google" | the form is never shown in demo (BUG-013) |
| Catalog | `/app/catalog` | WebCatalog | 661 real cards, filters, compare tray | no "Add to wallet" per row in demo, sign-in panel is below 50 rows (BUG-015); first 50 rows all "Not checked yet" (BUG-025); 375px table cramped (BUG-024) |
| Compare | `/app/compare` | Compare | Demo Card A vs B, green winners, "+ Add a card" third slot | "+ Add a card" label (BUG-023); "Only my cards" no-op (BUG-003) |
| Privacy / Terms | `/privacy`, `/terms` | — | static pages, "Last updated October 9, 2026" | none |

### 4. Leaving the demo
- "Sign in to use your own cards" → Google → lands on `/app/cards` signed in; the demo flag is
  cleared on `SIGNED_IN` and `["me"]` queries are dropped so no sample data leaks into the real
  wallet.
- "Exit demo" → clears the flag and stays on the current route, which now shows the signed-out
  prompt ("Sign in to see your cards …"). Design: the banner's only link goes to
  `Landing.dc.html`. Spec: "Exit demo" should return to `/` (BUG-027).

## Required states (per screen, demo)
- Loading: Home shows the skeleton best-card block (`aria-busy`); lists show "Loading…" /
  "Loading your cards…" / "Loading cards…".
- Error: "Couldn't load your recommendation." / "Couldn't load your offers." / "Couldn't load
  your cards." / "Couldn't load the catalog. Is the API running?" — plain text, `.error`
  (`#A3261E`). No retry control on web (mobile: "Pull to retry.").
- Write attempt in demo: hooks throw `ApiError(403, "Demo mode is read-only. Sign in to save
  changes.")`; screens that can write render the gate instead of the form.

## Phone width (375px) notes
- Bottom tabs: Home · Cards · Offers · Compare (Catalog only in the sidebar / via links). Matches
  `Main.dc.html`.
- The demo banner wraps to ~100px tall on every screen (BUG-019).
- Home hides the side panels; "View card & offers" appears on the top pick. Matches `Main.dc.html`
  except the missing "Spending on" overline and scan placeholder (BUG-011).

## Open design questions for the lead
- Whether the demo should render the Add offer form read-only (BUG-013 proposes this) or keep the
  gate. The landing page sells "from a photo", so the demo should show it.
