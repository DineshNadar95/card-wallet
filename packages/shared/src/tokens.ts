/** Design tokens from CLAUDE.md / design/*.dc.html. Both apps style from these. */
export const colors = {
  ground: "#F4F5F7",
  surface: "#FFFFFF",
  text: "#14181F",
  textSecondary: "#4A5361",
  border: "#DDE1E7",
  borderSubtle: "#EEF0F3",
  accent: "#0B6E73",
  accentDark: "#084F53",
  accentTint: "#E6F1F1",
  offerText: "#8A3F0E",
  offerBg: "#FCEFE4",
  betterText: "#1F6B3A",
  betterBg: "#E7F4EC",
  urgent: "#A3261E",
} as const;

export const fontFamily = "'IBM Plex Sans', 'Helvetica Neue', system-ui, sans-serif";

/** Minimum touch target, in px / points. */
export const minTouch = 44;

export const CATEGORIES = ["dining", "groceries", "travel", "gas", "online", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  dining: "Dining",
  groceries: "Groceries",
  travel: "Travel",
  gas: "Gas",
  online: "Online",
  other: "Everything else",
};

export const DISCLAIMER = "Not financial advice.";
