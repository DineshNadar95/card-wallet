import { useApi, useMe, useOffers, useUpdateMe } from "@card-wallet/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { Button, Loading, Muted, s } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { alertsEnabled, disableAlerts, enableAlerts, geofencingSupported } from "@/lib/geofence";
import { unregisterPush } from "@/lib/push";
import { colors, fonts } from "@/lib/theme";

/**
 * Opt-in for "near a saved offer" alerts. The explanation is shown before the system prompts
 * (prominent disclosure), and the feature works without it (Scan where I am).
 */
function LocationAlerts() {
  const { data: offers } = useOffers({ status: "active" });
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    alertsEnabled().then(setOn);
  }, []);

  if (!geofencingSupported)
    return (
      <View style={s.card}>
        <Text style={s.cardTitle}>Nearby offers</Text>
        <Muted>
          On Android, Card Wallet doesn't track location in the background. Tap “Scan where I am” on
          Home to see saved offers near you.
        </Muted>
      </View>
    );

  async function toggle(next: boolean) {
    setBusy(true);
    setNote(null);
    try {
      if (!next) {
        await disableAlerts();
        setOn(false);
        return;
      }
      const result = await enableAlerts(offers ?? []);
      setOn(result === "on");
      if (result === "foreground-denied") setNote("Location is off for Card Wallet.");
      if (result === "always-denied")
        setNote("Alerts need location set to “Always”. You can change it in Settings → Card Wallet → Location.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.card}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text style={[s.cardTitle, { flex: 1 }]} nativeID="geoLabel">
          Remind me near saved offers
        </Text>
        <Switch accessibilityLabelledBy="geoLabel" value={on} onValueChange={toggle} disabled={busy} />
      </View>
      <Muted>
        When you pin a store to an offer, Card Wallet can alert you when you're nearby, even with the
        app closed. This uses your location in the background: iOS watches up to 20 places at a time
        and wakes the app only when you arrive. Your location stays on this phone; only the stores you
        pin are saved.
      </Muted>
      {note && (
        <Text style={{ color: colors.urgent }} onPress={() => Linking.openSettings()}>
          {note}
        </Text>
      )}
    </View>
  );
}

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
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
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

      <LocationAlerts />

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
    </ScrollView>
  );
}
