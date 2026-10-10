---
id: BUG-007
title: Local SQLite: removing a card leaves its offers pointing at the deleted card, and they can no longer be edited
status: proposed
severity: minor
area: backend
screen: DELETE /me/cards/{id} → PATCH /me/offers/{id} (local SQLite from docs/LOCAL_TESTING.md)
reporter: testing-expert
reviewer:
lead_note:
---

## Repro
1. Local API on SQLite as in docs/LOCAL_TESTING.md, token for the test user.
2. Create an offer linked to one of your cards: `POST /me/offers {"user_card_id":6,"merchant":"Orphan test","kind":"amount_off","value":5,"expires_at":"2026-12-01"}` → id 11.
3. `DELETE /me/cards/6` → 204.
4. `GET /me/offers/11` and then `PATCH /me/offers/11 {"merchant":"Orphan test 2"}`.

## Expected
`offers.user_card_id` is declared `ForeignKey("user_cards.id", ondelete="SET NULL")` (`backend/app/db/models.py`, migration `938f276c5c87`): after the card is removed the offer should become a store coupon (`user_card_id: null`) and stay editable. That is what Postgres does.

## Actual
On SQLite the FK action is not applied (no `PRAGMA foreign_keys=ON` in `backend/app/db/session.py`), so the offer keeps `"user_card_id": 6` with `"card": null`. The PATCH then fails with `404 {"detail":"Card not in your wallet"}` because `_check_card` re-validates the stale id, so the user cannot save any change to that offer without first switching its card. Affects anyone testing with the local kit; production Postgres is not affected.

## Evidence
```
GET /me/offers/11 → {"id":11,"user_card_id":6,"card":null,...} [200]
PATCH /me/offers/11 {"merchant":"Orphan test 2"} → {"detail":"Card not in your wallet"} [404]
```
(Test rows deleted afterwards.)

## History
- 2026-10-10 testing-expert: filed.
