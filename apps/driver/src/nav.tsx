import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Animated, Image, Modal, PanResponder, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "./i18n";
import { C, R } from "./theme";
import type { DriverInfo } from "./types";
import type { IconName } from "./ui";

/** Where the driver is in the app. Each one is an item in the side menu. */
export type Section = "trips" | "jobs" | "calendar" | "earnings" | "documents" | "profile" | "help";

/** The trips list's three views. */
export type Segment = "upcoming" | "today" | "past";

/** The bright gold of the brand (logo dots, "needs attention" icons, counts). */
export const GOLD = "#F5B301";
export const GOLD_INK = "#3B2A00";

/** Menu entries: [Spanish, English] title and icon. */
export const SECTION_TITLE: Record<Section, [string, string]> = {
  trips: ["Próximos viajes", "Upcoming trips"],
  jobs: ["Ofertas", "Offers"],
  calendar: ["Disponibilidad", "Availability"],
  earnings: ["Ganancias", "Earnings"],
  documents: ["Documentos", "Documents"],
  profile: ["Mi cuenta", "My account"],
  help: ["Ayuda", "Help"],
};
export const SEGMENT_TITLE: Record<Segment, [string, string]> = {
  upcoming: ["Próximos viajes", "Upcoming trips"],
  today: ["Viajes de hoy", "Today's trips"],
  past: ["Viajes pasados", "Past trips"],
};
const MAIN: { id: Section; icon: IconName }[] = [
  { id: "trips", icon: "car-outline" },
  { id: "jobs", icon: "pricetags-outline" },
  { id: "calendar", icon: "calendar-outline" },
  { id: "earnings", icon: "wallet-outline" },
  { id: "documents", icon: "document-text-outline" },
  { id: "profile", icon: "person-circle-outline" },
];

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require("../assets/logo-mark.png") as number;

/** The brand mark (the "CR route": emerald strokes, gold dots), drawn from a transparent PNG. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return <Image source={LOGO} style={{ width: size, height: size }} accessibilityIgnoresInvertColors accessible={false} />;
}

/** A 44 pt round icon button for the top bar. */
function BarBtn({ icon, label, onPress, count }: { icon: IconName; label: string; onPress?: () => void; count?: number }) {
  if (!onPress) return <View style={{ width: 44, height: 44 }} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? C.emeraldTint : "transparent",
      })}
    >
      <Ionicons name={icon} size={24} color={C.text} />
      {count ? (
        <View
          style={{
            position: "absolute",
            top: 6,
            right: 5,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: GOLD,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 4,
            borderWidth: 2,
            borderColor: C.card,
          }}
        >
          <Text style={{ color: GOLD_INK, fontSize: 10, fontWeight: "800" }}>{count > 9 ? "9+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * The bar above every screen: ☰ (or ← on a pushed screen) on the left, the title in the
 * centre, and a bell on the right that opens the new offers (gold dot with how many).
 */
export function Bar({
  title,
  onMenu,
  onBack,
  onBell,
  bellCount,
}: {
  title: string;
  onMenu?: () => void;
  onBack?: () => void;
  onBell?: () => void;
  bellCount?: number;
}) {
  const { t } = useT();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: C.card,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
      }}
    >
      {onBack ? (
        <BarBtn icon="chevron-back" label={t("Atrás", "Back")} onPress={onBack} />
      ) : (
        <BarBtn icon="menu" label={t("Abrir el menú", "Open the menu")} onPress={onMenu} />
      )}
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "800", color: C.text, letterSpacing: -0.2 }}
      >
        {title}
      </Text>
      <BarBtn icon="notifications-outline" label={t("Ofertas nuevas", "New offers")} onPress={onBell} count={bellCount} />
    </View>
  );
}

/** Who is signed in, for the top of the side menu. */
export interface DrawerProfile {
  name: string;
  /** "Conductor independiente", or where their application stands. */
  role: string;
  /** "★ 4.9", only once they have ratings. */
  rating?: string;
}

/** Approval status as [Spanish, English], for drivers who aren't approved yet. */
const KYC: Record<string, [string, string]> = {
  pending: ["Solicitud en revisión", "Application in review"],
  rejected: ["Solicitud no aprobada", "Application not approved"],
  suspended: ["Cuenta suspendida", "Account suspended"],
};

/** The menu's profile card from the driver row and their name (or email when no name is saved yet). */
export function drawerProfile(driver: DriverInfo | null, name: string, t: (es: string, en: string) => string): DrawerProfile {
  const role = !driver
    ? t("Aún sin solicitud", "No application yet")
    : driver.kyc_status === "approved"
      ? t("Conductor independiente", "Independent driver")
      : KYC[driver.kyc_status]
        ? t(...KYC[driver.kyc_status])
        : driver.kyc_status;
  const rating = driver?.rating_count && driver.rating_avg != null ? "★ " + Number(driver.rating_avg).toFixed(2).replace(/0$/, "") : undefined;
  return { name: name || "—", role, rating };
}

/**
 * The side menu that replaces the bottom tabs. Slides in from the left over a dimmed
 * shade; tapping the shade, swiping it left or the phone's back button closes it.
 * Plain React Native (Modal + Animated + PanResponder): no navigation library.
 */
