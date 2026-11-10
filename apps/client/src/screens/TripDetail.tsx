import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { WebView } from "react-native-webview";
import { api } from "../api";
import { crDateTime, plural, usd } from "../format";
import { C, R, S } from "../theme";
import { TRAVELLER_STATUS, type AppBooking, type ChatMessage } from "../types";
import { Back, Badge, Btn, Card, Divider, IconLine } from "../ui";
import { bookingStage } from "./Trips";

/** One booking: status, what's due, the driver and car once assigned, the chat, and the rating after the trip. */
export function TripDetail({
  booking: b,
  token,
  onBack,
  onChanged,
  demo,
}: {
  booking: AppBooking;
  token: string;
  onBack: () => void;
  onChanged: () => Promise<void>;
  /** Sample chat for design previews; skips loading and the live map. */
  demo?: { chat: ChatMessage[] };
}) {
  // While the driver is sharing their position, keep it fresh.
  const live = Boolean(b.driverLocation) || b.driverOnTheWay;
  useEffect(() => {
    if (!live || demo) return;
    const t = setInterval(() => void onChanged(), 20000);
    return () => clearInterval(t);
  }, [live, onChanged, demo]);
  const loc = b.driverLocation;
  const stage = bookingStage(b);
  const driverName = b.driver?.firstName ?? "Your driver";
  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      <Back label="Your trips" onPress={onBack} />
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Badge text={stage.text} tone={stage.tone} icon={stage.icon} />
          <Text style={S.muted}>{b.ref}</Text>
        </View>
        <Text style={[S.title, { fontSize: 24 }]}>{b.title}</Text>
        <Text style={S.muted}>{crDateTime(b.scheduledAt)} · Costa Rica time</Text>
      </View>

      {b.driverOnTheWay && b.status === "confirmed" ? (
        <Card tone="emerald">
          <IconLine icon="navigate" color={C.emerald} text={driverName + " is on the way to your pickup."} />
        </Card>
      ) : null}
      {b.status === "pending_payment" || b.status === "pending_bids" ? (
        <Card tone="amber">
          <IconLine icon="time-outline" color={C.amber} text={TRAVELLER_STATUS[b.status] ?? b.status} />
        </Card>
      ) : null}

      {loc && b.driver && (b.status === "confirmed" || b.status === "in_progress") ? (
        <Card>
          <View style={S.row}>
            <Text style={S.h2}>{b.status === "in_progress" ? "You're on the road" : "Where " + b.driver.firstName + " is now"}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.emeraldBright }} />
              <Text style={{ fontSize: 12, fontWeight: "800", color: C.emerald }}>LIVE</Text>
            </View>
          </View>
          {b.status === "confirmed" && loc.etaAt ? (
            <Text style={S.text}>
              Arriving around <Text style={{ fontWeight: "800", color: C.text }}>{crDateTime(loc.etaAt).split(" · ").pop()}</Text> with current traffic.
            </Text>
          ) : null}
          <View style={{ height: 220, borderRadius: R.control, overflow: "hidden", backgroundColor: C.emeraldTint }}>
            {demo ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="location" size={36} color={C.emerald} />
              </View>
            ) : (
              <WebView
                source={{
                  uri:
                    "https://www.openstreetmap.org/export/embed.html?bbox=" +
                    (loc.lng - 0.02) + "," + (loc.lat - 0.02) + "," + (loc.lng + 0.02) + "," + (loc.lat + 0.02) +
                    "&layer=mapnik&marker=" + loc.lat + "," + loc.lng,
                }}
                scrollEnabled={false}
              />
            )}
          </View>
          <Text style={S.muted}>Updates by itself. Shown from 3 hours before your pickup until the trip ends.</Text>
        </Card>
      ) : null}

      {b.driver ? (
        <Card>
          <Text style={S.label}>Your driver</Text>
          <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            {b.driver.photo ? (
              <Image source={{ uri: b.driver.photo }} accessibilityLabel={b.driver.firstName + ", your driver"} style={{ width: 64, height: 64, borderRadius: 32 }} />
            ) : (
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.emeraldDark, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800" }}>{b.driver.firstName.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[S.h2, { fontSize: 20 }]}>{b.driver.firstName}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {b.driver.rating ? <Badge text={b.driver.rating} tone="amber" icon="star" /> : null}
                {b.driver.english ? <Badge text={b.driver.english === "fluent" ? "Fluent English" : "Basic English"} icon="chatbubbles-outline" /> : null}
                {b.driver.ict ? <Badge text="ICT tourist-transport permit" tone="sky" icon="ribbon-outline" /> : null}
              </View>
            </View>
          </View>
          {b.driver.bio ? <Text style={S.text}>{b.driver.bio}</Text> : null}
          {b.car ? (
            <>
              <Divider />
              <IconLine
                icon="car-outline"
                text={b.car.name + (b.car.color ? " · " + b.car.color : "") + (b.car.plate ? " · " + b.car.plate : "") + (b.car.seats ? " · " + b.car.seats + " seats" : "")}
              />
              {b.car.photos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {b.car.photos.map((u) => (
                    <Image key={u} source={{ uri: u }} accessibilityLabel={b.car?.name ?? "Vehicle"} style={{ width: 160, height: 116, borderRadius: R.control }} />
                  ))}
                </ScrollView>
              ) : null}
            </>
          ) : null}
        </Card>
      ) : b.status !== "cancelled" ? (
        <Card>
          <IconLine icon="person-circle-outline" text="We're matching you with a hand-picked local driver. Their profile and car photos will show here." />
        </Card>
      ) : null}

      <Card>
        <View style={S.row}>
          <Text style={S.label}>{b.paymentMode === "cash_driver" ? "To pay your driver in cash" : b.dueUsd > 0 ? "To pay online" : "Paid"}</Text>
          {b.dueUsd > 0 ? <Text style={S.money}>{usd(b.dueUsd)}</Text> : <Ionicons name="checkmark-circle" size={26} color={C.emerald} />}
        </View>
        <IconLine
          icon={b.paymentMode === "cash_driver" ? "cash-outline" : b.dueUsd > 0 ? "card-outline" : "checkmark-circle-outline"}
          text={
            b.paymentMode === "cash_driver"
              ? "Includes the " + usd(b.cashFeeUsd) + " cash booking fee."
              : b.dueUsd > 0
                ? "We send you a secure payment link once your trip is confirmed."
                : "Thank you, this trip is paid."
          }
        />
        {b.passengers ? <IconLine icon="people-outline" text={plural(b.passengers, "traveller")} /> : null}
      </Card>

      {b.status === "completed" && b.driver ? <Rate booking={b} token={token} onChanged={onChanged} /> : null}
      {b.status !== "cancelled" ? <Chat bookingId={b.id} token={token} driverName={b.driver?.firstName} demo={demo?.chat} /> : null}
    </ScrollView>
  );
}

