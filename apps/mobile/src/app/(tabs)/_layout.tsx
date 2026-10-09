import { Tabs } from "expo-router";

import { CardsIcon, CompareIcon, HomeIcon, OffersIcon } from "@/components/icons";
import { colors, fonts } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.text },
        sceneStyle: { backgroundColor: colors.ground },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", headerShown: false, tabBarIcon: ({ color }) => <HomeIcon color={color} /> }}
      />
      <Tabs.Screen
        name="cards"
        options={{ title: "Cards", tabBarIcon: ({ color }) => <CardsIcon color={color} /> }}
      />
      <Tabs.Screen
        name="offers"
        options={{ title: "Offers", tabBarIcon: ({ color }) => <OffersIcon color={color} /> }}
      />
      <Tabs.Screen
        name="compare"
        options={{ title: "Compare", tabBarIcon: ({ color }) => <CompareIcon color={color} /> }}
      />
    </Tabs>
  );
}
