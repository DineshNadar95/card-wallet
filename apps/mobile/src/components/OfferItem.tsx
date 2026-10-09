import {
  cardArt,
  OFFER_SOURCE_LABELS,
  type Offer,
  offerCardLabel,
  offerDetail,
  offerDue,
  offerValue,
} from "@card-wallet/shared";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/lib/theme";

export function OfferItem({ o }: { o: Offer }) {
  const urgent = o.status === "ending_soon";
  const detail = offerDetail(o);
  return (
    <Link href={{ pathname: "/offers/[id]", params: { id: o.id } }} asChild>
      <Pressable
        accessibilityRole="link"
        style={[st.item, { borderLeftColor: o.card ? cardArt(o.card.card_id) : "#9AA4B2" }]}
      >
        <View style={st.top}>
          <Text style={st.merchant} numberOfLines={1}>
            {o.merchant}
          </Text>
          <Text style={st.value}>{offerValue(o)}</Text>
        </View>
        {!!detail && <Text style={st.detail}>{detail}</Text>}
        <View style={st.bottom}>
          <Text style={st.meta} numberOfLines={1}>
            {offerCardLabel(o)} · <Text style={urgent ? st.urgent : undefined}>{offerDue(o)}</Text>
          </Text>
          <Text style={st.pill}>{OFFER_SOURCE_LABELS[o.source]}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

const st = StyleSheet.create({
  item: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  top: { flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "baseline" },
  merchant: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, flexShrink: 1 },
  value: { fontFamily: fonts.bold, fontSize: 16, color: colors.offerText },
  detail: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  bottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  urgent: { color: colors.urgent, fontFamily: fonts.semibold },
  pill: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.ground,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
});
