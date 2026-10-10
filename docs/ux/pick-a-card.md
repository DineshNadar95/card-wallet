# Flow: pick a card (Home categories)

The one question the product answers. Who: a signed-in user (or demo visitor) about to pay.
Goal: in one tap, know which of their own cards to use for this purchase, and why.

Designs: `design/WebApp.dc.html` (≥ 768px), `design/Main.dc.html` (< 768px and the mobile app).
Data: `GET /me/recommend?category=` (`/demo/recommend` in demo). Walked in demo at desktop and
375px on 2026-10-10.

## Screen: Home `/app` (web), `(tabs)/index` (mobile)

### Header
- Greeting (13px, secondary): "Good morning" / "Good afternoon" / "Good evening", plus
  ", {first name}" when signed in. (Design: "Good evening, [Name]" on Main; none on WebApp.)
- H1: "Which card should you use?"

### Step 1 — choose what you're buying
- Phone / mobile app: overline "SPENDING ON" (12px, 600, uppercase, letter-spacing 0.05em) above a
  horizontally scrolling chip row. Web at 375px currently has the label only as `aria-label`
  (BUG-011).
- Chips (`button`, `aria-pressed`, 40px, pill): "Dining", "Groceries", "Travel", "Gas", "Online",
  "Everything else". Selected: border `#0B6E73`, background `#E6F1F1`, text `#084F53`.
- Default: Dining. Web keeps the choice in the URL (`?for=groceries`, `replace`) so back/forward
  and reload keep it; mobile keeps it in state.
- Phone design also has a dashed "Scan where I am · coming soon" button above the chips; the
  mobile app ships a working "Scan where I am" (→ `/scan`); web has neither (BUG-011, lead to
  decide if web needs it).

What changes: the recommendation query re-runs; the best-card block swaps colour to the winning
card's art (`cardArt(card_id)`), "Best for {x}" updates.

### Step 2 — read the answer
Best card block (`section aria-label="Best card"`, 18px radius, white text on card art):
- Row 1: "Best for {dining | groceries | travel | gas | online shopping | everyday spend}" ·
  pill "Top pick".
- Row 2: card name (nickname if set) 26px/20px bold; "{issuer} · •••• {last4}" (issuer only when
  no last4). Right: rate "4x" / "6%" (44px desktop, 30px phone) and the unit line
  "points on dining" / "cash back on groceries" / "miles on travel" / "… on everything".
- Row 3: reason box (translucent white): the API's `reason`. Design copy is one clause, e.g.
  "Also: your [Merchant 1] offer gives 10% back, ends in 3 days" or "Up to [$6,000] a year, then
  1%". As built the demo reason reads "4x points on dining (≈4¢ per $1 at 1¢ a point) · Also:
  your Demo Bistro offer gives 10% back, ends in 3 days · Also: your Dining credit offer gives
  $10 off" — three clauses (BUG-022).
- Phone only: full-width white button "View card & offers" → `/app/cards/{user_card_id}`.

"Other good options" (overline, then up to 2 rows): art stripe · name · reason (13px secondary)
· rate (20px desktop / 16px phone, `#084F53`). Rows link to the card. Web desktop lays the two
side by side; phone stacks them. Design matches.

Source note (12px secondary, always present — Rule 4):
"Rewards checked {Oct 4, 2026} from issuer pages · Fees: CFPB TCCP · Points valued at 1¢
(change) · Not financial advice." When no rate has a `checked_at`: "Rewards from issuer pages,
checked weekly". "change" is omitted in demo. The hard-coded sources are wrong for demo data
(BUG-005) and rates never link to their `source_url` (BUG-010).

### Desktop side column (`WebApp.dc.html`)
- Panel "Ending soon" · link "All offers" → `/app/offers?tab=ending_soon` (built: `/app/offers`,
  which opens the Active tab — small gap, noted here, not filed). Up to 4 rows: "{merchant} ·
  {value}" / "{card} •••• 1234" or "Coupon · no card" / right "Ends in 3 days" (urgent red; the
  design greys non-urgent dates). Empty: "Nothing ends in the next week." Rows link to
  `/app/offers/{id}` (edit); in demo that is a dead end (BUG-014).
- Dashed link "+ Add offer or coupon · drop a screenshot" → `/app/offers/new`. Hidden in demo
  (BUG-013).
- Panel "My cards" · "+ Add card" → `/app/catalog`; 2×2 mini cards (name / •••• last4) linking to
  card detail. Empty: "No cards yet."

## States
| State | Trigger | Screen |
|---|---|---|
| Loading | query pending | grey skeleton block the size of the best card, `aria-busy="true"`; chips stay interactive |
| Error | query error | "Couldn't load your recommendation." (mobile adds "Pull to retry.") — no retry button on web; propose a "Try again" link-button that calls `refetch()` |
| No cards | `picks.length === 0` | panel "Add the cards you own" / "Pick from 600+ US cards. Then we'll tell you which one to use for each purchase." / button "Add a card" → `/app/catalog` (mobile → `/cards/add`) |
| Cards but no rates | best pick has `effective_cents == null` | panel "No reward rates on file yet" / "We read each card's earn rates from the issuer's own page every Sunday. Your cards haven't been checked yet, so we can't rank them. Fees and APRs are on each card's page." — nothing else is shown, including the chips' effect; propose still listing the cards as "Other good options" with "—" so the chips feel alive |
| One card | 1 pick | best card only, no "Other good options" heading |
| Demo | `useIsDemo()` | banner at top; "change" hidden; everything else identical |
| Signed out | no session, no demo | `RequireAuth` prompt replaces the body; the H1 stays |

## Accessibility
- Chips are real buttons with `aria-pressed`; group has `aria-label="Spending on"`.
- The best card is a landmark `section[aria-label="Best card"]`; the rate and unit are plain
  text so screen readers read "4x points on dining".
- Colour is never the only signal: "Top pick" pill + position + the "Best for" label.
- Keyboard: focus ring is the browser default (verified visible). Tab order: banner links → chips
  → "View card & offers" → other options → source note "change".

## Mobile app (from source, `apps/mobile/src/app/(tabs)/index.tsx`)
Matches `Main.dc.html` including "Spending on", "Scan where I am", "View card & offers" and
"Other good options". Source note has "(change)" → `/settings`. Pull-to-refresh on the scroll
view. Signed-out: `SignInCard` with the wallet copy.
