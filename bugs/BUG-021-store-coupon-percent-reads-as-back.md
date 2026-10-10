---
id: BUG-021
title: A store coupon with a percent value reads "25% back" (design: "25% off")
status: proposed
severity: minor
area: shared
screen: /app/offers, /app (Ending soon), mobile Offers tab
reporter: ui-ux-expert
reviewer:
lead_note:
---

## Repro
1. Open http://localhost:5173/demo → "Offers & coupons".
2. Read the "Demo Clothing" item (Coupon · no card).

## Expected
`Offers.dc.html` wording: card-linked offers are "10% back" / "5x pts"; store coupons are "$100 off" and "25% off" ("[Clothing store] · 25% off · In-store or online, one use · Coupon · no card"). "Back" means cash back on a card; a coupon takes money off the price.

## Actual
"Demo Clothing / 25% back / In-store or online, one use / Coupon · no card · Ends Nov 19, 2026 / Typed". `offerValue()` in `packages/shared/src/format.ts` maps `percent_back` to `"{n}% back"` without looking at `card`/`user_card_id`. The same wording appears in Home's "Ending soon" and in the reminder email (`value_text` in `backend/app/jobs/reminders.py`).

Proposed: when `user_card_id` is null, render `percent_back` as "{n}% off" (web, mobile, email). In the form, the "% back" chip could read "% off" while "No card — store coupon" is selected; `AddOffer.dc.html` keeps the fixed label "% back", so that part is the lead's call.

## Evidence
- Page text of `/app/offers` (demo): "Demo Clothing · 25% back · … Coupon · no card".
- `packages/shared/src/format.ts` `offerValue`: `case "percent_back": return `${num(o.value ?? 0)}% back`;`

## History
- 2026-10-10 ui-ux-expert: filed.
