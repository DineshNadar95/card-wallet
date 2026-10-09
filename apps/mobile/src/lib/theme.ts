import { colors } from "@card-wallet/shared";

export { colors };

/** React Native needs one family per weight for custom fonts. */
export const fonts = {
  regular: "IBMPlexSans_400Regular",
  medium: "IBMPlexSans_500Medium",
  semibold: "IBMPlexSans_600SemiBold",
  bold: "IBMPlexSans_700Bold",
} as const;
