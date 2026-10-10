---
id: BUG-001
title: Demo mode marks real catalog cards as "In wallet" because demo card ids collide with catalog ids
status: proposed
severity: major
area: web
screen: /app/catalog (demo mode)
reporter: testing-expert
reviewer:
lead_note:
---

## Repro
1. Desktop width, signed out. Open http://localhost:5173/demo (lands on `/app` with the demo banner).
2. Click "Card catalog" in the sidebar.
3. In "Search card or issuer" type `Platinum Visa Card with` (this is catalog card id 1, a real CFPB card from "1st Community Federal Credit Union").
4. Look at the row.

## Expected
The demo wallet holds only "Demo Card A".."D" from "Demo Bank" (`backend/app/routers/demo.py`, CLAUDE.md Rule 1: "Seeds and tests use fake cards"). No real card should be shown as owned. WebCatalog.dc.html shows "In wallet" only on cards the user actually owns, and the row background `#F3F9F9` only for those.

## Actual
The real card "Platinum Visa Card with and without Rewards." (1st Community Federal Credit Union) is rendered with the highlighted "owned" row background and the green "In wallet" label. The same happens for catalog ids 2, 3 and 4 (e.g. "3Rivers Mastercard Credit Card" on the first page is not affected only because its id is not 1–4; any card whose catalog id is 1–4 is affected).

Cause (for context, not a fix): `GET /demo/cards` returns `card_id` 1..4 for the fake cards, and `apps/web/src/pages/Catalog.tsx` builds `owned` from `useMyCards()` (which in demo mode reads `/demo/cards`) keyed by `card_id`, then matches against real catalog ids.

## Evidence
- Screenshot of the catalog in demo mode after searching: row shows "In wallet" on "Platinum Visa Card with and without Rewards.".
- `curl -s 'http://localhost:8000/demo/cards' | jq '.[].card_id'` → `1 2 3 4`
- `curl -s 'http://localhost:8000/catalog/cards/1' | jq .name` → `"Platinum Visa Card with and without Rewards."`

## History
- 2026-10-10 testing-expert: filed.
