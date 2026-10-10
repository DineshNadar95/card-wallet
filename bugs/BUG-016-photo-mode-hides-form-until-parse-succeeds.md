---
id: BUG-016
title: Add offer "From a photo" hides the whole form until the AI read succeeds; on a read error there is no way forward
status: proposed
severity: major
area: web
screen: /app/offers/new (signed in), apps/mobile offers/new
reporter: ui-ux-expert
reviewer:
lead_note:
---

## Repro
1. Signed in (local kit, docs/LOCAL_TESTING.md). Open `/app/offers/new`, tab "From a photo" (default).
2. Observe: only the drop zone, no form fields.
3. Choose an image. While "Reading your screenshot…" shows, there is still no form.
4. Make the read fail (stop the API, or upload a 20 MB file / unsupported type).

## Expected
`AddOffer.dc.html` (photo mode): the photo card ("Read 5 details from your screenshot / Check them below before saving — photos can be misread. / Retake or choose another") sits **above** the full form (Card, Merchant or store, Offer type, Value, Max back, Min spend, Expires, Remind me before it ends, Save offer). The form is always present in photo mode; the photo only prefills it. A user whose photo can't be read should be able to type the offer right there.

## Actual
`AddOffer.tsx`: `{(mode === "type" || draft) && (<OfferForm …/>)}` — in photo mode the form mounts only after a successful parse. Before a photo, during the read, and after an error ("Couldn't read that image." or the API message) the page shows no fields and no "Save offer". The user must discover the "Type it in" tab on their own. The mobile `offers/new.tsx` has the same condition.

Proposed: always render `OfferForm` in photo mode (below the drop zone / photo card); disable "Save offer" only while `parse.isPending`.

## Evidence
- `apps/web/src/pages/AddOffer.tsx` lines around `{(mode === "type" || draft) && (`; `apps/mobile/src/app/offers/new.tsx` same expression.
- Design markup: `<sc-if value="{{photo}}">` wraps only the photo card and the "From screenshot" badges, not the fields.

## History
- 2026-10-10 ui-ux-expert: filed.
