import { type CardSummary, cardArt, useAddCard } from "@card-wallet/shared";
import { type FormEvent, useEffect, useRef, useState } from "react";

export function AddCardDialog({ card, onClose }: { card: CardSummary; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const add = useAddCard();
  const [last4, setLast4] = useState("");
  const [nickname, setNickname] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
  }, []);

  const valid = last4 === "" || /^\d{4}$/.test(last4);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    await add.mutateAsync({ card_id: card.id, last4: last4 || null, nickname: nickname.trim() || null });
    setDone(true);
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="add-title">
      <form method="dialog" onSubmit={submit}>
        <div className="dialog-card" style={{ background: cardArt(card.id) }}>
          <div className="strong">{card.name}</div>
          <div className="small">{card.issuer}</div>
        </div>
        {done ? (
          <>
            <h2 id="add-title" className="dialog-title">
              Added to your wallet
            </h2>
            <div className="dialog-actions">
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="add-title" className="dialog-title">
              Add to wallet
            </h2>
            <div className="field">
              <label htmlFor="last4">Last 4 digits (optional)</label>
              <input
                id="last4"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                pattern="\d{4}"
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                aria-invalid={!valid}
                aria-describedby="last4-help"
              />
              <small id="last4-help" className="muted">
                Only so you can tell cards apart. We never ask for or store your full card number.
              </small>
            </div>
            <label className="field">
              <span>Nickname (optional)</span>
              <input value={nickname} maxLength={100} onChange={(e) => setNickname(e.target.value)} />
            </label>
            {add.isError && <p className="error">{add.error.message}</p>}
            <div className="dialog-actions">
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={!valid || add.isPending}>
                {add.isPending ? "Adding…" : "Add card"}
              </button>
            </div>
          </>
        )}
      </form>
    </dialog>
  );
}
