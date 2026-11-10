import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { SITE_URL } from "../config";
import { crTime, plural, usd, vehicleLabel } from "../format";
import { useT } from "../i18n";
import { GOLD } from "../nav";
import { C, R, S } from "../theme";
import { hasContactDetails } from "../contact";
import type { ChatAnswer, ChatMessage, Coords, Names, Trip } from "../types";
import { Badge, Btn, Card, IconLine, LinkBtn, type IconName } from "../ui";
import { BagsChip, InfoChip, TripIcons, tripBags, tripFacts, tripStage, tripTitle } from "./Trips";

type StepId = "en_route" | "in_progress" | "completed";
/** Each text as [Spanish, English]. */
type Pair = [string, string];
const STEPS: { id: StepId; short: Pair; title: Pair; help: Pair; button: Pair }[] = [
  {
    id: "en_route",
    short: ["En camino", "On my way"],
    title: ["¿Sale hacia la recogida?", "Heading to the pickup?"],
    help: [
      "Tóquelo cuando salga (desde 6 horas antes de la hora de recogida). Al cliente se le avisa que va en camino y nuestro equipo sigue su llegada.",
      "Tap when you set off (from 6 hours before the pickup time). The traveller is told you're on the way and our team follows your arrival.",
    ],
    button: ["Voy en camino", "I'm on my way"],
  },
  {
    id: "in_progress",
    short: ["Recogido", "Picked up"],
    title: ["¿Pasajeros a bordo?", "Travellers on board?"],
    help: ["Tóquelo en la recogida, cuando todos estén en el carro.", "Tap at the pickup, once everyone is in the car."],
    button: ["Cliente recogido", "Client picked up"],
  },
  {
    id: "completed",
    short: ["Terminado", "Trip ended"],
    title: ["¿Ya dejó a sus pasajeros?", "Dropped your travellers off?"],
    help: [
      "Tóquelo en el destino. Se deja de compartir la ubicación y se le pide al cliente que califique el viaje.",
      "Tap at the drop-off. Location sharing stops and the traveller is asked to rate the trip.",
    ],
    button: ["Viaje terminado", "Trip ended"],
  },
];

/** Where the car goes for one end. Drake Bay is reached by boat, so the car goes to the Sierpe dock. */
const SIERPE_DOCK = { lat: 8.8593, lng: -83.4725 };
type Target = { label: string; lat?: number; lng?: number; note?: Pair };
function target(text: string | null, coords: Coords | null): Target | null {
  const label = (text ?? "").trim();
  if (coords?.town === "DrakeBay")
    return {
      label,
      ...SIERPE_DOCK,
      note: [
        "Maneje hasta el muelle de Sierpe; el bote hace el último tramo hasta Bahía Drake.",
        "Drive to the Sierpe boat dock; the boat covers the last part to Drake Bay.",
      ],
    };
  if (typeof coords?.lat === "number" && typeof coords?.lng === "number") return { label, lat: coords.lat, lng: coords.lng };
  return label ? { label } : null;
}
const waze = (t: Target) =>
  t.lat != null ? "https://waze.com/ul?ll=" + t.lat + "," + t.lng + "&navigate=yes" : "https://waze.com/ul?q=" + encodeURIComponent(t.label) + "&navigate=yes";
const gmaps = (t: Target) =>
  "https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate&destination=" +
  encodeURIComponent(t.lat != null ? t.lat + "," + t.lng : t.label);

