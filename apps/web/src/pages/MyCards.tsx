import { cardArt, categoryLabel, rateLabel, useCatalog, useMyCards } from "@card-wallet/shared";
import { Link } from "react-router";

import { RequireAuth } from "../components/SignIn";
import { SourceNote } from "../components/SourceNote";

function Wallet() {
  const { data: cards, isPending, isError } = useMyCards();
  const { data: catalog } = useCatalog({ limit: 1 });

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">My cards</h1>
          <div className="page-sub">{cards ? `${cards.length} card${cards.length === 1 ? "" : "s"}` : " "}</div>
        </div>
        <Link to="/app/catalog" className="btn btn-primary">
          + Add card
        </Link>
      </div>

      {isPending && <p className="muted">Loading your cards…</p>}
      {isError && <p className="error">Couldn't load your cards.</p>}

      <div className="wallet-grid">
        {cards?.map((uc) => (
          <Link key={uc.id} to={`/app/cards/${uc.id}`} className="wallet-card">
            <div className="wallet-art" style={{ background: cardArt(uc.card.id) }}>
              <div>
                <div className="wallet-name">{uc.nickname || uc.card.name}</div>
                <div className="wallet-meta">
                  {uc.card.issuer}
                  {uc.last4 ? ` · •••• ${uc.last4}` : ""}
                </div>
              </div>
            </div>
            <div className="earn-chips">
              {uc.card.earn_rates.length ? (
                uc.card.earn_rates.map((r) => (
                  <span key={r.category} className="earn-chip">
                    <strong>{rateLabel(r)}</strong> {categoryLabel(r.category)}
                  </span>
                ))
              ) : (
                <span className="muted small">Reward rates not checked yet</span>
              )}
            </div>
          </Link>
        ))}

        <Link to="/app/catalog" className="add-tile">
          <div className="strong">
            Add from {catalog ? catalog.total.toLocaleString() : ""} US cards
          </div>
          <div className="small muted">
            Search by name. Fees, APRs and base rewards fill in automatically. We never ask for your
            full card number — only the last 4, so you can tell cards apart.
          </div>
        </Link>
      </div>

      <SourceNote
        source={cards?.[0]?.card.source}
        rates={cards?.flatMap((c) => c.card.earn_rates)}
      />
    </>
  );
}

export function MyCards() {
  return (
    <section className="page">
      <RequireAuth>
        <Wallet />
      </RequireAuth>
    </section>
  );
}
