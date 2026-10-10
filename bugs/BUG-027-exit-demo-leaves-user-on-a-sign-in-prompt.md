---
id: BUG-027
title: "Exit demo" leaves the user on the same app route, now showing a sign-in prompt, instead of returning to the landing page
status: proposed
severity: minor
area: web
screen: demo banner → any /app/* route
reporter: ui-ux-expert
reviewer:
lead_note:
---

## Repro
1. Open http://localhost:5173/demo, go to "Offers & coupons".
2. Click "Exit demo" in the banner (desktop or 375px).

## Expected
`WebApp.dc.html`: the banner's only way out is the link "Sign in to use your own cards" → `Landing.dc.html`. Leaving the demo should take the user to a place that explains their options: the landing page (`/`) with "Try the demo — no sign-up" and "Continue with Google". There is no "Exit demo" control in the design; if it stays, it should go to `/`.

## Actual
`endDemo()` clears the flag and nothing navigates. The banner disappears and the current page body is replaced by the generic prompt "Sign in to see your cards / Your wallet is private to your Google account…" under the page title (on Offers: "Offers & coupons / + Add offer / Sign in to see your cards"). No message says the demo ended; a first-time visitor reads it as "the app logged me out".

## Evidence
- Screenshot of `/app/offers` at 375px right after "Exit demo" (2026-10-10).
- `apps/web/src/layout/AppShell.tsx` `DemoBanner`: `<button … onClick={endDemo}>Exit demo</button>`; `auth.tsx` `endDemo() { writeDemo(false); setDemoFlag(false); }`.

## History
- 2026-10-10 ui-ux-expert: filed.