/** 1–5 stars and an optional comment after the trip. A written comment counts double for the driver. */
function Rate({ booking: b, token, onChanged }: { booking: AppBooking; token: string; onChanged: () => Promise<void> }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = b.driver?.firstName ?? "your driver";

  if (b.myRating) {
    return (
      <Card>
        <IconLine icon="star" color={C.emerald} text={"You rated " + name + " " + plural(b.myRating, "star") + ". Thank you!"} />
      </Card>
    );
  }

  async function send() {
    setBusy(true);
    setError("");
    const res = await api("/client/rate", { token, booking_id: b.id, stars, comment: comment.trim() });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Couldn't save your rating.");
    await onChanged();
  }

  return (
    <Card tone="amber">
      <Text style={S.h2}>How was your ride with {name}?</Text>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 2 }} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={plural(n, "star")}
            accessibilityState={{ selected: stars === n }}
            onPress={() => setStars(n)}
            style={{ width: 54, height: 54, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name={stars >= n ? "star" : "star-outline"} size={38} color={stars >= n ? "#F59E0B" : "#D6B36A"} />
          </Pressable>
        ))}
      </View>
      <TextInput
        accessibilityLabel="A few words about your driver"
        value={comment}
        onChangeText={setComment}
        placeholder="A few words about your driver (optional)"
        placeholderTextColor={C.faint}
        multiline
        maxLength={1000}
        style={[S.input, { minHeight: 80, textAlignVertical: "top", backgroundColor: "#fff" }]}
      />
      {error ? <Text style={S.error}>{error}</Text> : null}
      <Btn label="Send rating" icon="star-outline" onPress={send} busy={busy} disabled={stars === 0} />
    </Card>
  );
}

/** The same chat as the trip page: the traveller, the driver once assigned, and our team. */
function Chat({ bookingId, token, driverName, demo }: { bookingId: string; token: string; driverName?: string; demo?: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(demo ?? []);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (demo) return;
    const res = await api<{ messages: ChatMessage[] }>("/chat/" + bookingId + "?trip=" + token);
    if (res.ok && res.data) setMessages(res.data.messages);
  }, [bookingId, token, demo]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10000);
    return () => clearInterval(t);
  }, [load]);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    const res = await api<{ messages: ChatMessage[] }>("/chat/" + bookingId, { text: text.trim(), trip: token });
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.error ?? "Couldn't send.");
    setMessages(res.data.messages);
    setText("");
  }

  return (
    <Card>
      <Text style={S.h2}>Chat</Text>
      {messages.length === 0 ? (
        <Text style={S.muted}>
          {driverName ? "Questions for " + driverName + " or our team? Write here." : "Questions about this booking? Write here and our team replies."}
        </Text>
      ) : null}
      {messages.map((m) => (
        <View key={m.id} style={{ alignSelf: m.mine ? "flex-end" : "flex-start", maxWidth: "86%", gap: 2 }}>
          {!m.mine ? <Text style={[S.label, { marginLeft: 4 }]}>{m.name}</Text> : null}
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
          accessibilityLabel="Message"
          value={text}
          onChangeText={setText}
          placeholder="Write a message"
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
