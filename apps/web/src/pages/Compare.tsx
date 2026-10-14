import {
  type CardSummary,
  cardArt,
  compareCards,
  DISCLAIMER,
  MAX_COMPARE,
  rewardsCheckedAt,
  useCatalogCard,
  useMe,
  useMyCards,
  useOffers,
  type UserCard,
} from "@card-wallet/shared";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import { useAuth } from "../auth";
import { CardThumb } from "../components/CardThumb";

function parseIds(raw: string | null): number[] {
  return (raw ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, MAX_COMPARE);
}

function Table({ cards, pointValue, offers }: { cards: CardSummary[]; pointValue: number; offers?: number[] }) {
  const rows = compareCards(cards, pointValue, offers);
  const checked = rewardsCheckedAt(cards.flatMap((c) => c.earn_rates));
  const cols = {
    gridTemplateColumns: `minmax(140px, 1.2fr) repeat(${cards.length}, minmax(0, 1fr))`,
    "--n": cards.length,
  } as React.CSSProperties;
  return (
    <>
      <div className="cmp" role="table" aria-label="Card comparison">
        <div className="cmp-row cmp-cards" role="row" style={cols}>
          <span role="columnheader" />
          {cards.map((c) => (
            <span key={c.id} role="columnheader" className="cmp-card" style={{ background: cardArt(c.id) }}>
              <CardThumb card={c} width={64} />
              <span className="strong">{c.name}</span>
              <span className="small">{c.issuer}</span>
            </span>
          ))}
        </div>
        {rows.map((r, i) =>
          r.kind === "head" ? (
            <div key={i} className="section-label cmp-head" role="row">
              <span role="rowheader">{r.label}</span>
            </div>
          ) : (
            <div key={i} className="cmp-row" role="row" style={cols}>
              <span role="rowheader" className="muted small">
                {r.label}
              </span>
              {r.values.map((v, j) => (
                <span key={j} role="cell" className={`cmp-val${r.winner === j ? " better" : ""}`}>
                  {v}
                  {r.winner === j && <span className="sr-only"> (better value)</span>}
                </span>
              ))}
            </div>
          ),
        )}
      </div>
      <p className="source-note">
        Green marks the better value at {pointValue}¢ a point. Terms: {cards[0]?.source ?? "CFPB TCCP"} ·{" "}
        {checked ? `Rewards checked ${checked}` : "Reward rates not checked yet"}. {DISCLAIMER}
      </p>
    </>
  );
}

function FromCatalog({ ids }: { ids: number[] }) {
  const queries = [useCatalogCard(ids[0]), useCatalogCard(ids[1] ?? ids[0]), useCatalogCard(ids[2] ?? ids[0])].slice(
    0,
    ids.length,
  );
  const { session, demo } = useAuth();
  const { data: me } = useMe(!!session || demo);
  if (queries.some((q) => q.isPending)) return <p className="muted">Loading…</p>;
  if (queries.some((q) => q.isError)) return <p className="error">Couldn't load those cards.</p>;
  return <Table cards={queries.map((q) => q.data!)} pointValue={me?.point_value_cents ?? 1} />;
}

function FromWallet() {
  const { data: mine, isPending } = useMyCards();
  const { data: me } = useMe();
  const { data: offers } = useOffers({ status: "active" });
  const [picked, setPicked] = useState<number[] | null>(null);

  if (isPending) return <p className="muted">Loading…</p>;
  const cards = mine ?? [];
  if (cards.length < 2)
    return (
      <div className="panel prompt">
        <div className="prompt-title">Add at least two cards to compare</div>
        <Link to="/app/catalog" className="btn btn-primary">
          Browse the catalog
        </Link>
      </div>
    );

  const slots = (picked ?? cards.slice(0, 2).map((c) => c.id)).filter((id) => cards.some((c) => c.id === id));
  const chosen = slots.map((id) => cards.find((c) => c.id === id)!) as UserCard[];
  const count = (ucId: number) => (offers ?? []).filter((o) => o.user_card_id === ucId).length;
  const setSlot = (i: number, id: number) => setPicked(slots.map((s, j) => (j === i ? id : s)));

  return (
    <>
      <div className="cmp-pickers">
        {slots.map((id, i) => (
          <label key={i} className="cmp-picker">
            <span className="sr-only">Card {i + 1}</span>
            <select value={id} onChange={(e) => setSlot(i, Number(e.target.value))}>
              {cards.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id !== id && slots.includes(c.id)}>
                  {c.nickname || c.card.name}
                  {c.last4 ? ` •••• ${c.last4}` : ""}
                </option>
              ))}
            </select>
          </label>
        ))}
        {slots.length < Math.min(MAX_COMPARE, cards.length) && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setPicked([...slots, cards.find((c) => !slots.includes(c.id))!.id])}
          >
            + Add a card
          </button>
        )}
        {slots.length > 2 && (
          <button type="button" className="link-button" onClick={() => setPicked(slots.slice(0, -1))}>
            Remove last
          </button>
        )}
      </div>
      <Table cards={chosen.map((c) => c.card)} pointValue={me?.point_value_cents ?? 1} offers={chosen.map((c) => count(c.id))} />
    </>
  );
}

export function Compare() {
  const [params, setParams] = useSearchParams();
  const ids = parseIds(params.get("ids"));
  const { session, demo } = useAuth();
  const canUseWallet = !!session || demo;
  const onlyMine = ids.length < 2;

  return (
    <section className="page page-wide">
      <div className="page-head">
        <h1 className="page-title">Compare</h1>
        <label className="toggle">
          <input
            type="checkbox"
            checked={onlyMine}
            disabled={!canUseWallet && onlyMine}
            onChange={(e) => (e.target.checked ? setParams({}) : undefined)}
          />
          <span>Only my cards</span>
        </label>
      </div>
      {onlyMine ? (
        canUseWallet ? (
          <FromWallet />
        ) : (
          <div className="panel prompt">
            <div className="prompt-title">Pick cards to compare</div>
            <p className="muted">Tick up to three cards in the catalog, then choose “Compare side by side”.</p>
            <Link to="/app/catalog" className="btn btn-primary">
              Open the catalog
            </Link>
          </div>
        )
      ) : (
        <>
          <p className="small muted">
            Comparing cards from the catalog. <Link to="/app/catalog">Change cards</Link>
          </p>
          <FromCatalog ids={ids} />
        </>
      )}
    </section>
  );
}
