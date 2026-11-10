import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { WebView } from "react-native-webview";
import { api } from "../api";
import { crDateTime, plural, usd } from "../format";
import { useT } from "../i18n";
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
  const { lang, t } = useT();
  // While the driver is sharing their position, keep it fresh.
  const live = Boolean(b.driverLocation) || b.driverOnTheWay;
  useEffect(() => {
    if (!live || demo) return;
    const t = setInterval(() => void onChanged(), 20000);
    return () => clearInterval(t);
  }, [live, onChanged, demo]);
  const loc = b.driverLocation;
  const stage = bookingStage(b, lang);
  const driverName = b.driver?.firstName ?? t("Your driver", "Su conductor");
  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      <Back label={t("Your trips", "Sus viajes")} onPress={onBack} />
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Badge text={stage.text} tone={stage.tone} icon={stage.icon} />
          <Text style={S.muted}>{b.ref}</Text>
        </View>
        <Text style={[S.title, { fontSize: 24 }]}>{b.title}</Text>
        <Text style={S.muted}>{crDateTime(b.scheduledAt, lang)} · {t("Costa Rica time", "hora de Costa Rica")}</Text>
      </View>

      {b.driverOnTheWay && b.status === "confirmed" ? (
        <Card tone="emerald">
          <IconLine icon="navigate" color={C.emerald} text={t(driverName + " is on the way to your pickup.", driverName + " va en camino a su punto de recogida.")} />
        </Card>
      ) : null}
      {b.status === "pending_payment" || b.status === "pending_bids" ? (
        <Card tone="amber">
          <IconLine icon="time-outline" color={C.amber} text={TRAVELLER_STATUS[lang][b.status] ?? b.status} />
        </Card>
      ) : null}

      {loc && b.driver && (b.status === "confirmed" || b.status === "in_progress") ? (
        <Card>
          <View style={S.row}>
            <Text style={S.h2}>{b.status === "in_progress" ? t("You're on the road", "Ya va en ruta") : t("Where " + b.driver.firstName + " is now", "Dónde está " + b.driver.firstName + " ahora")}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.emeraldBright }} />
              <Text style={{ fontSize: 12, fontWeight: "800", color: C.emerald }}>{t("LIVE", "EN VIVO")}</Text>
            </View>
          </View>
          {b.status === "confirmed" && loc.etaAt ? (
            <Text style={S.text}>
              {t("Arriving around ", "Llega alrededor de las ")}
              <Text style={{ fontWeight: "800", color: C.text }}>{crDateTime(loc.etaAt, lang).split(" · ").pop()}</Text>
              {t(" with current traffic.", " con el tráfico actual.")}
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
          <Text style={S.muted}>{t("Updates by itself. Shown from 3 hours before your pickup until the trip ends.", "Se actualiza solo. Se muestra desde 3 horas antes de su recogida hasta que termina el viaje.")}</Text>
        </Card>
      ) : null}

      {b.driver ? (
        <Card>
          <Text style={S.label}>{t("Your driver", "Su conductor")}</Text>
          <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            {b.driver.photo ? (
              <Image source={{ uri: b.driver.photo }} accessibilityLabel={b.driver.firstName + t(", your driver", ", su conductor")} style={{ width: 64, height: 64, borderRadius: 32 }} />
            ) : (
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.emeraldDark, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800" }}>{b.driver.firstName.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[S.h2, { fontSize: 20 }]}>{b.driver.firstName}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {b.driver.rating ? <Badge text={b.driver.rating} tone="amber" icon="star" /> : null}
                {b.driver.english ? <Badge text={b.driver.english === "fluent" ? t("Fluent English", "Inglés fluido") : t("Basic English", "Inglés básico")} icon="chatbubbles-outline" /> : null}
                {b.driver.ict ? <Badge text={t("ICT tourist-transport permit", "Permiso ICT de transporte turístico")} tone="sky" icon="ribbon-outline" /> : null}
              </View>
            </View>
          </View>
          {b.driver.bio ? <Text style={S.text}>{b.driver.bio}</Text> : null}
          {b.car ? (
            <>
              <Divider />
              <IconLine
                icon="car-outline"
                text={b.car.name + (b.car.color ? " · " + b.car.color : "") + (b.car.plate ? " · " + b.car.plate : "") + (b.car.seats ? " · " + plural(b.car.seats, "seat", lang) : "")}
              />
              {b.car.photos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {b.car.photos.map((u) => (
                    <Image key={u} source={{ uri: u }} accessibilityLabel={b.car?.name ?? t("Vehicle", "Vehículo")} style={{ width: 160, height: 116, borderRadius: R.control }} />
                  ))}
                </ScrollView>
              ) : null}
            </>
          ) : null}
        </Card>
      ) : b.status !== "cancelled" ? (
        <Card>
          <IconLine icon="person-circle-outline" text={t("We're matching you with a hand-picked local driver. Their profile and car photos will show here.", "Estamos asignándole un conductor local seleccionado. Su perfil y las fotos del vehículo aparecerán aquí.")} />
        </Card>
      ) : null}

      <Card>
        <View style={S.row}>
          <Text style={S.label}>{b.paymentMode === "cash_driver" ? t("To pay your driver in cash", "Por pagar al conductor en efectivo") : b.dueUsd > 0 ? t("To pay online", "Por pagar en línea") : t("Paid", "Pagado")}</Text>
          {b.dueUsd > 0 ? <Text style={S.money}>{usd(b.dueUsd)}</Text> : <Ionicons name="checkmark-circle" size={26} color={C.emerald} />}
        </View>
        <IconLine
          icon={b.paymentMode === "cash_driver" ? "cash-outline" : b.dueUsd > 0 ? "card-outline" : "checkmark-circle-outline"}
          text={
            b.paymentMode === "cash_driver"
              ? t("Includes the " + usd(b.cashFeeUsd) + " cash booking fee.", "Incluye el cargo por reserva en efectivo de " + usd(b.cashFeeUsd) + ".")
              : b.dueUsd > 0
                ? t("We send you a secure payment link once your trip is confirmed.", "Le enviamos un enlace de pago seguro cuando su viaje esté confirmado.")
                : t("Thank you, this trip is paid.", "Gracias, este viaje está pagado.")
          }
        />
        {b.passengers ? <IconLine icon="people-outline" text={plural(b.passengers, "traveller", lang)} /> : null}
      </Card>

      {b.status === "completed" && b.driver ? <Rate booking={b} token={token} onChanged={onChanged} /> : null}
      {b.status !== "cancelled" ? <Chat bookingId={b.id} token={token} driverName={b.driver?.firstName} demo={demo?.chat} /> : null}
    </ScrollView>
  );
}