/** One trip: the chips, the route with its stops, the travellers, the payout, the next step and the chat. */
export function TripDetail({
  trip,
  names,
  onChanged,
  demoChat,
  demoChatState,
  demoSupport,
}: {
  trip: Trip;
  names: Names;
  onChanged: () => Promise<void>;
  /** Sample messages for design previews; skips loading. */
  demoChat?: ChatMessage[];
  /** Design previews: the chat closed, showing the "contact hidden" notice, or with a draft. */
  demoChatState?: { closed?: boolean; notice?: boolean; draft?: string };
  /** Sample support WhatsApp for design previews; skips loading. */
  demoSupport?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [teamWhatsapp, setTeamWhatsapp] = useState(demoSupport ?? "");
  const { t, lang } = useT();
  const pickup = trip.service_type === "transfer" ? target(trip.origin, trip.origin_coords) : null;
  const dropoff = trip.service_type === "transfer" ? target(trip.destination, trip.destination_coords) : null;
  const stopList = (trip.sightseeing_stops ?? []).map((s) => ({ name: names.stops[s.id] ?? s.id, minutes: names.stopMinutes?.[s.id] }));
  const cash = trip.cash_to_collect == null ? 0 : Number(trip.cash_to_collect);
  const stage = tripStage(trip, lang);
  const facts = tripFacts(trip);
  const bags = tripBags(trip, lang);
  const vehicle = vehicleLabel(trip.vehicle_class, lang);
  const prefs = (trip.preferences ?? {}) as { language?: string; childSeats?: number; wifi?: boolean; stroller?: boolean; pets?: boolean };
  const active = trip.status === "confirmed" || trip.status === "in_progress";
  // I'm on my way → Client picked up → Trip ended.
  const nextIndex = trip.status === "in_progress" ? 2 : trip.en_route_at ? 1 : 0;
  const next = STEPS[nextIndex];
  // Before the pickup the driver needs the pickup; after it, the drop-off.
  const goingTo = trip.status === "in_progress" ? dropoff : pickup;

  // Our team's WhatsApp (the same number as Help). Travellers are reached through the trip chat.
  useEffect(() => {
    if (demoSupport !== undefined) return;
    void fetch(SITE_URL + "/api/v1/support")
      .then((r) => r.json() as Promise<{ whatsapp?: string }>)
      .then((d) => setTeamWhatsapp(d.whatsapp ?? ""))
      .catch(() => {});
  }, [demoSupport]);

  async function step(id: StepId) {
    setBusy(true);
    setError("");
    const res = await api("/driver/trips/status", { booking_id: trip.id, step: id });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? t("No se pudo actualizar el viaje.", "Couldn't update the trip."));
    await onChanged();
  }

  const asked: string[] = [];
  if (prefs.language === "english") asked.push(t("Conductor que habla inglés", "English-speaking driver"));
  if (prefs.language === "spanish_ok") asked.push(t("Español o inglés básico está bien", "Spanish or basic English is fine"));
  if (prefs.childSeats) asked.push(plural(prefs.childSeats, ["silla de niño", "sillas de niño"], ["child seat", "child seats"], lang));
  if (prefs.wifi) asked.push("Wi-Fi");
  if (prefs.stroller) asked.push(t("Coche de bebé", "Stroller"));
  if (prefs.pets) asked.push(t("Viaja con una mascota", "Travelling with a pet"));

  return (
    <ScrollView style={S.screen} contentContainerStyle={{ padding: 12, paddingBottom: 32, gap: 10 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        <Badge text={stage.text} tone={stage.tone} />
        {vehicle ? <InfoChip icon="car-outline" text={vehicle} /> : null}
        {facts.stops ? <InfoChip icon="camera-outline" text={plural(facts.stops, ["parada", "paradas"], ["stop", "stops"], lang)} /> : null}
        {trip.passenger_count ? <InfoChip icon="people-outline" text={String(trip.passenger_count)} /> : null}
        <BagsChip trip={trip} />
        {facts.seats ? <InfoChip icon="happy-outline" text={plural(facts.seats, ["silla de niño", "sillas de niño"], ["child seat", "child seats"], lang)} /> : null}
        <TripIcons trip={trip} detail />
        <Text style={[S.muted, { fontSize: 12 }]}>{trip.booking_ref}</Text>
      </View>

      <Section title={t("Ruta", "Route")}>
        {trip.service_type !== "transfer" ? <Text style={S.h2}>{tripTitle(trip, names)}</Text> : null}
        <View style={{ gap: 0 }}>
          {pickup ? (
            <Stop
              kind="start"
              title={pickup.label}
              sub={t("Recogida", "Pickup") + (trip.scheduled_at ? " · " + crTime(trip.scheduled_at, lang) : "")}
              last={!stopList.length && !dropoff}
            />
          ) : null}
          {stopList.map((s, i) => (
            <Stop
              key={i}
              kind="mid"
              title={s.name}
              sub={s.minutes ? t("Parada ", "Stop ") + duration(s.minutes) : t("Parada", "Stop")}
              last={i === stopList.length - 1 && !dropoff}
            />
          ))}
          {dropoff ? (
            <Stop
              kind="end"
              title={dropoff.label}
              sub={t("Destino", "Drop-off") + (trip.arrive_at ? " · " + t("Llegada aprox. ", "Arrives approx. ") + crTime(trip.arrive_at, lang) : "")}
              last
            />
          ) : null}
        </View>
        {pickup?.note || dropoff?.note ? <IconLine icon="boat-outline" text={t(...(pickup?.note ?? dropoff?.note)!)} color={C.amber} /> : null}
        {facts.ferry ? (
          <IconLine
            icon="boat-outline"
            text={t("Ruta con ferry por el golfo de Nicoya: revise el horario del ferry.", "Ferry route across the Gulf of Nicoya: check the ferry times.")}
            color={C.amber}
          />
        ) : null}
        {active && goingTo ? (
          <LinkBtn label={t("Abrir en Google Maps", "Open in Google Maps")} icon="map-outline" onPress={() => void Linking.openURL(gmaps(goingTo))} />
        ) : null}
      </Section>

      <Section title={t("Pasajeros", "Travellers")}>
        {trip.passenger_name ? <Row label={t("Letrero", "Name sign")} value={trip.passenger_name} /> : null}
        {trip.passenger_count ? <Row label={t("Pasajeros", "Travellers")} value={String(trip.passenger_count)} /> : null}
        {bags ? <Row label={t("Maletas", "Bags")} value={bags.words} /> : null}
        {trip.flight_or_hotel_notes ? <Row label={t("Vuelo / hotel", "Flight / hotel")} value={trip.flight_or_hotel_notes} /> : null}
        {asked.length ? <Row label={t("Pidió", "Asked for")} value={asked.join("\n")} /> : null}
        {trip.driver_notes ? <Row label={t("Nota", "Note")} value={"“" + trip.driver_notes + "”"} /> : null}
        {!trip.passenger_name && !trip.passenger_count && !bags && !trip.flight_or_hotel_notes && !asked.length && !trip.driver_notes ? (
          <Text style={S.muted}>{t("Sin detalles adicionales.", "No extra details.")}</Text>
        ) : null}
      </Section>

      <View style={[S.card, { gap: 8 }]}>
        <View style={S.row}>
          <Text style={[S.text, { color: C.muted }]}>{t("Usted recibe", "You receive")}</Text>
          <Text style={S.money}>{trip.driver_payout == null ? "—" : usd(trip.driver_payout)}</Text>
        </View>
        {cash > 0 ? (
          <View style={{ backgroundColor: C.amberSoft, borderRadius: R.control, padding: 12 }}>
            <Text style={{ color: C.amber, fontWeight: "800" }}>
              {t("Cobre " + usd(cash) + " en efectivo al cliente", "Collect " + usd(cash) + " in cash from the traveller")}
            </Text>
            <Text style={{ color: C.amber, fontSize: 13 }}>
              {t("Usted se queda con su pago; el resto se liquida cada semana.", "You keep your payout; the rest is settled weekly.")}
            </Text>
          </View>
        ) : null}
      </View>

      {active ? (
        <View style={[S.card, { gap: 8 }]}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            {STEPS.map((s, i) => (
              <View key={s.id} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "stretch" }}>
                  <View style={{ flex: 1, height: 3, backgroundColor: i === 0 ? "transparent" : i <= nextIndex ? C.emerald : C.border }} />
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: i < nextIndex ? C.emerald : i === nextIndex ? C.emeraldTint : "#fff",
                      borderWidth: 2,
                      borderColor: i <= nextIndex ? C.emerald : C.border,
                    }}
                  >
                    {i < nextIndex ? (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    ) : (
                      <Text style={{ fontWeight: "800", color: i === nextIndex ? C.emerald : C.faint, fontSize: 13 }}>{i + 1}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, height: 3, backgroundColor: i === STEPS.length - 1 ? "transparent" : i < nextIndex ? C.emerald : C.border }} />
                </View>
                <Text style={{ fontSize: 11, fontWeight: "700", color: i <= nextIndex ? C.text : C.faint }} numberOfLines={1}>
                  {t(...s.short)}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[S.h2, { marginTop: 4 }]}>{t(...next.title)}</Text>
          <Text style={S.muted}>{t(...next.help)}</Text>
        </View>
      ) : null}

      {teamWhatsapp ? <ContactRow phone={teamWhatsapp} /> : null}
      {teamWhatsapp || (active && goingTo) ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {teamWhatsapp ? (
            <OutlineBtn
              icon="logo-whatsapp"
              iconColor="#128C7E"
              label={t("Ayuda", "Help")}
              a11y={t("Escribir a nuestro equipo por WhatsApp", "WhatsApp our team")}
              onPress={() =>
                void Linking.openURL(
                  "https://wa.me/" +
                    teamWhatsapp +
                    "?text=" +
                    encodeURIComponent(
                      t(
                        "¡Hola! Soy conductor socio, sobre el viaje " + trip.booking_ref + ".",
                        "Hi! I'm a partner driver, about trip " + trip.booking_ref + ".",
                      ),
                    ),
                )
              }
            />
          ) : null}
          {active && goingTo ? (
            <OutlineBtn
              icon="navigate"
              iconColor={C.sky}
              label="Waze"
              a11y={trip.status === "in_progress" ? t("Waze al destino", "Waze to the drop-off") : t("Waze a la recogida", "Waze to the pickup")}
              onPress={() => void Linking.openURL(waze(goingTo))}
            />
          ) : null}
        </View>
      ) : null}
      {active ? <Btn label={t(...next.button)} onPress={() => void step(next.id)} busy={busy} color={C.emerald} /> : null}
      {error ? <Text style={S.error}>{error}</Text> : null}

      <Chat bookingId={trip.id} bookingRef={trip.booking_ref} demo={demoChat} demoState={demoChatState} support={teamWhatsapp} />
    </ScrollView>
  );
}

