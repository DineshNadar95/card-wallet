import { Link } from "react-router";

import { GoogleButton } from "../components/SignIn";
import { Logo } from "../layout/Logo";

const FEATURES = [
  {
    title: "Best card, per purchase",
    body: "Ranks only the cards you own, using each card's category earn rates.",
  },
  {
    title: "Offers & coupons, from a photo",
    body: "AI reads merchant, value and expiry. You confirm, then get reminded 3, 5 or 7 days before.",
  },
  {
    title: "Sourced, refreshed weekly",
    body: "Fees from CFPB data. Rewards pulled from issuer pages every Sunday, each with its source and date.",
  },
];

export function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="brand">
          <Logo />
          Card Wallet
        </div>
        <nav className="landing-nav">
          <a href="#how" className="hide-sm">
            How it's built
          </a>
          <Link to="/app/catalog" className="hide-sm">
            Card catalog
          </Link>
          <GoogleButton next="/app/cards">Sign in</GoogleButton>
        </nav>
      </header>

      <main className="hero">
        <div className="hero-copy">
          <span className="pill">Free · works on phone and desktop</span>
          <h1>
            Know which card to use.
            <br />
            Never miss a coupon.
          </h1>
          <p className="lede">
            Add the cards you already own. Pick what you're buying, and Card Wallet tells you which
            card earns the most. Snap a photo of any offer or coupon and get reminded before it
            expires.
          </p>
          <div className="hero-ctas">
            <Link to="/app" className="btn btn-primary btn-lg">
              Try the demo — no sign-up
            </Link>
            <GoogleButton next="/app/cards" className="btn btn-outline btn-lg" />
          </div>
          <p className="fine">
            We never ask for card numbers or bank logins. Only the last 4 digits, so you can tell
            your cards apart.
          </p>
        </div>

        <div className="phone" aria-hidden="true">
          <div className="phone-screen">
            <div className="phone-title">Which card should you use?</div>
            <div className="chips">
              <span className="chip on">Dining</span>
              <span className="chip">Groceries</span>
              <span className="chip">Travel</span>
            </div>
            <div className="mini-best">
              <div>
                <div className="mini-label">Best for dining</div>
                <div className="mini-name">Demo Card A</div>
              </div>
              <div className="mini-rate">4x</div>
            </div>
            <div className="mini-offer">
              <span>
                <strong>Demo Phone Co.</strong> · $100 off
              </span>
              <span className="urgent">4 days left</span>
            </div>
          </div>
        </div>
      </main>

      <section id="how" className="features">
        {FEATURES.map((f) => (
          <div key={f.title} className="panel">
            <div className="feature-title">{f.title}</div>
            <div className="feature-body">{f.body}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
