---
id: BUG-011
title: Home at phone width omits the "Spending on" label and the "Scan where I am · coming soon" placeholder from Main.dc.html
status: proposed
severity: minor
area: web
screen: /app at 375px (Main.dc.html)
reporter: testing-expert
reviewer:
lead_note:
---

## Repro
1. Viewport 375px. Open http://localhost:5173/demo (lands on `/app`).
2. Look above the category chips and at the top of the content.

## Expected
Main.dc.html (the mobile-width Home): a dashed "Scan where I am · coming soon" button at the top of `<main>`, then the uppercase overline "Spending on" above the chips, then the best card. (The mobile app renders both: `apps/mobile/src/app/(tabs)/index.tsx` has `ScanButton` and the "Spending on" overline.)

## Actual
The web Home at 375px goes straight from the title to the chips. "Spending on" exists only as `aria-label` on the chip group (`apps/web/src/pages/Home.tsx`), so it is not visible, and there is no scan placeholder. Whether the web needs the scan button (Phase 7 is mobile-only) is for the lead to decide; the label is a plain copy gap.

## Evidence
- Screenshot of `/app` at 375px in demo mode: "Good morning / Which card should you use? / [Dining] [Groceries] …" with nothing between title and chips.

## History
- 2026-10-10 testing-expert: filed.
