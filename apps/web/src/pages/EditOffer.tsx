import { type Offer, useDeleteOffer, useOffer, useUpdateOffer } from "@card-wallet/shared";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { OfferForm, type OfferFormValues, toInput } from "../components/OfferForm";
import { DemoGate, RequireAuth } from "../components/SignIn";

const s = (v: number | null) => (v == null ? "" : String(v));

function fromOffer(o: Offer): OfferFormValues {
  return {
    user_card_id: o.user_card_id ? String(o.user_card_id) : "",
    merchant: o.merchant,
    kind: o.kind,
    value: s(o.value),
    max_back: s(o.max_back),
    min_spend: s(o.min_spend),
    expires_at: o.expires_at ?? "",
    code: o.code ?? "",
    category: o.category ?? "",
    notes: o.notes ?? "",
    remind_days: ([0, 3, 5, 7].includes(o.remind_days) ? o.remind_days : 0) as 0 | 3 | 5 | 7,
    place: o.place_lat != null && o.place_lng != null ? { lat: o.place_lat, lng: o.place_lng } : null,
    place_label: o.place_label ?? "",
  };
}

function Edit({ offer }: { offer: Offer }) {
  const navigate = useNavigate();
  const update = useUpdateOffer(offer.id);
  const del = useDeleteOffer();
  const [values, setValues] = useState(() => fromOffer(offer));

  async function save() {
    const { source: _source, ...patch } = toInput(values, offer.source);
    await update.mutateAsync(patch);
    navigate("/app/offers");
  }

  async function remove() {
    if (!window.confirm(`Delete the ${offer.merchant} offer?`)) return;
    await del.mutateAsync(offer.id);
    navigate("/app/offers");
  }

  return (
    <OfferForm
      values={values}
      onChange={setValues}
      onSubmit={save}
      submitLabel="Save changes"
      busy={update.isPending}
      error={update.error?.message ?? del.error?.message}
      extraActions={
        <button type="button" className="btn btn-danger btn-lg" onClick={remove} disabled={del.isPending}>
          Delete
        </button>
      }
    />
  );
}

function Loader() {
  const { id } = useParams();
  const { data, isPending, isError } = useOffer(Number(id));
  if (isPending) return <p className="muted">Loading…</p>;
  if (isError || !data)
    return (
      <div className="panel">
        Offer not found. <Link to="/app/offers">Back to offers</Link>
      </div>
    );
  return <Edit offer={data} />;
}

export function EditOffer() {
  return (
    <section className="page page-narrow">
      <div className="page-head">
        <h1 className="page-title">Edit offer</h1>
        <Link to="/app/offers" className="small strong">
          Cancel
        </Link>
      </div>
      <RequireAuth>
        <DemoGate what="edit offers">
          <Loader />
        </DemoGate>
      </RequireAuth>
    </section>
  );
}

