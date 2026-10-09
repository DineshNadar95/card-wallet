import {
  cardArt,
  OFFER_SOURCE_LABELS,
  type Offer,
  type OfferStatusFilter,
  offerCardLabel,
  offerDetail,
  offerDue,
  offerValue,
  useIsDemo,
  useOffers,
} from "@card-wallet/shared";
import { Link, useSearchParams } from "react-router";

import { RequireAuth } from "../components/SignIn";

const TABS: { k: OfferStatusFilter; label: string }[] = [
  { k: "active", label: "Active" },
  { k: "ending_soon", label: "Ending soon" },
  { k: "expired", label: "Expired" },
];

export function OfferItem({ o }: { o: Offer }) {
  const urgent = o.status === "ending_soon";
  const demo = useIsDemo();
  const body = (
    <>
      <div className="offer-top">
        <span className="offer-merchant">{o.merchant}</span>
        <span className="offer-value">{offerValue(o)}</span>
      </div>
      {offerDetail(o) && <div className="small muted">{offerDetail(o)}</div>}
      <div className="offer-bottom">
        <span>
          {offerCardLabel(o)} · <span className={urgent ? "urgent" : undefined}>{offerDue(o)}</span>
        </span>
        <span className="source-pill">{OFFER_SOURCE_LABELS[o.source]}</span>
      </div>
    </>
  );
  const style = { borderLeftColor: o.card ? cardArt(o.card.card_id) : "#9AA4B2" };
  return demo ? (
    <article className="offer" style={style}>
      {body}
    </article>
  ) : (
    <Link to={`/app/offers/${o.id}`} className="offer" style={style}>
      {body}
    </Link>
  );
}

function List() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.k === params.get("tab"))?.k ?? "active") as OfferStatusFilter;
  const { data, isPending, isError } = useOffers({ status: tab });

  return (
    <>
      <div className="seg-tabs" role="tablist" aria-label="Offer status">
        {TABS.map((t) => (
          <button
            key={t.k}
            type="button"
            role="tab"
            aria-selected={t.k === tab}
            onClick={() => setParams({ tab: t.k }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>
      {isPending && <p className="muted">Loading…</p>}
      {isError && <p className="error">Couldn't load your offers.</p>}
      <div className="offer-list" role="tabpanel">
        {data?.map((o) => <OfferItem key={o.id} o={o} />)}
        {data?.length === 0 && <p className="empty">Nothing here.</p>}
      </div>
    </>
  );
}

export function Offers() {
  const demo = useIsDemo();
  return (
    <section className="page">
      <div className="page-head">
        <h1 className="page-title">Offers &amp; coupons</h1>
        {!demo && (
          <Link to="/app/offers/new" className="btn btn-primary">
            + Add offer
          </Link>
        )}
      </div>
      <RequireAuth>
        <List />
      </RequireAuth>
    </section>
  );
}
