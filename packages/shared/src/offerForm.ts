import type { OfferDraft, OfferInput } from "./index";
import type { Category } from "./tokens";

/** Form state and rules for adding/editing an offer, shared by web and mobile. */
export type OfferKind = OfferInput["kind"];
export const OFFER_KINDS: { k: OfferKind; label: string }[] = [
  { k: "percent_back", label: "% back" },
  { k: "amount_off", label: "$ off" },
  { k: "points", label: "Points" },
  { k: "code", label: "Code only" },
];
export const REMIND_OPTIONS: { d: 0 | 3 | 5 | 7; label: string }[] = [
  { d: 0, label: "Off" },
  { d: 3, label: "3 days" },
  { d: 5, label: "5 days" },
  { d: 7, label: "1 week" },
];
export const LOW_CONFIDENCE = 0.6;

export type OfferFormValues = {
  user_card_id: string; // "" = store coupon
  merchant: string;
  kind: OfferKind;
  value: string;
  max_back: string;
  min_spend: string;
  expires_at: string;
  code: string;
  category: Category | "";
  notes: string;
  remind_days: 0 | 3 | 5 | 7;
  /** Optional store pin (Phase 7). Set from "Use my current location"; never typed by hand. */
  place: { lat: number; lng: number } | null;
  place_label: string;
};

export const emptyOffer = (cardId?: string): OfferFormValues => ({
  user_card_id: cardId ?? "",
  merchant: "",
  kind: "percent_back",
  value: "",
  max_back: "",
  min_spend: "",
  expires_at: "",
  code: "",
  category: "",
  notes: "",
  remind_days: 3,
  place: null,
  place_label: "",
});

const str = (v: number | string | null | undefined) => (v == null ? "" : String(v));

/** Prefill from what the photo reader saw. Fields it didn't see stay as they were. */
export function applyDraft(v: OfferFormValues, d: OfferDraft): OfferFormValues {
  return {
    ...v,
    merchant: d.merchant.value ?? v.merchant,
    kind: d.kind.value ?? v.kind,
    value: d.value.value != null ? str(d.value.value) : v.value,
    max_back: d.max_back.value != null ? str(d.max_back.value) : v.max_back,
    min_spend: d.min_spend.value != null ? str(d.min_spend.value) : v.min_spend,
    expires_at: d.expires_at.value ?? v.expires_at,
    code: d.code.value ?? v.code,
    category: d.category.value ?? v.category,
    notes: d.notes.value ?? v.notes,
  };
}

const optNum = (s: string) => (s.trim() === "" ? null : Number(s));

export function toInput(v: OfferFormValues, source: OfferInput["source"]): OfferInput {
  return {
    user_card_id: v.user_card_id ? Number(v.user_card_id) : null,
    merchant: v.merchant.trim(),
    kind: v.kind,
    value: v.kind === "code" ? null : optNum(v.value),
    max_back: optNum(v.max_back),
    min_spend: optNum(v.min_spend),
    expires_at: v.expires_at || null,
    code: v.code.trim() || null,
    category: v.category || null,
    notes: v.notes.trim() || null,
    source,
    remind_days: v.remind_days,
    place_lat: v.place?.lat ?? null,
    place_lng: v.place?.lng ?? null,
    place_radius_m: null,
    place_label: v.place ? v.place_label.trim() || null : null,
  };
}

export function offerProblems(v: OfferFormValues): Partial<Record<keyof OfferFormValues, string>> {
  const p: Partial<Record<keyof OfferFormValues, string>> = {};
  if (!v.merchant.trim()) p.merchant = "Add the merchant or store";
  const n = Number(v.value);
  if (v.kind === "percent_back" && !(n > 0 && n <= 100)) p.value = "Enter a percent between 0 and 100";
  if ((v.kind === "amount_off" || v.kind === "points") && !(n > 0)) p.value = "Enter a value above 0";
  if (v.kind === "code" && !v.code.trim()) p.code = "Add the code";
  for (const f of ["max_back", "min_spend"] as const) if (v[f] && !(Number(v[f]) >= 0)) p[f] = "Enter an amount";
  return p;
}

