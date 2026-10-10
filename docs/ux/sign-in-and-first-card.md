# Flow: sign in → first card

Who: a new user who wants real recommendations. Goal: be signed in with a card in the wallet and
see a recommendation, in under two minutes.

Designs: `design/Landing.dc.html` (sign-in), `design/Wallet.dc.html` (empty wallet + add tile),
`design/WebCatalog.dc.html` (pick a card, "+ Add to wallet"), `design/WebApp.dc.html` /
`design/Main.dc.html` (first recommendation). The add-card dialog has no design file; it is a
proposed screen (see "New screen" below) that already exists in `apps/web/src/components/
AddCardDialog.tsx` and `apps/mobile/src/app/cards/add.tsx`.

Reviewed from source (`apps/web/src/auth.tsx`, `SignIn.tsx`, `MyCards.tsx`, `Catalog.tsx`,
`AddCardDialog.tsx`, `Home.tsx`; mobile `(tabs)/cards.tsx`, `cards/add.tsx`): sign-in can't be
driven in the preview.

## Steps

### 1. Start sign-in
Entry points, all calling `signInWithGoogle(next)`:
- Landing header "Sign in" and hero "Continue with Google" (`next=/app/cards`).
- Demo banner "Sign in to use your own cards" (`next=/app/cards`).
- Any `/app/*` route when signed out and not in demo: the `RequireAuth` prompt (`next` = current
  path).
- Catalog, signed out: panel "Sign in to add cards to your wallet." + "Continue with Google"
  (`next=/app/catalog`).

Prompt copy (web, every screen): title "Sign in to see your cards", body "Your wallet is private
to your Google account. We only store the cards you add and their last 4 digits.", button
"Continue with Google". Mobile uses per-screen copy; web should too (BUG-018):
- Home / Cards: as above.
- Offers: "Sign in to track offers" / "Save card offers and store coupons from a photo or by
  typing, and get a reminder before they end."
- Compare: "Sign in to compare your cards" / "See your cards side by side, with the better value
  in green."
- Add offer: "Sign in to add offers" / "Offers are saved to your account."

Not-configured state: button disabled, fine print "Sign-in isn't configured on this deployment
yet. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`."

What changes: browser leaves for Google (PKCE). On return Supabase sets the session; `SIGNED_IN`
clears the demo flag and the `["me"]` cache; the app lands on `next`.

Missing state: there is no "Signing you in…" screen while the OAuth callback is exchanged; the
user briefly sees the signed-out prompt on `/app/cards` before the session resolves (`ready`
false → `RequireAuth` renders nothing, then the prompt or the page). Acceptable; keep `null`
while `!ready` so the prompt never flashes.

### 2. Empty wallet `/app/cards` — `Wallet.dc.html`
Copy: "My cards" / sub "0 cards · 0 active offers" / primary "+ Add card" → `/app/catalog`.
Grid is empty except the dashed tile:
"Add from {total} US cards" / "Search by name. Fees, APRs and base rewards fill in
automatically. We never ask for your full card number — only the last 4, so you can tell cards
apart." → `/app/catalog`.
Footer: "Fees & APRs: CFPB TCCP · Reward rates not checked yet. Not financial advice."
(no `as_of` here: BUG-009).

Sidebar account block: "{full_name}" / "{email}" / "Sign out" (link-button).

### 3. Pick a card `/app/catalog` — `WebCatalog.dc.html`
- Title "Card catalog", sub "{total} US cards · fees from {source} · rewards refreshed every
  Sunday".
- Search: visually hidden label "Search cards", placeholder "Search card or issuer", debounced
  250ms, resets to page 1.
- Filter chips (`aria-pressed`): "$0 annual fee", "No FX fee", "Cashback", "Travel" (these two are
  exclusive), "Credit score: 720+".
- Table columns: Compare (checkbox `aria-label="Compare {name}"`), Card (art + name + issuer),
  Annual fee, FX fee, Purchase APR, Top earn rate ("**4x** on dining" or "Not checked yet"),
  Rewards checked ("Oct 4, 2026 · source" link or "—"), action.
- Action cell, signed in: "Add to wallet" (36px `.btn-small`), or "Add another" + "In wallet"
  when already owned (row gets the `#F3F9F9` owned background).
- Pager when total > 50: "Previous" / "1–50 of 661" / "Next".
- States: "Loading cards…", "Couldn't load the catalog. Is the API running?", "No cards match."
- Footer: "Fees & APRs: {source} · Reward rates not checked yet. Terms are as reported to the
  CFPB. Not financial advice."

Gap: the default order is alphabetical, so a new user's first page is 50 credit-union cards with
no rewards (BUG-025). Searching for a known card ("Amazon", "Apple Card") works.

### 4. Add-card dialog (new screen, no design file)
Why it's needed: the design's "+ Add to wallet" has nothing behind it, but `user_cards` needs
`last4` and `nickname`, and Rule "store last 4 digits only" must be explained at the moment of
entry. A `<dialog>` keeps the user on the catalog row they chose.

Layout (web, `AddCardDialog.tsx`): card art block with name + issuer on the chosen card's
`cardArt` colour; h2 "Add to wallet"; field "Last 4 digits (optional)" (`inputMode="numeric"`,
4 digits, help "Only so you can tell cards apart. We never ask for or store your full card
number."); field "Nickname (optional)"; buttons "Cancel" / "Add card" (busy: "Adding…").
Validation: last4 empty or exactly 4 digits; otherwise "Add card" disabled and `aria-invalid`.
Error: the API message in `.error` above the buttons.
Success state: title changes to "Added to your wallet", single button "Done" closes the dialog;
the row now reads "In wallet" and the button "Add another".

Mobile (`cards/add.tsx`): modal "Add a card" with autofocused search, result rows (art · name /
issuer · annual fee), then a confirm screen with the same two fields and "Back" / "Add card";
on success it `router.back()`s to Cards with no confirmation text. Note for the lead: web and
mobile differ here; the web "Added to your wallet" state is the better one.

### 5. First recommendation `/app` — `WebApp.dc.html` / `Main.dc.html`
After "Done", the user has to navigate to Home themselves (sidebar "Home" / tab "Home"). Propose:
the success state offers "See which card to use" → `/app` alongside "Done" (not filed as a bug;
copy suggestion only).

Home with one card and no scraped rates shows the panel "No reward rates on file yet / We read
each card's earn rates from the issuer's own page every Sunday. Your cards haven't been checked
yet, so we can't rank them. Fees and APRs are on each card's page." This is the common case for
a real card today (only ~30 cards are scraped), so the first-run experience depends on which card
they add. The "Ending soon" panel reads "Nothing ends in the next week." and "My cards" shows the
one card.

With zero cards Home shows "Add the cards you own / Pick from 600+ US cards. Then we'll tell you
which one to use for each purchase. / Add a card" → `/app/catalog`.

## Removing a card
Card detail → "Remove card" (danger button) → `window.confirm("Remove {name} from your
wallet?")` → `DELETE /me/cards/{id}` → navigate to `/app/cards`. Linked offers become store
coupons (`user_card_id` → null) on Postgres; SQLite caveat in BUG-007.

## Point value (signed in only)
Home source note: "… Points valued at 1¢ (change) · Not financial advice." "change" opens the
dialog "What's a point worth to you?" / "Card Wallet multiplies points and miles by this to
compare them with cash back. 1¢ is a common baseline; transfer partners can be worth more, gift
cards often less." / field "Cents per point or mile" (0.1–10, step 0.05) / "Cancel" "Save".
Design says "(change in Settings)"; web has no Settings screen, so the inline dialog is the
agreed substitute. Mobile: Settings modal.
