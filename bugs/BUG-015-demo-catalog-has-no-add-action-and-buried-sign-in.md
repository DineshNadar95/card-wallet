---
id: BUG-015
title: Demo: "+ Add card" and "Add from 661 US cards" lead to a catalog with no per-row add action; the sign-in prompt is below 50 rows
status: proposed
severity: major
area: web
screen: /app/cards, /app → /app/catalog (demo mode and signed out)
reporter: ui-ux-expert
reviewer:
lead_note:
---

## Repro
1. Desktop or 375px. Open http://localhost:5173/demo, go to "My cards".
2. Click "+ Add card" (header) or the dashed tile "Add from 661 US cards".
3. On the catalog, look for how to add a card.

## Repro (signed out, no demo)
Open http://localhost:5173/app/catalog directly from the landing's "Card catalog" link.

## Expected
`WebCatalog.dc.html`: every row ends with `+ Add to wallet` (or `In wallet`), 38px, accent outline. `Wallet.dc.html`'s tile promises "Search by name. Fees, APRs and base rewards fill in automatically." The next step after clicking "Add" must be visible on the first screen.

## Actual
`Catalog.tsx` renders the action button only `{session ? … : null}`. In demo and signed out the Actions column is empty for all 50 rows. The only hint is the panel "Sign in to add cards to your wallet. / Continue with Google", which is rendered **after** the table and pager, i.e. ~50 rows (several screens) below the fold. At 375px it is even further down. The user who clicked "Add card" sees a read-only table with no explanation.

Proposed: render "+ Add to wallet" on every row in demo/signed-out and have it open the existing sign-in prompt (web) — or show the "Sign in to add cards to your wallet" panel **above** the table when `!session`, and keep the button.

## Evidence
- Screenshot of `/app/catalog` in demo at desktop: Actions column blank; prompt not visible.
- `apps/web/src/pages/Catalog.tsx`: `{session ? (<button … >{count ? "Add another" : "Add to wallet"}</button>) : null}` and `{!session && (<div className="panel inline-prompt">…` placed after `.pager`.

## History
- 2026-10-10 ui-ux-expert: filed.
