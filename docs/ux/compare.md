# Flow: compare

Who: a user deciding between two or three cards: their own (should I keep paying $95 for Card A?)
or catalog cards they're curious about. Goal: see rewards, fees and offers side by side with the
better value highlighted.

Designs: `design/Compare.dc.html` (phone: two card-coloured "Change ▾" pickers, "Only my cards"
checkbox, rows Rewards / Fees & rates / Your offers, green winner `#1F6B3A` on `#E7F4EC`),
`design/WebCatalog.dc.html` (tray "{n} of 3 selected to compare · names" → "Compare side by
side"), `design/Card.dc.html` ("Compare" button). Walked in demo at desktop and 375px on
2026-10-10.

## Two ways in

### A. From my wallet — `/app/compare` (web), `(tabs)/compare` (mobile)
Default when the URL has fewer than two `ids`. Needs a session or demo.
- Title "Compare"; right: checkbox "Only my cards" (checked).
- Two pickers (web: `<select>` with sr-only labels "Card 1" / "Card 2", options
  "{name} •••• {last4}", the other slot's card disabled; design: card-coloured buttons
  "[Card A] / Change ▾"). Defaults: the first two wallet cards.
- "+ Add a card" (outline) adds a third slot while < 3 and wallet has more cards; "Remove last"
  (link-button) removes it. Label collides with "add a card to the wallet" (BUG-023).
- Mobile: chips "Pick 2 or 3 of your cards" (checkbox role); tapping a fourth replaces the
  oldest.
- Fewer than 2 cards: panel "Add at least two cards to compare" / "Browse the catalog"
  (mobile: "Add a card").

### B. From the catalog — `/app/compare?ids=1,2[,3]`
- Catalog: tick "Compare {name}" checkboxes (max 3; the 4th is disabled). The tray appears,
  sticky at the bottom: "**{n}** of 3 selected to compare · {names}" · "Clear" · "Compare side by
  side" (or "Pick one more" while n = 1).
- Compare screen shows "Comparing cards from the catalog. Change cards" above the table;
  "Only my cards" is unchecked (and disabled when there is no session/demo). "Change cards" →
  `/app/catalog` with the tray empty — the picks were component state (BUG-026).
- Signed-out `/app/compare` with no ids: panel "Pick cards to compare" / "Tick up to three cards
  in the catalog, then choose “Compare side by side”." / "Open the catalog".
- Card detail "Compare" → `/app/compare?ids={catalog id}` which, with one id, falls back to the
  wallet's first two cards (BUG-004). Expected: the wallet view with this card in slot 1.

## The table (both ways) — `Compare.dc.html`
Header row: a card-art block per column: name (bold) · issuer. Then:
- "REWARDS": one row per category (Dining, Groceries, Travel, Gas, Online, Everything else) with
  each card's rate ("4x", "6%", "1% (base)" when the card has no category bonus, "Not checked
  yet" when no rates at all). Winner by effective cents at the user's point value.
- "FEES & RATES": Annual fee, Foreign transaction fee, Purchase APR (no winner for ranges).
- "YOUR OFFERS": "Active offers" count per card (wallet mode only).
Winner cell: `#E7F4EC` background, `#1F6B3A` text, plus sr-only " (better value)". Ties: no
highlight.
Footer: "Green marks the better value at {1}¢ a point. Terms: {source} · Rewards checked {date}
| Reward rates not checked yet. Not financial advice." (`as_of` missing: BUG-009).

Semantics: `role="table"` with `row` / `columnheader` / `rowheader` / `cell` on divs; the
section labels are rows with a single rowheader. Works with screen readers; keep.

## States
| State | Copy |
|---|---|
| Loading (either source) | "Loading…" |
| Catalog ids fail | "Couldn't load those cards." |
| Wallet < 2 cards | "Add at least two cards to compare" + CTA |
| Unticking "Only my cards" | nothing happens (BUG-003). Expected: switch to the catalog prompt ("Pick cards to compare") |
| Demo | wallet mode with Demo Card A/B; catalog mode works too |

## Phone width (375px)
Two stacked selects + "+ Add a card", then the two card headers side by side and the rows.
Readable; the design's single header with two coloured picker buttons is tighter and keeps the
pickers and the columns aligned — implement the design's header when BUG-023 is picked up.

## What the user learns and what next
No action is offered after comparing (e.g. "Remove Card A" or "Add Card B to wallet"). Card
headers could link to card detail (wallet mode) or open the add dialog (catalog mode, signed
in). Suggestion only; the design has no such links.
