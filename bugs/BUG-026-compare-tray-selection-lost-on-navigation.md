---
id: BUG-026
title: Catalog compare picks are lost on any navigation; "Change cards" on Compare returns to an empty tray
status: proposed
severity: minor
area: web
screen: /app/catalog ↔ /app/compare?ids=
reporter: ui-ux-expert
reviewer:
lead_note:
---

## Repro
1. Desktop. Open http://localhost:5173/app/catalog, tick two cards. Tray: "2 of 3 selected to compare · …".
2. Click "Compare side by side" (→ `/app/compare?ids=462,595`).
3. Click "Change cards".
4. Also: tick two cards, click "My cards" in the sidebar, come back.

## Expected
`WebCatalog.dc.html`: the tray reflects the current picks ("**2** of 3 selected to compare · [Card A], [Card B]"); the Compare screen is reached from it. "Change cards" implies the picks are kept so the user can swap one. Picks should survive navigation within the session.

## Actual
`picked` is `useState` inside `Catalog.tsx`. After "Change cards" the catalog loads with no checkboxes ticked and no tray; the user has to find both cards again (the first one may be on another page or behind a search). Leaving the catalog for any other route also clears the picks.

Proposed: keep the picks in the URL (`/app/catalog?compare=462,595`) or `sessionStorage`; "Change cards" links to `/app/catalog?compare={ids}`; the tray reads from that and rows with those ids render ticked (and highlighted `#F3F9F9` per the design).

## Evidence
- Walk on 2026-10-10: after step 3 the catalog showed no tray and no ticked rows.
- `apps/web/src/pages/Catalog.tsx`: `const [picked, setPicked] = useState<CardSummary[]>([]);`; `Compare.tsx`: `<Link to="/app/catalog">Change cards</Link>`.

## History
- 2026-10-10 ui-ux-expert: filed.
