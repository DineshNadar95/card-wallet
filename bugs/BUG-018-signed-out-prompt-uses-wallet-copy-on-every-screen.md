---
id: BUG-018
title: Signed-out prompt says "Sign in to see your cards" on Offers, Compare and Add offer; mobile has per-screen copy
status: proposed
severity: minor
area: web
screen: /app/offers, /app/compare, /app/offers/new, /app/offers/:id (signed out, not demo)
reporter: ui-ux-expert
reviewer:
lead_note:
---

## Repro
1. Signed out, demo off (open http://localhost:5173/demo then click "Exit demo", or open the route directly).
2. Open http://localhost:5173/app/offers, then /app/compare, then /app/offers/new.

## Expected
The prompt should say what signing in unlocks on this screen. The mobile app already does (`apps/mobile/src/app/(tabs)/offers.tsx`, `compare.tsx`, `offers/new.tsx`):
- Offers: "Sign in to track offers" / "Save card offers and store coupons from a photo or by typing, and get a reminder before they end."
- Compare: "Sign in to compare your cards" / "See your cards side by side, with the better value in green."
- Add offer: "Sign in to add offers" / "Offers are saved to your account."
Home / My cards keep "Sign in to see your cards" / "Your wallet is private to your Google account. We only store the cards you add and their last 4 digits."

## Actual
`RequireAuth` in `apps/web/src/components/SignIn.tsx` hard-codes the wallet copy and every page uses it, so `/app/offers` shows "Offers & coupons / + Add offer / Sign in to see your cards / Your wallet is private to your Google account…" — the title and the prompt disagree. Same on Compare and Add offer.

## Evidence
- Page text of `/app/offers` signed out at 375px (captured 2026-10-10): "Offers & coupons / + Add offer / Sign in to see your cards / Your wallet is private to your Google account. We only store the cards you add and their last 4 digits. / Continue with Google".
- `SignIn.tsx`: `RequireAuth` renders `<SignInPrompt title="Sign in to see your cards" body="Your wallet is private…" />` with no props.

## History
- 2026-10-10 ui-ux-expert: filed.
