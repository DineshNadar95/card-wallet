---
id: BUG-010
title: Earn rates on Card detail, My cards, Home and Compare show a date but never link to their source URL
status: proposed
severity: minor
area: web
screen: /app/cards/:id, /app/cards, /app, /app/compare
reporter: testing-expert
reviewer:
lead_note:
---

## Repro
1. Open http://localhost:5173/demo → "My cards" → "Demo Card A" (`/app/cards/1`).
2. Look at the "Earns" list (Dining 4x, Travel 3x, …) and the note under "Fees & rates".
3. Compare with `/app/catalog`, whose "Rewards checked" column links each card's top rate to `source_url`.

## Expected
CLAUDE.md Rule 1: "Every real number needs a source URL and a date." Each `card_earn_rates` row carries `source_url` and `checked_at`, and the API returns both on every rate (`EarnRateOut`). The screens that show the rates should let the user reach the issuer page they were read from, as the catalog does.

## Actual
Card detail prints "Rewards checked Oct 4, 2026 from issuer pages" with no link; the only link on the page is "CFPB source data" (the fee source). My cards, Home and Compare print the same sentence with no link. `source_url` is never rendered outside `Catalog.tsx`. Mobile screens are the same (from source).

## Evidence
- Page text of `/app/cards/1` in demo: links present: "← My cards", "CFPB source data", "Compare" only.
- `GET /demo/cards/1` → each `earn_rates[].source_url` = `https://card-wallet.example/demo`; `GET /me/cards/1` (seeded) → `https://demo-bank.test/cards`.

## History
- 2026-10-10 testing-expert: filed.
