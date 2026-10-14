import {
  BEST_FOR,
  CATEGORIES,
  CATEGORY_LABELS,
  type CardPick,
  type Category,
  cardArt,
  cents,
  DISCLAIMER,
  greeting,
  offerCardLabel,
  offerDue,
  offerValue,
  rateLabel,
  rewardsCheckedAt,
  unitLine,
  useMe,
  useMyCards,
  useIsDemo,
  useOffers,
  useRecommend,
} from "@card-wallet/shared";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import { useAuth } from "../auth";
import { CardThumb } from "../components/CardThumb";
import { PointValueDialog } from "../components/PointValueDialog";
import { RequireAuth } from "../components/SignIn";

const isCategory = (v: string | null): v is Category => !!v && (CATEGORIES as readonly string[]).includes(v);

function cardTitle(p: CardPick) {
  return p.nickname || p.name;
}

function BestCard({ pick, category }: { pick: CardPick; category: Category }) {
  return (
    <section className="best" aria-label="Best card" style={{ background: cardArt(pick.card_id) }}>
      <div className="best-top">
        <span>Best for {BEST_FOR[category]}</span>
        <span className="best-badge">Top pick</span>
      </div>
      <div className="best-mid">
        <div className="best-ident">
          <CardThumb card={{ id: pick.card_id, name: pick.name, image_url: pick.image_url }} width={88} />
          <div>
            <div className="best-name">{cardTitle(pick)}</div>
            <div className="best-issuer">
              {pick.issuer}
              {pick.last4 ? ` · •••• ${pick.last4}` : ""}
            </div>
          </div>
        </div>
        {pick.rate && (
          <div className="best-rate">
            <div className="best-rate-num">{rateLabel(pick.rate)}</div>
            <div className="best-rate-unit">{unitLine(pick.rate)}</div>
          </div>
        )}
      </div>
      <div className="best-reason">{pick.reason}</div>
      <Link to={`/app/cards/${pick.user_card_id}`} className="best-link">
        View card &amp; offers
      </Link>
    </section>
  );
}

function OtherOption({ pick }: { pick: CardPick }) {
  return (
    <Link to={`/app/cards/${pick.user_card_id}`} className="other">
      <div className="other-top">
        <CardThumb card={{ id: pick.card_id, name: pick.name, image_url: pick.image_url }} width={56} />
        <span className="other-rate">{pick.rate ? rateLabel(pick.rate) : "—"}</span>
      </div>
      <div className="other-body">
        <div className="strong">{cardTitle(pick)}</div>
        <div className="small muted">{pick.reason}</div>
      </div>
    </Link>
  );
}

function Recommendations() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("for");
  const category: Category = isCategory(raw) ? raw : "dining";
  const { data, isPending, isError } = useRecommend(category);
  const { data: me } = useMe();
  const [editing, setEditing] = useState(false);
  const demo = useIsDemo();

  const picks = data?.picks ?? [];
  const [best, ...others] = picks;
  const hasRates = !!best && best.effective_cents != null;
  const checked = rewardsCheckedAt(picks.flatMap((p) => (p.rate ? [p.rate] : [])));
  const pointValue = data?.point_value_cents ?? me?.point_value_cents ?? 1;

  return (
    <section className="home-main">
      <div className="chips-scroll" role="group" aria-label="Spending on">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={`filter cat${c === category ? " on" : ""}`}
            aria-pressed={c === category}
            onClick={() => setParams({ for: c }, { replace: true })}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {isPending && <div className="best skeleton" aria-busy="true" />}
      {isError && <p className="error">Couldn't load your recommendation.</p>}

      {data && picks.length === 0 && (
        <div className="panel prompt">
          <div className="prompt-title">Add the cards you own</div>
          <p className="muted">Pick from 600+ US cards. Then we'll tell you which one to use for each purchase.</p>
          <Link to="/app/catalog" className="btn btn-primary">
            Add a card
          </Link>
        </div>
      )}

      {best && !hasRates && (
        <div className="panel prompt">
          <div className="prompt-title">No reward rates on file yet</div>
          <p className="muted">
            We read each card's earn rates from the issuer's own page every Sunday. Your cards haven't
            been checked yet, so we can't rank them. Fees and APRs are on each card's page.
          </p>
        </div>
      )}

      {best && hasRates && (
        <>
          <BestCard pick={best} category={category} />
          {others.length > 0 && (
            <div>
              <h2 className="section-label">Other good options</h2>
              <div className="others">
                {others.map((p) => (
                  <OtherOption key={p.user_card_id} pick={p} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <p className="source-note">
        {checked ? `Rewards checked ${checked} from issuer pages` : "Rewards from issuer pages, checked weekly"} ·
        Fees: CFPB TCCP · Points valued at {cents(pointValue)}
        {!demo && (
          <>
            {" "}(
            <button type="button" className="link-button inline" onClick={() => setEditing(true)}>
              change
            </button>
            )
          </>
        )}{" "}
        · {DISCLAIMER}
      </p>
      {editing && <PointValueDialog current={pointValue} onClose={() => setEditing(false)} />}
    </section>
  );
}

function SidePanels() {
  const demo = useIsDemo();
  const { data: cards } = useMyCards();
  const { data: ending } = useOffers({ status: "ending_soon" });
  return (
    <aside className="home-side">
      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Ending soon</h2>
          <Link to="/app/offers" className="small strong">
            All offers
          </Link>
        </div>
        {ending?.slice(0, 4).map((o) => (
          <Link key={o.id} to={`/app/offers/${o.id}`} className="ending-row">
            <div>
              <div className="strong">
                {o.merchant} <span className="offer-value-inline">· {offerValue(o)}</span>
              </div>
              <div className="small muted">{offerCardLabel(o)}</div>
            </div>
            <span className="small strong urgent">{offerDue(o)}</span>
          </Link>
        ))}
        {ending?.length === 0 && <p className="muted small">Nothing ends in the next week.</p>}
        {!demo && (
          <Link to="/app/offers/new" className="dashed-link">
            + Add offer or coupon · drop a screenshot
          </Link>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">My cards</h2>
          <Link to="/app/catalog" className="small strong">
            + Add card
          </Link>
        </div>
        <div className="mini-cards">
          {cards?.map((uc) => (
            <Link key={uc.id} to={`/app/cards/${uc.id}`} className="mini-card" style={{ background: cardArt(uc.card.id) }}>
              <CardThumb card={uc.card} width={48} />
              <span className="strong">{uc.nickname || uc.card.name}</span>
              <span className="small">{uc.last4 ? `•••• ${uc.last4}` : uc.card.issuer}</span>
            </Link>
          ))}
          {cards?.length === 0 && <p className="muted small">No cards yet.</p>}
        </div>
      </div>
    </aside>
  );
}

export function Home() {
  const { session } = useAuth();
  const name = (session?.user.user_metadata as { full_name?: string } | undefined)?.full_name?.split(" ")[0];
  return (
    <section className="page page-wide">
      <div>
        <div className="greeting">
          {greeting()}
          {name ? `, ${name}` : ""}
        </div>
        <h1 className="page-title">Which card should you use?</h1>
      </div>
      <RequireAuth>
        <div className="home">
          <Recommendations />
          <SidePanels />
        </div>
      </RequireAuth>
    </section>
  );
}
