import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { cents, useBooking } from "../../booking";
import { useT } from "../../i18n";
import { useNav } from "../../nav";
import { driveTime } from "../../prices";
import { C, S, T } from "../../theme";
import { Badge, BottomBar, Btn, Progress, Skeleton, Text } from "../../ui";

export const STEPS = 5;

/** "Step 2 of 5", the bars, then the one question this screen asks. */
export function StepIntro({ step, title, subtitle }: { step: number; title: string; subtitle?: string }) {
  const { t } = useT();
  return (
    <View style={{ gap: 14 }}>
      <Progress step={step} of={STEPS} label={t("Step " + step + " of " + STEPS, "Paso " + step + " de " + STEPS)} />
      <View style={{ gap: 6 }}>
        <Text accessibilityRole="header" style={T.display}>
          {title}
        </Text>
        {subtitle ? <Text style={T.body}>{subtitle}</Text> : null}
      </View>
    </View>
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

/** Drive time, distance, ferry and season for the priced route; grey blocks while it loads. */
export function QuoteFacts() {
  const { t } = useT();
  const { state, quote, quoteBusy } = useBooking();
  if (!quote) {
    if (!quoteBusy || !state.from || !state.to) return null;
    return (
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Skeleton height={30} width={140} radius={15} />
        <Skeleton height={30} width={84} radius={15} />
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Badge text={t("About ", "Aprox. ") + driveTime(quote.minutes)} tone="grey" icon="time-outline" />
      {quote.km != null ? <Badge text={quote.km + " km"} tone="grey" icon="speedometer-outline" /> : null}
      {quote.ferries ? <Badge text={t("Ferry fares included", "Tarifas de ferry incluidas")} tone="sky" icon="boat-outline" /> : null}
      {quote.season.percent ? <Badge text={quote.season.name + " " + (quote.season.percent > 0 ? "+" : "") + quote.season.percent + "%"} tone="gold" icon="sunny-outline" /> : null}
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
