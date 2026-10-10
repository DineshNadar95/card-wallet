---
id: BUG-020
title: Card detail has no page heading; the card name is only inside the decorative card art
status: proposed
severity: minor
area: web
screen: /app/cards/:id
reporter: ui-ux-expert
reviewer:
lead_note:
---

## Repro
1. Open http://localhost:5173/demo → My cards → Demo Card A (`/app/cards/1`), desktop or 375px.
2. Inspect headings (or use a screen reader's heading list).

## Expected
`Card.dc.html`: a header bar with a 44×44 "Back to my cards" button (`aria-label`) and `<h1>[Card A]</h1>`; the card art below repeats the name visually. Every other screen in the app has a `.page-title` H1 ("My cards", "Offers & coupons", "Compare", "Card catalog", "Which card should you use?").

## Actual
`CardDetail.tsx` renders the back link `← My cards` (text link, 15px) and then `.big-card` with the name in a `<span class="big-card-name">`. The first heading on the page is `<h2 class="section-label">Earns</h2>`. There is no H1, so the heading outline starts at level 2 and a screen-reader user who jumps to the main heading lands on "Earns" with no card name. At 375px the design's compact header bar (back icon + name) is also missing; the page starts with the text link and the art.

Proposed: `<h1 class="page-title">{nickname || name}</h1>` in the page head (visually the header bar at phone width, with the 44px back button), and keep the name in the art.

## Evidence
- Page text of `/app/cards/1`: "← My cards / Demo Bank / Visa / Demo Card A / •••• 1234 / EARNS / …" — no H1 element; `get_page_text` headings start at "EARNS".
- `apps/web/src/pages/CardDetail.tsx`: no `h1`, `<Link to="/app/cards" className="back">← My cards</Link>`.

## History
- 2026-10-10 ui-ux-expert: filed.
