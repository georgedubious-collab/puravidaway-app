import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type DimensionValue,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { pick, tap } from "./haptics";
import { C, R, S, SHADOW, SHADOW_UP, SP, T, fontFor } from "./theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

/** Text never grows past this multiple of its size, however large the phone's text setting is. */
const MAX_SCALE = 1.35;

/** Swap `fontWeight` for the Plus Jakarta Sans file of that weight (no faux bold). */
function withFont(style: StyleProp<TextStyle>): TextStyle {
  const { fontWeight, fontFamily, ...rest } = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  return { ...rest, fontFamily: fontFamily ?? fontFor(fontWeight) };
}

/** Every piece of text in the app: brand font, weight by family, capped Dynamic Type. */
export function Text({ style, ...rest }: TextProps) {
  return <RNText maxFontSizeMultiplier={MAX_SCALE} {...rest} style={withFont(style)} />;
}

/** Every text box in the app (same font rules as <Text>). */
export function Input({ style, ...rest }: TextInputProps) {
  return <TextInput maxFontSizeMultiplier={MAX_SCALE} placeholderTextColor={C.faint} {...rest} style={withFont([S.input, style])} />;
}

/** Sets the status bar (clock, battery) to dark or light icons while this screen is the one showing. */
export function Bar({ style }: { style: "dark" | "light" }) {
  return useIsFocused() ? <StatusBar style={style} /> : null;
}

/**
 * The app's button: a 52 px pill. Default is the solid emerald primary; `alt`
 * is the quiet secondary (tinted); `color` recolours the primary. Dims while
 * pressed, shows a spinner while busy, and gives a light tap you can feel.
 */
export function Btn({
  label,
  onPress,
  alt,
  busy,
  disabled,
  color,
  icon,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  alt?: boolean;
  busy?: boolean;
  disabled?: boolean;
  color?: string;
  icon?: IconName;
  accessibilityLabel?: string;
}) {
  const off = Boolean(busy || disabled);
  const fg = alt ? C.emerald : "#fff";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off, busy: Boolean(busy) }}
      onPress={
        off
          ? undefined
          : () => {
              tap();
              onPress();
            }
      }
      style={({ pressed }) => [
        {
          backgroundColor: alt ? C.emeraldTint : (color ?? C.emerald),
          borderRadius: R.pill,
          minHeight: 52,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 22,
          paddingVertical: 12,
          flexDirection: "row",
          gap: 8,
        },
        off ? { opacity: 0.4 } : pressed ? { opacity: 0.85, transform: [{ scale: 0.985 }] } : null,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
          {label ? <Text style={[T.button, { color: fg, flexShrink: 1, textAlign: "center" }]}>{label}</Text> : null}
        </>
      )}
    </Pressable>
  );
}

/** A plain text action for the least important choice on a screen. */
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
      <Text style={{ color: color ?? C.emerald, fontWeight: "700", fontSize: 16, flexShrink: 1 }}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, tone, style }: { children: ReactNode; tone?: "amber" | "emerald" | "red" | "flat"; style?: StyleProp<ViewStyle> }) {
  const bg = tone === "amber" ? C.amberSoft : tone === "emerald" ? C.emeraldTint : tone === "red" ? C.redSoft : tone === "flat" ? C.surface : C.card;
  // Tinted cards sit flat on the page; only white cards float.
  return <View style={[S.card, { backgroundColor: bg }, tone ? { shadowOpacity: 0, elevation: 0 } : null, style]}>{children}</View>;
}

/** A small rounded label: status, a fact about the route. `solid` is the white pill used on top of photos. */
export function Badge({ text, tone, icon, solid }: { text: string; tone?: "sky" | "amber" | "red" | "grey" | "gold"; icon?: IconName; solid?: boolean }) {
  const map = {
    sky: [C.skySoft, C.sky],
    amber: [C.amberSoft, C.amber],
    red: [C.redSoft, C.red],
    grey: [C.surface, C.body],
    gold: ["#FFF4CC", "#7A5600"],
    emerald: [C.emeraldSoft, C.emeraldDark],
  } as const;
  const [bg, fg] = map[tone ?? "emerald"];
  return (
    <View
      style={[
        { alignSelf: "flex-start", backgroundColor: solid ? "#fff" : bg, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
        solid ? SHADOW : null,
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={solid && !tone ? C.emerald : fg} /> : null}
      <Text style={{ fontSize: 13, lineHeight: 17, fontWeight: "700", color: solid && !tone ? C.text : fg, flexShrink: 1 }}>{text}</Text>
    </View>
  );
}

/** The big title at the top of a tab, with an optional line under it and something on the right (the language switch). */
export function ScreenTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text accessibilityRole="header" style={[T.title, { flex: 1 }]}>
          {title}
        </Text>
        {right}
      </View>
      {subtitle ? <Text style={T.body}>{subtitle}</Text> : null}
    </View>
  );
}