/** "1 h 30 min" / "45 min". */
const duration = (min: number) => (min >= 60 ? Math.floor(min / 60) + " h" + (min % 60 ? " " + (min % 60) + " min" : "") : min + " min");

/** A white card with a small uppercase heading. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={[S.card, { gap: 10 }]}>
      <Text style={S.label}>{title}</Text>
      {children}
    </View>
  );
}

/** A label on the left, its value on the right. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <Text style={[S.text, { color: C.muted, width: 104 }]}>{label}</Text>
      <Text style={[S.text, { color: C.text, fontWeight: "700", flex: 1, textAlign: "right" }]}>{value}</Text>
    </View>
  );
}

/**
 * One place on the route: an emerald ring for the pickup, gold rings for the stops
 * on the way, a solid emerald dot for the drop-off, joined by a thin line.
 */
function Stop({ kind, title, sub, last }: { kind: "start" | "mid" | "end"; title: string; sub: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ width: 14, alignItems: "center" }}>
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            marginTop: 3,
            borderWidth: 3,
            borderColor: kind === "mid" ? GOLD : C.emerald,
            backgroundColor: kind === "end" ? C.emerald : C.card,
          }}
        />
        {last ? null : <View style={{ flex: 1, width: 2, backgroundColor: C.border, marginVertical: 2 }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 14 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{title}</Text>
        <Text style={{ fontSize: 12.5, color: C.muted }}>{sub}</Text>
      </View>
    </View>
  );
}

