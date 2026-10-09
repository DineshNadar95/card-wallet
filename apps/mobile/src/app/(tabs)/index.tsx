import {
  BEST_FOR,
  CATEGORIES,
  CATEGORY_LABELS,
  type CardPick,
  type Category,
  cardArt,
  cents,
  DISCLAIMER,
  greeting,
  rateLabel,
  rewardsCheckedAt,
  unitLine,
  useRecommend,
} from "@card-wallet/shared";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { Button, Loading, Muted, s, SignInCard } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { colors, fonts } from "@/lib/theme";

const title = (p: CardPick) => p.nickname || p.name;

function Chips({ value, onChange }: { value: Category; onChange: (c: Category) => void }) {
  return (
    <View>
      <Text style={st.overline}>Spending on</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips} style={{ marginHorizontal: -16 }}>
        {CATEGORIES.map((c) => {
          const on = c === value;
          return (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(c)}
              style={[st.chip, on && st.chipOn]}
            >
              <Text style={[st.chipText, on && { color: colors.accentDark }]}>{CATEGORY_LABELS[c]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Best({ pick, category }: { pick: CardPick; category: Category }) {
  return (
    <View accessibilityLabel="Best card" style={[st.best, { backgroundColor: cardArt(pick.card_id) }]}>
      <View style={st.rowBetween}>
        <Text style={st.bestFor}>Best for {BEST_FOR[category]}</Text>
        <Text style={st.badge}>Top pick</Text>
      </View>
      <View style={[st.rowBetween, { alignItems: "flex-end", gap: 12 }]}>
        <View style={{ flexShrink: 1 }}>
          <Text style={st.bestName}>{title(pick)}</Text>
          <Text style={st.bestIssuer}>
            {pick.issuer}
            {pick.last4 ? ` · •••• ${pick.last4}` : ""}
          </Text>
        </View>
        {pick.rate && (
          <View style={{ alignItems: "flex-end" }}>
            <Text style={st.bestRate}>{rateLabel(pick.rate)}</Text>
            <Text style={st.bestUnit}>{unitLine(pick.rate)}</Text>
          </View>
        )}
      </View>
      <Text style={st.reason}>{pick.reason}</Text>
      <Link href={{ pathname: "/cards/[id]", params: { id: pick.user_card_id } }} asChild>
        <Pressable accessibilityRole="link" style={st.viewBtn}>
          <Text style={st.viewText}>View card & offers</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function Other({ pick }: { pick: CardPick }) {
  return (
    <Link href={{ pathname: "/cards/[id]", params: { id: pick.user_card_id } }} asChild>
      <Pressable accessibilityRole="link" style={st.other}>
        <View style={[st.otherArt, { backgroundColor: cardArt(pick.card_id) }]} />
        <View style={{ flex: 1 }}>
          <Text style={st.otherName}>{title(pick)}</Text>
          <Text style={st.otherReason}>{pick.reason}</Text>
        </View>
        <Text style={st.otherRate}>{pick.rate ? rateLabel(pick.rate) : "—"}</Text>
      </Pressable>
    </Link>
  );
}

function ScanSoon() {
  // Main.dc.html: location-based suggestions are Phase 7.
  return (
    <View style={st.scan} accessibilityState={{ disabled: true }}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth={2}>
        <Path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" />
        <Circle cx="12" cy="10" r="2.5" />
      </Svg>
      <Text style={st.scanText}>Scan where I am · coming soon</Text>
    </View>
  );
}

function Recommendations() {
  const [category, setCategory] = useState<Category>("dining");
  const { data, isPending, isError, refetch, isRefetching } = useRecommend(category);
  const picks = data?.picks ?? [];
  const [best, ...others] = picks;
  const hasRates = !!best && best.effective_cents != null;
  const checked = rewardsCheckedAt(picks.flatMap((p) => (p.rate ? [p.rate] : [])));

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <ScanSoon />
      <Chips value={category} onChange={setCategory} />

      {isPending && <Loading />}
      {isError && <Muted>Couldn't load your recommendation. Pull to retry.</Muted>}

      {data && picks.length === 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Add the cards you own</Text>
          <Muted>Pick from 600+ US cards. Then we'll tell you which one to use for each purchase.</Muted>
          <Button label="Add a card" onPress={() => router.push("/cards/add")} />
        </View>
      )}

      {best && !hasRates && (
        <View style={s.card}>
          <Text style={s.cardTitle}>No reward rates on file yet</Text>
          <Muted>
            We read each card's earn rates from the issuer's own page every Sunday. Your cards haven't been
            checked yet, so we can't rank them.
          </Muted>
        </View>
      )}

      {best && hasRates && (
        <>
          <Best pick={best} category={category} />
          {others.length > 0 && (
            <View>
              <Text style={st.overline}>Other good options</Text>
              <View style={{ gap: 8 }}>
                {others.map((p) => (
                  <Other key={p.user_card_id} pick={p} />
                ))}
              </View>
            </View>
          )}
        </>
      )}

      {data && (
        <Text style={s.note}>
          {checked ? `Rewards checked ${checked} from issuer pages` : "Rewards from issuer pages, checked weekly"} ·
          Fees: CFPB TCCP · Points valued at {cents(data.point_value_cents)} (
          <Text style={st.link} accessibilityRole="link" onPress={() => router.push("/settings")}>
            change
          </Text>
          ) · {DISCLAIMER}
        </Text>
      )}
    </ScrollView>
  );
}

export default function Home() {
  const { ready, session } = useAuth();
  const name = (session?.user.user_metadata as { full_name?: string } | undefined)?.full_name?.split(" ")[0];
  return (
    <View style={s.screen}>
      <SafeAreaView edges={["top"]} style={st.header}>
        <Text style={st.greeting}>
          {greeting()}
          {name ? `, ${name}` : ""}
        </Text>
        <Text style={st.h1} accessibilityRole="header">
          Which card should you use?
        </Text>
      </SafeAreaView>
      {!ready ? (
        <Loading />
      ) : session ? (
        <Recommendations />
      ) : (
        <View style={s.body}>
          <SignInCard
            title="Sign in to see your cards"
            body="Your wallet is private to your Google account. We only store the cards you add and their last 4 digits."
          />
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 8,
    gap: 4,
  },
  greeting: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  h1: { fontFamily: fonts.bold, fontSize: 22, color: colors.text, letterSpacing: -0.2 },
  overline: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginHorizontal: 2,
    marginBottom: 8,
  },
  chips: { gap: 8, paddingHorizontal: 16 },
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
  scan: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#9AA4B2",
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  scanText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  best: {
    borderRadius: 18,
    padding: 18,
    gap: 14,
    shadowColor: "#14181F",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bestFor: { fontFamily: fonts.semibold, fontSize: 13, color: "#fff", opacity: 0.85 },
  badge: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: "#fff",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  bestName: { fontFamily: fonts.bold, fontSize: 20, color: "#fff" },
  bestIssuer: { fontFamily: fonts.regular, fontSize: 13, color: "#fff", opacity: 0.85 },
  bestRate: { fontFamily: fonts.bold, fontSize: 30, color: "#fff", lineHeight: 32 },
  bestUnit: { fontFamily: fonts.regular, fontSize: 12, color: "#fff", opacity: 0.85 },
  reason: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: "#fff",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    overflow: "hidden",
    lineHeight: 19,
  },
  viewBtn: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  viewText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  other: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  otherArt: { width: 10, height: 34, borderRadius: 4 },
  otherName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  otherReason: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  otherRate: { fontFamily: fonts.bold, fontSize: 16, color: colors.accentDark },
  link: { color: colors.accent, textDecorationLine: "underline", fontFamily: fonts.semibold },
});
