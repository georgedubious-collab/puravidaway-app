import { Platform, StyleSheet } from "react-native";

/**
 * Design tokens for the driver app. Same emerald / amber family as the website,
 * tuned for a phone: a soft grey-green page, white cards that float on a light
 * shadow instead of hard borders, large titles and 48 pt touch targets.
 */
export const C = {
  bg: "#F3F6F4",
  card: "#FFFFFF",
  border: "#E4E9E6",
  text: "#0B1F17",
  body: "#374151",
  muted: "#6B7280",
  faint: "#9CA3AF",
  emerald: "#047857",
  emeraldBright: "#059669",
  emeraldDark: "#022C22",
  emeraldSoft: "#D1FAE5",
  emeraldTint: "#ECFDF5",
  amber: "#B45309",
  amberSoft: "#FEF3C7",
  red: "#B91C1C",
  redSoft: "#FEE2E2",
  sky: "#0284C7",
  skySoft: "#E0F2FE",
};

export const R = { card: 18, control: 14, pill: 999 };

/** A soft lift for cards (iOS shadow, Android elevation). */
export const SHADOW = Platform.select({
  android: { elevation: 2 },
  default: { shadowColor: "#0B1F17", shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
});

export const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { padding: 16, paddingBottom: 32, gap: 14 },
  card: { backgroundColor: C.card, borderRadius: R.card, padding: 16, gap: 8, ...SHADOW },
  title: { fontSize: 28, fontWeight: "800", color: C.text, letterSpacing: -0.5 },
  h1: { fontSize: 28, fontWeight: "800", color: C.text, letterSpacing: -0.5 },
  h2: { fontSize: 17, fontWeight: "800", color: C.text, letterSpacing: -0.2 },
  label: { fontSize: 11, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 0.7 },
  text: { fontSize: 15, lineHeight: 21, color: C.body },
  muted: { fontSize: 13, lineHeight: 18, color: C.muted },
  money: { fontSize: 24, fontWeight: "800", color: C.emerald, letterSpacing: -0.5 },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: R.control,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#FAFBFA",
    color: C.text,
  },
  btn: { backgroundColor: C.emeraldDark, borderRadius: R.control, minHeight: 50, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, flexDirection: "row", gap: 8 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  btnAlt: { backgroundColor: C.emeraldTint, borderRadius: R.control, minHeight: 50, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, flexDirection: "row", gap: 8 },
  btnAltText: { color: C.emerald, fontWeight: "800", fontSize: 15 },
  badge: { alignSelf: "flex-start", backgroundColor: C.emeraldSoft, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: "700", color: C.emeraldDark },
  error: { color: C.red, fontWeight: "600", fontSize: 13, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
});
