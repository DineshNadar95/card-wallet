import type { components } from "./schema.gen";
import { CATEGORY_LABELS } from "./tokens";

type EarnRate = components["schemas"]["EarnRateOut"];
type CardTerms = {
  annual_fee?: number | null;
  fx_fee?: number | null;
  purchase_apr_min?: number | null;
  purchase_apr_max?: number | null;
};

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, ""));

export const money = (n: number | null | undefined) =>
  n == null ? "Not reported" : n === 0 ? "$0" : `$${num(n)}`;

export const percent = (n: number | null | undefined) =>
  n == null ? "Not reported" : n === 0 ? "None" : `${num(n)}%`;

export function aprRange(c: CardTerms): string {
  const { purchase_apr_min: lo, purchase_apr_max: hi } = c;
  if (lo == null && hi == null) return "Not reported";
  if (lo == null || hi == null || lo === hi) return `${num((lo ?? hi)!)}%`;
  return `${num(lo)}%–${num(hi)}%`;
}

/** "4x" for points/miles, "3%" for cash back. */
export const rateLabel = (r: Pick<EarnRate, "rate" | "unit">) =>
  r.unit === "percent" ? `${num(r.rate)}%` : `${num(r.rate)}x`;

export const categoryLabel = (c: EarnRate["category"]) => CATEGORY_LABELS[c];

/** Highest rate by face value; Phase 3's recommender does the real cents-per-dollar ranking. */
export const topRate = (rates: EarnRate[]) =>
  rates.length ? rates.reduce((a, b) => (b.rate > a.rate ? b : a)) : null;

/** Latest earn-rate check date, for "Rewards checked …" lines. */
export function rewardsCheckedAt(rates: EarnRate[]): string | null {
  if (!rates.length) return null;
  const latest = rates.map((r) => r.checked_at).sort().at(-1)!;
  return shortDate(latest);
}

export const shortDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// Card art colors from the designs. Picked by id so a card keeps its color.
const ART = ["#7A2E3A", "#2F5D3A", "#1F3A6B", "#5A4632", "#3B3F6B", "#2E4A52", "#6B2F3A", "#4F5B4A"];
export const cardArt = (id: number) => ART[Math.abs(id) % ART.length];
