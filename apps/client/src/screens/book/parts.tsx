import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { bagsFor, cents, luggageCapacity, useBooking } from "../../booking";
import { useT } from "../../i18n";
import { useNav } from "../../nav";
import { driveTime, nightLabel } from "../../prices";
import { C, R, S, SHADOW_UP, T } from "../../theme";
import { Badge, BottomBar, Btn, Skeleton, Text, type IconName } from "../../ui";

/** The white panel that sits over the bottom of a map. */
export const SHEET = [{ backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26 }, SHADOW_UP];

/** Pickup to drop-off, drawn: a green dot, a line, a dark square. Stretches to the height of the rows beside it. */
export function RouteDots({ inset = 20, small }: { inset?: number; small?: boolean }) {
  const d = small ? 10 : 12;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignItems: "center", paddingVertical: inset, width: 14 }}>
      <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: C.emerald }} />
      <View style={{ flex: 1, width: 2, minHeight: 10, backgroundColor: C.faint }} />
      <View style={{ width: d, height: d, borderRadius: 3, backgroundColor: C.text }} />
    </View>
  );
}

/** A small outlined button with an icon ("Add a stop", the date, the travellers). `tone="amber"` asks for attention. */
export function ChipBtn({ icon, label, onPress, tone, grow, accessibilityLabel }: { icon?: IconName; label: string; onPress: () => void; tone?: "amber"; grow?: boolean; accessibilityLabel?: string }) {
  const fg = tone === "amber" ? C.amber : C.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 44,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: R.pill,
        borderWidth: 1,
        borderColor: tone === "amber" ? C.amberSoft : C.border,
        backgroundColor: tone === "amber" ? C.amberSoft : C.card,
        opacity: pressed ? 0.6 : 1,
        ...(grow ? { flexGrow: 1, flexShrink: 1 } : { flexShrink: 1 }),
      })}
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={{ fontSize: 14, lineHeight: 19, fontWeight: "700", color: fg, flexShrink: 1 }}>{label}</Text>
    </Pressable>
  );
}

/** A gentle amber hint, never a block: more large suitcases than the chosen vehicle lists. */
export function BagNote() {
  const { t } = useT();
  const { state, vehicle } = useBooking();
  const fits = luggageCapacity(vehicle?.luggage);
  const large = bagsFor(state).large;
  if (fits == null || large <= fits) return null;
  return (
    <View style={{ backgroundColor: C.amberSoft, borderRadius: R.control, padding: 12 }}>
      <Text style={[T.small, { color: C.amber, fontWeight: "700" }]}>
        {t(
          "This vehicle lists " + fits + (fits === 1 ? " suitcase" : " suitcases") + " and you have " + large + " large. Consider a larger vehicle or ask our team.",
          "Este vehículo indica " + fits + (fits === 1 ? " maleta" : " maletas") + " y usted lleva " + large + " grandes. Considere un vehículo más grande o consulte a nuestro equipo.",
        )}
      </Text>
    </View>
  );
}

/** One line of a settings-like card on the confirm screen: title, a detail under it, and a green action word. */
export function ActionRow({ title, detail, action, onPress, last }: { title: string; detail?: string; action: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title + (detail ? ": " + detail : "") + ". " + action}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.border, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: "600", color: C.text }}>{title}</Text>
        {detail ? <Text style={T.caption}>{detail}</Text> : null}
      </View>
      <Text style={{ fontSize: 14, lineHeight: 19, fontWeight: "700", color: C.emerald }}>{action}</Text>
    </Pressable>
  );
}

/**
 * The bar pinned under a booking step: the price so far on the left, the way
 * forward on the right. `amount` null shows a placeholder while the price loads.
 */
export function PriceBar({
  label,
  amount,
  note,
  action,
  onPress,
  disabled,
  busy,
  icon = "arrow-forward",
}: {
  label: string;
  amount: string | null;
  note?: string;
  action: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"] | null;
}) {
  return (
    <BottomBar>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={T.caption} numberOfLines={1}>
            {label}
          </Text>
          {amount === null ? <Skeleton height={26} width={90} style={{ marginVertical: 2 }} /> : <Text style={T.money}>{amount}</Text>}
          {note ? (
            <Text style={[T.caption, { fontSize: 12, lineHeight: 16 }]} numberOfLines={2}>
              {note}
            </Text>
          ) : null}
        </View>
        <View style={{ minWidth: 148, maxWidth: "58%" }}>
          <Btn label={action} icon={icon ?? undefined} onPress={onPress} disabled={disabled} busy={busy} />
        </View>
      </View>
    </BottomBar>
  );
}

