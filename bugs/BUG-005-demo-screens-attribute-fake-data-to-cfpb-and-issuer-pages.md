---
id: BUG-005
title: Demo mode attributes made-up card terms to "CFPB TCCP" and "issuer pages"
status: proposed
severity: minor
area: web
screen: /app (Home), /app/cards/:id, /app/cards, /app/compare (demo mode)
reporter: testing-expert
reviewer:
lead_note:
---

## Repro
1. Desktop width. Open http://localhost:5173/demo.
2. Read the small note under the recommendation on `/app`.
3. Open `/app/cards/1` and read the note under "Fees & rates" and the link below it.

## Expected
CLAUDE.md Rule 1 ("Never invent real card terms. Every real number needs a source URL and a date") and Rule 4 (every screen with card terms shows their source). Demo data is served with `source: "Demo data (not real)"` and `source_url: "https://card-wallet.example/demo"` (`backend/app/routers/demo.py`), so the screens should say that, not attribute the numbers to CFPB or issuer pages.

Note for the lead: WebApp.dc.html's note is hard-coded "Rewards checked [DATE] from issuer pages · Fees: CFPB TCCP", so the design and the spec disagree here.

## Actual
- `/app` (demo): "Rewards checked Oct 4, 2026 from issuer pages · Fees: CFPB TCCP · Points valued at 1¢ · Not financial advice." Both source phrases are hard-coded in `apps/web/src/pages/Home.tsx` regardless of the data's `source`.
- `/app/cards/1` (demo): "Fees & APRs: Demo data (not real) (as of 2026-10-10) · Rewards checked Oct 4, 2026 from issuer pages." and a link labelled "CFPB source data" that points to `https://card-wallet.example/demo`.
- `/app/cards` and `/app/compare` (demo): "Rewards checked Oct 4, 2026 from issuer pages" (`SourceNote` hard-codes "from issuer pages").
- Mobile `(tabs)/index.tsx` has the same hard-coded "Fees: CFPB TCCP" (not run; from source).

## Evidence
- Page text captured from `/app` and `/app/cards/1` in demo mode (see above).
- `apps/web/src/components/SourceNote.tsx`, `apps/web/src/pages/Home.tsx` (source-note paragraph), `apps/web/src/pages/CardDetail.tsx` ("CFPB source data").

## History
- 2026-10-10 testing-expert: filed.
