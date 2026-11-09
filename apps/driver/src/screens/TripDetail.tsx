import * as Linking from "expo-linking";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { crDateTime, plural, STATUS_LABEL, usd } from "../format";
import { C, S } from "../theme";
import type { ChatMessage, Coords, Names, Trip } from "../types";
import { Btn, Card, Field } from "../ui";
import { tripTitle } from "./Trips";

/** Where the car goes for one end. Drake Bay is reached by boat, so the car goes to the Sierpe dock. */
const SIERPE_DOCK = { lat: 8.8593, lng: -83.4725 };
function target(text: string | null, coords: Coords | null): { label: string; lat?: number; lng?: number; note?: string } | null {
  const label = (text ?? "").trim();
  if (coords?.town === "DrakeBay") return { label, ...SIERPE_DOCK, note: "Drive to the Sierpe boat dock; the boat covers the last part to Drake Bay." };
  if (typeof coords?.lat === "number" && typeof coords?.lng === "number") return { label, lat: coords.lat, lng: coords.lng };
  return label ? { label } : null;
}
const waze = (t: { label: string; lat?: number; lng?: number }) =>
  t.lat != null ? "https://waze.com/ul?ll=" + t.lat + "," + t.lng + "&navigate=yes" : "https://waze.com/ul?q=" + encodeURIComponent(t.label) + "&navigate=yes";
const gmaps = (t: { label: string; lat?: number; lng?: number }) =>
  "https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate&destination=" +
  encodeURIComponent(t.lat != null ? t.lat + "," + t.lng : t.label);

/** One trip: what to do, where to go, start / complete, and the chat with the traveller and the team. */
export function TripDetail({ trip, names, onBack, onChanged }: { trip: Trip; names: Names; onBack: () => void; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pickup = trip.service_type === "transfer" ? target(trip.origin, trip.origin_coords) : null;
  const dropoff = trip.service_type === "transfer" ? target(trip.destination, trip.destination_coords) : null;
  const stops = (trip.sightseeing_stops ?? []).map((s) => names.stops[s.id] ?? s.id).join(", ");
  const cash = trip.cash_to_collect == null ? 0 : Number(trip.cash_to_collect);

  async function step(next: "in_progress" | "completed") {
    setBusy(true);
    setError("");
    const res = await api("/driver/trips/status", { booking_id: trip.id, step: next });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Couldn't update the trip.");
    await onChanged();
  }

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      <Btn label="← Your trips" alt onPress={onBack} />
      <View>
        <Text style={S.label}>
          {trip.booking_ref} · {STATUS_LABEL[trip.status] ?? trip.status}
        </Text>
        <Text style={S.h1}>{tripTitle(trip, names)}</Text>
        <Text style={S.muted}>{crDateTime(trip.scheduled_at)} (Costa Rica time)</Text>
      </View>

      {trip.status === "confirmed" || trip.status === "in_progress" ? (
        <View style={[S.card, { borderColor: C.emerald, borderWidth: 2 }]}>
          <Text style={S.h2}>{trip.status === "confirmed" ? "When your travellers are on board" : "When you've dropped your travellers off"}</Text>
          <Text style={S.muted}>
            {trip.status === "confirmed"
              ? "Tap as you set off (available from 3 hours before the pickup time)."
              : "Tap at the drop-off. The traveller is then asked to rate the trip."}
          </Text>
          <Btn
            label={trip.status === "confirmed" ? "Start trip" : "Complete trip"}
            onPress={() => step(trip.status === "confirmed" ? "in_progress" : "completed")}
            busy={busy}
            color={C.emerald}
          />
          {error ? <Text style={S.error}>{error}</Text> : null}
        </View>
      ) : null}

      <Card>
        <Field label="Your payout" value={trip.driver_payout == null ? null : usd(trip.driver_payout)} />
        {cash > 0 ? <Field label="Collect in cash from the traveller" value={usd(cash) + " (you keep your payout; the rest is settled weekly)"} /> : null}
        <Field label="Passengers" value={trip.passenger_count == null ? null : plural(trip.passenger_count, "passenger")} />
        <Field label="Stops" value={stops} />
        <Field label="Flight / hotel" value={trip.flight_or_hotel_notes} />
        <Field label="Message for you" value={trip.driver_notes} />
      </Card>

      {pickup || dropoff ? (
        <Card>
          <Text style={S.h2}>Navigate</Text>
          {pickup ? <NavRow title="To the pickup" t={pickup} /> : null}
          {dropoff ? <NavRow title="To the drop-off" t={dropoff} /> : null}
        </Card>
      ) : null}

      <Chat bookingId={trip.id} />
    </ScrollView>
  );
}

function NavRow({ title, t }: { title: string; t: { label: string; lat?: number; lng?: number; note?: string } }) {
  return (
    <View style={{ gap: 6, marginTop: 6 }}>
      <Text style={S.label}>{title}</Text>
      <Text style={S.text}>{t.label}</Text>
      {t.note ? <Text style={{ color: C.amber, fontSize: 13 }}>{t.note}</Text> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Btn label="Waze" onPress={() => void Linking.openURL(waze(t))} color={C.sky} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label="Google Maps" alt onPress={() => void Linking.openURL(gmaps(t))} />
        </View>
      </View>
    </View>
  );
}

/** Trip chat through the server (same thread as the website), refreshed every 10 seconds. */
function Chat({ bookingId }: { bookingId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await api<{ messages: ChatMessage[] }>("/chat/" + bookingId);
    if (res.ok && res.data) setMessages(res.data.messages);
  }, [bookingId]);

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
    if (!res.ok || !res.data) return setError(res.error ?? "Couldn't send.");
    setMessages(res.data.messages);
    setText("");
  }

  return (
    <Card>
      <Text style={S.h2}>Chat with the traveller and our team</Text>
      {messages.length === 0 ? <Text style={S.muted}>Introduce yourself and confirm the pickup time. Keep phone numbers and links out of the chat.</Text> : null}
      {messages.map((m) => (
        <View
          key={m.id}
          style={{
            alignSelf: m.mine ? "flex-end" : "flex-start",
            backgroundColor: m.mine ? C.emeraldSoft : "#F1F5F9",
            borderRadius: 12,
            padding: 10,
            maxWidth: "88%",
          }}
        >
          {!m.mine ? <Text style={S.label}>{m.name}</Text> : null}
          <Text style={S.text}>{m.text}</Text>
        </View>
      ))}
      <TextInput accessibilityLabel="Message" value={text} onChangeText={setText} placeholder="Write a message" multiline maxLength={2000} style={[S.input, { minHeight: 48 }]} />
      {error ? <Text style={S.error}>{error}</Text> : null}
      <Btn label="Send" onPress={send} busy={busy} disabled={!text.trim()} />
    </Card>
  );
}
