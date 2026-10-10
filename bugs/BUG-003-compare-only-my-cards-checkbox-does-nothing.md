---
id: BUG-003
title: Compare: unticking "Only my cards" does nothing
status: proposed
severity: minor
area: web
screen: /app/compare
reporter: testing-expert
reviewer:
lead_note:
---

## Repro
1. Desktop width. Open http://localhost:5173/demo, then click "Compare" in the sidebar (same when signed in with ≥2 cards).
2. "Only my cards" is ticked and the wallet comparison shows.
3. Click the "Only my cards" checkbox to untick it.

## Expected
Compare.dc.html has "Only my cards" as a working toggle (`onChange="{{flip}}"`): unticking it should switch away from the wallet view (e.g. to the "Pick cards to compare" / catalog mode), and the checkbox state should change.

## Actual
Nothing happens: the box stays ticked and the view is unchanged. The control reacts only to being ticked (`onChange={(e) => (e.target.checked ? setParams({}) : undefined)}` in `apps/web/src/pages/Compare.tsx`), and when there are no `ids` in the URL it is already ticked, so it is a no-op.

## Evidence
- Zoomed screenshot after clicking: checkbox still ticked, wallet pickers still shown, URL unchanged (`/app/compare`).

## History
- 2026-10-10 testing-expert: filed.
