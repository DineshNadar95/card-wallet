import { DISCLAIMER, type EarnRate, minTouch, rewardsCheckedAt } from "@card-wallet/shared";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useAuth } from "@/lib/auth";
import { colors, fonts } from "@/lib/theme";

export function Button({
  label,
  onPress,
  kind = "primary",
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "outline" | "danger";
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        kind === "primary" && s.btnPrimary,
        kind === "outline" && s.btnOutline,
        kind === "danger" && s.btnDanger,
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.85 },
        style,
      ]}
    >
      <Text style={[s.btnText, kind === "primary" ? { color: "#fff" } : kind === "danger" ? { color: colors.urgent } : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={s.sectionLabel}>{children}</Text>;
}

export function List({ children }: { children: ReactNode }) {
  return <View style={s.list}>{children}</View>;
}

export function Row({ left, right, last }: { left: ReactNode; right?: ReactNode; last?: boolean }) {
  return (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      <Text style={s.rowLeft}>{left}</Text>
      {right != null && <Text style={s.rowRight}>{right}</Text>}
    </View>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}

export function Loading() {
  return <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />;
}

/** Rule 4: terms always come with source, as-of date and the disclaimer. */
export function SourceNote({ source, rates = [], extra }: { source?: string; rates?: EarnRate[]; extra?: string }) {
  const checked = rewardsCheckedAt(rates);
  return (
    <Text style={s.note}>
      Fees & APRs: {source ?? "CFPB TCCP"} ·{" "}
      {checked ? `Rewards checked ${checked} from issuer pages` : "Reward rates not checked yet"}.
      {extra ? ` ${extra}` : ""} {DISCLAIMER}
    </Text>
  );
}

export function SignInCard({ title, body }: { title: string; body: string }) {
  const { configured, signInWithGoogle } = useAuth();
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      <Muted>{body}</Muted>
      <Button
        label="Continue with Google"
        disabled={!configured}
        onPress={() => signInWithGoogle().catch((e) => console.warn("Sign-in failed", e))}
      />
      {!configured && (
        <Muted style={{ fontSize: 12 }}>
          Sign-in isn't configured yet. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
        </Muted>
      )}
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  body: { padding: 16, gap: 16 },
  btn: {
    minHeight: minTouch,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnOutline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnDanger: { backgroundColor: colors.surface, borderWidth: 1, borderColor: "#E8C4C1" },
  btnText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginHorizontal: 2,
    marginBottom: 8,
  },
  list: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowLeft: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, flexShrink: 1 },
  rowRight: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text, textAlign: "right" },
  muted: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  cardTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  input: {
    minHeight: minTouch,
    borderWidth: 1,
    borderColor: "#C3C9D2",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
});
