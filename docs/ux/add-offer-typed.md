# Flow: add an offer by typing

Who: a signed-in user with a coupon code from an email, a carrier promo, or a card offer they
read on paper. Goal: save it in under a minute with the right expiry and a reminder.

Design: `design/AddOffer.dc.html` with the "Type it in" tab selected (the file's `mode: 'type'`
state: no photo card, no "From screenshot" badges). Entry points as in
`docs/ux/add-offer-from-photo.md`. API: `POST /me/offers`.

## Steps

### 1. Open and switch mode
`/app/offers/new` → tab "Type it in". The form appears immediately with defaults:
Card = "No card — store coupon" (or the card from `?card=`), Offer type = "% back",
Remind = "3 days", everything else empty.

Mobile: same, in the "Add an offer" modal.

### 2. Fill the form (exact labels and rules — see photo flow step 5 for the full list)
Minimum to save:
- "Merchant or store" (required).
- For "% back": "Value" 0 < n ≤ 100. For "$ off" / "Points": n > 0. For "Code only": "Code".
Everything else optional. "Expires" is a native date field on web; on mobile the user types
"YYYY-MM-DD" (BUG-028: no picker, no example beyond the placeholder).

Offer type semantics (shown to the user only through the affix and the list wording):
| Type | Affix | List shows |
|---|---|---|
| % back | "{n}%" | "10% back" (store coupons should read "10% off": BUG-021) |
| $ off | "$ {n}" | "$100 off" |
| Points | "{n}x" | "5x pts" |
| Code only | — | "Code UPG100" (or "Coupon" if no code) |

### 3. Reminder
"Remind me before it ends": Off / 3 days / 5 days / 1 week. With no expiry the hint "Add an
expiry date to get a reminder." appears under the buttons; saving still works (the reminder
simply never fires). See `docs/ux/reminders.md`.

### 4. Save
"Save offer" → `POST /me/offers` with `source: "typed"` → `/app/offers`. The new item shows the
"Typed" source pill. Errors: field messages on submit; API message above the button
(e.g. 404 "Card not in your wallet" if the card was removed meanwhile).

### 5. Edit later — `/app/offers/{id}` ("Edit offer")
Same form, title "Edit offer", button "Save changes", plus "Delete" (danger) →
`window.confirm("Delete the {merchant} offer?")` → `/app/offers`. States: "Loading…";
"Offer not found. Back to offers". Source stays what it was. Mobile: screen title is the
merchant, "Delete offer" with a native alert "Delete offer?".

## What the user sees afterwards — `Offers.dc.html`
`/app/offers`, tab "Active" (`?tab=active|ending_soon|expired`, `role="tablist"` labelled
"Offer status"). Item: merchant (16px bold) · value (16px bold, `#8A3F0E`); detail line
("Spend $50+, up to $15 back · code X · notes"); "{card} •••• 1234" or "Coupon · no card" ·
due ("Ends in 3 days" red when ending soon; "Ends today"; "Ends tomorrow"; "Ends Nov 19, 2026";
"Expired"; "Card benefit"; "No end date"); source pill "Typed" / "Screenshot" / "Card benefit".
Left border = the linked card's art colour, grey `#9AA4B2` for coupons. Empty: "Nothing here."

Gap: the list gives no feedback that a save just happened (see photo flow step 6).

## Demo state
Gate only (BUG-013). The typed form could be shown read-only with the Demo Clothing values and
"Sign in to save this offer".

## Accessibility
- Every input has a `<label for>`; selects too. Segmented groups use `aria-labelledby`.
- Error text should be tied to the input with `aria-describedby="{id}-err"` (the id exists,
  the attribute doesn't).
- Sticky "Save offer" at phone width sits above the bottom tabs (`bottom: 72px + safe-area`).
