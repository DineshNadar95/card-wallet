import {
  applyDraft,
  emptyOffer,
  type OfferDraft,
  type OfferFormValues,
  toInput,
  useCreateOffer,
  useParseOfferImage,
} from "@card-wallet/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { OfferForm } from "@/components/OfferForm";
import { Button, Muted, s, SignInCard } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { pickOfferImage } from "@/lib/image";
import { colors, fonts } from "@/lib/theme";

type Mode = "photo" | "type";

const readCount = (d: OfferDraft) =>
  (["merchant", "kind", "value", "max_back", "min_spend", "expires_at", "code", "notes"] as const).filter(
    (k) => d[k].value != null,
  ).length;

export default function AddOffer() {
  const { session } = useAuth();
  const { card } = useLocalSearchParams<{ card?: string }>();
  const create = useCreateOffer();
  const parse = useParseOfferImage();
  const [mode, setMode] = useState<Mode>("photo");
  const [values, setValues] = useState<OfferFormValues>(() => emptyOffer(card));
  const [draft, setDraft] = useState<OfferDraft | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!session) return <View style={[s.screen, s.body]}><SignInCard title="Sign in to add offers" body="Offers are saved to your account." /></View>;

  async function pick(source: "camera" | "library") {
    setError(null);
    try {
      const img = await pickOfferImage(source);
      if (!img) return;
      setPhoto(img.uri);
      setDraft(null);
      const form = new FormData();
      // React Native's FormData takes a file descriptor object instead of a Blob.
      form.append("image", { uri: img.uri, name: "offer.jpg", type: "image/jpeg" } as unknown as Blob);
      const d = await parse.mutateAsync(form);
      setDraft(d);
      setValues((v) => applyDraft(v, d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that image.");
    }
  }

  async function save() {
    await create.mutateAsync(toInput(values, draft ? "screenshot" : "typed"));
    router.back();
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[s.body, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
        <View style={st.tabs} accessibilityRole="tablist">
          {(
            [
              ["photo", "From a photo"],
              ["type", "Type it in"],
            ] as const
          ).map(([k, label]) => (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === k }}
              onPress={() => setMode(k)}
              style={[st.tab, mode === k && st.tabOn]}
            >
              <Text style={[st.tabText, mode === k && st.tabTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {mode === "photo" && !photo && (
          <View style={{ gap: 10 }}>
            <Button label="Take a photo" onPress={() => pick("camera")} />
            <Button label="Choose a screenshot" kind="outline" onPress={() => pick("library")} />
            <Muted style={{ fontSize: 13 }}>We read the merchant, value and expiry. You check them before saving.</Muted>
          </View>
        )}

        {mode === "photo" && photo && (
          <View style={st.photoCard}>
            <Image source={{ uri: photo }} style={st.thumb} accessibilityLabel="Your offer photo" />
            <View style={{ flex: 1, gap: 4 }}>
              {parse.isPending && <Text style={st.strong}>Reading your photo…</Text>}
              {draft && (
                <>
                  <Text style={st.strong}>
                    {draft.is_offer ? `Read ${readCount(draft)} details from your screenshot` : "This doesn't look like an offer"}
                  </Text>
                  <Muted style={{ fontSize: 13 }}>Check them below before saving — photos can be misread.</Muted>
                </>
              )}
              <Text style={st.link} accessibilityRole="button" onPress={() => pick("library")}>
                Retake or choose another
              </Text>
            </View>
          </View>
        )}

        {error && <Text style={{ color: colors.urgent }}>{error}</Text>}

        {(mode === "type" || draft) && (
          <OfferForm
            values={values}
            onChange={setValues}
            draft={mode === "photo" ? draft : null}
            onSubmit={save}
            submitLabel="Save offer"
            busy={create.isPending}
            error={create.error?.message}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  tabs: { flexDirection: "row", backgroundColor: colors.borderSubtle, borderRadius: 10, padding: 3 },
  tab: { flex: 1, minHeight: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tabOn: { backgroundColor: colors.surface, elevation: 1, shadowColor: "#14181F", shadowOpacity: 0.12, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  tabText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  tabTextOn: { fontFamily: fonts.semibold, color: colors.text },
  photoCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  thumb: { width: 64, height: 96, borderRadius: 8, backgroundColor: colors.borderSubtle },
  strong: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accent, paddingVertical: 8 },
});
