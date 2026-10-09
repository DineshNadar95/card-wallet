import { ApiProvider, colors } from "@card-wallet/shared";
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  useFonts,
} from "@expo-google-fonts/ibm-plex-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";

import { api } from "@/lib/api";
import { AuthProvider } from "@/lib/auth";
import { fonts } from "@/lib/theme";

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
            <Stack.Screen name="settings" options={{ title: "Settings", presentation: "modal" }} />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </ApiProvider>
  );
}
