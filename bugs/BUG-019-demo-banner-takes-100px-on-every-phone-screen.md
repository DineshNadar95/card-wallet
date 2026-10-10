---
id: BUG-019
title: At 375px the demo banner wraps to ~100px and sits above every screen
status: proposed
severity: minor
area: web
screen: /app/* at 375px (demo mode)
reporter: ui-ux-expert
reviewer:
lead_note:
---

## Repro
1. Viewport 375px. Open http://localhost:5173/demo, then any tab.

## Expected
`WebApp.dc.html` (the only design with the banner) shows a single 38px line: "**Demo mode** · sample cards and offers. Nothing you do here is saved." with one link "Sign in to use your own cards" on the right. The phone designs (`Main.dc.html`, `Wallet.dc.html`, `Offers.dc.html`, `Compare.dc.html`) have no banner at all; their header is the H1. At phone width the banner should cost at most one 44px line.

## Actual
`.demo-banner` wraps (`flex-wrap: wrap`) into a two-line sentence plus a third line with "Sign in to use your own cards" and "Exit demo" (both underlined 13px link-buttons), ≈100 CSS px tall, on every screen. On Compare and Card detail it pushes the H1 / card art below the first 100px; on Home the chips start a third of the way down.

Proposed phone variant: one line, 44px min-height: "Demo · nothing is saved" + a single right-aligned link "Sign in"; keep "Exit demo" in the sidebar/account area only, or fold it into the same link row with smaller gap.

## Evidence
- Screenshots of `/app/compare` and `/app/cards/1` at 375px: banner occupies the top ~200px of the 2× screenshot (≈100 CSS px).
- `apps/web/src/styles.css` `.demo-banner { … flex-wrap: wrap }`, `.demo-actions { gap: 16px }`, `@media (max-width: 767px) { .demo-banner { … } }`.

## History
- 2026-10-10 ui-ux-expert: filed.
