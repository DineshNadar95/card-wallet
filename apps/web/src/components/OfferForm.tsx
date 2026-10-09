import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  LOW_CONFIDENCE,
  OFFER_KINDS,
  type OfferDraft,
  type OfferFormValues,
  offerProblems,
  REMIND_OPTIONS,
  useMyCards,
} from "@card-wallet/shared";
import { type FormEvent, type ReactNode, useState } from "react";

export { applyDraft, emptyOffer, type OfferFormValues, toInput } from "@card-wallet/shared";

function Badge({ conf }: { conf?: number }) {
  if (conf == null) return null;
  if (conf === 0) return null;
  return conf < LOW_CONFIDENCE ? (
    <span className="badge badge-check">Check this</span>
  ) : (
    <span className="badge badge-shot">From screenshot</span>
  );
}

function Field({
  id,
  label,
  conf,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  conf?: number;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <div className="field-label">
        <label htmlFor={id}>{label}</label>
        <Badge conf={conf} />
      </div>
      {children}
      {error && (
        <small className="error" id={`${id}-err`}>
          {error}
        </small>
      )}
    </div>
  );
}

export function OfferForm({
  values,
  onChange,
  draft,
  onSubmit,
  submitLabel,
  busy,
  error,
  extraActions,
}: {
  values: OfferFormValues;
  onChange: (v: OfferFormValues) => void;
  draft?: OfferDraft | null;
  onSubmit: () => void;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  extraActions?: ReactNode;
}) {
  const { data: cards } = useMyCards();
  const [touched, setTouched] = useState(false);
  const errs = touched ? offerProblems(values) : {};
  const set = <K extends keyof OfferFormValues>(k: K, val: OfferFormValues[K]) => onChange({ ...values, [k]: val });
  const conf = (k: keyof OfferDraft) => (draft && k !== "is_offer" ? draft[k].confidence : undefined);

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(offerProblems(values)).length === 0) onSubmit();
  }

  const unit = values.kind === "percent_back" ? "%" : values.kind === "points" ? "x" : null;

  return (
    <form className="offer-form" onSubmit={submit} noValidate>
      <Field id="card" label={<>Card <span className="muted normal">(optional)</span></>}>
        <select id="card" value={values.user_card_id} onChange={(e) => set("user_card_id", e.target.value)}>
          <option value="">No card — store coupon</option>
          {cards?.map((uc) => (
            <option key={uc.id} value={uc.id}>
              {uc.nickname || uc.card.name}
              {uc.last4 ? ` •••• ${uc.last4}` : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field id="merchant" label="Merchant or store" conf={conf("merchant")} error={errs.merchant}>
        <input
          id="merchant"
          value={values.merchant}
          maxLength={200}
          onChange={(e) => set("merchant", e.target.value)}
          aria-invalid={!!errs.merchant}
        />
      </Field>

      <div className="field">
        <div className="field-label">
          <span id="kind-label">Offer type</span>
          <Badge conf={conf("kind")} />
        </div>
        <div className="seg-buttons four" role="group" aria-labelledby="kind-label">
          {OFFER_KINDS.map(({ k, label }) => (
            <button key={k} type="button" aria-pressed={values.kind === k} onClick={() => set("kind", k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="two">
        {values.kind !== "code" ? (
          <Field id="value" label="Value" conf={conf("value")} error={errs.value}>
            <div className="affix">
              {values.kind === "amount_off" && <span>$</span>}
              <input
                id="value"
                inputMode="decimal"
                value={values.value}
                onChange={(e) => set("value", e.target.value)}
                aria-invalid={!!errs.value}
              />
              {unit && <span>{unit}</span>}
            </div>
          </Field>
        ) : (
          <div />
        )}
        <Field id="max_back" label="Max back" conf={conf("max_back")} error={errs.max_back}>
          <div className="affix">
            <span>$</span>
            <input id="max_back" inputMode="decimal" value={values.max_back} onChange={(e) => set("max_back", e.target.value)} />
          </div>
        </Field>
      </div>

      <div className="two">
        <Field id="min_spend" label="Min spend" conf={conf("min_spend")} error={errs.min_spend}>
          <div className="affix">
            <span>$</span>
            <input id="min_spend" inputMode="decimal" value={values.min_spend} onChange={(e) => set("min_spend", e.target.value)} />
          </div>
        </Field>
        <Field id="expires_at" label="Expires" conf={conf("expires_at")}>
          <input id="expires_at" type="date" value={values.expires_at} onChange={(e) => set("expires_at", e.target.value)} />
        </Field>
      </div>

      <div className="two">
        <Field id="code" label={<>Code <span className="muted normal">(optional)</span></>} conf={conf("code")} error={errs.code}>
          <input id="code" value={values.code} maxLength={100} autoComplete="off" onChange={(e) => set("code", e.target.value)} />
        </Field>
        <Field id="category" label="Category" conf={conf("category")}>
          <select id="category" value={values.category} onChange={(e) => set("category", e.target.value as Category | "")}>
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="notes" label={<>Notes <span className="muted normal">(optional)</span></>} conf={conf("notes")}>
        <input id="notes" value={values.notes} maxLength={500} placeholder="e.g. One use, in-store only" onChange={(e) => set("notes", e.target.value)} />
      </Field>

      <div className="field remind">
        <span id="remind-label" className="field-label">
          Remind me before it ends
        </span>
        <div className="seg-buttons four" role="group" aria-labelledby="remind-label">
          {REMIND_OPTIONS.map(({ d, label }) => (
            <button key={d} type="button" aria-pressed={values.remind_days === d} onClick={() => set("remind_days", d)}>
              {label}
            </button>
          ))}
        </div>
        {values.remind_days > 0 && !values.expires_at && (
          <small className="muted">Add an expiry date to get a reminder.</small>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="form-actions">
        {extraActions}
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
