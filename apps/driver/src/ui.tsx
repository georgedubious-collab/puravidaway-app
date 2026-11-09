import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { C, S } from "./theme";

/** A big, thumb-friendly button. `alt` is the outlined style. */
export function Btn({
  label,
  onPress,
  alt,
  busy,
  disabled,
  color,
}: {
  label: string;
  onPress: () => void;
  alt?: boolean;
  busy?: boolean;
  disabled?: boolean;
  color?: string;
}) {
  const off = Boolean(busy || disabled);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: Boolean(busy) }}
      onPress={off ? undefined : onPress}
      style={[alt ? S.btnAlt : S.btn, color && !alt ? { backgroundColor: color } : null, off ? { opacity: 0.5 } : null]}
    >
      {busy ? <ActivityIndicator color={alt ? C.emerald : "#fff"} /> : <Text style={alt ? S.btnAltText : S.btnText}>{label}</Text>}
    </Pressable>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={S.card}>{children}</View>;
}

export function Badge({ text, tone }: { text: string; tone?: "sky" | "amber" }) {
  const bg = tone === "sky" ? "#E0F2FE" : tone === "amber" ? C.amberSoft : C.emeraldSoft;
  return (
    <View style={[S.badge, { backgroundColor: bg }]}>
      <Text style={S.badgeText}>{text}</Text>
    </View>
  );
}

/** A label above a value, used in detail lists. */
export function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <View style={{ gap: 2 }}>
      <Text style={S.label}>{label}</Text>
      <Text style={S.text}>{String(value)}</Text>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <Card>
      <Text style={S.muted}>{text}</Text>
    </Card>
  );
}
