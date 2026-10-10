---
id: BUG-022
title: Top-pick reason stacks the rate math and two "Also:" clauses into one 3-line sentence
status: proposed
severity: minor
area: backend
screen: /app (Home) best card, mobile Home; GET /me/recommend reason text
reporter: ui-ux-expert
reviewer:
lead_note:
---

## Repro
1. Open http://localhost:5173/demo (Dining selected), desktop or 375px.
2. Read the reason box inside the green "Best for dining" card.

## Expected
`WebApp.dc.html` / `Main.dc.html`: the reason is one short clause, e.g. "Also: your [Merchant 1] offer gives 10% back, ends in 3 days", "Up to [$6,000] a year, then 1%", "No foreign transaction fee on this card". The rate itself is already the big number ("4x · points on dining") and the point value is already in the source note ("Points valued at 1¢"), so the reason should add only the one most useful fact.

## Actual
"4x points on dining (≈4¢ per $1 at 1¢ a point) · Also: your Demo Bistro offer gives 10% back, ends in 3 days · Also: your Dining credit offer gives $10 off" — three clauses, 13px, four lines at 375px. "Also:" appears twice. The "Other good options" reasons have the same pattern ("No dining bonus · 2x miles on everything (≈2¢ per $1 at 1¢ a mile)").

Note for the lead: CLAUDE.md asks the recommender to "show [caps and conditions] in the reason text" and to "mention" a matching offer, so the content is per spec; the design asks for one clause. Proposed: keep the cap/condition sentence when present; drop the "(≈4¢ per $1 …)" parenthetical from the top pick (keep it for the alternatives only if the units differ); merge several offers into one clause: "Also: 2 offers on this card — Demo Bistro 10% back (3 days), Dining credit $10 off".

## Evidence
- Page text of `/app` in demo (2026-10-10), quoted above.
- `GET /demo/recommend?category=dining` → `picks[0].reason` is built in `backend/app/recommend.py` (pure module); `apps/web/src/pages/Home.tsx` renders `pick.reason` verbatim.

## History
- 2026-10-10 ui-ux-expert: filed.
