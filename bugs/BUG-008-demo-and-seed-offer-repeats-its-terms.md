---
id: BUG-008
title: Demo and seed offer "Demo Bistro" shows its terms twice ("Spend $50+, up to $15 back · Spend $50+, up to $15 back")
status: proposed
severity: minor
area: backend
screen: /app/offers, /app/cards/1, /app (Ending soon) in demo mode; same for the seeded local wallet
reporter: testing-expert
reviewer:
lead_note:
---

## Repro
1. Open http://localhost:5173/demo, click "Offers & coupons".
2. Read the detail line of the first offer, "Demo Bistro".
3. Same on `/app/cards/1` under "Your offers on this card", and signed in as the local test user after `scripts/seed_demo.py`.

## Expected
Offers.dc.html shows one detail line per offer, e.g. "Spend $50+, up to $15 back".

## Actual
"Spend $50+, up to $15 back · Spend $50+, up to $15 back". The demo and seed rows set `min_spend=50`, `max_back=15` **and** `notes="Spend $50+, up to $15 back"`; `offerDetail()` in `packages/shared/src/format.ts` renders the structured fields and then appends the notes, so the same sentence appears twice.

## Evidence
- Page text from `/app/offers` (demo): "Demo Bistro / 10% back / Spend $50+, up to $15 back · Spend $50+, up to $15 back".
- `backend/app/routers/demo.py` `_OFFERS` row 1 and `backend/scripts/seed_demo.py` first offer dict.

## History
- 2026-10-10 testing-expert: filed.
