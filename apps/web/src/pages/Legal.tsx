import { Link } from "react-router";

import { Logo } from "../layout/Logo";

const UPDATED = "October 9, 2026";
const CONTACT = "https://github.com/DineshNadar95/card-wallet/issues";

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="legal">
      <header className="landing-header">
        <Link to="/" className="brand">
          <Logo />
          Card Wallet
        </Link>
        <nav className="landing-nav">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
      </header>
      <main className="legal-body">
        <h1>{title}</h1>
        <p className="muted small">Last updated {UPDATED}</p>
        {children}
      </main>
    </div>
  );
}

export function Privacy() {
  return (
    <Page title="Privacy policy">
      <p>
        Card Wallet is a portfolio project that helps you pick which of your own credit cards to use
        and keeps track of your offers and coupons. This page explains what it stores and why.
      </p>

      <h2>What we never collect</h2>
      <ul>
        <li>Full card numbers, CVVs or expiry dates. Only the last 4 digits, if you choose to add them.</li>
        <li>Bank or card-issuer logins. Card Wallet doesn't connect to banks.</li>
        <li>Transactions or spending history.</li>
        <li>Your location history. See “Location” below.</li>
      </ul>

      <h2>What we store when you sign in</h2>
      <ul>
        <li>
          <strong>Account:</strong> your Google account's email address and name, through Supabase
          Auth, to identify you and send the reminders you ask for.
        </li>
        <li>
          <strong>Your wallet:</strong> which catalog cards you hold, an optional nickname and the
          optional last 4 digits.
        </li>
        <li>
          <strong>Offers and coupons:</strong> the details you save (merchant, value, dates, codes,
          notes, reminder setting) and, if you choose, a store location pin.
        </li>
        <li>
          <strong>Settings:</strong> the value you assign to a reward point.
        </li>
        <li>
          <strong>Mobile notifications:</strong> a push token for your device, if you allow
          notifications. It's removed when you sign out.
        </li>
      </ul>
      <p>
        Each user's data is only accessible with their own sign-in. The server checks your identity
        on every request, and the database enforces per-user access rules as a second layer.
      </p>

      <h2>Photos of offers</h2>
      <p>
        When you add an offer from a photo, the image is sent to our server and on to Anthropic's
        Claude API to read the offer details. The photo is not saved by Card Wallet. You review the
        details before anything is saved. Before upload, the app converts the photo to JPEG, which
        removes embedded metadata such as GPS location.
      </p>

      <h2>Location</h2>
      <p>
        Location is optional. “Scan where I am” and “Pin this store” read your location once, when
        you tap them. On iPhone, if you turn on “Remind me near saved offers”, iOS watches up to 20
        of your pinned stores and wakes the app when you arrive. In every case, matching happens on
        your device. Your location is never sent to our servers; only the store pins you choose to
        save are stored. On Android, Card Wallet does not use background location.
      </p>

      <h2>Services we use</h2>
      <ul>
        <li>Supabase: database and Google sign-in.</li>
        <li>Render: runs the API and scheduled jobs (reminders, weekly rewards refresh).</li>
        <li>Vercel: hosts this website.</li>
        <li>Anthropic: reads offer photos you upload.</li>
        <li>An email provider: sends the expiry reminders you turn on.</li>
        <li>Expo: delivers push notifications on mobile.</li>
      </ul>
      <p>We don't sell your data, show ads, or share it for advertising.</p>

      <h2>Keeping and deleting your data</h2>
      <p>
        You can remove any card or offer at any time, and it's deleted from the database. To delete
        your whole account and everything linked to it, open a request at{" "}
        <a href={CONTACT}>{CONTACT.replace("https://", "")}</a> and it will be removed.
      </p>

      <h2>Demo mode</h2>
      <p>The demo uses fixed sample data. Nothing you do in the demo is stored.</p>

      <h2>Changes and contact</h2>
      <p>
        If this policy changes, the date at the top changes too. Questions:{" "}
        <a href={CONTACT}>{CONTACT.replace("https://", "")}</a>.
      </p>
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Terms of service">
      <p>
        Card Wallet is a free portfolio project. By using it, you agree to these terms. If you don't
        agree, please don't use it.
      </p>

      <h2>Not financial advice</h2>
      <p>
        Card Wallet shows card fees, APRs and reward rates to help you compare your own cards. It is
        not financial, credit or tax advice, and it doesn't recommend applying for any card.
      </p>

      <h2>Where the data comes from</h2>
      <p>
        Fees and APRs come from the Consumer Financial Protection Bureau's Terms of Credit Card Plans
        survey. Reward rates are read from card issuers' own websites, roughly weekly. Each is shown
        with its source and date. Terms change, pages are sometimes misread, and your actual terms
        depend on your account, so always check with your card issuer before relying on a rate.
        Offer details read from photos may be wrong; you confirm them before saving.
      </p>

      <h2>Your account</h2>
      <p>
        You sign in with Google. Keep your Google account secure; you're responsible for activity
        under it. Don't enter full card numbers or other sensitive financial details anywhere in the
        app; it never asks for them.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don't misuse the service: no attempts to access other users' data, overload or attack the
        service, or upload content you don't have the right to share.
      </p>

      <h2>No warranty</h2>
      <p>
        The service is provided “as is”, without warranties of any kind. It may change, be
        unavailable, or shut down at any time. To the extent the law allows, Card Wallet and its
        author aren't liable for losses from using it, including missed offers, reminders that don't
        arrive, or decisions made using its information.
      </p>

      <h2>Changes and contact</h2>
      <p>
        These terms may be updated; the date at the top shows the latest version. Questions:{" "}
        <a href={CONTACT}>{CONTACT.replace("https://", "")}</a>.
      </p>
    </Page>
  );
}
