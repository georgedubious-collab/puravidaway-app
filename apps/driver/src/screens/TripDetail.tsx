import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { crDateTime, plural, usd } from "../format";
import { useT } from "../i18n";
import { C, R, S } from "../theme";
import type { ChatMessage, Coords, Names, Trip } from "../types";
import { Back, Badge, Btn, Card, IconLine } from "../ui";
import { tripStage, tripTitle } from "./Trips";

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
  "https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate&destination=" + encodeURIComponent(t.lat != null ? t.lat + "," + t.lng : t.label);

/** One trip: the next step, where to go, the details, and the chat with the traveller and the team. */
export function TripDetail({
  trip,
  names,
  onBack,
  onChanged,
  demoChat,
}: {
  trip: Trip;
  names: Names;
  onBack: () => void;
  onChanged: () => Promise<void>;
  /** Sample messages for design previews; skips loading. */
  demoChat?: ChatMessage[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { t, lang } = useT();
  const pickup = trip.service_type === "transfer" ? target(trip.origin, trip.origin_coords) : null;
  const dropoff = trip.service_type === "transfer" ? target(trip.destination, trip.destination_coords) : null;
  const stops = (trip.sightseeing_stops ?? []).map((s) => names.stops[s.id] ?? s.id).join(", ");
  const cash = trip.cash_to_collect == null ? 0 : Number(trip.cash_to_collect);
  const stage = tripStage(trip, lang);
  const active = trip.status === "confirmed" || trip.status === "in_progress";
  // I'm on my way → Client picked up → Trip ended.
  const nextIndex = trip.status === "in_progress" ? 2 : trip.en_route_at ? 1 : 0;
  const next = STEPS[nextIndex];
  // Before the pickup the driver needs the pickup; after it, the drop-off.
  const goingTo = trip.status === "in_progress" ? dropoff : pickup;

  async function step(id: StepId) {
    setBusy(true);
    setError("");
    const res = await api("/driver/trips/status", { booking_id: trip.id, step: id });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? t("No se pudo actualizar el viaje.", "Couldn't update the trip."));
    await onChanged();
  }

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      <Back label={t("Sus viajes", "Your trips")} onPress={onBack} />
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Badge text={stage.text} tone={stage.tone} />
          <Text style={S.muted}>{trip.booking_ref}</Text>
        </View>
        <Text style={[S.title, { fontSize: 24 }]}>{tripTitle(trip, names)}</Text>
        <Text style={S.muted}>{crDateTime(trip.scheduled_at, lang) + t(" · hora de Costa Rica", " · Costa Rica time")}</Text>
      </View>

      {active ? (
        <Card>
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
          <Text style={[S.h2, { marginTop: 6 }]}>{t(...next.title)}</Text>
          <Text style={S.muted}>{t(...next.help)}</Text>
          <Btn label={t(...next.button)} onPress={() => void step(next.id)} busy={busy} color={C.emerald} />
          {error ? <Text style={S.error}>{error}</Text> : null}
        </Card>
      ) : null}

      {active && goingTo ? (
        <Card>
          <Text style={S.label}>{trip.status === "in_progress" ? t("Destino", "Drop-off") : t("Recogida", "Pickup")}</Text>
          <Text style={S.h2}>{goingTo.label}</Text>
          {goingTo.note ? <IconLine icon="boat-outline" text={t(...goingTo.note)} color={C.amber} /> : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Btn label="Waze" icon="navigate" onPress={() => void Linking.openURL(waze(goingTo))} color={C.sky} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn label="Google Maps" icon="map-outline" alt onPress={() => void Linking.openURL(gmaps(goingTo))} />
            </View>
          </View>
          {trip.status !== "in_progress" && dropoff ? <Text style={S.muted}>{t("Luego a: ", "Then to: ") + dropoff.label}</Text> : null}
        </Card>
      ) : null}

      <Card>
        <View style={S.row}>
          <Text style={S.label}>{t("Su pago", "Your payout")}</Text>
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
        {trip.passenger_count ? (
          <IconLine icon="people-outline" text={plural(trip.passenger_count, ["pasajero", "pasajeros"], ["passenger", "passengers"], lang)} />
        ) : null}
        {stops ? <IconLine icon="camera-outline" text={t("Paradas: ", "Stops: ") + stops} /> : null}
        {trip.flight_or_hotel_notes ? <IconLine icon="airplane-outline" text={trip.flight_or_hotel_notes} /> : null}
        {trip.driver_notes ? <IconLine icon="chatbox-ellipses-outline" text={"“" + trip.driver_notes + "”"} /> : null}
      </Card>

      <Chat bookingId={trip.id} demo={demoChat} />
    </ScrollView>
  );
}

/** Trip chat through the server (same thread as the website), refreshed every 10 seconds. */
function Chat({ bookingId, demo }: { bookingId: string; demo?: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(demo ?? []);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { t } = useT();
  // The server names the team and the driver in English; show those two in the app's language.
  const who = (name: string) => (name === "Our team" ? t("Nuestro equipo", "Our team") : name === "You" ? t("Usted", "You") : name);

  const load = useCallback(async () => {
    if (demo) return;
    const res = await api<{ messages: ChatMessage[] }>("/chat/" + bookingId);
    if (res.ok && res.data) setMessages(res.data.messages);
  }, [bookingId, demo]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10000);
    return () => clearInterval(t);
  }, [load]);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    const res = await api<{ messages: ChatMessage[] }>("/chat/" + bookingId, { text: text.trim() });
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.error ?? t("No se pudo enviar.", "Couldn't send."));
    setMessages(res.data.messages);
    setText("");
  }

  return (
    <Card>
      <Text style={S.h2}>Chat</Text>
      <Text style={S.muted}>
        {t("Con el cliente y nuestro equipo. No comparta números de teléfono ni enlaces aquí.", "With the traveller and our team. Keep phone numbers and links out of it.")}
      </Text>
      {messages.length === 0 ? (
        <Text style={[S.muted, { fontStyle: "italic" }]}>
          {t("Aún no hay mensajes. Preséntese y confirme la hora de recogida.", "No messages yet. Introduce yourself and confirm the pickup time.")}
        </Text>
      ) : null}
      {messages.map((m) => (
        <View key={m.id} style={{ alignSelf: m.mine ? "flex-end" : "flex-start", maxWidth: "86%", gap: 2 }}>
          {!m.mine ? <Text style={[S.label, { marginLeft: 4 }]}>{who(m.name)}</Text> : null}
          <View
            style={{
              backgroundColor: m.mine ? C.emerald : "#EEF1EF",
              borderRadius: 18,
              borderBottomRightRadius: m.mine ? 4 : 18,
              borderBottomLeftRadius: m.mine ? 18 : 4,
              paddingHorizontal: 14,
              paddingVertical: 9,
            }}
          >
            <Text style={{ fontSize: 15, lineHeight: 20, color: m.mine ? "#fff" : C.text }}>{m.text}</Text>
          </View>
        </View>
      ))}
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
      {error ? <Text style={S.error}>{error}</Text> : null}
    </Card>
  );
}