/** The bar for the first steps, before a vehicle is chosen: "From $146 · for the whole car". */
export function FromBar({ onNext, canNext }: { onNext: () => void; canNext: boolean }) {
  const { t } = useT();
  const { state, quote, quoteBusy, fromCents } = useBooking();
  const waiting = Boolean(state.from && state.to) && !quote && quoteBusy;
  return (
    <PriceBar
      label={fromCents !== null ? t("From", "Desde") : t("Private ride", "Traslado privado")}
      amount={waiting ? null : fromCents !== null ? cents(fromCents) : "—"}
      note={t("For the whole car, taxes included", "Por todo el vehículo, impuestos incluidos")}
      action={t("Continue", "Continuar")}
      onPress={onNext}
      disabled={!canNext}
    />
  );
}

/**
 * Drive time, distance, ferry, season and night pickup for the priced route; grey blocks while it loads.
 * `brief` leaves out the drive time (already on the map) and the placeholder.
 */
export function QuoteFacts({ brief }: { brief?: boolean }) {
  const { lang, t } = useT();
  const { state, quote, quoteBusy } = useBooking();
  if (!quote) {
    if (brief || !quoteBusy || !state.from || !state.to) return null;
    return (
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Skeleton height={30} width={140} radius={15} />
        <Skeleton height={30} width={84} radius={15} />
      </View>
    );
  }
  const night = quote.night?.applies ? quote.night : null;
  if (brief && quote.km == null && !quote.ferries && !quote.season.percent && !night) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {brief ? null : <Badge text={t("About ", "Aprox. ") + driveTime(quote.minutes)} tone="grey" icon="time-outline" />}
      {quote.km != null ? <Badge text={quote.km + " km"} tone="grey" icon="speedometer-outline" /> : null}
      {quote.ferries ? <Badge text={t("Ferry fares included", "Tarifas de ferry incluidas")} tone="sky" icon="boat-outline" /> : null}
      {quote.season.percent ? <Badge text={quote.season.name + " " + (quote.season.percent > 0 ? "+" : "") + quote.season.percent + "%"} tone="gold" icon="sunny-outline" /> : null}
      {night ? <Badge text={nightLabel(night, lang)} tone="gold" icon="moon-outline" /> : null}
    </View>
  );
}

/** What went wrong with the price, if anything: the server's message, or no vehicle big enough. */
export function QuoteProblem() {
  const { t } = useT();
  const { state, quote, quoteError } = useBooking();
  const text = quoteError
    ? quoteError
    : quote && quote.vehicles.length === 0
      ? t("No vehicle for " + state.pax + " travellers on this route. Message us on WhatsApp.", "No hay vehículo para " + state.pax + " viajeros en esta ruta. Escríbanos por WhatsApp.")
      : "";
  if (!text) return null;
  return (
    <View accessibilityRole="alert" style={{ flexDirection: "row", gap: 10, backgroundColor: C.redSoft, borderRadius: 14, padding: 14 }}>
      <Ionicons name="alert-circle" size={20} color={C.red} style={{ marginTop: 1 }} />
      <Text style={[S.error, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

/** The ✕ at the top of a slide-up panel. */
export function CloseBtn() {
  const { t } = useT();
  const nav = useNav();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t("Close", "Cerrar")} hitSlop={10} onPress={() => nav.goBack()} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name="close" size={22} color={C.text} />
    </Pressable>
  );
}

/** A tappable field that opens a picker: small label, big value, chevron. */
export function PickRow({ icon, label, value, placeholder, onPress, right }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value?: string; placeholder?: string; onPress: () => void; right?: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label + ": " + (value ?? placeholder ?? "")}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 68, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.emeraldTint, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={20} color={C.emerald} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={T.caption}>{label}</Text>
        <Text style={[T.bodyStrong, value ? null : { color: C.faint, fontWeight: "500" }]} numberOfLines={2}>
          {value ?? placeholder}
        </Text>
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={C.faint} />}
    </Pressable>
  );
}
