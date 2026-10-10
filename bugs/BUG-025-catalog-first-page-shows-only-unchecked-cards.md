---
id: BUG-025
title: Catalog's first page is 50 alphabetical cards with "Not checked yet" in every rewards cell
status: proposed
severity: minor
area: web
screen: /app/catalog (default state)
reporter: ui-ux-expert
reviewer:
lead_note:
---

## Repro
1. Open http://localhost:5173/app/catalog with no search or filter (desktop).
2. Read the "Top earn rate" and "Rewards checked" columns on page 1 (and 2).

## Expected
`WebCatalog.dc.html`: every visible row has a top earn rate ("**4x** on dining") and "[date] · source". The sub-title promises "rewards refreshed every Sunday". A first-time visitor should see at least some cards with rewards on the first screen, or be told why the cells are empty and how to find checked cards.

## Actual
The default order is alphabetical, so the first 50 of 661 rows are "14.9% Share Secured Visa", "3Rivers Mastercard Credit Card", "9.9% Share Secured Visa", "AAA Daily Advantage …" — all "Not checked yet" / "—". Only ~30 cards are scraped (CLAUDE.md Phase 5), and none of them is on page 1. There is no filter for "rewards checked" and the empty cell doesn't explain itself. The visitor concludes the rewards feature is empty.

Proposed (lead to pick one): sort cards with `earn_rates` first by default; or add a filter chip "Rewards checked" next to "Credit score: 720+"; or make "Not checked yet" a tooltip/line "Read from issuer pages weekly; not on the list yet". Spec vs design: CLAUDE.md doesn't fix an order.

## Evidence
- Page text of `/app/catalog` (2026-10-10): 50 rows, each ending "Not checked yet · —".
- `GET /catalog/cards?limit=50` default ordering in `backend/app/routers/catalog.py` (alphabetical by name).

## History
- 2026-10-10 ui-ux-expert: filed.
