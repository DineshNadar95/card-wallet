---
id: BUG-006
title: POST /me/offers accepts a merchant made of whitespace
status: proposed
severity: minor
area: backend
screen: POST /me/offers, PATCH /me/offers/{id}
reporter: testing-expert
reviewer:
lead_note:
---

## Repro
1. Start the local API (see docs/LOCAL_TESTING.md) and mint a token with `scripts/dev_session.py`.
2. `curl -s -X POST localhost:8000/me/offers -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"merchant":"   ","kind":"amount_off","value":5}'`

## Expected
CLAUDE.md data model: `offers.merchant` is the offer's identifying field; the web and mobile forms refuse an empty merchant ("Add the merchant or store", `packages/shared/src/offerForm.ts`). The API should refuse it too (422), since the API is the only layer every client shares.

## Actual
`201 Created` with `"merchant": "   "`. `_OfferFields.merchant = Field(min_length=1, …)` counts the spaces. The offer then shows as a blank title on `/app/offers` and in reminder emails (`offer_line` starts with `o.merchant`).

## Evidence
```
{"id":10,"user_card_id":null,"card":null,"merchant":"   ","kind":"amount_off","value":5.0,...,"status":"active"} [201]
```
(Test row deleted afterwards.)

## History
- 2026-10-10 testing-expert: filed.
