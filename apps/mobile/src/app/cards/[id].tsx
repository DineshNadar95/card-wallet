import { aprRange, cardArt, categoryLabel, money, percent, rateLabel, useMyCard, useRemoveCard } from "@card-wallet/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, List, Loading, Muted, Row, s, SectionLabel, SourceNote } from "@/components/ui";
import { colors, fonts } from "@/lib/theme";

export default function CardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: uc, isPending, isError } = useMyCard(Number(id));
  const remove = useRemoveCard();

  if (isPending) return <Loading />;
  if (isError || !uc)
    return (
      <View style={[s.screen, s.body]}>
        <Muted>This card isn't in your wallet.</Muted>
      </View>
    );

  const c = uc.card;
  const terms: [string, string][] = [
    ["Annual fee", money(c.annual_fee)],
    ["Purchase APR", aprRange(c)],
    ["Foreign transaction fee", percent(c.fx_fee)],
    ["Late fee", c.late_fee ? `Up to ${money(c.late_fee)}` : money(c.late_fee)],
    ["Cash advance APR", aprRange({ purchase_apr_min: c.cash_advance_apr_min, purchase_apr_max: c.cash_advance_apr_max })],
  ];

  const confirmRemove = () =>
    Alert.alert("Remove card?", `Remove ${c.name} from your wallet?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await remove.mutateAsync(uc.id);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.body, { gap: 18 }]}>
      <Stack.Screen options={{ title: uc.nickname || c.name }} />

      <View style={[st.big, { backgroundColor: cardArt(c.id) }]}>
        <View style={st.bigTop}>
          <Text style={st.bigSmall}>{c.issuer}</Text>
          <Text style={st.bigSmall}>{c.network ?? ""}</Text>
        </View>
        <View style={st.chip} />
        <View style={st.bigBottom}>
          <Text style={st.bigName} numberOfLines={2}>
            {uc.nickname || c.name}
          </Text>
          {uc.last4 && <Text style={st.bigNum}>•••• {uc.last4}</Text>}
        </View>
      </View>

      <View>
        <SectionLabel>Earns</SectionLabel>
        <List>
          {c.earn_rates.length ? (
            c.earn_rates.map((r, i) => (
              <Row
                key={r.category}
                left={categoryLabel(r.category)}
                right={<Text style={{ color: colors.accentDark, fontFamily: fonts.bold, fontSize: 16 }}>{rateLabel(r)}</Text>}
                last={i === c.earn_rates.length - 1}
              />
            ))
          ) : (
            <Row left="Reward rates for this card haven't been checked from the issuer's page yet." last />
          )}
        </List>
      </View>

      <View>
        <SectionLabel>Your offers on this card</SectionLabel>
        <List>
          <Row left="Offers & coupons are coming soon." last />
        </List>
      </View>

      <View>
        <SectionLabel>Fees & rates</SectionLabel>
        <List>
          {terms.map(([k, v], i) => (
            <Row key={k} left={k} right={v} last={i === terms.length - 1} />
          ))}
        </List>
        <View style={{ marginTop: 8 }}>
          <SourceNote
            source={`${c.source} (as of ${c.as_of})`}
            rates={c.earn_rates}
            extra="Your actual APR depends on your credit."
          />
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button label="Compare" kind="outline" onPress={() => router.push("/compare")} style={{ flex: 1 }} />
        <Button label="Remove card" kind="danger" onPress={confirmRemove} disabled={remove.isPending} style={{ flex: 1 }} />
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  big: {
    aspectRatio: 1.586,
    borderRadius: 16,
    padding: 18,
    justifyContent: "space-between",
    shadowColor: "#14181F",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  bigTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  bigSmall: { fontFamily: fonts.regular, fontSize: 13, color: "#fff", opacity: 0.85, flexShrink: 1 },
  chip: { width: 40, height: 30, borderRadius: 5, backgroundColor: "#D9C08A" },
  bigBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12 },
  bigName: { fontFamily: fonts.bold, fontSize: 18, color: "#fff", flexShrink: 1 },
  bigNum: { fontFamily: fonts.medium, fontSize: 15, color: "#fff", letterSpacing: 1.5 },
});