/** 1–5 stars and an optional comment after the trip. A written comment counts double for the driver. */
function Rate({ booking: b, token, onChanged }: { booking: AppBooking; token: string; onChanged: () => Promise<void> }) {
  const { lang, t } = useT();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = b.driver?.firstName ?? t("your driver", "su conductor");

  if (b.myRating) {
    return (
      <Card>
        <IconLine icon="star" color={C.emerald} text={t("You rated " + name + " " + plural(b.myRating, "star") + ". Thank you!", "Usted calificó a " + name + " con " + plural(b.myRating, "star", "es") + ". ¡Gracias!")} />
      </Card>
    );
  }

  async function send() {
    setBusy(true);
    setError("");
    const res = await api("/client/rate", { token, booking_id: b.id, stars, comment: comment.trim() });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? t("Couldn't save your rating.", "No pudimos guardar su calificación."));
    await onChanged();
  }

  return (
    <Card tone="amber">
      <Text style={S.h2}>{t("How was your ride with " + name + "?", "¿Cómo estuvo su viaje con " + name + "?")}</Text>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 2 }} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={plural(n, "star", lang)}
            accessibilityState={{ selected: stars === n }}
            onPress={() => setStars(n)}
            style={{ width: 54, height: 54, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name={stars >= n ? "star" : "star-outline"} size={38} color={stars >= n ? "#F59E0B" : "#D6B36A"} />
          </Pressable>
        ))}
      </View>
      <TextInput
        accessibilityLabel={t("A few words about your driver", "Unas palabras sobre su conductor")}
        value={comment}
        onChangeText={setComment}
        placeholder={t("A few words about your driver (optional)", "Unas palabras sobre su conductor (opcional)")}
        placeholderTextColor={C.faint}
        multiline
        maxLength={1000}
        style={[S.input, { minHeight: 80, textAlignVertical: "top", backgroundColor: "#fff" }]}
      />
      {error ? <Text style={S.error}>{error}</Text> : null}
      <Btn label={t("Send rating", "Enviar calificación")} icon="star-outline" onPress={send} busy={busy} disabled={stars === 0} />
    </Card>
  );
}

/** The same chat as the trip page: the traveller, the driver once assigned, and our team. */
function Chat({ bookingId, token, driverName, demo }: { bookingId: string; token: string; driverName?: string; demo?: ChatMessage[] }) {
  const { t } = useT();
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
    if (!res.ok || !res.data) return setError(res.error ?? t("Couldn't send.", "No se pudo enviar."));
    setMessages(res.data.messages);
    setText("");
  }

  return (
    <Card>
      <Text style={S.h2}>Chat</Text>
      {messages.length === 0 ? (
        <Text style={S.muted}>
          {driverName
            ? t("Questions for " + driverName + " or our team? Write here.", "¿Preguntas para " + driverName + " o para nuestro equipo? Escriba aquí.")
            : t("Questions about this booking? Write here and our team replies.", "¿Preguntas sobre esta reserva? Escriba aquí y nuestro equipo le responde.")}
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
          accessibilityLabel={t("Message", "Mensaje")}
          value={text}
          onChangeText={setText}
          placeholder={t("Write a message", "Escriba un mensaje")}
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
