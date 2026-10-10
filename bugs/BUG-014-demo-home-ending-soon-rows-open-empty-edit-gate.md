---
id: BUG-014
title: Demo: Home "Ending soon" rows open an empty "Edit offer" gate instead of the offer
status: proposed
severity: major
area: web
screen: /app → /app/offers/:id (demo mode)
reporter: ui-ux-expert
reviewer:
lead_note:
---

## Repro
1. Desktop width (the panel is hidden at 375px). Open http://localhost:5173/demo.
2. In the "Ending soon" panel click the row "Demo Bistro · 10% back".

## Expected
`WebApp.dc.html`: the "Ending soon" rows are plain rows and the panel's link is `All offers` → `Offers.dc.html`. On `/app/offers` in demo the same offers are deliberately rendered as non-link `<article>`s (`OfferItem` in `Offers.tsx`), so a row on Home should behave the same way: either go to `/app/offers` (the list, with the offer visible) or not be a link at all.

## Actual
The row is `<Link to="/app/offers/1">` regardless of demo, which renders `EditOffer` → `DemoGate`: "Edit offer / Cancel / This is the demo / Demo data is read-only. Sign in with Google to edit offers with your own cards. / Continue with Google". Nothing about Demo Bistro is shown; the only ways out are "Cancel" and the sidebar. A first-time visitor clicking the most urgent item on the home screen hits a dead end.

## Evidence
- Screenshot of `/app/offers/1` after the click (gate only).
- `apps/web/src/pages/Home.tsx` `SidePanels`: `<Link key={o.id} to={`/app/offers/${o.id}`} className="ending-row">` with no demo branch; `Offers.tsx` `OfferItem`: `return demo ? (<article …>) : (<Link …>)`.

## History
- 2026-10-10 ui-ux-expert: filed.