/** A white, outlined half-width button (WhatsApp, Waze). */
function OutlineBtn({ icon, iconColor, label, a11y, onPress }: { icon: IconName; iconColor: string; label: string; a11y: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 50,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: R.control,
        borderWidth: 1.5,
        borderColor: C.border,
        backgroundColor: pressed ? C.emeraldTint : C.card,
      })}
    >
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text style={{ fontSize: 15, fontWeight: "800", color: C.text }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Ways to reach people from a trip. Drivers never get the traveller's phone or email
 * (Jorge, 2026-11-10): they write in the chat or call our team. A masked "Llamar al
 * cliente" button (Twilio, a later PR) goes in this row, next to "Llamar a nuestro equipo".
 */
function ContactRow({ phone, compact }: { phone: string; compact?: boolean }) {
  const { t } = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("Llamar a nuestro equipo", "Call our team")}
      onPress={() => void Linking.openURL("tel:+" + phone)}
      style={({ pressed }) => ({
        minHeight: compact ? 46 : 50,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: R.control,
        borderWidth: 1.5,
        borderColor: C.emerald,
        backgroundColor: pressed ? C.emeraldTint : C.card,
      })}
    >
      <Ionicons name="call" size={18} color={C.emerald} />
      <Text style={{ fontSize: 15, fontWeight: "800", color: C.emerald }}>{t("Llamar a nuestro equipo", "Call our team")}</Text>
    </Pressable>
  );
}

