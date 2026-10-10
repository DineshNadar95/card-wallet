# Flow: add an offer from a photo

Who: a signed-in user holding a screenshot (card-linked offer from a bank app) or a photo of a
paper coupon. Goal: save it with the right merchant, value and expiry, and a reminder, without
retyping.

Design: `design/AddOffer.dc.html` (photo mode is the default state of that file). Entry points
are on `design/WebApp.dc.html` ("+ Add offer or coupon · drop a screenshot"),
`design/Offers.dc.html` ("Add offer"), `design/Card.dc.html` ("+ Add" → card preselected).
API: `POST /me/offers/parse-image` (draft, nothing saved) then `POST /me/offers`.

Reviewed from source (`apps/web/src/pages/AddOffer.tsx`, `components/OfferForm.tsx`,
`packages/shared/src/offerForm.ts`, `apps/mobile/src/app/offers/new.tsx`,
`apps/mobile/src/components/OfferForm.tsx`): the form is signed-in only and can't be driven in
the preview. The demo shows only the gate (BUG-013).

## Steps

### 1. Open `/app/offers/new` (mobile: modal `offers/new`)
- Header: H1 "Add an offer"; right: design has a 44×44 close icon (`aria-label="Close"`) → Offers;
  web has a text link "Cancel" (size in BUG-002).
- Segmented tabs (`role="tablist"`, `aria-label="How to add"`): "From a photo" (selected) ·
  "Type it in".
- Arriving from Card detail "+ Add" sets `?card={user_card_id}` so the Card select is preselected.

### 2. Choose the photo
Web: dashed drop zone (`label for="photo-input"`, 140px min): "Choose a photo or drop a
screenshot" / "We read the merchant, value and expiry. You check them before saving." Clicking
opens the file picker (`accept="image/*"`); drag-and-drop works. The file is resized/re-encoded
to JPEG client-side (`lib/image.ts`), which also strips EXIF/GPS (stated in the Privacy page).

Mobile: two buttons "Take a photo" (primary) / "Choose a screenshot" (outline) and the same
helper line.

### 3. Reading state
The drop zone is replaced by the photo card from the design (64×96 thumbnail, `alt="Your offer
screenshot"`): bold "Reading your screenshot…" (mobile: "Reading your photo…") and the
"Retake or choose another" link-button. Nothing else on the page changes.

Gap: while reading, the form is not visible, and if the request fails the form never appears
(BUG-016). The design shows the photo card *above* the full form, so the user can start typing
while the AI works and still has the form if the read fails.

### 4. Result states
| Result | Photo card copy | Form |
|---|---|---|
| `is_offer: true` | "Read {n} details from your screenshot" / "Check them below before saving — photos can be misread." (n = non-null of merchant, kind, value, max_back, min_spend, expires_at, code, notes) | shown, prefilled with every non-null draft field; untouched fields keep their defaults |
| `is_offer: false` | "This doesn't look like an offer" / same second line | shown, prefilled with whatever was read (often nothing) |
| request error (413, 415, 5xx, network) | red line with the API message or "Couldn't read that image." | **not shown** (BUG-016) |

"Retake or choose another" reopens the picker; a new file clears the draft and re-runs the read.

### 5. Check the fields — `AddOffer.dc.html`
Each field label carries a badge when the draft had a value:
- "From screenshot" (`#084F53` on `#E6F1F1`) when confidence ≥ 0.6;
- "Check this" (`#8A3F0E` on `#FCEFE4`) when 0 < confidence < 0.6 (built addition, keep: it tells
  the user where to look).
Fields, in order (46px inputs, 16px text):
1. "Card (optional)" — select: "No card — store coupon", then "{name} •••• {last4}" per wallet
   card (mobile: chips "No card", "{name} {last4}").
2. "Merchant or store" — required; error "Add the merchant or store".
3. "Offer type" — segmented buttons (`aria-pressed`): "% back", "$ off", "Points", "Code only"
   (design has three; "Code only" is a built addition for coupons that are just a code).
4. "Value" with affix (% / $ / x) — hidden for "Code only"; errors "Enter a percent between 0
   and 100" / "Enter a value above 0". Paired with "Max back" ($).
5. "Min spend" ($) · "Expires" (native date input; mobile: free text "YYYY-MM-DD", BUG-028).
6. "Code (optional)" (required for "Code only": "Add the code") · "Category" select ("—", Dining,
   Groceries, Travel, Gas, Online, Everything else) — category lets the recommender mention the
   offer.
7. "Notes (optional)", placeholder "e.g. One use, in-store only".
8. "Store location (optional)" — "Pin this store: use my current location" → "Locating…" →
   "Pinned at {lat}, {lng}" with an editable label (placeholder "e.g. Demo Bistro, 5th Ave") and
   "Remove pin". Help: "At the store? Pin it and the mobile app can remind you when you're nearby.
   Only this pin is saved, never your location history." Errors: "This browser can't share its
   location." / "Location permission is off for this site." / "Couldn't get your location."
   (Phase 7 addition; not in the design.)
9. "Remind me before it ends" — "Off", "3 days" (default), "5 days", "1 week". Hint when a
   reminder is on but no expiry: "Add an expiry date to get a reminder."

Validation runs on submit only (`touched`), then live. Invalid fields get `aria-invalid` and the
message in `<small class="error" id="{id}-err">` (not yet linked with `aria-describedby`; add it).

### 6. Save
Sticky footer button "Save offer" (50px, accent; "Saving…" while pending; mobile keeps the
button in the scroll). `source` is `screenshot` when a draft exists, else `typed`. On success →
`/app/offers` (mobile: `router.back()`).

Gap: there is no confirmation after save — the list simply appears with the new item somewhere
in "Active" (sorted by expiry). Propose a one-line status at the top of Offers: "Saved {merchant}
· {value}" (`role="status"`, dismisses on navigation). Not filed as a design-gap bug because the
design has no toast either; lead to decide.

On API error: the message in `.error` above the button; the form keeps its values.

## Demo state
`/app/offers/new` in demo shows: "This is the demo" / "Demo data is read-only. Sign in with
Google to add offers with your own cards." / "Continue with Google". The entry points are hidden
(BUG-013). Proposed demo state: render the photo card with the design's "[shot]" placeholder and
"Read 5 details from your screenshot", the form prefilled with the Demo Bistro draft, badges on,
all inputs `readOnly`, and the footer button "Sign in to save this offer" → Google.

## Accessibility
- File input is `.sr-only` with a visible `<label>`; `:focus-visible` on the input highlights
  the drop zone. Good.
- Segmented controls are buttons with `aria-pressed` inside `role="group"` labelled by the field
  label. Good.
- Thumbnail has alt text. "Retake or choose another" is a 32px link-button (BUG-002).
