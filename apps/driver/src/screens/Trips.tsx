import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { crDateParts, crDayKey, crToday, departsIn, plural, usd, vehicleLabel } from "../format";
import { useT, type Lang } from "../i18n";
import { GOLD, GOLD_INK, type Segment } from "../nav";
import { C, R, S, SHADOW } from "../theme";
import type { Names, Trip } from "../types";
import { Empty, type IconName } from "../ui";

/** "Tour" reads the same in Spanish and English. */
export function tripTitle(t: Trip, names: Names): string {
  return t.service_type === "transfer" ? (t.origin ?? "—") + " → " + (t.destination ?? "—") : (names.tours[t.catalog_item_id ?? ""] ?? "Tour");
}

/** Where the trip stands, in the driver's words. */
export function tripStage(t: Trip, lang: Lang = "es"): { text: string; tone?: "sky" | "amber" | "grey" } {
  const es = lang === "es";
  if (t.status === "in_progress") return { text: es ? "En ruta" : "On the road" };
  if (t.status === "completed") return { text: es ? "Completado" : "Completed", tone: "grey" };
  if (t.status === "cancelled") return { text: es ? "Cancelado" : "Cancelled", tone: "grey" };
  return t.en_route_at ? { text: es ? "Camino a la recogida" : "On the way to pickup", tone: "sky" } : { text: es ? "Confirmado" : "Confirmed", tone: "amber" };
}

const AIRPORT_TOWNS = new Set(["SJO", "LIR"]);
const AIRPORT_WORDS = /airport|aeropuerto|\bSJO\b|\bLIR\b/i;
/** Towns across the Gulf of Nicoya: reached by the Paquera / Playa Naranjo car ferry unless the ride comes by road from Guanacaste. */
const FERRY_TOWNS = new Set(["SouthNicoya"]);
const ROAD_TO_NICOYA = new Set(["LIR", "Tamarindo"]);

/** What the trip's data says about it, for the small icons on the card and the detail. All from real booking fields. */
export function tripFacts(t: Trip) {
  const ride = t.service_type === "transfer";
  const o = t.origin_coords?.town ?? "";
  const d = t.destination_coords?.town ?? "";
  const airport =
    ride &&
    ((AIRPORT_TOWNS.has(o) && AIRPORT_WORDS.test(t.origin ?? "")) ||
    (AIRPORT_TOWNS.has(d) && AIRPORT_WORDS.test(t.destination ?? "")) ||
    /flight|vuelo/i.test(t.flight_or_hotel_notes ?? ""));
  const stops = t.sightseeing_stops?.length ?? 0;
  const seats = Number((t.preferences as { childSeats?: unknown } | null)?.childSeats ?? 0) || 0;
  const boat = (ride && (o === "DrakeBay" || d === "DrakeBay")) || t.vehicle_class === "sierpe_combo";
  const ferry = ride && ((FERRY_TOWNS.has(o) && !ROAD_TO_NICOYA.has(d)) || (FERRY_TOWNS.has(d) && !ROAD_TO_NICOYA.has(o)));
  const cash = t.cash_to_collect == null ? 0 : Number(t.cash_to_collect);
  return { airport, stops, seats, boat, ferry, cash };
}

/** The line under the route: stops, boat or ferry, or "day tour". */
function subline(t: Trip, lang: Lang): string {
  const es = lang === "es";
  if (t.service_type !== "transfer") return es ? "Tour de un día" : "Day tour";
  const f = tripFacts(t);
  const parts = [f.stops ? plural(f.stops, ["parada", "paradas"], ["stop", "stops"], lang) : es ? "sin paradas" : "no stops"];
  if (f.boat) parts.push(es ? "bote desde Sierpe" : "boat from Sierpe");
  if (f.ferry) parts.push(es ? "con ferry" : "ferry crossing");
  return parts.join(" · ");
}

/** A small round icon on the card. Gold means "needs your attention". */
function Dot({ icon, gold, label }: { icon: IconName; gold?: boolean; label: string }) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 1.5,
        borderColor: gold ? GOLD : C.border,
        backgroundColor: gold ? GOLD : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={14} color={gold ? GOLD_INK : C.body} />
    </View>
  );
}

/** The vehicle class (and other short facts) as an outlined pill. */
export function InfoChip({ icon, text, a11y }: { icon?: IconName; text: string; a11y?: string }) {
  return (
    <View
      accessible={Boolean(a11y)}
      accessibilityLabel={a11y}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderWidth: 1.5,
        borderColor: C.border,
        borderRadius: R.pill,
        paddingHorizontal: 9,
        paddingVertical: 3,
      }}
    >
      {icon ? <Ionicons name={icon} size={13} color={C.body} /> : null}
      <Text style={{ fontSize: 12, fontWeight: "700", color: C.text }}>{text}</Text>
    </View>
  );
}

