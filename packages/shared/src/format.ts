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

/** Source dates read the same for every viewer, so format in UTC. */
export const shortDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

// Card art colors from the designs. Picked by id so a card keeps its color.
const ART = ["#7A2E3A", "#2F5D3A", "#1F3A6B", "#5A4632", "#3B3F6B", "#2E4A52", "#6B2F3A", "#4F5B4A"];
export const cardArt = (id: number) => ART[Math.abs(id) % ART.length];

/** "Best for …" wording from the designs. */
export const BEST_FOR: Record<keyof typeof CATEGORY_LABELS, string> = {
  dining: "dining",
  groceries: "groceries",
  travel: "travel",
  gas: "gas",
  online: "online shopping",
  other: "everyday spend",
};

/** Small line under the big rate on the top pick, e.g. "points on dining". */
export function unitLine(rate: Pick<EarnRate, "unit" | "category">): string {
  const unit = rate.unit === "percent" ? "cash back" : rate.unit;
  const where = rate.category === "other" ? "everything" : categoryLabel(rate.category).toLowerCase();
  return `${unit} on ${where}`;
}

/** 1 -> "1¢", 1.25 -> "1.25¢". */
export const cents = (n: number) => `${num(n)}¢`;

export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

// ---------------------------------------------------------------- offers

type OfferLike = Pick<
  components["schemas"]["OfferOut"],
  "kind" | "value" | "code" | "min_spend" | "max_back" | "notes" | "status" | "days_left" | "expires_at" | "source" | "card"
>;

export function offerValue(o: Pick<OfferLike, "kind" | "value" | "code">): string {
  switch (o.kind) {
    case "percent_back":
      return `${num(o.value ?? 0)}% back`;
    case "amount_off":
      return `$${num(o.value ?? 0)} off`;
    case "points":
      return `${num(o.value ?? 0)}x pts`;
    default:
      return o.code ? `Code ${o.code}` : "Coupon";
  }
}

/** "Spend $50+, up to $15 back · One use" */
export function offerDetail(o: OfferLike): string {
  const terms: string[] = [];
  if (o.min_spend) terms.push(`Spend $${num(o.min_spend)}+`);
  if (o.max_back) terms.push(`up to $${num(o.max_back)} back`);
  const parts = [terms.join(", ")];
  if (o.kind !== "code" && o.code) parts.push(`code ${o.code}`);
  if (o.notes) parts.push(o.notes);
  return parts.filter(Boolean).join(" · ");
}

export function offerDue(o: Pick<OfferLike, "status" | "days_left" | "expires_at" | "source">): string {
  if (o.days_left == null) return o.source === "card_benefit" ? "Card benefit" : "No end date";
  if (o.status === "expired") return "Expired";
  if (o.days_left === 0) return "Ends today";
  if (o.days_left === 1) return "Ends tomorrow";
  if (o.status === "ending_soon") return `Ends in ${o.days_left} days`;
  return `Ends ${shortDate(o.expires_at!)}`;
}

export const OFFER_SOURCE_LABELS = { screenshot: "Screenshot", typed: "Typed", card_benefit: "Card benefit" } as const;

export function offerCardLabel(o: Pick<OfferLike, "card">): string {
  if (!o.card) return "Coupon · no card";
  return `${o.card.nickname || o.card.name}${o.card.last4 ? ` •••• ${o.card.last4}` : ""}`;
}
