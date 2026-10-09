import { type CardSummary, compareCards } from "@card-wallet/shared";
import { describe, expect, it } from "vitest";

const rate = (category: string, value: number, unit = "percent") => ({
  category, rate: value, unit, annual_cap: null, conditions: null,
  source_url: "https://demo-bank.test", checked_at: "2026-10-04T00:00:00Z",
});

const card = (id: number, rates: ReturnType<typeof rate>[], extra: Partial<CardSummary> = {}) =>
  ({
    id, issuer: "Demo Bank", name: `Demo Card ${id}`, network: null, annual_fee: 0, fx_fee: 0,
    purchase_apr_min: 20, purchase_apr_max: 28, rewards_types: null, credit_tiers: null, secured: false,
    source: "Demo data", as_of: "2025-12-31", earn_rates: rates, ...extra,
  }) as CardSummary;

const row = (rows: ReturnType<typeof compareCards>, label: string) => {
  const r = rows.find((x) => x.kind === "row" && x.label === label);
  if (!r || r.kind !== "row") throw new Error(`no row ${label}`);
  return r;
};

describe("compareCards", () => {
  const a = card(1, [rate("dining", 4, "points"), rate("other", 1, "points")], { annual_fee: 95, fx_fee: 0 });
  const b = card(2, [rate("groceries", 6), rate("other", 1.5)], { annual_fee: 0, fx_fee: 3 });

  it("marks the better reward by cents per dollar, using base rates when there's no bonus", () => {
    const rows = compareCards([a, b], 1);
    expect(row(rows, "Dining")).toEqual({ kind: "row", label: "Dining", values: ["4x", "1.5% (base)"], winner: 0 });
    expect(row(rows, "Groceries")).toMatchObject({ values: ["1x (base)", "6%"], winner: 1 });
    expect(row(rows, "Everything else").winner).toBe(1); // 1.5¢ beats 1¢
  });

  it("point value changes who wins", () => {
    expect(row(compareCards([a, b], 2), "Everything else").winner).toBe(0); // 2¢ beats 1.5¢
  });

  it("ties have no winner", () => {
    const c = card(3, [rate("other", 1.5)]);
    expect(row(compareCards([b, c], 1), "Everything else").winner).toBeNull();
  });

  it("lower fees win; unknown values mean no winner", () => {
    const rows = compareCards([a, b], 1);
    expect(row(rows, "Annual fee")).toMatchObject({ values: ["$95", "$0"], winner: 1 });
    expect(row(rows, "Foreign transaction fee")).toMatchObject({ values: ["None", "3%"], winner: 0 });
    const unknown = card(4, [], { annual_fee: null });
    expect(row(compareCards([a, unknown], 1), "Annual fee").winner).toBeNull();
  });

  it("APR is shown but never green", () => {
    expect(row(compareCards([a, b], 1), "Purchase APR")).toMatchObject({ values: ["20%–28%", "20%–28%"], winner: null });
  });

  it("skips categories nobody has and shows 'Not checked' for cards without rates", () => {
    const diningOnly = card(6, [rate("dining", 4, "points")]);
    const empty = card(5, []);
    const rows = compareCards([diningOnly, empty], 1);
    expect(rows.some((r) => r.kind === "row" && r.label === "Gas")).toBe(false);
    expect(row(rows, "Dining")).toMatchObject({ values: ["4x", "Not checked"], winner: null });
  });

  it("says so when no card has rates yet, instead of an empty section", () => {
    const rows = compareCards([card(7, []), card(8, [])], 1);
    expect(row(rows, "Earn rates")).toMatchObject({ values: ["Not checked yet", "Not checked yet"], winner: null });
  });

  it("adds the offers row only for the user's own cards", () => {
    expect(compareCards([a, b], 1).some((r) => r.label === "Your offers")).toBe(false);
    expect(row(compareCards([a, b], 1, [3, 1]), "Active offers").values).toEqual(["3", "1"]);
  });
});
