---
id: BUG-028
title: Mobile Add/Edit offer: "Expires" is a free-text "YYYY-MM-DD" field with no date picker
status: proposed
severity: minor
area: mobile
screen: offers/new, offers/[id] (apps/mobile)
reporter: ui-ux-expert
reviewer:
lead_note:
---

## Repro
From source (`apps/mobile/src/components/OfferForm.tsx`, no simulator available):
1. Open "Add an offer" → "Type it in".
2. Tap "Expires".

## Expected
`AddOffer.dc.html` shows "Expires" as a normal input prefilled "[date]" next to "Min spend"; on a phone the native way to enter a date is the platform picker (the web form already uses `<input type="date">`, which shows the OS picker on phones). The reminder feature depends on this field being filled correctly ("Add an expiry date to get a reminder.").

## Actual
`<Input id="expLabel" value={values.expires_at} onChange={(v) => set("expires_at", v.replace(/[^\d-]/g, "").slice(0, 10))} placeholder="YYYY-MM-DD" max={10} invalid={…regex…} />` — the user types ten characters on the default keyboard (not even `numeric`), the format is only implied by the placeholder, and an invalid value shows a red border with no message. Nothing stops saving with an empty field, so reminders silently never fire.

Proposed: a `DateTimePicker` (expo) opened from a 46px button showing the formatted date or "Pick a date", plus a "Clear" action; keep `expires_at` as ISO in state.

## Evidence
- `apps/mobile/src/components/OfferForm.tsx` "Expires" field (quoted above).

## History
- 2026-10-10 ui-ux-expert: filed.
