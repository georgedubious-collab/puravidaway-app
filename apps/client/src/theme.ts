import { StyleSheet } from "react-native";

/** Same emerald / amber palette as the website. */
export const C = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  emerald: "#059669",
  emeraldDark: "#022C22",
  emeraldSoft: "#D1FAE5",
  amber: "#B45309",
  amberSoft: "#FEF3C7",
  red: "#B91C1C",
  sky: "#0EA5E9",
};

export const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { padding: 16, gap: 12 },
  card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, gap: 6 },
  h1: { fontSize: 22, fontWeight: "800", color: C.text },
  h2: { fontSize: 17, fontWeight: "800", color: C.text },
  label: { fontSize: 11, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  text: { fontSize: 14, color: C.text },
  muted: { fontSize: 13, color: C.muted },
  money: { fontSize: 22, fontWeight: "800", color: C.emerald },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
    color: C.text,
  },
  btn: { backgroundColor: C.emeraldDark, borderRadius: 12, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  btnAlt: { borderWidth: 2, borderColor: C.emerald, borderRadius: 12, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  btnAltText: { color: C.emerald, fontWeight: "800", fontSize: 15 },
  badge: { alignSelf: "flex-start", backgroundColor: C.emeraldSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: "700", color: C.emeraldDark },
  error: { color: C.red, fontWeight: "600", fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
});
