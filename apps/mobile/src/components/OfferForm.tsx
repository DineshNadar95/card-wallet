import {
  CATEGORIES,
  CATEGORY_LABELS,
  LOW_CONFIDENCE,
  OFFER_KINDS,
  type OfferDraft,
  type OfferFormValues,
  offerProblems,
  REMIND_OPTIONS,
  useMyCards,
} from "@card-wallet/shared";
import { type ReactNode, useState } from "react";
import * as Location from "expo-location";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button, s } from "@/components/ui";
import { colors, fonts } from "@/lib/theme";

function Badge({ conf }: { conf?: number }) {
  if (!conf) return null;
  const check = conf < LOW_CONFIDENCE;
  return <Text style={[st.badge, check ? st.badgeCheck : st.badgeShot]}>{check ? "Check this" : "From screenshot"}</Text>;
}

function Label({ text, id, conf, optional }: { text: string; id: string; conf?: number; optional?: boolean }) {
  return (
    <View style={st.labelRow}>
      <Text style={st.label} nativeID={id}>
        {text}
        {optional && <Text style={st.optional}> (optional)</Text>}
      </Text>
      <Badge conf={conf} />
    </View>
  );
}

function Chips<T extends string | number>({
  options,
  value,
  onChange,
  labelledBy,
}: {
  options: { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  labelledBy?: string;
}) {
  return (
    <View style={st.chips} accessibilityLabelledBy={labelledBy}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <Pressable
            key={String(o.v)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.v)}
            style={[st.chip, on && st.chipOn]}
          >
            <Text style={[st.chipText, on && st.chipTextOn]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Input({
  id,
  value,
  onChange,
  numeric,
  prefix,
  suffix,
  invalid,
  placeholder,
  max = 200,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  prefix?: string;
  suffix?: string;
  invalid?: boolean;
  placeholder?: string;
  max?: number;
}) {
  return (
    <View style={[s.input, st.affix, invalid && { borderColor: colors.urgent }]}>
      {prefix && <Text style={st.affixText}>{prefix}</Text>}
      <TextInput
        accessibilityLabelledBy={id}
        style={st.inputInner}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? "decimal-pad" : "default"}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        maxLength={max}
        autoCorrect={false}
      />
      {suffix && <Text style={st.affixText}>{suffix}</Text>}
    </View>
  );
}

/** Optional store pin (Phase 7): one foreground location read, only when the user taps it. */
function StorePin({ values, onChange }: { values: OfferFormValues; onChange: (v: OfferFormValues) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function locate() {
    setBusy(true);
    setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return setError("Location is off for Card Wallet.");
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      onChange({
        ...values,
        place: { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) },
        place_label: values.place_label || values.merchant,
      });
    } catch {
      setError("Couldn't get your location.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Label text="Store location" id="pinLabel" optional />
      {values.place ? (
        <View style={{ gap: 6 }}>
          <Input id="pinLabel" value={values.place_label} onChange={(v) => onChange({ ...values, place_label: v })} placeholder="e.g. Demo Bistro, 5th Ave" />
          <Text style={st.hint}>
            Pinned at {values.place.lat.toFixed(4)}, {values.place.lng.toFixed(4)}
          </Text>
          <Text style={[st.hint, { color: colors.accent }]} accessibilityRole="button" onPress={() => onChange({ ...values, place: null })}>
            Remove pin
          </Text>
        </View>
      ) : (
        <Button label={busy ? "Locating…" : "Pin this store: use my location"} kind="outline" onPress={locate} disabled={busy} />
      )}
      <Text style={st.hint}>At the store? Pin it to get reminded when you're nearby.</Text>
      {error && <Text style={st.error}>{error}</Text>}
    </View>
  );
}

export function OfferForm({
  values,
  onChange,
  draft,
  onSubmit,
  submitLabel,
  busy,
  error,
  extra,
}: {
  values: OfferFormValues;
  onChange: (v: OfferFormValues) => void;
  draft?: OfferDraft | null;
  onSubmit: () => void;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  extra?: ReactNode;
}) {
  const { data: cards } = useMyCards();
  const [touched, setTouched] = useState(false);
  const errs = touched ? offerProblems(values) : {};
  const set = <K extends keyof OfferFormValues>(k: K, v: OfferFormValues[K]) => onChange({ ...values, [k]: v });
  const conf = (k: Exclude<keyof OfferDraft, "is_offer">) => draft?.[k].confidence;

  const submit = () => {
    setTouched(true);
    if (Object.keys(offerProblems(values)).length === 0) onSubmit();
  };

  const cardOptions = [
    { v: "", label: "No card" },
    ...(cards ?? []).map((uc) => ({
      v: String(uc.id),
      label: `${uc.nickname || uc.card.name}${uc.last4 ? ` ${uc.last4}` : ""}`,
    })),
  ];

  return (
    <View style={{ gap: 16 }}>
      <View>
        <Label text="Card" id="cardLabel" optional />
        <Chips options={cardOptions} value={values.user_card_id} onChange={(v) => set("user_card_id", v)} labelledBy="cardLabel" />
      </View>

      <View>
        <Label text="Merchant or store" id="merchantLabel" conf={conf("merchant")} />
        <Input id="merchantLabel" value={values.merchant} onChange={(v) => set("merchant", v)} invalid={!!errs.merchant} />
        {errs.merchant && <Text style={st.error}>{errs.merchant}</Text>}
      </View>

      <View>
        <Label text="Offer type" id="kindLabel" conf={conf("kind")} />
        <Chips
          options={OFFER_KINDS.map((k) => ({ v: k.k, label: k.label }))}
          value={values.kind}
          onChange={(v) => set("kind", v)}
          labelledBy="kindLabel"
        />
      </View>

      <View style={st.two}>
        {values.kind !== "code" && (
          <View style={{ flex: 1 }}>
            <Label text="Value" id="valueLabel" conf={conf("value")} />
            <Input
              id="valueLabel"
              numeric
              value={values.value}
              onChange={(v) => set("value", v)}
              prefix={values.kind === "amount_off" ? "$" : undefined}
              suffix={values.kind === "percent_back" ? "%" : values.kind === "points" ? "x" : undefined}
              invalid={!!errs.value}
            />
            {errs.value && <Text style={st.error}>{errs.value}</Text>}
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Label text="Max back" id="maxLabel" conf={conf("max_back")} />
          <Input id="maxLabel" numeric prefix="$" value={values.max_back} onChange={(v) => set("max_back", v)} />
        </View>
      </View>

      <View style={st.two}>
        <View style={{ flex: 1 }}>
          <Label text="Min spend" id="minLabel" conf={conf("min_spend")} />
          <Input id="minLabel" numeric prefix="$" value={values.min_spend} onChange={(v) => set("min_spend", v)} />
        </View>
        <View style={{ flex: 1 }}>
          <Label text="Expires" id="expLabel" conf={conf("expires_at")} />
          <Input
            id="expLabel"
            value={values.expires_at}
            onChange={(v) => set("expires_at", v.replace(/[^\d-]/g, "").slice(0, 10))}
            placeholder="YYYY-MM-DD"
            max={10}
            invalid={!!values.expires_at && !/^\d{4}-\d{2}-\d{2}$/.test(values.expires_at)}
          />
        </View>
      </View>

      <View>
        <Label text="Code" id="codeLabel" conf={conf("code")} optional={values.kind !== "code"} />
        <Input id="codeLabel" value={values.code} onChange={(v) => set("code", v)} invalid={!!errs.code} max={100} />
        {errs.code && <Text style={st.error}>{errs.code}</Text>}
      </View>

      <View>
        <Label text="Category" id="catLabel" conf={conf("category")} optional />
        <Chips
          options={[{ v: "" as const, label: "None" }, ...CATEGORIES.map((c) => ({ v: c, label: CATEGORY_LABELS[c] }))]}
          value={values.category}
          onChange={(v) => set("category", v)}
          labelledBy="catLabel"
        />
      </View>

      <View>
        <Label text="Notes" id="notesLabel" conf={conf("notes")} optional />
        <Input id="notesLabel" value={values.notes} onChange={(v) => set("notes", v)} placeholder="e.g. One use, in-store only" max={500} />
      </View>

      <StorePin values={values} onChange={onChange} />

      <View style={st.remind}>
        <Label text="Remind me before it ends" id="remindLabel" />
        <Chips
          options={REMIND_OPTIONS.map((r) => ({ v: r.d, label: r.label }))}
          value={values.remind_days}
          onChange={(v) => set("remind_days", v)}
          labelledBy="remindLabel"
        />
        {values.remind_days > 0 && !values.expires_at && (
          <Text style={st.hint}>Add an expiry date to get a reminder.</Text>
        )}
      </View>

      {error && <Text style={st.error}>{error}</Text>}
      <Button label={busy ? "Saving…" : submitLabel} onPress={submit} disabled={busy} />
      {extra}
    </View>
  );
}

const st = StyleSheet.create({
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  optional: { fontFamily: fonts.regular, color: colors.textSecondary },
  badge: { fontFamily: fonts.semibold, fontSize: 11, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  badgeShot: { color: colors.accentDark, backgroundColor: colors.accentTint },
  badgeCheck: { color: colors.offerText, backgroundColor: colors.offerBg },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  chipOn: { borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.accentTint },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  chipTextOn: { fontFamily: fonts.semibold, color: colors.accentDark },
  affix: { flexDirection: "row", alignItems: "center", gap: 4 },
  affixText: { fontFamily: fonts.regular, fontSize: 16, color: colors.textSecondary },
  inputInner: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text, minHeight: 44 },
  two: { flexDirection: "row", gap: 10 },
  remind: { borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: 14 },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  error: { fontFamily: fonts.regular, fontSize: 13, color: colors.urgent, marginTop: 4 },
});
