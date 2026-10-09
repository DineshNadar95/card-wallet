import { useApi, useMe, useUpdateMe } from "@card-wallet/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { Button, Loading, Muted, s } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { unregisterPush } from "@/lib/push";
import { colors, fonts } from "@/lib/theme";

export default function Settings() {
  const { session, signOut } = useAuth();
  const { data: me, isPending } = useMe(!!session);
  const update = useUpdateMe();
  const api = useApi();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (me) setValue(String(me.point_value_cents));
  }, [me]);

  if (!session) return <Muted style={{ padding: 16 }}>Sign in to change settings.</Muted>;
  if (isPending) return <Loading />;

  const n = Number(value);
  const valid = value.trim() !== "" && n > 0 && n <= 10;

  async function save() {
    await update.mutateAsync({ point_value_cents: n });
    router.back();
  }

  return (
    <View style={[s.screen, s.body]}>
      <View style={s.card}>
        <Text style={s.cardTitle}>What's a point worth to you?</Text>
        <Muted>
          Card Wallet multiplies points and miles by this to compare them with cash back. 1¢ is a common
          baseline; transfer partners can be worth more, gift cards often less.
        </Muted>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.text }} nativeID="pvLabel">
          Cents per point or mile
        </Text>
        <TextInput
          accessibilityLabelledBy="pvLabel"
          style={[s.input, !valid && { borderColor: colors.urgent }]}
          keyboardType="decimal-pad"
          value={value}
          onChangeText={setValue}
        />
        {update.isError && <Text style={{ color: colors.urgent }}>{update.error.message}</Text>}
        <Button label="Save" onPress={save} disabled={!valid || update.isPending} />
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Account</Text>
        <Muted>{session.user.email}</Muted>
        <Button label="Sign out" kind="outline" onPress={() =>
            unregisterPush(api)
              .catch(() => {})
              .then(signOut)
              .then(() => router.back())
          } />
      </View>
    </View>
  );
}
