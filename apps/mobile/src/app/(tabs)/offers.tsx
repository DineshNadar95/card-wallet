import { type OfferStatusFilter, useOffers } from "@card-wallet/shared";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { OfferItem } from "@/components/OfferItem";
import { Button, Loading, Muted, s, SignInCard } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { colors, fonts } from "@/lib/theme";

const TABS: { k: OfferStatusFilter; label: string }[] = [
  { k: "active", label: "Active" },
  { k: "ending_soon", label: "Ending soon" },
  { k: "expired", label: "Expired" },
];

function List() {
  const [tab, setTab] = useState<OfferStatusFilter>("active");
  const { data, isPending, isError, refetch, isRefetching } = useOffers({ status: tab });

  return (
    <View style={s.screen}>
      <View style={st.header}>
        <Button label="+ Add offer" onPress={() => router.push("/offers/new")} />
        <View style={st.tabs} accessibilityRole="tablist">
          {TABS.map((t) => {
            const on = t.k === tab;
            return (
              <Pressable
                key={t.k}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setTab(t.k)}
                style={[st.tab, on && st.tabOn]}
              >
                <Text style={[st.tabText, on && st.tabTextOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {isPending && <Loading />}
      {isError && <Muted style={{ padding: 16 }}>Couldn't load your offers. Pull to retry.</Muted>}
      <FlatList
        data={data ?? []}
        keyExtractor={(o) => String(o.id)}
        renderItem={({ item }) => <OfferItem o={item} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={data ? <Text style={st.empty}>Nothing here.</Text> : null}
      />
    </View>
  );
}

export default function OffersTab() {
  const { ready, session } = useAuth();
  if (!ready) return <Loading />;
  if (!session)
    return (
      <View style={[s.screen, s.body]}>
        <SignInCard
          title="Sign in to track offers"
          body="Save card offers and store coupons from a photo or by typing, and get a reminder before they end."
        />
      </View>
    );
  return <List />;
}

const st = StyleSheet.create({
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: 16,
    paddingTop: 12,
    gap: 12,
  },
  tabs: { flexDirection: "row", backgroundColor: colors.borderSubtle, borderRadius: 10, padding: 3 },
  tab: { flex: 1, minHeight: 38, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tabOn: {
    backgroundColor: colors.surface,
    shadowColor: "#14181F",
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  tabTextOn: { fontFamily: fonts.semibold, color: colors.text },
  empty: { textAlign: "center", marginTop: 24, fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
});