/** Bags as the driver sees them. Older bookings have one number only (no carry-on count). */
export function tripBags(t: Trip, lang: Lang): { chip: string; words: string } | null {
  const large = t.luggage_count;
  const carry = t.carry_on_count;
  if (large == null && carry == null) return null;
  const es = lang === "es";
  if (carry == null) return { chip: String(large), words: large === 0 ? (es ? "Sin maletas" : "No bags") : plural(large ?? 0, ["maleta", "maletas"], ["bag", "bags"], lang) };
  const l = large ?? 0;
  return { chip: l + " + " + carry, words: l + " " + (es ? (l === 1 ? "grande" : "grandes") : "large") + " + " + carry + " " + (es ? "de mano" : "carry-on") };
}

/** The bags chip on the trip card and the trip screen: "4 + 4" = large suitcases + carry-ons. */
export function BagsChip({ trip }: { trip: Trip }) {
  const { t, lang } = useT();
  const bags = tripBags(trip, lang);
  return bags ? <InfoChip icon="briefcase-outline" text={bags.chip} a11y={t("Maletas: ", "Bags: ") + bags.words} /> : null;
}

/** The icons a trip earns, in the same order on the list and the detail (`detail` leaves out stops and seats, shown there as words). */
export function TripIcons({ trip, detail }: { trip: Trip; detail?: boolean }) {
  const { t } = useT();
  const f = tripFacts(trip);
  return (
    <>
      {f.airport ? <Dot icon="airplane-outline" label={t("Aeropuerto", "Airport")} /> : null}
      {f.stops && !detail ? <Dot icon="camera-outline" label={t("Con paradas", "Has stops")} /> : null}
      {f.seats && !detail ? <Dot icon="happy-outline" label={t("Silla de niño", "Child seat")} /> : null}
      {f.boat ? <Dot icon="boat" gold label={t("Bote a Bahía Drake", "Drake Bay boat")} /> : null}
      {f.ferry ? <Dot icon="boat" gold label={t("Ferry", "Ferry")} /> : null}
      {f.cash > 0 && trip.status !== "completed" ? <Dot icon="cash" gold label={t("Cobrar en efectivo", "Collect cash")} /> : null}
    </>
  );
}

/**
 * The driver's trips (the app's home): one card per trip with a big date, the
 * vehicle, small icons, the route, how long until it starts and the driver's payout.
 * The next trip gets an emerald border and a gold "Next" pill. Drivers only ever
 * see their own payout, never the client's price.
 */
export function Trips({
  trips,
  names,
  loading,
  onRefresh,
  onOpen,
  segment,
  onSegment,
  header,
}: {
  trips: Trip[];
  names: Names;
  loading: boolean;
  onRefresh: () => void;
  onOpen: (id: string) => void;
  segment: Segment;
  onSegment: (s: Segment) => void;
  /** Shown above the list, e.g. the request to share location. */
  header?: ReactNode;
}) {
  const { t, lang } = useT();
  const active = trips.filter((x) => x.status === "confirmed" || x.status === "in_progress");
  const today = crToday();
  const data =
    segment === "past"
      ? trips.filter((x) => x.status === "completed").reverse()
      : segment === "today"
        ? active.filter((x) => x.status === "in_progress" || (x.scheduled_at && crDayKey(x.scheduled_at) === today))
        : active;
  const nextId = active[0]?.id;
  const segs: [Segment, string][] = [
    ["upcoming", t("Próximos", "Upcoming")],
    ["today", t("Hoy", "Today")],
    ["past", t("Pasados", "Past")],
  ];

  return (
    <FlatList
      style={S.screen}
      contentContainerStyle={{ padding: 12, paddingBottom: 32, gap: 10 }}
      data={data}
      keyExtractor={(x) => x.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.emerald} />}
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 6 }}>
            {segs.map(([id, label]) => {
              const on = segment === id;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => onSegment(id)}
                  style={{
                    minHeight: 44,
                    justifyContent: "center",
                    paddingHorizontal: 16,
                    borderRadius: R.pill,
                    borderWidth: 1.5,
                    borderColor: on ? C.emerald : C.border,
                    backgroundColor: on ? C.emerald : C.card,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: on ? "#fff" : C.muted }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          {header}
        </View>
      }
      ListEmptyComponent={
        <Empty
          icon="car-outline"
          text={
            segment === "past"
              ? t("Aquí aparecen sus viajes completados.", "Your completed trips appear here.")
              : segment === "today"
                ? t("Hoy no tiene viajes.", "No trips today.")
                : t(
                    "Aún no tiene viajes. Envíe ofertas en Ofertas; cuando nuestro equipo lo elija, el viaje aparece aquí.",
                    "No trips yet. Send offers under Offers; when our team picks you, the trip appears here.",
                  )
          }
        />
      }
      ListFooterComponent={
        data.length > 0 && segment !== "past" ? (
          <Text style={[S.muted, { textAlign: "center", fontSize: 12, paddingHorizontal: 16, paddingTop: 4 }]}>
            {t("No tiene más viajes por ahora. Deslice hacia abajo para actualizar.", "No other upcoming trips. Pull down to refresh.")}
          </Text>
        ) : undefined
      }
      renderItem={({ item }) => (
        <TripCard trip={item} names={names} lang={lang} next={segment !== "past" && item.id === nextId} onPress={() => onOpen(item.id)} />
      )}
    />
  );
}