/** An icon with a line of detail. */
export function IconLine({ icon, text, color, small }: { icon: IconName; text: string; color?: string; small?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      <Ionicons name={icon} size={small ? 16 : 20} color={color ?? C.muted} style={{ marginTop: small ? 2 : 3 }} />
      <Text style={[small ? T.small : T.body, { flex: 1 }, color && !small ? { color: C.text } : null]}>{text}</Text>
    </View>
  );
}

/** A tappable settings-style row: icon, title, optional detail, chevron. */
export function ListRow({ icon, title, detail, onPress, tone, value }: { icon: IconName; title: string; detail?: string; onPress: () => void; tone?: "red"; value?: string }) {
  const fg = tone === "red" ? C.red : C.text;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: tone === "red" ? C.redSoft : C.emeraldTint, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={20} color={tone === "red" ? C.red : C.emerald} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[T.bodyStrong, { color: fg }]}>{title}</Text>
        {detail ? <Text style={T.small}>{detail}</Text> : null}
      </View>
      {value ? <Text style={T.small}>{value}</Text> : null}
      {tone === "red" ? null : <Ionicons name="chevron-forward" size={18} color={C.faint} />}
    </Pressable>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: C.border }} />;
}

/** What a list shows when there is nothing in it yet. */
export function Empty({ title, text, icon }: { title?: string; text: string; icon?: IconName }) {
  return (
    <View style={{ alignItems: "center", gap: 10, paddingVertical: 28, paddingHorizontal: 12 }}>
      <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: C.emeraldTint, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon ?? "leaf-outline"} size={32} color={C.emerald} />
      </View>
      {title ? <Text style={[T.h2, { textAlign: "center" }]}>{title}</Text> : null}
      <Text style={[T.body, { textAlign: "center", color: C.muted }]}>{text}</Text>
    </View>
  );
}

