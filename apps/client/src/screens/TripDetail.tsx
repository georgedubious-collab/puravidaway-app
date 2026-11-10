import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { api } from "../api";
import { useDemo } from "../demo";
import { crDateTime, plural, usd } from "../format";
import { pick, success, tap } from "../haptics";
import { LangToggle, useT } from "../i18n";
import { photoForTrip } from "../images";
import { useNav, type RootParams, type TripsParams } from "../nav";
import { Photo } from "../Photo";
import { allBookings, useSession } from "../session";
import { C, R, S, SHADOW, SHADOW_UP, SP, T, fontFor } from "../theme";
import { TRAVELLER_STATUS, type AppBooking, type ChatMessage } from "../types";
import { Badge, Bar, Btn, Card, Divider, IconLine, Input, ListRow, Page, RoundBtn, Skeleton, Text } from "../ui";
import { Avatar, bookingStage } from "./Trips";

function useBookingById(id: string) {
  const { trips } = useSession();
  return allBookings(trips).find((x) => x.booking.id === id);
}

/** One booking: status, the live map, the driver and car once assigned, what's due, the chat and the rating. */
export function TripDetail() {
  const { lang, t } = useT();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const demo = useDemo();
  const { id } = useRoute<RouteProp<TripsParams, "TripDetail">>().params;
  const { reload, loaded } = useSession();
  const found = useBookingById(id);
  const b = found?.booking;
  const [pulling, setPulling] = useState(false);

  // While the driver is sharing their position, keep it fresh.
  const live = Boolean(b?.driverLocation) || Boolean(b?.driverOnTheWay);
  useEffect(() => {
    if (!live || demo) return;
    const timer = setInterval(() => void reload(), 20000);
    return () => clearInterval(timer);
  }, [live, reload, demo]);

  const top = (
    <View style={{ position: "absolute", top: insets.top + 8, left: SP.page, right: SP.page, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <RoundBtn icon="chevron-back" label={t("Your trips", "Sus viajes")} onPress={() => nav.goBack()} />
      <LangToggle />
    </View>
  );

  if (!b) {
    return (
      <View style={[S.screen, { paddingTop: insets.top + 72, paddingHorizontal: SP.page, gap: SP.lg }]}>
        <Bar style="dark" />
        {loaded ? (
          <Text style={T.body}>{t("We couldn't find that trip. Pull down in My trips to refresh.", "No encontramos ese viaje. Deslice hacia abajo en Mis viajes para actualizar.")}</Text>
        ) : (
          <>
            <Skeleton height={200} radius={R.card} />
            <Skeleton height={24} width="70%" />
            <Skeleton height={16} width="45%" />
          </>
        )}
        {top}
      </View>
    );
  }

  const loc = b.driverLocation;
  const stage = bookingStage(b, lang);
  const driverName = b.driver?.firstName ?? t("Your driver", "Su conductor");
  async function pull() {
    setPulling(true);
    await reload();
    setPulling(false);
  }

  return (
    <View style={S.screen}>
      <Bar style="light" />
      <ScrollView style={S.screen} contentContainerStyle={{ paddingBottom: SP.xxl }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void pull()} tintColor="#fff" colors={[C.emerald]} />}>
        <Photo name={photoForTrip(b.title)} scrim style={{ height: 260 }} />
        <View style={{ marginTop: -28, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: SP.page, gap: SP.lg }}>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Badge text={stage.text} tone={stage.tone} icon={stage.icon} />
              <Text style={T.caption}>{b.ref}</Text>
            </View>
            <Text accessibilityRole="header" style={T.h1}>
              {b.title}
            </Text>
            <Text style={T.body}>
              {crDateTime(b.scheduledAt, lang)} · {t("Costa Rica time", "hora de Costa Rica")}
            </Text>
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
            <Card style={{ padding: 0, gap: 0, overflow: "hidden" }}>
              <View style={{ height: 220, backgroundColor: C.emeraldTint }}>
                {demo ? (
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="location" size={40} color={C.emerald} />
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
                <View style={[{ position: "absolute", left: 12, top: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 6 }, SHADOW]}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.emeraldBright }} />
                  <Text style={{ fontSize: 12, fontWeight: "800", color: C.emerald, letterSpacing: 0.5 }}>{t("LIVE", "EN VIVO")}</Text>
                </View>
              </View>
              <View style={{ padding: SP.lg, gap: 6 }}>
                <Text style={T.h3}>{b.status === "in_progress" ? t("You're on the road", "Ya va en ruta") : t("Where " + b.driver.firstName + " is now", "Dónde está " + b.driver.firstName + " ahora")}</Text>
                {b.status === "confirmed" && loc.etaAt ? (
                  <Text style={T.body}>
                    {t("Arriving around ", "Llega alrededor de las ")}
                    <Text style={{ fontWeight: "700", color: C.text }}>{crDateTime(loc.etaAt, lang).split(" · ").pop()}</Text>
                    {t(" with current traffic.", " con el tráfico actual.")}
                  </Text>
                ) : null}
                <Text style={T.caption}>{t("Updates by itself. Shown from 3 hours before your pickup until the trip ends.", "Se actualiza solo. Se muestra desde 3 horas antes de su recogida hasta que termina el viaje.")}</Text>
              </View>
            </Card>
          ) : null}

          {b.driver ? (
            <Card>
              <Text style={T.label}>{t("Your driver", "Su conductor")}</Text>
              <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
                <Avatar name={b.driver.firstName} photo={b.driver.photo} size={68} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={T.h2}>{b.driver.firstName}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {b.driver.rating ? <Badge text={b.driver.rating} tone="gold" icon="star" /> : null}
                    {b.driver.english ? <Badge text={b.driver.english === "fluent" ? t("Fluent English", "Inglés fluido") : t("Basic English", "Inglés básico")} tone="grey" icon="chatbubbles-outline" /> : null}
                    {b.driver.ict ? <Badge text={t("ICT tourist-transport permit", "Permiso ICT de transporte turístico")} tone="sky" icon="ribbon-outline" /> : null}
                  </View>
                </View>
              </View>
              {b.driver.bio ? <Text style={T.body}>{b.driver.bio}</Text> : null}
              {b.car ? (
                <>
                  <Divider />
                  <IconLine icon="car-outline" text={b.car.name + (b.car.color ? " · " + b.car.color : "") + (b.car.plate ? " · " + b.car.plate : "") + (b.car.seats ? " · " + plural(b.car.seats, "seat", lang) : "")} />
                  {b.car.photos.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                      {b.car.photos.map((u) => (
                        <Image key={u} source={{ uri: u }} accessibilityLabel={b.car?.name ?? t("Vehicle", "Vehículo")} style={{ width: 180, height: 126, borderRadius: R.control, backgroundColor: C.surface }} />
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

          {b.status !== "cancelled" ? (
            <Card>
              <ListRow
                icon="chatbubbles-outline"
                title="Chat"
                detail={b.driver ? t("Message " + b.driver.firstName + " or our team", "Escriba a " + b.driver.firstName + " o a nuestro equipo") : t("Questions about this booking? Our team replies here", "¿Preguntas sobre esta reserva? Nuestro equipo le responde aquí")}
                onPress={() => nav.navigate("Chat", { id: b.id })}
              />
            </Card>
          ) : null}

          {b.status === "completed" && b.driver ? (
            b.myRating ? (
              <Card>
                <IconLine icon="star" color={C.gold} text={t("You rated " + driverName + " " + plural(b.myRating, "star") + ". Thank you!", "Usted calificó a " + driverName + " con " + plural(b.myRating, "star", "es") + ". ¡Gracias!")} />
              </Card>
            ) : (
              <Card tone="amber">
                <Text style={T.h2}>{t("How was your ride with " + driverName + "?", "¿Cómo estuvo su viaje con " + driverName + "?")}</Text>
                <Text style={T.body}>{t("It takes a few seconds and helps " + driverName + " a lot.", "Toma unos segundos y le ayuda mucho a " + driverName + ".")}</Text>
                <Btn label={t("Rate your ride", "Calificar su viaje")} icon="star-outline" color={C.emeraldDark} onPress={() => nav.navigate("Rate", { id: b.id })} />
              </Card>
            )
          ) : null}

          <Card>
            <View style={S.row}>
              <Text style={[T.bodyStrong, { flex: 1 }]}>{b.paymentMode === "cash_driver" ? t("To pay your driver in cash", "Por pagar al conductor en efectivo") : b.dueUsd > 0 ? t("To pay online", "Por pagar en línea") : t("Paid", "Pagado")}</Text>
              {b.dueUsd > 0 ? <Text style={T.money}>{usd(b.dueUsd)}</Text> : <Ionicons name="checkmark-circle" size={28} color={C.emerald} />}
            </View>
            <IconLine
              small
              icon={b.paymentMode === "cash_driver" ? "cash-outline" : b.dueUsd > 0 ? "card-outline" : "checkmark-circle-outline"}
              text={
                b.paymentMode === "cash_driver"
                  ? t("Includes the " + usd(b.cashFeeUsd) + " cash booking fee.", "Incluye el cargo por reserva en efectivo de " + usd(b.cashFeeUsd) + ".")
                  : b.dueUsd > 0
                    ? t("We send you a secure payment link once your trip is confirmed.", "Le enviamos un enlace de pago seguro cuando su viaje esté confirmado.")
                    : t("Thank you, this trip is paid.", "Gracias, este viaje está pagado.")
              }
            />
            {b.passengers ? <IconLine small icon="people-outline" text={plural(b.passengers, "traveller", lang)} /> : null}
          </Card>

          {b.status !== "cancelled" ? <Timeline booking={b} /> : null}
        </View>
      </ScrollView>
      {top}
    </View>
  );
}

/** The trip's steps from request to arrival, with the ones already done ticked. */
function Timeline({ booking: b }: { booking: AppBooking }) {
  const { t } = useT();
  const s = b.status;
  const after = (...list: string[]) => list.includes(s);
  const steps: { label: string; done: boolean }[] = [
    { label: t("Request received", "Solicitud recibida"), done: true },
    { label: t("Driver confirmed", "Conductor confirmado"), done: after("confirmed", "in_progress", "completed") },
    { label: t("Driver on the way", "Conductor en camino"), done: (s === "confirmed" && b.driverOnTheWay) || after("in_progress", "completed") },
    { label: t("On the road", "En ruta"), done: after("in_progress", "completed") },
    { label: t("Trip completed", "Viaje completado"), done: s === "completed" },
  ];
  const current = steps.findIndex((x) => !x.done);
  return (
    <Card>
      <Text style={T.label}>{t("Your trip, step by step", "Su viaje, paso a paso")}</Text>
      <View>
        {steps.map((step, i) => {
          const now = i === current;
          return (
            <View key={step.label} style={{ flexDirection: "row", gap: 14 }} accessible accessibilityLabel={step.label + (step.done ? t(", done", ", listo") : now ? t(", next", ", siguiente") : "")}>
              <View style={{ alignItems: "center", width: 24 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: step.done ? C.emerald : "#fff", borderWidth: step.done ? 0 : 2, borderColor: now ? C.emerald : C.border }}>
                  {step.done ? <Ionicons name="checkmark" size={15} color="#fff" /> : now ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.emerald }} /> : null}
                </View>
                {i < steps.length - 1 ? <View style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: steps[i + 1].done ? C.emerald : C.border }} /> : null}
              </View>
              <Text style={[step.done || now ? T.bodyStrong : T.body, { flex: 1, paddingBottom: i < steps.length - 1 ? 14 : 0, color: step.done || now ? C.text : C.faint }]}>{step.label}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

/** Slide-up panel: 1–5 stars and an optional comment after the trip. A written comment counts double for the driver. */
export function RateSheet() {
  const { lang, t } = useT();
  const nav = useNav();
  const { id } = useRoute<RouteProp<RootParams, "Rate">>().params;
  const { reload } = useSession();
  const found = useBookingById(id);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const b = found?.booking;
  const name = b?.driver?.firstName ?? t("your driver", "su conductor");

  async function send() {
    if (!found) return;
    setBusy(true);
    setError("");
    const res = await api("/client/rate", { token: found.trip.token, booking_id: found.booking.id, stars, comment: comment.trim() });
    if (!res.ok) {
      setBusy(false);
      return setError(res.error ?? t("Couldn't save your rating.", "No pudimos guardar su calificación."));
    }
    success();
    await reload();
    setBusy(false);
    nav.goBack();
  }

  const words = [
    "",
    t("Not good", "Nada bien"),
    t("Could be better", "Podría mejorar"),
    t("It was OK", "Estuvo bien"),
    t("Very good", "Muy bien"),
    t("Excellent!", "¡Excelente!"),
  ];
  return (
    <Page>
      <Bar style="dark" />
      <View style={{ alignItems: "center", gap: 10 }}>
        {b?.driver ? <Avatar name={b.driver.firstName} photo={b.driver.photo} size={84} /> : null}
        <Text accessibilityRole="header" style={[T.h1, { textAlign: "center" }]}>
          {t("How was your ride with " + name + "?", "¿Cómo estuvo su viaje con " + name + "?")}
        </Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 2 }} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={plural(n, "star", lang)}
            accessibilityState={{ selected: stars === n }}
            onPress={() => {
              pick();
              setStars(n);
            }}
            style={{ width: 58, height: 58, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name={stars >= n ? "star" : "star-outline"} size={44} color={stars >= n ? C.gold : C.faint} />
          </Pressable>
        ))}
      </View>
      <Text accessibilityLiveRegion="polite" style={[T.bodyStrong, { textAlign: "center", minHeight: 25 }]}>
        {words[stars]}
      </Text>
      <Input
        accessibilityLabel={t("A few words about your driver", "Unas palabras sobre su conductor")}
        value={comment}
        onChangeText={setComment}
        placeholder={t("A few words about your driver (optional)", "Unas palabras sobre su conductor (opcional)")}
        multiline
        maxLength={1000}
        style={{ minHeight: 110, textAlignVertical: "top" }}
      />
      {error ? (
        <Text accessibilityRole="alert" style={S.error}>
          {error}
        </Text>
      ) : null}
      <Btn label={t("Send rating", "Enviar calificación")} icon="star-outline" onPress={() => void send()} busy={busy} disabled={stars === 0} />
    </Page>
  );
}

/** The same chat as the trip page: the traveller, the driver once assigned, and our team. Its own screen, with the message box pinned above the keyboard. */
export function Chat() {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const header = useHeaderHeight();
  const demo = useDemo();
  const { id } = useRoute<RouteProp<RootParams, "Chat">>().params;
  const found = useBookingById(id);
  const token = found?.trip.token ?? "";
  const driverName = found?.booking.driver?.firstName;
  const [messages, setMessages] = useState<ChatMessage[] | null>(demo ? (demo.chat ?? []) : null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const load = useCallback(async () => {
    if (demo || !token) return;
    const res = await api<{ messages: ChatMessage[] }>("/chat/" + id + "?trip=" + token);
    if (res.ok && res.data) setMessages(res.data.messages);
    else setMessages((m) => m ?? []);
  }, [id, token, demo]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, [load]);

  async function send() {
    if (!text.trim() || !token) return;
    tap();
    setBusy(true);
    setError("");
    const res = await api<{ messages: ChatMessage[] }>("/chat/" + id, { text: text.trim(), trip: token });
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.error ?? t("Couldn't send.", "No se pudo enviar."));
    setMessages(res.data.messages);
    setText("");
  }

  const canSend = Boolean(text.trim()) && !busy;
  return (
    <KeyboardAvoidingView style={S.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={header}>
      <Bar style="dark" />
      <ScrollView
        ref={scroll}
        style={S.screen}
        contentContainerStyle={{ padding: SP.page, gap: 10, flexGrow: 1, justifyContent: "flex-end" }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
      >
        {messages === null ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={44} width="64%" radius={20} />
            <Skeleton height={44} width="52%" radius={20} style={{ alignSelf: "flex-end" }} />
            <Skeleton height={44} width="58%" radius={20} />
          </View>
        ) : messages.length === 0 ? (
          <View style={{ alignItems: "center", gap: 10, paddingVertical: 24 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.emeraldTint, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="chatbubbles-outline" size={32} color={C.emerald} />
            </View>
            <Text style={[T.body, { textAlign: "center" }]}>
              {driverName
                ? t("Questions for " + driverName + " or our team? Write here.", "¿Preguntas para " + driverName + " o para nuestro equipo? Escriba aquí.")
                : t("Questions about this booking? Write here and our team replies.", "¿Preguntas sobre esta reserva? Escriba aquí y nuestro equipo le responde.")}
            </Text>
          </View>
        ) : (
          messages.map((m) => (
            <View key={m.id} style={{ alignSelf: m.mine ? "flex-end" : "flex-start", maxWidth: "84%", gap: 3 }}>
              {!m.mine ? <Text style={[T.caption, { marginLeft: 6 }]}>{m.name}</Text> : null}
              <View
                style={{
                  backgroundColor: m.mine ? C.emerald : "#fff",
                  borderRadius: 22,
                  borderBottomRightRadius: m.mine ? 6 : 22,
                  borderBottomLeftRadius: m.mine ? 22 : 6,
                  borderWidth: m.mine ? 0 : 1,
                  borderColor: C.border,
                  paddingHorizontal: 16,
                  paddingVertical: 11,
                }}
              >
                <Text style={{ fontSize: 17, lineHeight: 24, color: m.mine ? "#fff" : C.text }}>{m.text}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <View style={[{ backgroundColor: "#fff", paddingHorizontal: SP.lg, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 10), gap: 6 }, SHADOW_UP]}>
        {error ? (
          <Text accessibilityRole="alert" style={S.error}>
            {error}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
          <TextInput
            accessibilityLabel={t("Message", "Mensaje")}
            value={text}
            onChangeText={setText}
            placeholder={t("Write a message", "Escriba un mensaje")}
            placeholderTextColor={C.faint}
            multiline
            maxLength={2000}
            maxFontSizeMultiplier={1.35}
            style={{ flex: 1, minHeight: 48, maxHeight: 130, backgroundColor: C.surface, borderRadius: 24, paddingHorizontal: 18, paddingTop: 13, paddingBottom: 13, fontSize: 17, color: C.text, fontFamily: fontFor("400") }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Send", "Enviar")}
            accessibilityState={{ disabled: !canSend, busy }}
            onPress={canSend ? () => void send() : undefined}
            style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, backgroundColor: C.emerald, alignItems: "center", justifyContent: "center", opacity: !canSend ? 0.35 : pressed ? 0.8 : 1 })}
          >
            <Ionicons name="arrow-up" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
