# Flow: reminders

Who: a signed-in user who saved an offer with "Remind me before it ends". Goal: hear about it
before it expires, in time to use it, and get back to the offer in one tap.

Designs: `design/AddOffer.dc.html` ("Remind me before it ends": Off / 3 days / 5 days /
1 week), `design/Landing.dc.html` ("get reminded 3, 5 or 7 days before"), `design/Offers.dc.html`
("Ending soon" tab), `design/WebApp.dc.html` ("Ending soon" panel). Backend:
`backend/app/jobs/reminders.py` (daily Render cron), CLAUDE.md "Reminders".

Reviewed from source; the cron can't be run from the preview.

## Steps

### 1. Turn it on (Add / Edit offer)
Field "Remind me before it ends", four 44px buttons: "Off", "3 days" (default on new offers),
"5 days", "1 week" (`remind_days` 0/3/5/7). If no expiry is set the hint "Add an expiry date to
get a reminder." appears; the choice is still saved.

What the user doesn't see: on which channel they'll be reminded. Propose one helper line under
the buttons: "By email to {email}" (web) / "As a notification on this phone" (mobile, after
push permission) — copy to add to the form; not a design-gap bug since the design has none.

### 2. The daily job
Runs once a day. Picks offers with `remind_days > 0`, `reminded_at IS NULL`,
`today ≤ expires_at ≤ today + 7` and `expires_at − today ≤ remind_days`. One message per user
per run, listing all due offers. Marks `reminded_at` only after a channel delivered; a failed day
retries the next day; a skipped run catches up (≤ rather than =).

### 3. What arrives
Email (needs `profiles.email`, set from Google):
- Subject: "{merchant} offer ends soon" (one) / "{n} offers ending soon" (several).
- Body:
  ```
  These offers and coupons in your Card Wallet end soon:

  • {merchant} · {value} · ends in {n} days · use {card} •••• {last4}
  • {merchant} · {value} · ends tomorrow

  See them all: {WEB_APP_URL}/app/offers

  You're getting this because you turned on a reminder for these offers.
  ```
  Value wording: "10% back", "$100 off", "5x points", "code UPG100" / "coupon". Due wording:
  "ends today" / "ends tomorrow" / "ends in {n} days".
Push (mobile, Expo; needs a registered token): title "{merchant}: {value}", body "Ends in 3
days" + " · and {n−1} more ending soon" when several. Tapping opens the app (the
`NotificationRouter` only deep-links when `data.offerId` is set, which the reminder push does
not set — it is the "near a saved offer" alert that does).

### 4. Landing back in the app
- Email link → `/app/offers` → Active tab. Signed out: the sign-in prompt, then back to
  `/app/offers` after Google (`next` = path). The offer is in "Active" and in "Ending soon".
- Gaps:
  - The link opens the Active tab, not "Ending soon". Propose linking to
    `{url}/app/offers?tab=ending_soon` (one-line change; noted here, not filed as a design gap
    since the email isn't a designed screen).
  - Nothing in the UI shows that a reminder was sent (`reminded_at` is never rendered) or will
    be sent ("Reminder: 3 days before" on the item). Propose adding to the offer item's bottom
    line, after the due date: "· Reminder {Oct 12}" when `remind_days > 0 && expires_at` and
    "· Reminded" once `reminded_at` is set. Lead to decide; not filed.

### 5. "Ending soon" everywhere (the in-app half of reminders)
- Offers tab "Ending soon": items with `status == "ending_soon"` (≤ 7 days), due text in urgent
  red `#A3261E`, 600 weight.
- Home desktop panel "Ending soon" (≤ 4 items) with "All offers". Phone Home has no panel
  (matches `Main.dc.html`); the Offers tab badge is the only cue — there is no badge today.
  Propose a count badge on the Offers tab icon when `ending_soon > 0` (both apps). Not in the
  designs; lead to decide.

## States
| State | Where | Copy |
|---|---|---|
| Reminder on, no expiry | form | "Add an expiry date to get a reminder." |
| No channel (no email, no push token) | job | user counted in `users_without_channel`; nothing shown to the user. Propose: Settings/Account line "Reminders go to {email}" so it is visible |
| Delivery failed | job | retried next day; invisible to the user |
| Offer expired before the run | job | not selected (`expires_at ≥ today`); the item moves to "Expired" |

## Mobile specifics
`registerForPush` runs after sign-in (best effort; failure only logs). Permission prompt timing
is the OS default on first run after sign-in — propose asking when the user first turns a
reminder on instead (better acceptance). Settings has the location-alert toggle; there is no
reminder/push toggle, and sign-out unregisters the token.