/** A choice chip (region, quick pick). */
export function Chip({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={() => {
        pick();
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        minHeight: 44,
        borderWidth: 1.5,
        borderColor: on ? C.text : C.border,
        backgroundColor: on ? C.text : "#fff",
        borderRadius: R.pill,
        paddingHorizontal: 16,
        paddingVertical: 9,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon ? <Ionicons name={icon} size={16} color={on ? "#fff" : C.body} /> : null}
      <Text style={{ fontWeight: "600", color: on ? "#fff" : C.body, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

/** Two or three choices side by side in one rounded track (Fixed price / Driver bids). */
export function Segments<V extends string>({ value, options, onChange }: { value: V; options: { id: V; label: string; icon?: IconName }[]; onChange: (v: V) => void }) {
  return (
    <View style={{ flexDirection: "row", backgroundColor: C.surface, borderRadius: R.pill, padding: 4 }} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (!on) pick();
              onChange(o.id);
            }}
            style={[{ flex: 1, flexDirection: "row", gap: 8, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 8 }, on ? { backgroundColor: "#fff", ...SHADOW } : null]}
          >
            {o.icon ? <Ionicons name={o.icon} size={18} color={on ? C.emerald : C.muted} /> : null}
            <Text style={{ fontWeight: "700", fontSize: 15, color: on ? C.text : C.muted, flexShrink: 1, textAlign: "center" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** − 2 + : a number you nudge up and down (travellers, child seats). */
export function Stepper({ value, min, max, onChange, lessLabel, moreLabel }: { value: number; min: number; max: number; onChange: (n: number) => void; lessLabel: string; moreLabel: string }) {
  const btn = (icon: "add" | "remove", label: string, to: number, off: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
      onPress={
        off
          ? undefined
          : () => {
              pick();
              onChange(to);
            }
      }
      style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: off ? C.border : C.faint, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", opacity: off ? 0.4 : pressed ? 0.6 : 1 })}
    >
      <Ionicons name={icon} size={22} color={C.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {btn("remove", lessLabel, value - 1, value <= min)}
      <Text accessibilityLiveRegion="polite" style={{ fontSize: 20, fontWeight: "700", color: C.text, minWidth: 34, textAlign: "center" }}>
        {value}
      </Text>
      {btn("add", moreLabel, value + 1, value >= max)}
    </View>
  );
}

/** A full-width choice with a radio or a checkbox on the right (driver's language, payment). */
export function Choice({
  icon,
  title,
  detail,
  right,
  on,
  disabled,
  onPress,
  kind = "radio",
}: {
  icon?: IconName;
  title: string;
  detail?: string;
  right?: string;
  on: boolean;
  disabled?: boolean;
  onPress: () => void;
  kind?: "radio" | "checkbox";
}) {
  return (
    <Pressable
      accessibilityRole={kind}
      accessibilityState={kind === "radio" ? { selected: on, disabled: Boolean(disabled) } : { checked: on, disabled: Boolean(disabled) }}
      onPress={
        disabled
          ? undefined
          : () => {
              pick();
              onPress();
            }
      }
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 60,
        borderWidth: on ? 2 : 1.5,
        borderColor: on ? C.emerald : C.border,
        backgroundColor: on ? C.emeraldTint : "#fff",
        borderRadius: R.control + 2,
        paddingHorizontal: on ? 14 : 14.5,
        paddingVertical: 10,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      {icon ? <Ionicons name={icon} size={22} color={on ? C.emerald : C.muted} /> : null}
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={T.bodyStrong}>{title}</Text>
        {detail ? <Text style={T.small}>{detail}</Text> : null}
      </View>
      {right ? <Text style={[T.bodyStrong, { fontWeight: "700" }]}>{right}</Text> : null}
      <Ionicons name={kind === "radio" ? (on ? "radio-button-on" : "radio-button-off") : on ? "checkbox" : "square-outline"} size={24} color={on ? C.emerald : C.faint} />
    </Pressable>
  );
}

/** An on/off extra as a pill (Wi-Fi, stroller, pet). */
export function Toggle({ icon, label, on, onPress }: { icon: IconName; label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={() => {
        pick();
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minHeight: 48,
        borderWidth: on ? 2 : 1.5,
        borderColor: on ? C.emerald : C.border,
        backgroundColor: on ? C.emeraldTint : "#fff",
        borderRadius: R.pill,
        paddingHorizontal: on ? 15.5 : 16,
        paddingVertical: 8,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={on ? "checkmark-circle" : icon} size={20} color={on ? C.emerald : C.muted} />
      <Text style={{ fontWeight: "600", color: on ? C.emeraldDark : C.body, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

/** A soft grey block that gently pulses where content is still loading. */
export function Skeleton({ width, height, radius, style }: { width?: DimensionValue; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const a = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(a, { toValue: 0.55, duration: 700, useNativeDriver: Platform.OS !== "web" }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ width: width ?? "100%", height, borderRadius: radius ?? 10, backgroundColor: C.surface, opacity: a }, style]} />;
}

/** A card-shaped placeholder: a photo block and two lines. */
export function SkeletonCard({ photo = 150 }: { photo?: number }) {
  return (
    <View style={[S.card, { padding: 0, overflow: "hidden", gap: 0 }]}>
      <Skeleton height={photo} radius={0} />
      <View style={{ padding: SP.lg, gap: 10 }}>
        <Skeleton height={18} width="70%" />
        <Skeleton height={14} width="45%" />
      </View>
    </View>
  );
}

/**
 * The bar pinned to the bottom of a booking step: what it costs so far on the
 * left, the main action on the right. It pads itself above the iPhone home
 * indicator.
 */
export function BottomBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: SP.page, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 14) }, SHADOW_UP]}>
      {children}
    </View>
  );
}

/** A round white button that floats over a photo (back, close). */
export function RoundBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 }, SHADOW]}
    >
      <Ionicons name={icon} size={22} color={C.text} />
    </Pressable>
  );
}

/** "Step 2 of 5" with five short bars. */
export function Progress({ step, of, label }: { step: number; of: number; label: string }) {
  return (
    <View style={{ gap: 8 }} accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 1, max: of, now: step }}>
      <Text style={[T.label, { color: C.emerald }]}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {Array.from({ length: of }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i < step ? C.emerald : C.border }} />
        ))}
      </View>
    </View>
  );
}

/**
 * A scrolling page that moves out of the keyboard's way, with an optional bar
 * pinned under it (which rides up with the keyboard). Every form uses this.
 */
export function Page({
  children,
  footer,
  refreshControl,
  pad = true,
}: {
  children: ReactNode;
  footer?: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  pad?: boolean;
}) {
  const header = useHeaderHeight();
  return (
    <KeyboardAvoidingView style={S.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={header}>
      <ScrollView
        style={S.screen}
        contentContainerStyle={pad ? S.pad : { paddingBottom: SP.xxl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
      {footer}
    </KeyboardAvoidingView>
  );
}

/** A label that reads as a sentence above a field. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={[T.smallStrong, { color: C.body }]}>{children}</Text>;
}

/** A section heading inside a page. */
export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Text accessibilityRole="header" style={[T.h2, { flex: 1 }]}>
        {title}
      </Text>
      {action && onAction ? <LinkBtn label={action} onPress={onAction} /> : null}
    </View>
  );
}
