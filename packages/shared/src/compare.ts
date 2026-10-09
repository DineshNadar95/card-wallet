import { aprRange, money, percent, rateLabel } from "./format";
import type { components } from "./schema.gen";
import { CATEGORIES, CATEGORY_LABELS } from "./tokens";

type Card = components["schemas"]["CardSummary"];
type EarnRate = components["schemas"]["EarnRateOut"];

export type CompareRow =
  | { kind: "head"; label: string }
  | { kind: "row"; label: string; values: string[]; winner: number | null };

/** Index of the single best value, or null on a tie / when any value is unknown. */
function best(values: (number | null)[], prefer: "high" | "low"): number | null {
  if (values.length < 2 || values.some((v) => v == null)) return null;
  const nums = values as number[];
  const target = prefer === "high" ? Math.max(...nums) : Math.min(...nums);
  const hits = nums.filter((v) => v === target).length;
  return hits === 1 ? nums.indexOf(target) : null;
}

function rateFor(card: Card, category: string): { rate: EarnRate | null; base: boolean } {
  const exact = card.earn_rates.find((r) => r.category === category);
  if (exact) return { rate: exact, base: false };
  const other = card.earn_rates.find((r) => r.category === "other");
  return { rate: other ?? null, base: !!other };
}

const cents = (r: EarnRate, pointValue: number) => (r.unit === "percent" ? r.rate : r.rate * pointValue);

/**
 * Side-by-side rows for 2-3 cards. Rewards compare by cents per dollar at the user's point
 * value (a card without a bonus uses its base rate, marked "(base)"); fees prefer lower;
 * APR ranges are shown but never "won". Green = `winner`.
 */
export function compareCards(cards: Card[], pointValue: number, activeOffers?: number[]): CompareRow[] {
  const rows: CompareRow[] = [{ kind: "head", label: "Rewards" }];

  for (const cat of CATEGORIES) {
    const found = cards.map((c) => rateFor(c, cat));
    if (found.every((f) => !f.rate)) continue;
    rows.push({
      kind: "row",
      label: cat === "other" ? "Everything else" : CATEGORY_LABELS[cat],
      values: found.map((f) => (f.rate ? `${rateLabel(f.rate)}${f.base ? " (base)" : ""}` : "Not checked")),
      winner: best(found.map((f) => (f.rate ? cents(f.rate, pointValue) : null)), "high"),
    });
  }

  if (rows.length === 1) {
    // No card here has rates on file yet (the weekly scraper fills them in).
    rows.push({ kind: "row", label: "Earn rates", values: cards.map(() => "Not checked yet"), winner: null });
  }

  rows.push({ kind: "head", label: "Fees & rates" });
  rows.push({
    kind: "row",
    label: "Annual fee",
    values: cards.map((c) => money(c.annual_fee)),
    winner: best(cards.map((c) => c.annual_fee ?? null), "low"),
  });
  rows.push({
    kind: "row",
    label: "Foreign transaction fee",
    values: cards.map((c) => percent(c.fx_fee)),
    winner: best(cards.map((c) => c.fx_fee ?? null), "low"),
  });
  rows.push({ kind: "row", label: "Purchase APR", values: cards.map((c) => aprRange(c)), winner: null });

  if (activeOffers) {
    rows.push({ kind: "head", label: "Your offers" });
    rows.push({ kind: "row", label: "Active offers", values: activeOffers.map(String), winner: null });
  }
  return rows;
}

export const MAX_COMPARE = 3;
