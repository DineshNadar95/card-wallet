import { type OfferDraft, useCreateOffer, useParseOfferImage } from "@card-wallet/shared";
import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { applyDraft, emptyOffer, OfferForm, type OfferFormValues, toInput } from "../components/OfferForm";
import { DemoGate, RequireAuth } from "../components/SignIn";
import { prepareImage } from "../lib/image";

type Mode = "photo" | "type";

function countRead(d: OfferDraft): number {
  const keys = ["merchant", "kind", "value", "max_back", "min_spend", "expires_at", "code", "notes"] as const;
  return keys.filter((k) => d[k].value != null).length;
}

function PhotoPicker({ onDraft }: { onDraft: (d: OfferDraft) => void }) {
  const parse = useParseOfferImage();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<OfferDraft | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function handle(file: File | undefined) {
    if (!file) return;
    setError(null);
    setDraft(null);
    try {
      const blob = await prepareImage(file);
      setPreview(URL.createObjectURL(blob));
      const form = new FormData();
      form.append("image", blob, "offer.jpg");
      const d = await parse.mutateAsync(form);
      setDraft(d);
      onDraft(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that image.");
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    handle(e.dataTransfer.files[0]);
  };

  return (
    <div className="photo">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        id="photo-input"
        onChange={(e: ChangeEvent<HTMLInputElement>) => handle(e.target.files?.[0])}
      />
      {!preview ? (
        <label htmlFor="photo-input" className="drop" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <span className="strong">Choose a photo or drop a screenshot</span>
          <span className="small muted">We read the merchant, value and expiry. You check them before saving.</span>
        </label>
      ) : (
        <div className="photo-card">
          <img src={preview} alt="Your offer screenshot" className="thumb" />
          <div className="photo-text">
            {parse.isPending && <div className="strong">Reading your screenshot…</div>}
            {draft && (
              <>
                <div className="strong">
                  {draft.is_offer
                    ? `Read ${countRead(draft)} details from your screenshot`
                    : "This doesn't look like an offer"}
                </div>
                <div className="small muted">Check them below before saving — photos can be misread.</div>
              </>
            )}
            {error && <div className="error small">{error}</div>}
            <button type="button" className="link-button" onClick={() => input.current?.click()}>
              Retake or choose another
            </button>
          </div>
        </div>
      )}
      {!preview && error && <p className="error small">{error}</p>}
    </div>
  );
}

function Add() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const create = useCreateOffer();
  const [mode, setMode] = useState<Mode>("photo");
  const [values, setValues] = useState<OfferFormValues>(() => emptyOffer(params.get("card") ?? undefined));
  const [draft, setDraft] = useState<OfferDraft | null>(null);

  async function save() {
    await create.mutateAsync(toInput(values, draft ? "screenshot" : "typed"));
    navigate("/app/offers");
  }

  return (
    <>
      <div className="seg-tabs" role="tablist" aria-label="How to add">
        {(
          [
            ["photo", "From a photo"],
            ["type", "Type it in"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)}>
            {label}
          </button>
        ))}
      </div>

      {mode === "photo" && (
        <PhotoPicker
          onDraft={(d) => {
            setDraft(d);
            setValues((v) => applyDraft(v, d));
          }}
        />
      )}

      {(mode === "type" || draft) && (
        <OfferForm
          values={values}
          onChange={setValues}
          draft={mode === "photo" ? draft : null}
          onSubmit={save}
          submitLabel="Save offer"
          busy={create.isPending}
          error={create.error?.message}
        />
      )}
    </>
  );
}

export function AddOffer() {
  return (
    <section className="page page-narrow">
      <div className="page-head">
        <h1 className="page-title">Add an offer</h1>
        <Link to="/app/offers" className="small strong">
          Cancel
        </Link>
      </div>
      <RequireAuth>
        <DemoGate what="add offers">
          <Add />
        </DemoGate>
      </RequireAuth>
    </section>
  );
}

