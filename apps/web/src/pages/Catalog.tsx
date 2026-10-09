import {
  aprRange,
  type CardSummary,
  type CatalogParams,
  cardArt,
  categoryLabel,
  money,
  percent,
  rateLabel,
  rewardsCheckedAt,
  topRate,
  useCatalog,
  useMyCards,
} from "@card-wallet/shared";
import { useEffect, useState } from "react";

import { useAuth } from "../auth";
import { AddCardDialog } from "../components/AddCardDialog";
import { GoogleButton } from "../components/SignIn";
import { SourceNote } from "../components/SourceNote";

const PAGE = 50;

type FilterKey = "no_annual_fee" | "no_fx_fee" | "cashback" | "travel" | "excellent";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "no_annual_fee", label: "$0 annual fee" },
  { key: "no_fx_fee", label: "No FX fee" },
  { key: "cashback", label: "Cashback" },
  { key: "travel", label: "Travel" },
  { key: "excellent", label: "Credit score: 720+" },
];

function toParams(q: string, on: Set<FilterKey>, offset: number): CatalogParams {
  return {
    q: q || undefined,
    no_annual_fee: on.has("no_annual_fee") || undefined,
    no_fx_fee: on.has("no_fx_fee") || undefined,
    // Cashback and Travel are exclusive: picking one clears the other.
    rewards: on.has("cashback") ? "cashback" : on.has("travel") ? "travel" : undefined,
    credit_tier: on.has("excellent") ? "excellent" : undefined,
    limit: PAGE,
    offset,
  };
}

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function Catalog() {
  const { session } = useAuth();
  const [query, setQuery] = useState("");
  const [on, setOn] = useState<Set<FilterKey>>(new Set());
  const [offset, setOffset] = useState(0);
  const [adding, setAdding] = useState<CardSummary | null>(null);
  const q = useDebounced(query.trim());

  const { data, isPending, isError, isFetching } = useCatalog(toParams(q, on, offset));
  const mine = useMyCards(!!session);
  const owned = new Map<number, number>();
  for (const uc of mine.data ?? []) owned.set(uc.card_id, (owned.get(uc.card_id) ?? 0) + 1);

  useEffect(() => setOffset(0), [q, on]);

  const toggle = (k: FilterKey) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else {
        next.add(k);
        if (k === "cashback") next.delete("travel");
        if (k === "travel") next.delete("cashback");
      }
      return next;
    });

  const items = data?.items ?? [];

  return (
    <section className="page page-wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Card catalog</h1>
          <div className="page-sub">
            {data ? `${data.total.toLocaleString()} US cards` : "US cards"} · fees from{" "}
            {items[0]?.source ?? "CFPB TCCP"} · rewards refreshed every Sunday
          </div>
        </div>
        <label className="search">
          <span className="sr-only">Search cards</span>
          <input
            type="search"
            placeholder="Search card or issuer"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      <div className="filter-row" role="group" aria-label="Filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`filter${on.has(f.key) ? " on" : ""}`}
            aria-pressed={on.has(f.key)}
            onClick={() => toggle(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="table-wrap" aria-busy={isFetching}>
        <table className="catalog">
          <thead>
            <tr>
              <th>Card</th>
              <th>Annual fee</th>
              <th className="wide">FX fee</th>
              <th className="wide">Purchase APR</th>
              <th className="wide">Top earn rate</th>
              <th className="wide">Rewards checked</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const top = topRate(c.earn_rates);
              const checked = rewardsCheckedAt(c.earn_rates);
              const count = owned.get(c.id) ?? 0;
              return (
                <tr key={c.id} className={count ? "owned" : undefined}>
                  <td>
                    <div className="card-cell">
                      <span className="art" style={{ background: cardArt(c.id) }} />
                      <div>
                        <div className="strong">{c.name}</div>
                        <div className="small muted">{c.issuer}</div>
                      </div>
                    </div>
                  </td>
                  <td>{money(c.annual_fee)}</td>
                  <td className="wide">{percent(c.fx_fee)}</td>
                  <td className="wide">{aprRange(c)}</td>
                  <td className="wide">
                    {top ? (
                      <>
                        <strong>{rateLabel(top)}</strong>{" "}
                        <span className="muted">on {categoryLabel(top.category).toLowerCase()}</span>
                      </>
                    ) : (
                      <span className="muted">Not checked yet</span>
                    )}
                  </td>
                  <td className="wide small muted">
                    {checked && top ? (
                      <>
                        {checked} ·{" "}
                        <a href={top.source_url} target="_blank" rel="noreferrer">
                          source
                        </a>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="actions">
                    {session ? (
                      <button type="button" className="btn btn-small" onClick={() => setAdding(c)}>
                        {count ? "Add another" : "Add to wallet"}
                      </button>
                    ) : null}
                    {count > 0 && <span className="in-wallet">In wallet</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {isPending && <div className="table-empty">Loading cards…</div>}
        {isError && <div className="table-empty">Couldn't load the catalog. Is the API running?</div>}
        {data && items.length === 0 && <div className="table-empty">No cards match.</div>}
      </div>

      {data && data.total > PAGE && (
        <nav className="pager" aria-label="Pages">
          <button type="button" className="btn btn-outline" disabled={offset === 0} onClick={() => setOffset(offset - PAGE)}>
            Previous
          </button>
          <span className="muted small">
            {offset + 1}–{offset + items.length} of {data.total.toLocaleString()}
          </span>
          <button
            type="button"
            className="btn btn-outline"
            disabled={offset + PAGE >= data.total}
            onClick={() => setOffset(offset + PAGE)}
          >
            Next
          </button>
        </nav>
      )}

      {!session && (
        <div className="panel inline-prompt">
          <span>Sign in to add cards to your wallet.</span>
          <GoogleButton next="/app/catalog" className="btn btn-primary" />
        </div>
      )}

      <SourceNote source={items[0]?.source} rates={items.flatMap((c) => c.earn_rates)} extra="Terms are as reported to the CFPB." />

      {adding && <AddCardDialog card={adding} onClose={() => setAdding(null)} />}
    </section>
  );
}
