---
id: BUG-004
title: Card detail "Compare" button ignores the card you came from
status: proposed
severity: minor
area: web
screen: /app/cards/:id → /app/compare
reporter: testing-expert
reviewer:
lead_note:
---

## Repro
1. Desktop or 375px. Open http://localhost:5173/demo, go to "My cards", open "Demo Card C" (`/app/cards/3`).
2. Click the "Compare" button under "Fees & rates".

## Expected
Card.dc.html links the card's "Compare" action to the Compare screen for that card; a user expects Demo Card C to be one of the compared cards.

## Actual
The link is `/app/compare?ids=3` (a catalog id, and only one of them). `parseIds` yields a single id, so `onlyMine` is true and the screen shows the wallet's first two cards (Demo Card A and Demo Card B). Demo Card C is not selected. Same behaviour signed in. (`apps/mobile/src/app/cards/[id].tsx` also just pushes `/compare` with no card.)

## Evidence
- `apps/web/src/pages/CardDetail.tsx`: `<Link to={`/app/compare?ids=${c.id}`} …>Compare</Link>`
- `apps/web/src/pages/Compare.tsx`: `const onlyMine = ids.length < 2;`

## History
- 2026-10-10 testing-expert: filed.