function TripCard({ trip, names, lang, next, onPress }: { trip: Trip; names: Names; lang: Lang; next: boolean; onPress: () => void }) {
  const { t } = useT();
  const date = crDateParts(trip.scheduled_at, lang);
  const vehicle = vehicleLabel(trip.vehicle_class, lang);
  const done = trip.status === "completed";
  const footLeft = trip.status === "in_progress" || trip.en_route_at || done ? tripStage(trip, lang).text : departsIn(trip.scheduled_at, lang);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        { backgroundColor: C.card, borderRadius: 16, padding: 12, gap: 8, borderWidth: next ? 2 : 1, borderColor: next ? C.emerald : C.border },
        SHADOW,
        pressed ? { opacity: 0.8 } : null,
      ]}
    >
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View
          style={{
            width: 74,
            backgroundColor: done ? "#EEF1EF" : C.emeraldTint,
            borderRadius: 12,
            alignItems: "center",
            paddingVertical: 8,
            paddingHorizontal: 4,
          }}
        >
          {date ? (
            <>
              <Text style={{ fontSize: 12, fontWeight: "700", color: done ? C.muted : C.emerald }}>{date.month}</Text>
              <Text style={{ fontSize: 28, lineHeight: 32, fontWeight: "800", color: C.text }}>{date.day}</Text>
              <View style={{ alignSelf: "stretch", height: 1, backgroundColor: done ? C.border : C.emeraldSoft, marginVertical: 4 }} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: C.text }} numberOfLines={1}>
                {date.time}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 11, fontWeight: "700", color: C.muted, textAlign: "center" }}>{t("Hora por confirmar", "Time to confirm")}</Text>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 6, justifyContent: "center" }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5 }}>
            {vehicle ? <InfoChip icon="car-outline" text={vehicle} /> : null}
            <BagsChip trip={trip} />
            <TripIcons trip={trip} />
            {trip.unread_chat ? (
              <View
                accessibilityLabel={t(trip.unread_chat + " mensajes sin leer", trip.unread_chat + " unread messages")}
                style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: GOLD, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 3 }}
              >
                <Ionicons name="chatbubble" size={11} color={GOLD_INK} />
                <Text style={{ fontSize: 11, fontWeight: "800", color: GOLD_INK }}>{trip.unread_chat}</Text>
              </View>
            ) : null}
            {next ? (
              <View
                style={{ backgroundColor: trip.status === "in_progress" ? C.emerald : GOLD, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 3 }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: trip.status === "in_progress" ? "#fff" : GOLD_INK }}>
                  {trip.status === "in_progress" ? t("En ruta", "On the road") : t("Siguiente", "Next")}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={{ fontSize: 15, fontWeight: "800", color: C.text, letterSpacing: -0.2 }} numberOfLines={1}>
            {tripTitle(trip, names)}
          </Text>
          <Text style={{ fontSize: 12.5, color: C.muted }} numberOfLines={1}>
            {subline(trip, lang)}
          </Text>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderTopWidth: 1,
          borderStyle: "dashed",
          borderTopColor: C.border,
          paddingTop: 8,
        }}
      >
        <Text style={{ fontSize: 12.5, color: C.muted, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>
          {footLeft}
        </Text>
        {trip.driver_payout != null ? <Text style={{ fontSize: 15, fontWeight: "800", color: C.emerald }}>{usd(trip.driver_payout)}</Text> : null}
      </View>
    </Pressable>
  );
}
