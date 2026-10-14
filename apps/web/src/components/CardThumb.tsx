import { cardArt } from "@card-wallet/shared";
import { useState } from "react";

export type ArtCard = { id: number; name: string; image_url?: string | null };

const plain = (id: number) => `linear-gradient(135deg, ${cardArt(id)}, #14181F)`;

/**
 * The card's own picture, linked from the issuer's product page (never re-hosted), at card
 * proportions. Shows the card's color while loading, and instead of a missing or broken picture.
 */
export function CardThumb({ card, width, className = "" }: { card: ArtCard; width: number; className?: string }) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  const height = Math.round(width / 1.586);
  if (card.image_url && state !== "failed")
    return (
      <img
        className={`card-thumb ${className}`}
        src={card.image_url}
        alt={`${card.name} card`}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        style={state === "loading" ? { background: plain(card.id) } : undefined}
        onLoad={() => setState("loaded")}
        onError={() => setState("failed")}
      />
    );
  return (
    <span
      className={`card-thumb card-thumb-plain ${className}`}
      style={{ width, height, background: plain(card.id) }}
      aria-hidden="true"
    />
  );
}
