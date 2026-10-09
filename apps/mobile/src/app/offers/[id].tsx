import { type Offer, type OfferFormValues, toInput, useDeleteOffer, useOffer, useUpdateOffer } from "@card-wallet/shared";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { OfferForm } from "@/components/OfferForm";
import { Button, Loading, Muted, s } from "@/components/ui";

const str = (v: number | null) => (v == null ? "" : String(v));

function fromOffer(o: Offer): OfferFormValues {
  return {
    user_card_id: o.user_card_id ? String(o.user_card_id) : "",
    merchant: o.merchant,
    kind: o.kind,
    value: str(o.value),
    max_back: str(o.max_back),
    min_spend: str(o.min_spend),
    expires_at: o.expires_at ?? "",
    code: o.code ?? "",
    category: o.category ?? "",
    notes: o.notes ?? "",
    remind_days: ([0, 3, 5, 7].includes(o.remind_days) ? o.remind_days : 0) as 0 | 3 | 5 | 7,
  };
}

function Edit({ offer }: { offer: Offer }) {
  const update = useUpdateOffer(offer.id);
  const del = useDeleteOffer();
  const [values, setValues] = useState(() => fromOffer(offer));

  async function save() {
    const { source: _source, ...patch } = toInput(values, offer.source);
    await update.mutateAsync(patch);
    router.back();
  }

  const confirmDelete = () =>
    Alert.alert("Delete offer?", `Delete the ${offer.merchant} offer?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await del.mutateAsync(offer.id);
          router.back();
        },
      },
    ]);

  return (
    <OfferForm
      values={values}
      onChange={setValues}
      onSubmit={save}
      submitLabel="Save changes"
      busy={update.isPending}
      error={update.error?.message ?? del.error?.message}
      extra={<Button label="Delete offer" kind="danger" onPress={confirmDelete} disabled={del.isPending} />}
    />
  );
}

export default function EditOffer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isPending, isError } = useOffer(Number(id));
  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: data?.merchant ?? "Offer" }} />
      <ScrollView contentContainerStyle={[s.body, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
        {isPending && <Loading />}
        {isError && (
          <View>
            <Muted>Offer not found.</Muted>
          </View>
        )}
        {data && <Edit offer={data} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
