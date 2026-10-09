import {
  BEST_FOR,
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  nearbyOffers,
  rateLabel,
  useOffers,
  useRecommend,
} from "@card-wallet/shared";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { OfferItem } from "@/components/OfferItem";
import { Button, Loading, Muted, s } from "@/components/ui";
import { colors, fonts } from "@/lib/theme";

type Here = { lat: number; lng: number; accuracy: number | null };

const fmtDistance = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

function BestFor({ category }: { category: Category }) {
  const { data } = useRecommend(category);
  const top = data?.picks[0];
  if (!top) return null;
  return (
    <View style={st.best}>
      <Text style={st.bestLabel}>Best for {BEST_FOR[category]}</Text>
      <Text style={st.bestName}>
        {top.nickname || top.name}
        {top.rate ? ` · ${rateLabel(top.rate)}` : ""}
      </Text>
      <Muted style={{ fontSize: 13 }}>{top.reason}</Muted>
    </View>
  );
}

/**
 * "Scan where I am" (Main.dc.html): one foreground location read, matched on the device against
 * the store pins on the user's offers. The position is never sent anywhere.
 */
export default function Scan() {
  const [here, setHere] = useState<Here | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const { data: offers, isPending } = useOffers({ status: "active" });

  async function locate() {
    setError(null);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return setError("Location is off for Card Wallet. You can turn it on in Settings.");
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
    } catch {
      setError("Couldn't get your location. Try again outdoors or with Wi-Fi on.");
    }
  }

  useEffect(() => {
    locate();
  }, []);

  const near = here && offers ? nearbyOffers(offers, here) : [];
  const nearCategory = near.find((n) => n.offer.category)?.offer.category ?? null;
  const shown = category ?? nearCategory;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      {!here && !error && <Loading />}
      {error && (
        <View style={s.card}>
          <Muted>{error}</Muted>
          <Button label="Try again" onPress={locate} />
        </View>
      )}

      {here && (
        <>
          <Text style={st.head}>Saved offers near you</Text>
          {isPending && <Loading />}
          {near.map(({ offer, distanceM }) => (
            <View key={offer.id} style={{ gap: 4 }}>
              <Text style={st.distance}>{fmtDistance(distanceM)} away</Text>
              <OfferItem o={offer} />
            </View>
          ))}
          {offers && near.length === 0 && (
            <Muted>
              No saved offers pinned near here. When you're at a store, open an offer and pin it, and
              it'll show up here next time.
            </Muted>
          )}

          <Text style={st.head}>What are you buying?</Text>
          <View style={st.chips}>
            {CATEGORIES.map((c) => {
              const on = c === shown;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setCategory(c)}
                  style={[st.chip, on && st.chipOn]}
                >
                  <Text style={[st.chipText, on && { color: colors.accentDark }]}>{CATEGORY_LABELS[c]}</Text>
                </Pressable>
              );
            })}
          </View>
          {shown && <BestFor category={shown} />}
          <Text style={s.note}>
            Your location is only used on this phone to match your saved store pins. It isn't sent to
            Card Wallet's servers.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  head: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginTop: 4,
  },
  distance: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accentDark },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentTint },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  best: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  bestLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  bestName: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
});
