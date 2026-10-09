import { cardArt, categoryLabel, rateLabel, useCatalog, useMyCards, useOffers } from "@card-wallet/shared";
import { Link, router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Loading, Muted, s, SignInCard, SourceNote } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { colors, fonts } from "@/lib/theme";

function Wallet() {
  const { data: cards, isPending, isError, refetch, isRefetching } = useMyCards();
  const { data: catalog } = useCatalog({ limit: 1 });
  const { data: offers } = useOffers({ status: "active" });
  const offerCount = new Map<number, number>();
  for (const o of offers ?? []) if (o.user_card_id) offerCount.set(o.user_card_id, (offerCount.get(o.user_card_id) ?? 0) + 1);
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <View style={st.head}>
        <Muted>{cards ? `${plural(cards.length, "card")} · ${plural(offers?.length ?? 0, "active offer")}` : " "}</Muted>
        <Button label="+ Add card" onPress={() => router.push("/cards/add")} />
      </View>

      {isPending && <Loading />}
      {isError && <Muted>Couldn't load your cards. Pull to retry.</Muted>}

      {cards?.map((uc) => (
        <Link key={uc.id} href={{ pathname: "/cards/[id]", params: { id: uc.id } }} asChild>
          <Pressable accessibilityRole="link" style={st.card}>
            <View style={[st.art, { backgroundColor: cardArt(uc.card.id) }]}>
              {!!offerCount.get(uc.id) && <Text style={st.badge}>{plural(offerCount.get(uc.id)!, "offer")}</Text>}
              <Text style={st.name}>{uc.nickname || uc.card.name}</Text>
              <Text style={st.meta}>
                {uc.card.issuer}
                {uc.last4 ? ` · •••• ${uc.last4}` : ""}
              </Text>
            </View>
            <View style={st.chips}>
              {uc.card.earn_rates.length ? (
                uc.card.earn_rates.map((r) => (
                  <Text key={r.category} style={st.chip}>
                    <Text style={{ fontFamily: fonts.bold }}>{rateLabel(r)}</Text> {categoryLabel(r.category)}
                  </Text>
                ))
              ) : (
                <Muted style={{ fontSize: 12 }}>Reward rates not checked yet</Muted>
              )}
            </View>
          </Pressable>
        </Link>
      ))}

      <Pressable accessibilityRole="button" style={st.addTile} onPress={() => router.push("/cards/add")}>
        <Text style={st.addTitle}>Add from {catalog ? catalog.total.toLocaleString() : ""} US cards</Text>
        <Muted style={{ fontSize: 13 }}>
          Search by name. Fees, APRs and base rewards fill in automatically. We never ask for your full card
          number — only the last 4, so you can tell cards apart.
        </Muted>
      </Pressable>

      <SourceNote source={cards?.[0]?.card.source} rates={cards?.flatMap((c) => c.card.earn_rates)} />
    </ScrollView>
  );
}

export default function CardsTab() {
  const { ready, session } = useAuth();
  if (!ready) return <Loading />;
  if (!session)
    return (
      <View style={[s.screen, s.body]}>
        <SignInCard
          title="Sign in to see your cards"
          body="Your wallet is private to your Google account. We only store the cards you add and their last 4 digits."
        />
      </View>
    );
  return <Wallet />;
}

const st = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  art: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 14, justifyContent: "flex-end" },
  name: { fontFamily: fonts.bold, fontSize: 17, color: "#fff" },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: "#fff", opacity: 0.85 },
  chips: { padding: 12, paddingHorizontal: 16, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    fontFamily: fonts.regular,
    fontSize: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.ground,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    color: colors.text,
  },
  badge: {
    position: "absolute",
    top: 12,
    right: 12,
    fontFamily: fonts.semibold,
    fontSize: 12,
    backgroundColor: colors.offerBg,
    color: colors.offerText,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  addTile: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#9AA4B2",
    borderRadius: 16,
    padding: 16,
    gap: 6,
    backgroundColor: colors.surface,
  },
  addTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
});
