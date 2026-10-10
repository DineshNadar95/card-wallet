---
id: BUG-023
title: Compare's "+ Add a card" means "compare a third card" but reads like "add a card to my wallet"
status: proposed
severity: minor
area: web
screen: /app/compare (wallet mode)
reporter: ui-ux-expert
reviewer:
lead_note:
---

## Repro
1. Open http://localhost:5173/demo → Compare (desktop or 375px).
2. Read the control next to the two card pickers.

## Expected
Everywhere else "+ Add card" (`Wallet.dc.html`, `WebApp.dc.html` "My cards" panel, catalog "Add to wallet") adds a card to the wallet. `Compare.dc.html` has no such button: two card-coloured pickers "[Card A] / Change ▾", "[Card B] / Change ▾" and the "Only my cards" checkbox. If a third slot is offered, its label must say what it does: "+ Compare a third card" (and "Remove third card" instead of "Remove last").

## Actual
`Compare.tsx` `FromWallet`: `<button … className="btn btn-outline">+ Add a card</button>` adds a third comparison slot; `<button className="link-button">Remove last</button>` removes it. At 375px "+ Add a card" is the most prominent control on the screen (outlined, 44px) right under the second picker, so a new user expects the add-card flow.

## Evidence
- Screenshot of `/app/compare` at 375px (2026-10-10): "+ Add a card" next to the "Demo Card B •••• 5678" select.
- `apps/web/src/pages/Compare.tsx` lines with `+ Add a card` and `Remove last`.

## History
- 2026-10-10 ui-ux-expert: filed.
