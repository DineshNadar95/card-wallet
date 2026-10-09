import {
  cardArt,
  compareCards,
  DISCLAIMER,
  MAX_COMPARE,
  rewardsCheckedAt,
  useMe,
  useMyCards,
  useOffers,
} from "@card-wallet/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Loading, Muted, s, SignInCard } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { colors, fonts } from "@/lib/theme";

function Comparison() {
  const { data: cards, isPending } = useMyCards();
  const { data: me } = useMe();
  const { data: offers } = useOffers({ status: "active" });
  const [picked, setPicked] = useState<number[] | null>(null);

  if (isPending) return <Loading />;
  const mine = cards ?? [];
  if (mine.length < 2)
    return (
      <View style={[s.screen, s.body]}>
        <View style={s.card}>
          <Text style={s.cardTitle}>Add at least two cards to compare</Text>
          <Button label="Add a card" onPress={() => router.push("/cards/add")} />
        </View>
      </View>
    );

  const slots = (picked ?? mine.slice(0, 2).map((c) => c.id)).filter((id) => mine.some((c) => c.id === id));
  const chosen = slots.map((id) => mine.find((c) => c.id === id)!);
  const pointValue = me?.point_value_cents ?? 1;
  const counts = chosen.map((uc) => (offers ?? []).filter((o) => o.user_card_id === uc.id).length);
  const rows = compareCards(
    chosen.map((c) => c.card),
    pointValue,
    counts,
  );
  const checked = rewardsCheckedAt(chosen.flatMap((c) => c.card.earn_rates));

  const toggle = (id: number) => {
    if (slots.includes(id)) {
      if (slots.length > 2) setPicked(slots.filter((x) => x !== id));
    } else if (slots.length < MAX_COMPARE) {
      setPicked([...slots, id]);
    } else {
      setPicked([...slots.slice(1), id]); // replace the oldest pick
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, gap: 6 }}>
      <Text style={st.hint}>Pick 2 or 3 of your cards</Text>
      <View style={st.chips}>
        {mine.map((uc) => {
          const on = slots.includes(uc.id);
          return (
            <Pressable
              key={uc.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => toggle(uc.id)}
              style={[st.chip, on && { backgroundColor: cardArt(uc.card.id), borderColor: cardArt(uc.card.id) }]}
            >
              <Text style={[st.chipText, on && { color: "#fff" }]} numberOfLines={1}>
                {uc.nickname || uc.card.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {rows.map((r, i) =>
        r.kind === "head" ? (
          <Text key={i} style={st.head}>
            {r.label}
          </Text>
        ) : (
          <View key={i} style={st.row}>
            <Text style={st.label}>{r.label}</Text>
            <View style={st.values}>
              {r.values.map((v, j) => {
                const win = r.winner === j;
                return (
                  <Text
                    key={j}
                    style={[st.value, win && st.better]}
                    accessibilityLabel={win ? `${v}, better value` : v}
                  >
                    {v}
                  </Text>
                );
              })}
            </View>
          </View>
        ),
      )}
      <Text style={[s.note, { marginTop: 10 }]}>
        Green marks the better value at {pointValue}¢ a point. Terms: {chosen[0]?.card.source ?? "CFPB TCCP"} ·{" "}
        {checked ? `Rewards checked ${checked}` : "Reward rates not checked yet"}. {DISCLAIMER}
      </Text>
    </ScrollView>
  );
}

export default function CompareTab() {
  const { ready, session } = useAuth();
  if (!ready) return <Loading />;
  if (!session)
    return (
      <View style={[s.screen, s.body]}>
        <SignInCard title="Sign in to compare your cards" body="See your cards side by side, with the better value in green." />
        <Muted style={{ fontSize: 13 }}>The full catalog comparison is on the web app.</Muted>
      </View>
    );
  return <Comparison />;
}

const st = StyleSheet.create({
  hint: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
    maxWidth: "100%",
  },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  head: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginTop: 14,
    marginBottom: 6,
    marginHorizontal: 2,
  },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  label: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  values: { flexDirection: "row", gap: 10 },
  value: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: "hidden",
  },
  better: { backgroundColor: colors.betterBg, color: colors.betterText },
});
