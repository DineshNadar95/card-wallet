import { type CardSummary, cardArt, money, useAddCard, useCatalog } from "@card-wallet/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { CardThumb } from "@/components/CardThumb";
import { Button, Loading, Muted, s, SourceNote } from "@/components/ui";
import { colors, fonts } from "@/lib/theme";

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Confirm({ card, onBack }: { card: CardSummary; onBack: () => void }) {
  const add = useAddCard();
  const [last4, setLast4] = useState("");
  const [nickname, setNickname] = useState("");
  const valid = last4 === "" || /^\d{4}$/.test(last4);

  async function save() {
    await add.mutateAsync({ card_id: card.id, last4: last4 || null, nickname: nickname.trim() || null });
    router.back();
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.body}>
        <View style={[st.preview, { backgroundColor: cardArt(card.id) }]}>
          <CardThumb card={card} width={96} style={{ marginBottom: 10 }} />
          <Text style={st.previewName}>{card.name}</Text>
          <Text style={st.previewIssuer}>{card.issuer}</Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={st.label} nativeID="last4Label">
            Last 4 digits (optional)
          </Text>
          <TextInput
            accessibilityLabelledBy="last4Label"
            style={[s.input, !valid && { borderColor: colors.urgent }]}
            keyboardType="number-pad"
            maxLength={4}
            value={last4}
            onChangeText={(t) => setLast4(t.replace(/\D/g, "").slice(0, 4))}
            autoComplete="off"
          />
          <Muted style={{ fontSize: 12 }}>
            Only so you can tell cards apart. We never ask for or store your full card number.
          </Muted>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={st.label} nativeID="nickLabel">
            Nickname (optional)
          </Text>
          <TextInput accessibilityLabelledBy="nickLabel" style={s.input} maxLength={100} value={nickname} onChangeText={setNickname} />
        </View>

        {add.isError && <Text style={{ color: colors.urgent }}>{add.error.message}</Text>}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button label="Back" kind="outline" onPress={onBack} style={{ flex: 1 }} />
          <Button label={add.isPending ? "Adding…" : "Add card"} onPress={save} disabled={!valid || add.isPending} style={{ flex: 1 }} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function AddCard() {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<CardSummary | null>(null);
  const q = useDebounced(query.trim());
  const { data, isPending, isError } = useCatalog({ q: q || undefined, limit: 50 });

  if (picked) return <Confirm card={picked} onBack={() => setPicked(null)} />;

  return (
    <View style={s.screen}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <TextInput
          accessibilityLabel="Search cards"
          placeholder="Search card or issuer"
          placeholderTextColor={colors.textSecondary}
          style={s.input}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>
      {isPending && <Loading />}
      {isError && <Muted style={{ padding: 16 }}>Couldn't load the catalog.</Muted>}
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(c) => String(c.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 8 }}
        ListEmptyComponent={data ? <Muted>No cards match.</Muted> : null}
        ListFooterComponent={
          data ? (
            <View style={{ marginTop: 8, gap: 4 }}>
              {data.total > data.items.length && (
                <Muted style={{ fontSize: 12 }}>
                  Showing {data.items.length} of {data.total.toLocaleString()}. Keep typing to narrow it down.
                </Muted>
              )}
              <SourceNote source={data.items[0]?.source} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" style={st.item} onPress={() => setPicked(item)}>
            <CardThumb card={item} width={44} />
            <View style={{ flex: 1 }}>
              <Text style={st.itemName}>{item.name}</Text>
              <Text style={st.itemIssuer}>{item.issuer}</Text>
            </View>
            <Text style={st.fee}>{money(item.annual_fee)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const st = StyleSheet.create({
  item: {
    minHeight: 60,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  itemIssuer: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  fee: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  preview: { borderRadius: 14, padding: 16, minHeight: 90, justifyContent: "flex-end" },
  previewName: { fontFamily: fonts.bold, fontSize: 18, color: "#fff" },
  previewIssuer: { fontFamily: fonts.regular, fontSize: 13, color: "#fff", opacity: 0.85 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
});
