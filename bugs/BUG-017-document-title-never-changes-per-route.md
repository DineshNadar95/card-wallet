---
id: BUG-017
title: The page <title> is "Card Wallet" on every route, so route changes are silent for screen readers and tabs/history are indistinguishable
status: proposed
severity: major
area: web
screen: all web routes
reporter: ui-ux-expert
reviewer:
lead_note:
---

## Repro
1. Open http://localhost:5173/, then /app, /app/cards, /app/cards/1, /app/offers, /app/offers/new, /app/catalog, /app/compare, /privacy.
2. Read the browser tab title each time, or use a screen reader and navigate with the sidebar/tabs.

## Expected
Each design file sets its own title: `Card Wallet · Landing`, `Card Wallet · Web home`, `Card Wallet · My cards`, `Card Wallet · Card detail`, `Card Wallet · My offers`, `Card Wallet · Add offer`, `Card Wallet · Catalog`, `Card Wallet · Compare`. In a single-page app the document title is what assistive tech announces on navigation and what history/tab lists show. Expected titles (screen first, as the designs' H1s): "Which card should you use? · Card Wallet", "My cards · Card Wallet", "{Card name} · Card Wallet", "Offers & coupons · Card Wallet", "Add an offer · Card Wallet", "Edit offer · Card Wallet", "Card catalog · Card Wallet", "Compare · Card Wallet", "Privacy policy · Card Wallet", "Terms of service · Card Wallet".

## Actual
`apps/web/index.html` has a static `<title>Card Wallet</title>`; no component sets `document.title` (grep for `document.title` / `<title` in `apps/web/src` returns nothing). Every screenshot taken during the review shows the tab as "Card Wallet". Also nothing moves focus or announces the new page on route change; with per-route titles, a small `useEffect` that sets the title (and optionally focuses the `h1`) covers both.

## Evidence
- `grep -rn "document.title\|<title" apps/web/src` → no matches; `apps/web/index.html:7: <title>Card Wallet</title>`.
- Tab context during the review: every route reported as `"Card Wallet"`.

## History
- 2026-10-10 ui-ux-expert: filed.
