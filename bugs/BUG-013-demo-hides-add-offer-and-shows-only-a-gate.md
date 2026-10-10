---
id: BUG-013
title: Demo hides every "Add offer" entry point and /app/offers/new shows only a gate, so the photo flow can't be seen in the demo
status: proposed
severity: major
area: web
screen: /app, /app/offers, /app/cards/:id, /app/offers/new (demo mode)
reporter: ui-ux-expert
reviewer:
lead_note:
---

## Repro
1. Desktop or 375px, signed out. Open http://localhost:5173/demo (lands on `/app`).
2. Look for a way to add an offer: Home's "Ending soon" panel, `/app/offers` header, `/app/cards/1` "Your offers on this card".
3. Type http://localhost:5173/app/offers/new by hand.

## Expected
- `WebApp.dc.html` shows the demo banner **and** the dashed link `+ Add offer or coupon · drop a screenshot` in the "Ending soon" panel; `Offers.dc.html` has the header button `Add offer`; `Card.dc.html` has `+ Add` next to "Your offers on this card".
- `AddOffer.dc.html` is the screen behind them: tabs "From a photo" / "Type it in", the photo card "Read 5 details from your screenshot / Check them below before saving — photos can be misread.", the prefilled form with "From screenshot" badges, "Remind me before it ends", "Save offer".
- CLAUDE.md: "The landing page and a no-sign-up demo mode are first-class features", and the landing sells "Offers & coupons, from a photo". A first-time visitor should be able to see that screen in the demo.

## Actual
- In demo, `Home.tsx`, `Offers.tsx` and `CardDetail.tsx` render the add links only when `!demo`, so there is no visible way to reach the screen.
- `/app/offers/new` in demo renders `DemoGate` only: "Add an offer / Cancel / This is the demo / Demo data is read-only. Sign in with Google to add offers with your own cards. / Continue with Google". No tabs, no photo card, no form.
- Same for `/app/offers/:id` ("Edit offer").

Proposed design for the demo state (spec: `docs/ux/add-offer-from-photo.md`, "Demo state"): keep the entry points visible; on `/app/offers/new` render the "From a photo" tab with the design's `[shot]` placeholder thumbnail, the line "Read 5 details from your screenshot", the form prefilled with the Demo Bistro values and badges, all inputs `readOnly`, and replace "Save offer" with "Sign in to save this offer" (→ Google) plus the gate's one-line note above it.

## Evidence
- Screenshot of `/app/offers/new` in demo: only the gate panel.
- `apps/web/src/pages/Home.tsx` (`{!demo && <Link to="/app/offers/new" className="dashed-link">`), `Offers.tsx` (`{!demo && (<Link to="/app/offers/new" …>+ Add offer`), `CardDetail.tsx` (`{!demo && (<Link to={`/app/offers/new?card=…`}`), `AddOffer.tsx` (`<DemoGate what="add offers">`).

## History
- 2026-10-10 ui-ux-expert: filed.