/**
 * Trip chat with the traveller through the server (same thread as the website; our team
 * reads it and can step in), refreshed every 10 seconds. The server hides phone numbers,
 * emails and links before storing and says so; after 48 hours past the trip it is read-only.
 */
function Chat({
  bookingId,
  bookingRef,
  demo,
  demoState,
  support,
}: {
  bookingId: string;
  bookingRef: string;
  demo?: ChatMessage[];
  demoState?: { closed?: boolean; notice?: boolean; draft?: string };
  support: string;
}) {
  const { t, lang } = useT();
  const [messages, setMessages] = useState<ChatMessage[]>(demo ?? []);
  const [text, setText] = useState(demoState?.draft ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(!demoState?.closed);
  const [serverClosedNote, setClosedNote] = useState("");
  const [serverNotice, setNotice] = useState("");
  // Design previews show these in whichever language the preview switches to.
  const closedNote =
    serverClosedNote ||
    (demoState?.closed ? t("Este chat se cerró 48 horas después del viaje. ¿Necesita algo? Contacte a nuestro equipo.", "This chat closed 48 hours after the trip. Need anything? Contact our team.") : "");
  const notice =
    serverNotice ||
    (demoState?.notice ? t("Por su seguridad, los datos de contacto se ocultan. Use este chat o llame a nuestro equipo.", "For your safety, contact details are hidden. Use this chat or call our team.") : "");
  // Older servers name the team in English; newer ones answer in the app's language (x-team-lang).
  const who = (name: string) => (name === "Our team" ? t("Nuestro equipo", "Our team") : name === "You" ? t("Usted", "You") : name);
  // Older servers store "[hidden]"; show it in the app's language.
  const shown = (s: string) => (lang === "es" ? s.split("[hidden]").join("[oculto]") : s);

  const apply = useCallback((a: ChatAnswer) => {
    setMessages(a.messages);
    if (a.open !== undefined) setOpen(a.open);
    setClosedNote(a.closedNote ?? "");
  }, []);

  const load = useCallback(async () => {
    if (demo) return;
    const res = await api<ChatAnswer>("/chat/" + bookingId);
    if (res.ok && res.data) apply(res.data);
  }, [bookingId, demo, apply]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10000);
    return () => clearInterval(t);
  }, [load]);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    const res = await api<ChatAnswer>("/chat/" + bookingId, { text: text.trim() });
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.error ?? t("No se pudo enviar.", "Couldn't send."));
    apply(res.data);
    setNotice(res.data.notice ?? "");
    setText("");
  }

  return (
    <Card>
      <Text style={S.h2}>{t("Chat con el cliente", "Chat with the traveller")}</Text>
      <IconLine
        icon="shield-checkmark-outline"
        color={C.emerald}
        text={t(
          "Nuestro equipo puede leer este chat. Los teléfonos, correos y enlaces se ocultan automáticamente.",
          "Our team can read this chat. Phone numbers, emails and links are hidden automatically.",
        )}
      />
      {messages.length === 0 ? (
        <Text style={[S.muted, { fontStyle: "italic" }]}>
          {t("Aún no hay mensajes. Preséntese y confirme la hora y el lugar de recogida.", "No messages yet. Introduce yourself and confirm the pickup time and place.")}
        </Text>
      ) : null}
      {messages.map((m) => (
        <View key={m.id} style={{ alignSelf: m.mine ? "flex-end" : "flex-start", maxWidth: "86%", gap: 2 }}>
          {!m.mine ? <Text style={[S.label, { marginLeft: 4 }]}>{who(m.name)}</Text> : null}
          <View
            style={{
              backgroundColor: m.mine ? C.emerald : m.party === "admin" ? "#FFF8E1" : "#EEF1EF",
              borderWidth: m.party === "admin" && !m.mine ? 1 : 0,
              borderColor: "#F6D77A",
              borderRadius: 18,
              borderBottomRightRadius: m.mine ? 4 : 18,
              borderBottomLeftRadius: m.mine ? 18 : 4,
              paddingHorizontal: 14,
              paddingVertical: 9,
            }}
          >
            <Text style={{ fontSize: 15, lineHeight: 20, color: m.mine ? "#fff" : C.text }}>{shown(m.text)}</Text>
          </View>
        </View>
      ))}
      {notice ? (
        <View accessibilityRole="alert" style={{ flexDirection: "row", gap: 8, backgroundColor: C.amberSoft, borderRadius: R.control, padding: 10 }}>
          <Ionicons name="shield-checkmark" size={18} color={C.amber} />
          <Text style={{ flex: 1, color: C.amber, fontWeight: "700", fontSize: 13.5 }}>{notice}</Text>
        </View>
      ) : null}
      {open ? (
        <>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end", marginTop: 4 }}>
            <TextInput
              accessibilityLabel={t("Mensaje", "Message")}
              value={text}
              onChangeText={setText}
              placeholder={t("Escriba un mensaje", "Write a message")}
              placeholderTextColor={C.faint}
              multiline
              maxLength={2000}
              style={[S.input, { flex: 1, borderRadius: 22, minHeight: 46 }]}
            />
            <View style={{ width: 52 }}>
              <Btn label="" icon="send" onPress={() => void send()} busy={busy} disabled={!text.trim()} color={C.emerald} />
            </View>
          </View>
          {hasContactDetails(text) ? (
            <Text style={{ color: C.amber, fontSize: 12.5, fontWeight: "700" }}>
              {t("Los teléfonos, correos y enlaces se ocultarán al enviar.", "Phone numbers, emails and links will be hidden when you send.")}
            </Text>
          ) : null}
        </>
      ) : (
        <IconLine icon="lock-closed-outline" text={closedNote} />
      )}
      {error ? <Text style={S.error}>{error}</Text> : null}
      {support ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <ContactRow phone={support} compact />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Escribir a nuestro equipo por WhatsApp", "WhatsApp our team")}
            onPress={() =>
              void Linking.openURL(
                "https://wa.me/" +
                  support +
                  "?text=" +
                  encodeURIComponent(t("¡Hola! Soy conductor socio, sobre el viaje " + bookingRef + ".", "Hi! I'm a partner driver, about trip " + bookingRef + ".")),
              )
            }
            style={({ pressed }) => ({ width: 52, minHeight: 46, borderRadius: R.control, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? C.emeraldTint : C.card })}
          >
            <Ionicons name="logo-whatsapp" size={22} color="#128C7E" />
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}
