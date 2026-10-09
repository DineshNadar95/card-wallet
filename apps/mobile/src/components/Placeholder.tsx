import { useHealth } from "@card-wallet/shared";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/lib/theme";

export function Placeholder({ title, phase }: { title: string; phase: number }) {
  const { isSuccess, isError } = useHealth();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.panel}>
        <Text style={styles.muted}>This screen is built in Phase {phase}.</Text>
      </View>
      <Text style={styles.muted} accessibilityRole="text">
        {isSuccess ? "API connected" : isError ? "API offline" : "Checking API…"}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  body: { padding: 16, gap: 16 },
  title: { fontFamily: fonts.bold, fontSize: 22, color: colors.text, letterSpacing: -0.2 },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
  },
  muted: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
});
