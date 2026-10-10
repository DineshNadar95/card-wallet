---
id: BUG-024
title: Catalog at 375px is a three-column table where names wrap to four lines and three cards fit a screen
status: proposed
severity: minor
area: web
screen: /app/catalog at 375px
reporter: ui-ux-expert
reviewer:
lead_note:
---

## Repro
1. Viewport 375px. Open http://localhost:5173/app/catalog.
2. Scroll the table.

## Expected
There is no phone design for the catalog (`WebCatalog.dc.html` is 1440px), but the product has a phone pattern for the same job: the mobile "Add a card" list (`apps/mobile/src/app/cards/add.tsx`): one 60px row per card — art swatch · name / issuer · annual fee on the right — and `Wallet.dc.html`'s card rows. CLAUDE.md: "On a phone browser it must look and feel like the app".

## Actual
Below 768px the `.wide` columns hide, leaving Compare · Card · Annual fee. The Card cell keeps the 44×28 art swatch beside a 110px text column, so "14.9% Share Secured Visa / Mid American Credit Union" wraps to 5 lines; each row is ~170 CSS px and only three rows fit between the filters and the bottom tabs. The "Rewards checked" and "Top earn rate" columns (the point of the catalog) are not shown at all at this width.

Proposed: below 768px render list rows (art · name / issuer · "$0 · 4x on dining" on one secondary line · annual fee right), with the compare checkbox as a 44px tap area at the row's start and "Add to wallet" as the row's action; keep the table ≥ 768px.

## Evidence
- Screenshot of `/app/catalog` at 375px (2026-10-10): three rows visible.
- `apps/web/src/styles.css` `@media (max-width: 767px) { .catalog .wide { display: none } }` (the `.wide` columns), `.card-cell .art { width: 44px }`.

## History
- 2026-10-10 ui-ux-expert: filed.
