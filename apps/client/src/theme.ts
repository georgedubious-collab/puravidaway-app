import { Platform, StyleSheet, type TextStyle } from "react-native";

/**
 * Design tokens for the traveller app (v2, "photo-led and warm"): a warm white
 * page, near-black text, emerald for anything you can tap, gold only as a small
 * accent. Big rounded cards on a soft shadow, 17 px body text, 52 px pill buttons.
 */
export const C = {
  bg: "#FFFCF8",
  card: "#FFFFFF",
  /** A quiet warm grey for wells, skeletons and unselected controls. */
  surface: "#F5F1EA",
  border: "#EAE4DA",
  text: "#1B1B18",
  body: "#3D3D38",
  muted: "#6E6C66",
  faint: "#A6A39B",
  emerald: "#047857",
  emeraldBright: "#059669",
  emeraldDark: "#022C22",
  emeraldSoft: "#D1FAE5",
  emeraldTint: "#ECFDF5",
  gold: "#F5B301",
  goldBright: "#FBBF24",
  amber: "#B45309",
  amberSoft: "#FEF3C7",
  red: "#B91C1C",
  redSoft: "#FEE2E2",
  sky: "#0369A1",
  skySoft: "#E0F2FE",
};

/** The drawn map (shown where a real map isn't available): land, hills, sea and roads. */
export const MAP = { land: "#E6EEE4", hills: "#D0E4CB", sea: "#CFE6EE", road: "#FFFFFF" };

export const R = { card: 20, control: 14, pill: 999 };

/** Spacing steps (4-pt grid). `page` is the side margin of every screen. */
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, page: 20 };

/**
 * Plus Jakarta Sans, one file per weight (loaded in App.tsx). React Native can't
 * synthesise weights for a custom font without a "faux bold", so a weight is
 * always chosen by family name: use `fontWeight` in a style and the app's
 * <Text> / <Input> (src/ui.tsx) swap it for the matching family below.
 */
export const F = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
} as const;

/** fontWeight → font family. Anything unknown falls back to regular. */
export function fontFor(weight: TextStyle["fontWeight"] | undefined): string {
  switch (String(weight ?? "400")) {
    case "500":
    case "medium":
      return F.medium;
    case "600":
    case "semibold":
      return F.semibold;
    case "700":
    case "bold":
      return F.bold;
    case "800":
    case "900":
    case "heavy":
    case "black":
      return F.extrabold;
    default:
      return F.regular;
  }
}

/** A soft lift for cards (iOS shadow, Android elevation). */
export const SHADOW = Platform.select({
  android: { elevation: 3, shadowColor: "#3B2F1A" },
  default: { shadowColor: "#3B2F1A", shadowOpacity: 0.09, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
});
/** A stronger lift for things that float over the page (bottom bar, round back button). */
export const SHADOW_UP = Platform.select({
  android: { elevation: 12, shadowColor: "#3B2F1A" },
  default: { shadowColor: "#3B2F1A", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
});

/**
 * The type scale. Sizes are in points and grow with the phone's text-size
 * setting (capped in <Text>), so layouts use minHeight, never a fixed height.
 */
export const T = StyleSheet.create({
  /** Home greeting and the question at the top of a booking step. */
  display: { fontSize: 30, lineHeight: 36, fontWeight: "800", color: C.text, letterSpacing: -0.6 },
  /** The large title of a tab. */
  title: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: C.text, letterSpacing: -0.5 },
  h1: { fontSize: 24, lineHeight: 30, fontWeight: "800", color: C.text, letterSpacing: -0.4 },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: "700", color: C.text, letterSpacing: -0.2 },
  h3: { fontSize: 17, lineHeight: 23, fontWeight: "700", color: C.text },
  body: { fontSize: 17, lineHeight: 25, fontWeight: "400", color: C.body },
  bodyStrong: { fontSize: 17, lineHeight: 25, fontWeight: "600", color: C.text },
  small: { fontSize: 15, lineHeight: 21, fontWeight: "400", color: C.muted },
  smallStrong: { fontSize: 15, lineHeight: 21, fontWeight: "600", color: C.text },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "500", color: C.muted },
  /** Small tracked capitals above a group. */
  label: { fontSize: 12, lineHeight: 16, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 0.9 },
  money: { fontSize: 24, lineHeight: 30, fontWeight: "800", color: C.text, letterSpacing: -0.5 },
  button: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: "#fff" },
});

export const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { paddingHorizontal: SP.page, paddingTop: SP.lg, paddingBottom: SP.xxl, gap: SP.lg },
  card: { backgroundColor: C.card, borderRadius: R.card, padding: SP.lg, gap: SP.md, ...SHADOW },
  title: T.title,
  h1: T.h1,
  h2: T.h3,
  label: T.label,
  text: T.body,
  muted: T.small,
  money: T.money,
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: R.control,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 54,
    fontSize: 17,
    backgroundColor: "#fff",
    color: C.text,
  },
  error: { color: C.red, fontWeight: "600", fontSize: 15, lineHeight: 21 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
});
