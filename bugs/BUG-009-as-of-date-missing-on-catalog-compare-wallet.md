---
id: BUG-009
title: Catalog, Compare and My cards show the fee source but not its as-of date
status: proposed
severity: minor
area: web
screen: /app/catalog, /app/compare, /app/cards
reporter: testing-expert
reviewer:
lead_note:
---

## Repro
1. Signed out, desktop width. Open http://localhost:5173/app/catalog and read the note under the table.
2. Open http://localhost:5173/app/compare?ids=418,419 and read the note under the comparison.
3. Open http://localhost:5173/demo → "My cards" and read the note at the bottom.

## Expected
CLAUDE.md Rule 4: "Every screen that shows card terms also shows their source and as-of date, plus 'Not financial advice.'" Each card carries `as_of` (e.g. `2025-12-31`), which `/app/cards/:id` already prints as "(as of 2025-12-31)".

Note for the lead: WebCatalog.dc.html, Compare.dc.html and Wallet.dc.html themselves only say "CFPB TCCP Jul–Dec 2025", so the spec and the design disagree on whether the survey period counts as the as-of date.

## Actual
- `/app/catalog`: "Fees & APRs: CFPB TCCP Jul–Dec 2025 · Reward rates not checked yet. Terms are as reported to the CFPB. Not financial advice."
- `/app/compare?ids=418,419`: "Green marks the better value at 1¢ a point. Terms: CFPB TCCP Jul–Dec 2025 · Reward rates not checked yet. Not financial advice."
- `/app/cards`: "Fees & APRs: Demo data (not real) · Rewards checked Oct 4, 2026 from issuer pages. Not financial advice."
None prints `as_of`. The mobile `(tabs)/cards.tsx`, `cards/add.tsx` and `(tabs)/compare.tsx` notes are the same (not run; from source).

## Evidence
- Page text captured from the three routes above.
- `apps/web/src/components/SourceNote.tsx` receives only `source`; `Catalog.tsx`, `MyCards.tsx`, `Compare.tsx` never pass `as_of`.

## History
- 2026-10-10 testing-expert: filed.
