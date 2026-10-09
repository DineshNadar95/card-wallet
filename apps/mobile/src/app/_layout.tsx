import { ApiProvider, colors, useOffers } from "@card-wallet/shared";
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  useFonts,
} from "@expo-google-fonts/ibm-plex-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { AppState } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";
import { syncGeofences } from "@/lib/geofence"; // also defines the background task
import { registerForPush } from "@/lib/push";
import { fonts } from "@/lib/theme";

/** After sign-in, register this device for reminder push notifications (best effort). */
function PushRegistrar() {
  const { session } = useAuth();
  const userId = session?.user.id;
  useEffect(() => {
    if (userId) registerForPush(api).catch((e) => console.warn("Push registration failed", e));
  }, [userId]);
  return null;
}

/** Keep iOS geofences in step with the user's offers (no-op unless they opted in). */
function GeofenceSync() {
  const { session } = useAuth();
  const { data: offers, refetch } = useOffers({ status: "active" }, !!session);
  useEffect(() => {
    if (offers) syncGeofences(offers).catch((e) => console.warn("Geofence sync failed", e));
  }, [offers]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => s === "active" && session && refetch());
    return () => sub.remove();
  }, [session, refetch]);
  return null;
}

/** Tapping a "you're near" alert opens that offer. */
function NotificationRouter() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const id = r.notification.request.content.data?.offerId;
      if (typeof id === "number") router.push({ pathname: "/offers/[id]", params: { id } });
    });
    return () => sub.remove();
  }, []);
  return null;
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const [loaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  });
  if (!loaded) return null;

  return (
    <ApiProvider client={api}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PushRegistrar />
          <GeofenceSync />
          <NotificationRouter />
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
              headerTintColor: colors.accent,
              contentStyle: { backgroundColor: colors.ground },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="cards/[id]" options={{ title: "Card" }} />
            <Stack.Screen name="cards/add" options={{ title: "Add a card", presentation: "modal" }} />
            <Stack.Screen name="offers/new" options={{ title: "Add an offer", presentation: "modal" }} />
            <Stack.Screen name="offers/[id]" options={{ title: "Offer" }} />
            <Stack.Screen name="settings" options={{ title: "Settings", presentation: "modal" }} />
            <Stack.Screen name="scan" options={{ title: "Where you are", presentation: "modal" }} />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </ApiProvider>
  );
}
