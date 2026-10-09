import {
  aprRange,
  cardArt,
  categoryLabel,
  money,
  percent,
  rateLabel,
  useMyCard,
  useIsDemo,
  useOffers,
  useRemoveCard,
} from "@card-wallet/shared";
import { Link, useNavigate, useParams } from "react-router";

import { RequireAuth } from "../components/SignIn";
import { OfferItem } from "./Offers";
import { SourceNote } from "../components/SourceNote";

function aprText(lo?: number | null, hi?: number | null) {
  return aprRange({ purchase_apr_min: lo, purchase_apr_max: hi });
}

function Detail({ id }: { id: number }) {
  const navigate = useNavigate();
  const { data: uc, isPending, isError } = useMyCard(id);
  const remove = useRemoveCard();
  const demo = useIsDemo();
  const { data: offers } = useOffers({ user_card_id: id, status: "active" });

  if (isPending) return <p className="muted">Loading…</p>;
  if (isError || !uc)
    return (
      <div className="panel">
        This card isn't in your wallet. <Link to="/app/cards">Back to my cards</Link>
      </div>
    );

  const c = uc.card;
  const art = cardArt(c.id);
  const terms: [string, string][] = [
    ["Annual fee", money(c.annual_fee)],
    ["Purchase APR", aprRange(c)],
    ["Foreign transaction fee", percent(c.fx_fee)],
    ["Late fee", c.late_fee ? `Up to ${money(c.late_fee)}` : money(c.late_fee)],
    ["Cash advance APR", aprText(c.cash_advance_apr_min, c.cash_advance_apr_max)],
  ];

  async function onRemove() {
    if (!window.confirm(`Remove ${c.name} from your wallet?`)) return;
    await remove.mutateAsync(id);
    navigate("/app/cards");
  }

  return (
    <div className="detail">
      <div className="detail-main">
        <Link to="/app/cards" className="back">
          ← My cards
        </Link>
        <div className="big-card" style={{ background: `linear-gradient(135deg, ${art}, #14181F)` }}>
          <div className="big-card-top">
            <span>{c.issuer}</span>
            <span>{c.network ?? ""}</span>
          </div>
          <div className="chip-gold" />
          <div className="big-card-bottom">
            <span className="big-card-name">{uc.nickname || c.name}</span>
            {uc.last4 && <span className="big-card-num">•••• {uc.last4}</span>}
          </div>
        </div>

        <section>
          <h2 className="section-label">Earns</h2>
          <div className="list">
            {c.earn_rates.length ? (
              c.earn_rates.map((r) => (
                <div key={r.category} className="list-row">
                  <span>
                    {categoryLabel(r.category)}
                    {r.conditions && <span className="small muted"> · {r.conditions}</span>}
                  </span>
                  <strong className="rate">{rateLabel(r)}</strong>
                </div>
              ))
            ) : (
              <div className="list-row muted">
                Reward rates for this card haven't been checked from the issuer's page yet.
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="section-head">
            <h2 className="section-label">Your offers on this card</h2>
            {!demo && (
              <Link to={`/app/offers/new?card=${uc.id}`} className="small strong">
                + Add
              </Link>
            )}
          </div>
          <div className="offer-list">
            {offers?.map((o) => <OfferItem key={o.id} o={o} />)}
            {offers?.length === 0 && (
              <div className="list">
                <div className="list-row muted">No active offers on this card.</div>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="detail-side">
        <section>
          <h2 className="section-label">Fees &amp; rates</h2>
          <div className="list">
            {terms.map(([k, v]) => (
              <div key={k} className="list-row">
                <span className="muted">{k}</span>
                <span className="strong">{v}</span>
              </div>
            ))}
          </div>
          <SourceNote
            source={`${c.source} (as of ${c.as_of})`}
            rates={c.earn_rates}
            extra="Your actual APR depends on your credit."
          />
          {c.source_url && (
            <p className="small">
              <a href={c.source_url} target="_blank" rel="noreferrer">
                CFPB source data
              </a>
            </p>
          )}
        </section>

        <div className="detail-actions">
          <Link to={`/app/compare?ids=${c.id}`} className="btn btn-outline">
            Compare
          </Link>
          {!demo && (
            <button type="button" className="btn btn-danger" onClick={onRemove} disabled={remove.isPending}>
              Remove card
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CardDetail() {
  const { id } = useParams();
  return (
    <section className="page page-wide">
      <RequireAuth>
        <Detail id={Number(id)} />
      </RequireAuth>
    </section>
  );
}
