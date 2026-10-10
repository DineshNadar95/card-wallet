---
id: BUG-002
title: Several tap targets on the web app at phone width are under 44px
status: proposed
severity: major
area: web
screen: /app, /app/offers/new, /app/offers/:id, /app/cards/:id, /app/catalog, /app/compare (375px)
reporter: testing-expert
reviewer:
lead_note:
---

## Repro
1. Set the viewport to 375px wide (device toolbar). Open http://localhost:5173/demo.
2. On `/app` (Home): look at the demo-banner links "Sign in to use your own cards" / "Exit demo", the "All offers" and "+ Add card" links in the side panels, and the "change" link next to "Points valued at" (signed in only).
3. Open `/app/offers/new`: look at the "Cancel" link top right (same on `/app/offers/:id` when signed in).
4. Open `/app/cards/1`: look at the "+ Add" link next to "Your offers on this card" (signed in only).
5. Open `/app/catalog`: look at the "Compare" checkboxes, the filter chips, and (signed in) the "Add to wallet" buttons.
6. Open `/app/compare`: look at the "Only my cards" checkbox and "Remove last" link.

## Expected
CLAUDE.md, Design reference: "Touch targets ≥ 44px." AddOffer.dc.html uses a 44×44 close button in the header; Card.dc.html uses 44px for the back button.

Note for the lead: the design files themselves use some smaller controls (catalog filter chips 36px, segmented tabs 38–40px, 20px checkboxes, "+ Add" 36px), so spec and design disagree on those; the items below marked "*" are below both.

## Actual
Measured from `apps/web/src/styles.css` and the rendered page:
- `*` "Cancel" on Add/Edit offer: `<Link className="small strong">` with no min-height, 13px text (≈20px tall). Design has a 44px close button.
- `*` "All offers", "+ Add card" in the Home panels: `.panel-head a` has no min-height (≈20px).
- `*` `.link-button` controls are 32px min-height: "Sign in to use your own cards", "Exit demo", "change", "Retake or choose another", "Remove pin", "Clear" (compare tray), "Remove last".
- "+ Add" on card detail: `.section-head a` 36px (design: 36px).
- Catalog filter chips `.filter` 36px; "Add to wallet" `.btn-small` 36px (design: 36px / 38px).
- Segmented tabs `.seg-tabs button` 40px; category chips `.filter.cat` 40px (design: 38–40px).
- Compare checkboxes `.cmp-check` and "Only my cards" `.toggle input` 20×20 with no enlarged hit area (design: 20px).

## Evidence
- Screenshot at 375px of `/app/offers/new`: "Cancel" is a small text link.
- `apps/web/src/styles.css`: `.link-button { min-height: 32px }`, `.section-head a { min-height: 36px }`, `.filter { min-height: 36px }`, `.btn-small { min-height: 36px }`, `.seg-tabs button { min-height: 40px }`, `.cmp-check { width: 20px; height: 20px }`, `.panel-head a { text-decoration: none }` (no size).

## History
- 2026-10-10 testing-expert: filed.
