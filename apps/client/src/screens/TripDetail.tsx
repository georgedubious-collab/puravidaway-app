import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { crDateTime, plural, usd } from "../format";
import { C, S } from "../theme";
import { TRAVELLER_STATUS, type AppBooking, type ChatMessage } from "../types";
import { Badge, Btn, Card } from "../ui";

/** One booking: status, what's due, the driver and car once assigned, the chat, and the rating after the trip. */
export function TripDetail({ booking: b, token, onBack, onChanged }: { booking: AppBooking; token: string; onBack: () => void; onChanged: () => Promise<void> }) {
  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      <Btn label="← Your trips" alt onPress={onBack} />
      <View>
        <Text style={S.label}>
          {b.ref} · {TRAVELLER_STATUS[b.status] ?? b.status}
        </Text>
        <Text style={S.h1}>{b.title}</Text>
        <Text style={S.muted}>{crDateTime(b.scheduledAt)} (Costa Rica time)</Text>
      </View>

      {b.driverOnTheWay ? <Badge text={(b.driver?.firstName ?? "Your driver") + " is on the way to your pickup"} /> : null}

      <Card>
        <Text style={S.label}>{b.paymentMode === "cash_driver" ? "To pay your driver in cash" : "To pay online"}</Text>
        <Text style={S.money}>{usd(b.dueUsd)}</Text>
        <Text style={S.muted}>
          {b.paymentMode === "cash_driver"
            ? "Includes the " + usd(b.cashFeeUsd) + " cash booking fee."
            : "We send you a secure payment link once your trip is confirmed."}
        </Text>
        {b.passengers ? <Text style={S.muted}>{plural(b.passengers, "traveller")}</Text> : null}
      </Card>

      {b.driver ? (
        <Card>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            {b.driver.photo ? (
              <Image source={{ uri: b.driver.photo }} accessibilityLabel={b.driver.firstName + ", your driver"} style={{ width: 72, height: 72, borderRadius: 36 }} />
            ) : (
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.emeraldSoft }} />
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={S.h2}>{b.driver.firstName} is your driver</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {b.driver.rating ? <Badge text={"★ " + b.driver.rating} tone="amber" /> : null}
                {b.driver.english ? <Badge text={b.driver.english === "fluent" ? "Fluent English" : "Basic English"} /> : null}
                {b.driver.ict ? <Badge text="ICT tourist-transport permit" tone="sky" /> : null}
              </View>
            </View>
          </View>
          {b.driver.bio ? <Text style={S.text}>{b.driver.bio}</Text> : null}
          {b.car ? (
            <>
              <Text style={[S.text, { fontWeight: "700", marginTop: 6 }]}>
                {b.car.name}
                {b.car.color ? " · " + b.car.color : ""}
                {b.car.plate ? " · " + b.car.plate : ""}
                {b.car.seats ? " · " + b.car.seats + " seats" : ""}
              </Text>
              {b.car.photos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {b.car.photos.map((u) => (
                    <Image key={u} source={{ uri: u }} accessibilityLabel={b.car?.name ?? "Vehicle"} style={{ width: 150, height: 110, borderRadius: 10 }} />
                  ))}
                </ScrollView>
              ) : null}
            </>
          ) : null}
        </Card>
      ) : b.status !== "cancelled" ? (
        <Card>
          <Text style={S.muted}>We&apos;re matching you with a hand-picked local driver. Their profile and car photos will show here.</Text>
        </Card>
      ) : null}

      {b.status === "completed" && b.driver ? <Rate booking={b} token={token} onChanged={onChanged} /> : null}
      {b.status !== "cancelled" ? <Chat bookingId={b.id} token={token} driverName={b.driver?.firstName} /> : null}
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
        <Text style={{ color: C.emerald, fontWeight: "700" }}>
          You rated {name} {plural(b.myRating, "star")}. Thank you!
        </Text>
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
    <View style={[S.card, { backgroundColor: C.amberSoft, borderColor: "#FCD34D" }]}>
      <Text style={S.h2}>How was your ride with {name}?</Text>
      <View style={{ flexDirection: "row", gap: 4 }} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={plural(n, "star")}
            accessibilityState={{ selected: stars === n }}
            onPress={() => setStars(n)}
            style={{ minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 34, color: stars >= n ? "#F59E0B" : "#CBD5E1" }}>★</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        accessibilityLabel="A few words about your driver"
        value={comment}
        onChangeText={setComment}
        placeholder="A few words about your driver (optional)"
        multiline
        maxLength={1000}
        style={[S.input, { minHeight: 70, textAlignVertical: "top" }]}
      />
      {error ? <Text style={S.error}>{error}</Text> : null}
      <Btn label="Send rating" onPress={send} busy={busy} disabled={stars === 0} />
    </View>
  );
}

/** The same chat as the trip page: the traveller, the driver once assigned, and our team. */
function Chat({ bookingId, token, driverName }: { bookingId: string; token: string; driverName?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await api<{ messages: ChatMessage[] }>("/chat/" + bookingId + "?trip=" + token);
    if (res.ok && res.data) setMessages(res.data.messages);
  }, [bookingId, token]);

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
        <View
          key={m.id}
          style={{ alignSelf: m.mine ? "flex-end" : "flex-start", backgroundColor: m.mine ? C.emeraldSoft : "#F1F5F9", borderRadius: 12, padding: 10, maxWidth: "88%" }}
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
