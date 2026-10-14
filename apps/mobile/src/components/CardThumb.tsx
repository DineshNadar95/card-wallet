import { cardArt } from "@card-wallet/shared";
import { useState } from "react";
import { Image, type StyleProp, View, type ViewStyle } from "react-native";

export type ArtCard = { id: number; name: string; image_url?: string | null };

/**
 * The card's own picture, linked from the issuer's product page (never re-hosted), at card
 * proportions. Shows the card's color while loading, and instead of a missing or broken picture.
 */
export function CardThumb({ card, width, style }: { card: ArtCard; width: number; style?: StyleProp<ViewStyle> }) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  const height = Math.round(width / 1.586);
  const radius = Math.max(4, Math.round(width / 16));
  if (card.image_url && state !== "failed")
    return (
      <Image
        source={{ uri: card.image_url }}
        accessibilityLabel={`${card.name} card`}
        resizeMode="contain"
        onLoad={() => setState("loaded")}
        onError={() => setState("failed")}
        style={[
          { width, height, borderRadius: radius },
          state === "loading" && { backgroundColor: cardArt(card.id) },
          style as object,
        ]}
      />
    );
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: cardArt(card.id),
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.18)",
          overflow: "hidden",
        },
        style,
      ]}
    >
      {/* Darker lower half, so the block reads as a card on a band of the same color. */}
      <View style={{ flex: 1, marginTop: height / 2, backgroundColor: "rgba(20,24,31,0.35)" }} />
    </View>
  );
}