export function Drawer({
  open,
  onClose,
  current,
  onGo,
  profile,
  offers,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  current: Section;
  onGo: (s: Section) => void;
  profile: DrawerProfile;
  /** How many open jobs the driver can offer on (gold badge). */
  offers?: number;
  onSignOut: () => void;
}) {
  const { t, lang, setLang } = useT();
  const insets = useSafeAreaInsets();
  const { width: screen } = useWindowDimensions();
  const width = Math.min(Math.round(screen * 0.84), 340);
  const [anim] = useState(() => new Animated.Value(0));
  // Kept true after opening so the menu stays on screen while it slides away.
  const [shown, setShown] = useState(false);
  const native = Platform.OS !== "web";

  useEffect(() => {
    if (open) {
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: native }).start(() => setShown(true));
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: native }).start(({ finished }) => {
        if (finished) setShown(false);
      });
    }
  }, [open, anim, native]);

  // Swipe left on the menu to close it.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dx < -8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_e, g) => anim.setValue(Math.max(0, Math.min(1, 1 + g.dx / width))),
        onPanResponderRelease: (_e, g) => {
          if (g.dx < -width * 0.25 || g.vx < -0.5) onClose();
          else Animated.timing(anim, { toValue: 1, duration: 150, useNativeDriver: native }).start();
        },
      }),
    [anim, width, native, onClose],
  );

  const go = (s: Section) => {
    onGo(s);
    onClose();
  };
  const initials =
    profile.name
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <Modal visible={open || shown} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(10,20,15,0.45)", opacity: anim }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Cerrar el menú", "Close the menu")} onPress={onClose} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View
        {...pan.panHandlers}
        accessibilityViewIsModal
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width,
          backgroundColor: C.card,
          borderTopRightRadius: 24,
          borderBottomRightRadius: 24,
          transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-width - 20, 0] }) }],
        }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18, paddingHorizontal: 16, gap: 4 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 16,
              marginBottom: 10,
            }}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.emerald, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}>{initials}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: C.text }} numberOfLines={1}>
                {profile.name}
              </Text>
              <Text style={{ fontSize: 12, color: C.muted }} numberOfLines={2}>
                {profile.role}
              </Text>
            </View>
            {profile.rating ? (
              <View style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: C.text }}>{profile.rating}</Text>
              </View>
            ) : null}
          </View>

          {MAIN.map((m) => {
            const on = current === m.id;
            return (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => go(m.id)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  minHeight: 52,
                  paddingHorizontal: 10,
                  borderRadius: 14,
                  backgroundColor: on ? C.emeraldSoft : pressed ? C.emeraldTint : "transparent",
                })}
              >
                <Ionicons name={m.icon} size={23} color={on ? C.emerald : C.muted} />
                <Text style={{ flex: 1, fontSize: 19, fontWeight: "700", color: on ? C.emerald : C.text, letterSpacing: -0.2 }} numberOfLines={1}>
                  {t(...SECTION_TITLE[m.id])}
                </Text>
                {m.id === "jobs" && offers ? (
                  <View style={{ backgroundColor: GOLD, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 2 }}>
                    <Text style={{ color: GOLD_INK, fontSize: 12, fontWeight: "800" }}>{offers}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}

          <View style={{ height: 1, backgroundColor: C.border, marginVertical: 10 }} />

          <SmallItem icon="help-buoy-outline" label={t("Ayuda", "Help")} on={current === "help"} onPress={() => go("help")} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingHorizontal: 10 }}>
            <Ionicons name="language-outline" size={20} color={C.muted} />
            <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 6 }}>
              {(
                [
                  ["es", "🇨🇷 Español"],
                  ["en", "English"],
                ] as const
              ).map(([id, label]) => (
                <Pressable
                  key={id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: lang === id }}
                  onPress={() => setLang(id)}
                  style={{
                    minHeight: 36,
                    justifyContent: "center",
                    paddingHorizontal: 12,
                    borderRadius: R.pill,
                    borderWidth: 1.5,
                    borderColor: lang === id ? C.emerald : C.border,
                    backgroundColor: lang === id ? C.emeraldTint : "transparent",
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: lang === id ? C.emerald : C.body }}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <SmallItem
            icon="log-out-outline"
            label={t("Cerrar sesión", "Sign out")}
            color={C.red}
            onPress={() => {
              onClose();
              onSignOut();
            }}
          />

          <View style={{ flex: 1, minHeight: 24 }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10 }}>
            <LogoMark size={28} />
            <Text style={{ flex: 1, fontSize: 12, fontWeight: "700", color: C.muted }}>Costa Rica Private Transfers · {t("Socio", "Partner")}</Text>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function SmallItem({ icon, label, onPress, color, on }: { icon: IconName; label: string; onPress: () => void; color?: string; on?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(on) }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 44,
        paddingHorizontal: 10,
        borderRadius: 12,
        backgroundColor: on ? C.emeraldSoft : pressed ? C.emeraldTint : "transparent",
      })}
    >
      <Ionicons name={icon} size={20} color={color ?? (on ? C.emerald : C.muted)} />
      <Text style={{ fontSize: 15, fontWeight: "600", color: color ?? (on ? C.emerald : C.text) }}>{label}</Text>
    </Pressable>
  );
}
