import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { C, R, S } from "./theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

/**
 * The app's button. Default is the solid primary action; `alt` is the quiet
 * secondary (tinted, no outline); `color` recolours the primary (e.g. red for
 * sign out). Dims while pressed, shows a spinner while busy.
 */
export function Btn({
  label,
  onPress,
  alt,
  busy,
  disabled,
  color,
  icon,
}: {
  label: string;
  onPress: () => void;
  alt?: boolean;
  busy?: boolean;
  disabled?: boolean;
  color?: string;
  icon?: IconName;
}) {
  const off = Boolean(busy || disabled);
  const fg = alt ? C.emerald : "#fff";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: Boolean(busy) }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [alt ? S.btnAlt : S.btn, color && !alt ? { backgroundColor: color } : null, off ? { opacity: 0.45 } : pressed ? { opacity: 0.8 } : null]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={alt ? S.btnAltText : S.btnText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** A plain text action for the least important choice on a screen ("Withdraw", "Back"). */
export function LinkBtn({ label, onPress, icon, color, disabled }: { label: string; onPress: () => void; icon?: IconName; color?: string; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={disabled ? undefined : onPress}
      hitSlop={8}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}
    >
      {icon ? <Ionicons name={icon} size={18} color={color ?? C.emerald} /> : null}
      <Text style={{ color: color ?? C.emerald, fontWeight: "700", fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, tone }: { children: ReactNode; tone?: "amber" | "emerald" | "red" }) {
  const bg = tone === "amber" ? C.amberSoft : tone === "emerald" ? C.emeraldTint : tone === "red" ? C.redSoft : C.card;
  return <View style={[S.card, { backgroundColor: bg }]}>{children}</View>;
}

/** A small rounded label: status, a reason a job suits the driver, a count. */
export function Badge({ text, tone, icon }: { text: string; tone?: "sky" | "amber" | "red" | "grey"; icon?: IconName }) {
  const map = {
    sky: [C.skySoft, C.sky],
    amber: [C.amberSoft, C.amber],
    red: [C.redSoft, C.red],
    grey: ["#EEF1EF", C.muted],
    emerald: [C.emeraldSoft, C.emeraldDark],
  } as const;
  const [bg, fg] = map[tone ?? "emerald"];
  return (
    <View style={[S.badge, { backgroundColor: bg, flexDirection: "row", alignItems: "center", gap: 5 }]}>
      {icon ? <Ionicons name={icon} size={13} color={fg} /> : null}
      <Text style={[S.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

/** The big title at the top of a screen, with an optional line under it. */
export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 4, marginTop: 4 }}>
      <Text accessibilityRole="header" style={S.title}>
        {title}
      </Text>
      {subtitle ? <Text style={S.muted}>{subtitle}</Text> : null}
    </View>
  );
}

/** "← Back" at the top of a pushed screen. */
export function Back({ label, onPress }: { label: string; onPress: () => void }) {
  return <LinkBtn label={label} icon="chevron-back" onPress={onPress} />;
}

/** A label above a value, used in detail lists. */
export function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <View style={{ gap: 2 }}>
      <Text style={S.label}>{label}</Text>
      <Text style={[S.text, { color: C.text }]}>{String(value)}</Text>
    </View>
  );
}

/** An icon with a line of detail, e.g. passengers or a flight number. */
export function IconLine({ icon, text, color }: { icon: IconName; text: string; color?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
      <Ionicons name={icon} size={16} color={color ?? C.muted} style={{ marginTop: 2 }} />
      <Text style={[S.text, { flex: 1, color: color ?? C.body }]}>{text}</Text>
    </View>
  );
}

/** A tappable settings-style row: icon, title, optional detail, chevron. */
export function ListRow({ icon, title, detail, onPress, tone }: { icon: IconName; title: string; detail?: string; onPress: () => void; tone?: "red" }) {
  const fg = tone === "red" ? C.red : C.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tone === "red" ? C.redSoft : C.emeraldTint, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={18} color={tone === "red" ? C.red : C.emerald} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: fg }}>{title}</Text>
        {detail ? <Text style={S.muted}>{detail}</Text> : null}
      </View>
      {tone === "red" ? null : <Ionicons name="chevron-forward" size={18} color={C.faint} />}
    </Pressable>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: C.border }} />;
}

/** What a list shows when there is nothing in it yet. */
export function Empty({ text, icon }: { text: string; icon?: IconName }) {
  return (
    <View style={{ alignItems: "center", gap: 10, paddingVertical: 36, paddingHorizontal: 24 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.emeraldTint, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon ?? "leaf-outline"} size={28} color={C.emerald} />
      </View>
      <Text style={[S.muted, { textAlign: "center", fontSize: 14 }]}>{text}</Text>
    </View>
  );
}

/** A pickup → drop-off pair drawn as two dots joined by a line. */
export function RouteLine({ from, to }: { from: string; to: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ alignItems: "center", paddingVertical: 5 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2.5, borderColor: C.emerald, backgroundColor: "#fff" }} />
        <View style={{ flex: 1, width: 2, backgroundColor: C.border, marginVertical: 2 }} />
        <View style={{ width: 10, height: 10, borderRadius: R.pill, backgroundColor: C.emeraldDark }} />
      </View>
      <View style={{ flex: 1, gap: 10 }}>
        <Text style={S.h2}>{from}</Text>
        <Text style={S.h2}>{to}</Text>
      </View>
    </View>
  );
}

/** A choice chip (vehicle, town, English level). */
export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => ({
        borderWidth: 1.5,
        borderColor: on ? C.emerald : C.border,
        backgroundColor: on ? C.emeraldTint : "#fff",
        borderRadius: R.pill,
        paddingHorizontal: 14,
        paddingVertical: 9,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontWeight: "700", color: on ? C.emerald : C.body, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
