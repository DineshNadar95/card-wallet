import { useUpdateMe } from "@card-wallet/shared";
import { type FormEvent, useEffect, useRef, useState } from "react";

/** Points/miles are worth whatever you redeem them for; this is the user's own assumption. */
export function PointValueDialog({ current, onClose }: { current: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const update = useUpdateMe();
  const [value, setValue] = useState(String(current));

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
  }, []);

  const n = Number(value);
  const valid = value.trim() !== "" && n > 0 && n <= 10;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    await update.mutateAsync({ point_value_cents: n });
    onClose();
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="pv-title">
      <form method="dialog" onSubmit={submit}>
        <h2 id="pv-title" className="dialog-title">
          What's a point worth to you?
        </h2>
        <p className="muted small">
          Card Wallet multiplies points and miles by this to compare them with cash back. 1¢ is a
          common baseline; transfer partners can be worth more, gift cards often less.
        </p>
        <div className="field">
          <label htmlFor="pv">Cents per point or mile</label>
          <input
            id="pv"
            type="number"
            inputMode="decimal"
            min="0.1"
            max="10"
            step="0.05"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={!valid}
          />
        </div>
        {update.isError && <p className="error">{update.error.message}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!valid || update.isPending}>
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
