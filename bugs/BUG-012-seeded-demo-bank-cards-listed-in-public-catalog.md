---
id: BUG-012
title: Local seed puts "Demo Bank" cards into the shared catalog, where they count as US cards and can be added to any wallet
status: proposed
severity: minor
area: backend
screen: scripts/seed_demo.py → /app/catalog, / (landing stats), /app/cards ("Add from N US cards")
reporter: testing-expert
reviewer:
lead_note:
---

## Repro
1. Follow docs/LOCAL_TESTING.md (`seed_demo.py` after the TCCP import).
2. Open http://localhost:5173/app/catalog and search `Demo`.
3. Look at the catalog count on the landing page and on "My cards" ("Add from 661 US cards").

## Expected
CLAUDE.md Rule 1: fake cards are for seeds and tests; the catalog is "Shared catalog (read-only to users)" imported from CFPB TCCP. A tester (or any signed-in local user) should not see made-up cards presented alongside real ones with real-looking fees, nor have them counted as US cards.

## Actual
`seed_demo.py` inserts four `Card` rows (issuer "Demo Bank", annual fee $95/$0, APR 20.24–28.24%, late fee $40) into `cards`. They appear in the catalog table like any other card (the only hint is the footer note, which shows `items[0].source` and so says "CFPB TCCP Jul–Dec 2025" whenever a real card is listed first), they can be added to a real wallet, and the total reads 661 instead of 657. The `/demo/*` endpoints do not need these rows (they build their data in memory), so the collision is avoidable.

## Evidence
- `curl -s 'localhost:8000/catalog/cards?q=Demo'` → `total: 4`, ids 658–661, issuer "Demo Bank".
- `curl -s 'localhost:8000/catalog/cards?limit=1'` → `total: 661`; README says the import loads "~657 cards".

## History
- 2026-10-10 testing-expert: filed.
