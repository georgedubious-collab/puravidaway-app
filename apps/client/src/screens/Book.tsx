import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { SITE_URL } from "../config";
import { TOWNS, plural, usd } from "../format";
import { DatePicker, longDate } from "../DatePicker";
import { useT, type Lang } from "../i18n";
import { C, R, S } from "../theme";
import { CodeInput, sendCode, validEmail, verifyCode } from "./SignIn";
import { Back, Badge, Btn, Card, Chip, Divider, IconLine, LinkBtn, ScreenTitle, type IconName } from "../ui";

/* Shapes returned by the website's /api/v1/client/quote and /tours (src/lib/appQuote.ts). */
export interface Place {
  id: string;
  label: string;
}
export interface RideQuote {
  base: Record<string, unknown>;
  originLabel: string;
  destinationLabel: string;
  airportPickup: boolean;
  minutes: number;
  km: number | null;
  ferries: number;
  season: { name: string; percent: number };
  cashFeeBps: number;
  vehicles: { id: string; name: string; badge: string; maxPax: number; luggage: string; allowsStops: boolean; spanishSpeakingDriver: boolean; totalCents: number }[];
  stops: { id: string; name: string; description: string; durationMin: number; cents: number; entrance: string }[];
}
export interface Tour {
  id: string;
  name: string;
  durationHours: number;
  highlights: string[];
  perPersonCents: number;
  totalCents: number;
}
/** What the traveller has chosen and is about to send. */
export interface Chosen {
  title: string;
  detail: string;
  date: string;
  totalCents: number;
  cashFeeBps: number;
  spec: Record<string, unknown>;
}

const cents = (c: number) => usd(c / 100);
const ENTRANCE: Record<Lang, Record<string, string>> = {
  en: { free: "Free stop, no entrance fee", included: "Entrance included", gate: "Entrance paid at the gate" },
  es: { free: "Parada gratis, sin entrada", included: "Entrada incluida", gate: "Entrada pagada en la puerta" },
};
const HUBS: Place[] = ["SJO", "LIR", "Arenal", "ManuelAntonio", "Monteverde", "Sierpe", "DrakeBay", "PuertoViejo", "Tamarindo"].map((id) => ({
  id: "hub:" + id,
  label: TOWNS[id],
}));
const TIMES = Array.from({ length: 37 }, (_, i) => {
  const m = 4 * 60 + i * 30;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
});
const time12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h % 12 === 0 ? 12 : h % 12) + ":" + String(m).padStart(2, "0") + (h < 12 ? " AM" : " PM");
};
/** Today + n days in Costa Rica (UTC−6), as YYYY-MM-DD. */
const crDatePlus = (n: number) => new Date(Date.now() - 6 * 3600000 + n * 86400000).toISOString().slice(0, 10);
/** Form labels read as sentences; the small capitals are kept for section labels. */
const FIELD_LABEL = { fontSize: 13, fontWeight: "600", color: C.body } as const;
const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d + "T00:00:00Z").getTime());

/**
 * Plan and send a trip from the app: a private ride (any hotel, airport or
 * address, with optional stops) or a day tour. Every price comes from the
 * server; the app only shows it and sends the choice back.
 */
export function Book({
  email,
  onBooked,
  demo,
}: {
  /** The signed-in email, or null when nobody is signed in on this phone (they confirm one with a code when sending). */
  email: string | null;
  onBooked: (tripToken: string | null, payOnline: boolean, totalCents: number, testCheckout: boolean) => void;
  /** Sample prices for design previews; skips loading. */
  demo?: { kind?: "ride" | "tour"; to?: Place; quote?: RideQuote; tours?: Tour[]; chosen?: Chosen; pickDate?: boolean; codeSentTo?: string };
}) {
  const { t } = useT();
  const [kind, setKind] = useState<"ride" | "tour">(demo?.kind ?? "ride");
  const [date, setDate] = useState(crDatePlus(14));
  const [pax, setPax] = useState(2);
  const [chosen, setChosen] = useState<Chosen | null>(demo?.chosen ?? null);

  if (chosen) {
    return (
      <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
        <Send chosen={chosen} email={email} onBack={() => setChosen(null)} onBooked={onBooked} demoCodeSentTo={demo?.codeSentTo} />
      </ScrollView>
    );
  }
  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      <ScreenTitle title={t("Plan a trip", "Planear un viaje")} subtitle={t("Private rides and day tours with hand-picked local drivers.", "Traslados privados y tours de un día con conductores locales seleccionados.")} />
      <View style={{ flexDirection: "row", backgroundColor: "#E6ECE8", borderRadius: R.control, padding: 4 }} accessibilityRole="tablist">
        <Segment label={t("Private ride", "Traslado privado")} icon="car-outline" on={kind === "ride"} onPress={() => setKind("ride")} />
        <Segment label={t("Day tour", "Tour de un día")} icon="trail-sign-outline" on={kind === "tour"} onPress={() => setKind("tour")} />
      </View>
      <Card>
        <DatePicker label={t("Travel date", "Fecha del viaje")} value={validDate(date) ? date : crDatePlus(14)} min={crDatePlus(1)} onChange={setDate} startOpen={demo?.pickDate} />
        <View style={[S.row, { marginTop: 6 }]}>
          <View style={{ flex: 1 }}>
            <Text style={S.label}>{t("Travellers", "Viajeros")}</Text>
            <Text style={S.muted}>{t("Children count too", "Los niños también cuentan")}</Text>
          </View>
          <Step icon="remove" label={t("One fewer traveller", "Un viajero menos")} onPress={() => setPax((p) => Math.max(1, p - 1))} disabled={pax <= 1} />
          <Text style={{ fontSize: 22, fontWeight: "800", color: C.text, minWidth: 28, textAlign: "center" }}>{pax}</Text>
          <Step icon="add" label={t("One more traveller", "Un viajero más")} onPress={() => setPax((p) => Math.min(10, p + 1))} disabled={pax >= 10} />
        </View>
      </Card>
      {kind === "ride" ? <Ride date={date} pax={pax} onChoose={setChosen} demo={demo} /> : <Tours date={date} pax={pax} onChoose={setChosen} demo={demo?.tours} />}
      <View style={{ alignItems: "center" }}>
        <LinkBtn label={t("Multi-day expeditions are on our website", "Las expediciones de varios días están en nuestro sitio web")} icon="open-outline" onPress={() => void WebBrowser.openBrowserAsync(SITE_URL)} />
      </View>
    </ScrollView>
  );
}

function Ride({ date, pax, onChoose, demo }: { date: string; pax: number; onChoose: (c: Chosen) => void; demo?: { to?: Place; quote?: RideQuote } }) {
  const { lang, t } = useT();
  const [from, setFrom] = useState<Place | null>(HUBS[0]);
  const [to, setTo] = useState<Place | null>(demo?.to ?? null);
  const [time, setTime] = useState("09:00");
  const [stopIds, setStopIds] = useState<string[]>([]);
  const [vehicleId, setVehicleId] = useState("sedan");
  const [notes, setNotes] = useState("");
  const [quote, setQuote] = useState<RideQuote | null>(demo?.quote ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stopsKey = stopIds.join(",");

  const load = useCallback(async () => {
    if (demo) return;
    if (!from || !to || !validDate(date)) return setQuote(null);
    setBusy(true);
    setError("");
    const res = await api<{ quote: RideQuote }>("/client/quote", { from: from.id, to: to.id, date, pax, stopIds: stopsKey ? stopsKey.split(",") : [] });
    setBusy(false);
    if (!res.ok || !res.data) {
      setQuote(null);
      return setError(res.error ?? t("We couldn't price that ride.", "No pudimos calcular el precio de ese traslado."));
    }
    setQuote(res.data.quote);
  }, [from, to, date, pax, stopsKey, demo, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const vehicle = quote?.vehicles.find((v) => v.id === vehicleId) ?? quote?.vehicles[0];
  const stopsOn = vehicle?.allowsStops ?? true;

  function choose() {
    if (!quote || !vehicle) return;
    const stops = stopsOn ? stopIds.filter((id) => quote.stops.some((s) => s.id === id)) : [];
    onChoose({
      title: quote.originLabel + " → " + quote.destinationLabel,
      detail: vehicle.name + ", " + plural(pax, "traveller", lang) + (stops.length ? " + " + plural(stops.length, "stop", lang) : "") + t(" · pickup ", " · recogida ") + time12(time),
      date,
      totalCents: vehicle.totalCents,
      cashFeeBps: quote.cashFeeBps,
      spec: {
        kind: "transfer",
        ...quote.base,
        vehicleId: vehicle.id,
        stopIds: stops,
        pax,
        pickupTime: time,
        pricing: "fixed",
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        // Economy comes with a Spanish-speaking driver.
        ...(vehicle.spanishSpeakingDriver ? { prefs: { language: "spanish_ok", wifi: false, stroller: false, childSeats: 0, pets: false } } : {}),
      },
    });
  }

  return (
    <>
      <Card>
        <PlaceField label={t("Pickup", "Recogida")} icon="radio-button-on-outline" value={from} onChange={setFrom} />
        <PlaceField label={t("Drop-off", "Destino")} icon="location" value={to} onChange={setTo} />
        <Text style={[S.label, { marginTop: 6 }]}>{t("Pickup time · Costa Rica time", "Hora de recogida · hora de Costa Rica")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -16 }} contentOffset={{ x: Math.max(0, TIMES.indexOf(time) * 106 - 8), y: 0 }}>
          <View style={{ width: 8 }} />
          {TIMES.map((t) => (
            <Chip key={t} label={time12(t)} on={t === time} onPress={() => setTime(t)} />
          ))}
          <View style={{ width: 8 }} />
        </ScrollView>
      </Card>
      {error ? <Text style={S.error}>{error}</Text> : null}
      {busy && !quote ? <IconLine icon="hourglass-outline" text={t("Checking the road distance…", "Calculando la distancia por carretera…")} /> : null}
      {!quote && !busy && !error ? <IconLine icon="information-circle-outline" text={t("Choose your drop-off to see the price. It's a fixed price for the whole car, not per person.", "Elija su destino para ver el precio. Es un precio fijo por todo el vehículo, no por persona.")} /> : null}
      {quote ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Badge text={t("About ", "Aprox. ") + Math.floor(quote.minutes / 60) + " h " + (quote.minutes % 60) + " min"} tone="grey" icon="time-outline" />
            {quote.km != null ? <Badge text={quote.km + " km"} tone="grey" icon="speedometer-outline" /> : null}
            {quote.ferries ? <Badge text={t("Ferry fares included", "Tarifas de ferry incluidas")} tone="sky" icon="boat-outline" /> : null}
            {quote.season.percent ? <Badge text={quote.season.name + " " + (quote.season.percent > 0 ? "+" : "") + quote.season.percent + "%"} tone="amber" icon="sunny-outline" /> : null}
          </View>
          {quote.vehicles.length === 0 ? <Text style={S.error}>{t("No vehicle for " + pax + " travellers on this route. Message us on WhatsApp.", "No hay vehículo para " + pax + " viajeros en esta ruta. Escríbanos por WhatsApp.")}</Text> : null}
          {quote.vehicles.length ? <Text style={[S.label, { marginTop: 4 }]}>{t("Choose your vehicle", "Elija su vehículo")}</Text> : null}
          {quote.vehicles.map((v) => {
            const on = v.id === vehicle?.id;
            return (
              <Pressable
                key={v.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setVehicleId(v.id)}
                style={({ pressed }) => [S.card, { borderWidth: 2, borderColor: on ? C.emerald : "transparent", flexDirection: "row", alignItems: "center", gap: 12 }, pressed ? { opacity: 0.75 } : null]}
              >
                <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={24} color={on ? C.emerald : C.faint} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={S.h2}>{v.name}</Text>
                  <Text style={S.muted}>
                    {t("Up to ", "Hasta ") + v.maxPax} · {v.luggage}
                    {v.allowsStops ? "" : t(" · direct ride, no stops", " · traslado directo, sin paradas")}
                  </Text>
                  <Badge text={v.badge} tone="amber" />
                </View>
                <Text style={S.money}>{cents(v.totalCents)}</Text>
              </Pressable>
            );
          })}
          {quote.stops.length > 0 ? (
            <Card>
              <Text style={S.h2}>{t("Add a stop on the way", "Agregue una parada en el camino")}</Text>
              <Text style={S.muted}>{stopsOn
                  ? t("Optional. Your driver waits while you visit.", "Opcional. Su conductor espera mientras usted la visita.")
                  : t((vehicle?.name ?? "This vehicle") + " is a direct ride. Choose another vehicle to add stops.", (vehicle?.name ?? "Este vehículo") + " es un traslado directo. Elija otro vehículo para agregar paradas.")}</Text>
              {stopsOn
                ? quote.stops.map((s, i) => {
                    const on = stopIds.includes(s.id);
                    return (
                      <View key={s.id}>
                        {i > 0 ? <Divider /> : null}
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          onPress={() => setStopIds((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))}
                          style={({ pressed }) => ({ flexDirection: "row", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}
                        >
                          <Ionicons name={on ? "checkbox" : "square-outline"} size={24} color={on ? C.emerald : C.faint} />
                          <View style={{ flex: 1, gap: 3 }}>
                            <View style={S.row}>
                              <Text style={{ fontSize: 15, fontWeight: "800", color: C.text, flex: 1 }}>{s.name}</Text>
                              <Text style={{ fontWeight: "800", color: C.emerald }}>+{cents(s.cents)}</Text>
                            </View>
                            <Text style={S.muted}>{s.description}</Text>
                            <Text style={S.muted}>
                              {t("Adds ", "Agrega ") + s.durationMin} min{ENTRANCE[lang][s.entrance] ? " · " + ENTRANCE[lang][s.entrance] : ""}
                            </Text>
                          </View>
                        </Pressable>
                      </View>
                    );
                  })
                : null}
            </Card>
          ) : null}
          <Card>
            <Text style={FIELD_LABEL}>{quote.airportPickup ? t("Flight number, so we can track it", "Número de vuelo, para darle seguimiento") : t("Flight number or hotel name (optional)", "Número de vuelo o nombre del hotel (opcional)")}</Text>
            <TextInput accessibilityLabel={t("Flight number or hotel", "Número de vuelo u hotel")} value={notes} onChangeText={setNotes} maxLength={200} placeholder={t("e.g. AA 1234", "p. ej. AA 1234")} placeholderTextColor={C.faint} style={S.input} />
            {vehicle ? (
              <>
                <View style={[S.row, { marginTop: 6 }]}>
                  <View>
                    <Text style={S.label}>Total</Text>
                    <Text style={S.muted}>{t("For the whole car, taxes included", "Por todo el vehículo, impuestos incluidos")}</Text>
                  </View>
                  <Text style={[S.money, { fontSize: 30 }]}>{cents(vehicle.totalCents)}</Text>
                </View>
                <Btn label={t("Continue", "Continuar")} icon="arrow-forward" onPress={choose} busy={busy} color={C.emerald} />
              </>
            ) : null}
          </Card>
        </>
      ) : null}
    </>
  );
}

function Tours({ date, pax, onChoose, demo }: { date: string; pax: number; onChoose: (c: Chosen) => void; demo?: Tour[] }) {
  const { lang, t } = useT();
  const [tours, setTours] = useState<Tour[] | null>(demo ?? null);
  const [fee, setFee] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    if (demo || !validDate(date)) return;
    let live = true;
    void api<{ tours: Tour[]; cashFeeBps: number }>("/client/tours?date=" + date + "&pax=" + pax).then((res) => {
      if (!live) return;
      if (!res.ok || !res.data) return setError(res.error ?? t("We couldn't load the tours.", "No pudimos cargar los tours."));
      setError("");
      setTours(res.data.tours);
      setFee(res.data.cashFeeBps);
    });
    return () => {
      live = false;
    };
  }, [date, pax, demo, t]);
  return (
    <>
      {error ? <Text style={S.error}>{error}</Text> : null}
      {(tours ?? []).map((tour) => (
        <Card key={tour.id}>
          <Text style={[S.h2, { fontSize: 19 }]}>{tour.name}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Badge text={plural(tour.durationHours, "hour", lang)} tone="grey" icon="time-outline" />
            <Badge text={t("Private", "Privado")} tone="grey" icon="lock-closed-outline" />
            <Badge text={t("Guide, entrances and lunch included", "Guía, entradas y almuerzo incluidos")} icon="restaurant-outline" />
          </View>
          {tour.highlights.map((h) => (
            <View key={h} style={{ flexDirection: "row", gap: 8 }}>
              <Ionicons name="checkmark" size={18} color={C.emerald} style={{ marginTop: 1 }} />
              <Text style={[S.text, { flex: 1 }]}>{h}</Text>
            </View>
          ))}
          <Divider />
          <View style={S.row}>
            <View>
              <Text style={S.label}>{plural(pax, "traveller", lang)}</Text>
              <Text style={S.muted}>{cents(tour.perPersonCents) + t(" per person", " por persona")}</Text>
            </View>
            <Text style={[S.money, { fontSize: 28 }]}>{cents(tour.totalCents)}</Text>
          </View>
          <Btn
            label={t("Choose this tour", "Elegir este tour")}
            color={C.emerald}
            onPress={() =>
              onChoose({
                title: tour.name,
                detail: t(tour.durationHours + "h private tour, ", "Tour privado de " + tour.durationHours + " h, ") + plural(pax, "traveller", lang),
                date,
                totalCents: tour.totalCents,
                cashFeeBps: fee,
                spec: { kind: "day_tour", tourId: tour.id, upgrade: false, pax },
              })
            }
          />
        </Card>
      ))}
    </>
  );
}

/** Last step: who is travelling and how they pay, then send. */
function Send({
  chosen,
  email,
  onBack,
  onBooked,
  demoCodeSentTo,
}: {
  chosen: Chosen;
  email: string | null;
  onBack: () => void;
  onBooked: (tripToken: string | null, payOnline: boolean, totalCents: number, testCheckout: boolean) => void;
  demoCodeSentTo?: string;
}) {
  const { lang, t } = useT();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"full_100" | "cash_driver">("full_100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Nobody signed in: they type their email and confirm it with a code before the request goes out.
  const [guestEmail, setGuestEmail] = useState(demoCodeSentTo ?? "");
  const [codeSent, setCodeSent] = useState(Boolean(demoCodeSentTo));
  const [code, setCode] = useState("");
  const guest = email === null;
  const fee = Math.round((chosen.totalCents * chosen.cashFeeBps) / 10000);
  const total = mode === "cash_driver" ? chosen.totalCents + fee : chosen.totalCents;

  const detailsOk = Boolean(name.trim()) && phone.replace(/\D/g, "").length >= 7 && (!guest || validEmail(guestEmail));

  /** Signed in: send now. Not signed in: email them a code first. */
  async function start() {
    if (!guest) return send();
    setBusy(true);
    setError("");
    const err = await sendCode(guestEmail, t);
    setBusy(false);
    if (err) return setError(err);
    setCode("");
    setCodeSent(true);
  }

  /** Check the code (this signs them in as that email), then send the request. */
  async function confirmAndSend() {
    setBusy(true);
    setError("");
    const err = await verifyCode(guestEmail, code, t);
    setBusy(false);
    if (err) return setError(err);
    await send();
  }

  async function send() {
    setBusy(true);
    setError("");
    const res = await api<{ tripToken: string | null; testCheckout?: boolean }>("/client/trip-request", {
      items: [{ id: "app-" + Date.now(), date: chosen.date, totalCents: chosen.totalCents, spec: chosen.spec }],
      mode,
      cashFeeBps: chosen.cashFeeBps,
      name: name.trim(),
      phone: phone.trim(),
      notes: "",
    });
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.error ?? t("We couldn't send your request.", "No pudimos enviar su solicitud."));
    onBooked(res.data.tripToken, mode === "full_100", chosen.totalCents, Boolean(res.data.testCheckout));
  }

  return (
    <>
      <Back label={t("Change the trip", "Cambiar el viaje")} onPress={onBack} />
      <ScreenTitle title={t("Almost there", "Ya casi")} />
      <Card tone="emerald">
        <Text style={S.label}>{longDate(chosen.date, lang)}</Text>
        <Text style={S.h2}>{chosen.title}</Text>
        <Text style={S.muted}>{chosen.detail}</Text>
      </Card>
      <Card>
        <Text style={S.h2}>{t("Your details", "Sus datos")}</Text>
        <Text style={FIELD_LABEL}>{t("Full name", "Nombre completo")}</Text>
        <TextInput accessibilityLabel={t("Full name", "Nombre completo")} value={name} onChangeText={setName} autoComplete="name" style={S.input} />
        <Text style={[FIELD_LABEL, { marginTop: 4 }]}>{t("Mobile / WhatsApp, with country code", "Celular / WhatsApp, con código de país")}</Text>
        <TextInput accessibilityLabel={t("Mobile number", "Número de celular")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+1 555 123 4567" placeholderTextColor={C.faint} style={S.input} />
        {guest ? (
          <>
            <Text style={[FIELD_LABEL, { marginTop: 4 }]}>{t("Email", "Correo electrónico")}</Text>
            <TextInput
              accessibilityLabel={t("Email", "Correo electrónico")}
              value={guestEmail}
              onChangeText={(v) => {
                setGuestEmail(v);
                setCodeSent(false);
              }}
              placeholder={t("you@example.com", "usted@ejemplo.com")}
              placeholderTextColor={C.faint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              editable={!codeSent}
              style={[S.input, codeSent ? { color: C.muted } : null]}
            />
            <IconLine icon="mail-outline" text={t("Your confirmation and driver details go here. No account or password needed.", "Aquí le enviamos la confirmación y los datos de su conductor. No necesita cuenta ni contraseña.")} />
          </>
        ) : (
          <IconLine icon="mail-outline" text={t("Confirmations go to " + email + ".", "Las confirmaciones se envían a " + email + ".")} />
        )}
      </Card>
      <Card>
        <Text style={S.h2}>{t("How would you like to pay?", "¿Cómo desea pagar?")}</Text>
        <PayOption icon="card-outline" title={t("Online in full", "En línea, pago total")} detail={t("Pay securely by card", "Pague de forma segura con tarjeta")} price={cents(chosen.totalCents)} on={mode === "full_100"} onPress={() => setMode("full_100")} />
        <PayOption
          icon="cash-outline"
          title={t("Cash to the driver", "Efectivo al conductor")}
          detail={t("Includes the " + chosen.cashFeeBps / 100 + "% cash booking fee", "Incluye el cargo del " + chosen.cashFeeBps / 100 + "% por reserva en efectivo")}
          price={cents(chosen.totalCents + fee)}
          on={mode === "cash_driver"}
          onPress={() => setMode("cash_driver")}
        />
        <View style={[S.row, { marginTop: 6 }]}>
          <Text style={S.label}>Total</Text>
          <Text style={[S.money, { fontSize: 30 }]}>{cents(total)}</Text>
        </View>
        {codeSent && guest ? (
          <View style={{ backgroundColor: C.emeraldTint, borderRadius: R.control, padding: 14, gap: 10 }}>
            <Text style={S.h2}>{t("Confirm your email", "Confirme su correo")}</Text>
            <Text style={S.text}>
              {t("We emailed a 6-digit code to ", "Enviamos un código de 6 dígitos a ")}
              <Text style={{ fontWeight: "800", color: C.text }}>{guestEmail.trim().toLowerCase()}</Text>
              {t(". Enter it to send your request. It also lets you follow your trip and your driver in the app.", ". Escríbalo para enviar su solicitud. También le permite seguir su viaje y su conductor en la app.")}
            </Text>
            <CodeInput value={code} onChange={setCode} />
            {error ? <Text style={S.error}>{error}</Text> : null}
            <Btn
              label={mode === "full_100" ? t("Confirm and pay", "Confirmar y pagar") : t("Confirm and send", "Confirmar y enviar")}
              icon="checkmark-circle-outline"
              onPress={() => void confirmAndSend()}
              busy={busy}
              disabled={code.length !== 6}
              color={C.emerald}
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <LinkBtn label={t("Send a new code", "Enviar otro código")} onPress={() => void start()} disabled={busy} />
              <LinkBtn
                label={t("Change email", "Cambiar correo")}
                color={C.muted}
                onPress={() => {
                  setCodeSent(false);
                  setCode("");
                  setError("");
                }}
              />
            </View>
          </View>
        ) : (
          <>
            {error ? <Text style={S.error}>{error}</Text> : null}
            <Btn
              label={mode === "full_100" ? t("Send request and pay", "Enviar solicitud y pagar") : t("Send request", "Enviar solicitud")}
              icon="paper-plane-outline"
              onPress={() => void start()}
              busy={busy}
              disabled={!detailsOk}
              color={C.emerald}
            />
          </>
        )}
        <IconLine icon="shield-checkmark-outline" text={t(
            "Free cancellation up to 24 hours before pickup. Our team confirms your driver and pickup time.",
            "Cancelación gratis hasta 24 horas antes de la recogida. Nuestro equipo confirma su conductor y la hora de recogida.",
          )} />
      </Card>
    </>
  );
}

function PayOption({ icon, title, detail, price, on, onPress }: { icon: IconName; title: string; detail: string; price: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 2,
        borderColor: on ? C.emerald : C.border,
        backgroundColor: on ? C.emeraldTint : "#fff",
        borderRadius: R.control,
        padding: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color={on ? C.emerald : C.muted} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: C.text }}>{title}</Text>
        <Text style={S.muted}>{detail}</Text>
      </View>
      <Text style={{ fontSize: 16, fontWeight: "800", color: C.text }}>{price}</Text>
      <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={22} color={on ? C.emerald : C.faint} />
    </Pressable>
  );
}

/** A place box: our towns at once, hotels and addresses as you type (through our server, Costa Rica only). */
function PlaceField({ label, icon, value, onChange }: { label: string; icon: IconName; value: Place | null; onChange: (p: Place | null) => void }) {
  const { t } = useT();
  const [text, setText] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<{ placeId: string; main: string; secondary: string }[]>([]);
  const [error, setError] = useState("");
  const session = useRef("s" + Math.random().toString(36).slice(2) + Date.now().toString(36));
  const q = text.trim();

  useEffect(() => {
    if (!open || q.length < 3 || q === value?.label) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(SITE_URL + "/api/places/suggest?q=" + encodeURIComponent(q) + "&session=" + session.current);
        const data = (await res.json()) as { suggestions?: { placeId: string; main: string; secondary: string }[] };
        setFound(data.suggestions ?? []);
      } catch {
        setFound([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, open, value?.label]);

  async function pickGoogle(s: { placeId: string; main: string }) {
    setError("");
    try {
      const res = await fetch(SITE_URL + "/api/places/lookup?id=" + s.placeId + "&label=" + encodeURIComponent(s.main) + "&session=" + session.current);
      const data = (await res.json()) as { place?: Place; error?: string };
      if (!data.place) return setError(data.error ?? t("We couldn't find that place.", "No pudimos encontrar ese lugar."));
      session.current = "s" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      onChange({ id: data.place.id, label: data.place.label });
      setText(data.place.label);
      setOpen(false);
    } catch {
      setError(t("We couldn't find that place. Check your connection.", "No pudimos encontrar ese lugar. Revise su conexión."));
    }
  }

  const hubs = HUBS.filter((h) => q.length < 2 || q === value?.label || h.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <View style={{ gap: 6 }}>
      <Text style={S.label}>{label}</Text>
      <View style={[S.input, { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 0, borderColor: open ? C.emerald : C.border }]}>
        <Ionicons name={icon} size={18} color={C.emerald} />
        <TextInput
          accessibilityLabel={label}
          value={text}
          onFocus={() => setOpen(true)}
          onChangeText={(t) => {
            setText(t);
            setOpen(true);
            if (value) onChange(null);
          }}
          placeholder={t("Airport, town, hotel or address", "Aeropuerto, pueblo, hotel o dirección")}
          placeholderTextColor={C.faint}
          autoCorrect={false}
          style={{ flex: 1, fontSize: 16, color: C.text, paddingVertical: 12 }}
        />
        {text ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Clear ", "Borrar ") + label.toLowerCase()}
            hitSlop={10}
            onPress={() => {
              setText("");
              setOpen(true);
              if (value) onChange(null);
            }}
          >
            <Ionicons name="close-circle" size={18} color={C.faint} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={S.error}>{error}</Text> : null}
      {open ? (
        <View style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: R.control, backgroundColor: "#fff", overflow: "hidden" }}>
          {hubs.map((h) => (
            <Option
              key={h.id}
              icon={h.id === "hub:SJO" || h.id === "hub:LIR" ? "airplane-outline" : "location-outline"}
              main={h.label}
              onPress={() => {
                onChange(h);
                setText(h.label);
                setOpen(false);
              }}
            />
          ))}
          {q.length >= 3 && q !== value?.label ? found.map((s) => <Option key={s.placeId} icon="business-outline" main={s.main} secondary={s.secondary} onPress={() => void pickGoogle(s)} />) : null}
          {found.length > 0 ? <Text style={[S.muted, { textAlign: "right", padding: 6, fontSize: 10 }]}>{t("Powered by Google", "Con tecnología de Google")}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function Option({ icon, main, secondary, onPress }: { icon: IconName; main: string; secondary?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, minHeight: 48, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F1F4F2", backgroundColor: pressed ? C.emeraldTint : "#fff" })}
    >
      <Ionicons name={icon} size={18} color={C.muted} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{main}</Text>
        {secondary ? <Text style={S.muted}>{secondary}</Text> : null}
      </View>
    </Pressable>
  );
}

function Segment({ label, icon, on, onPress }: { label: string; icon: IconName; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{ flex: 1, flexDirection: "row", gap: 8, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: on ? "#fff" : "transparent" }}
    >
      <Ionicons name={icon} size={18} color={on ? C.emerald : C.muted} />
      <Text style={{ fontWeight: "800", fontSize: 15, color: on ? C.emerald : C.muted }}>{label}</Text>
    </Pressable>
  );
}

function Step({ icon, label, onPress, disabled }: { icon: "add" | "remove"; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, backgroundColor: C.emeraldTint, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : pressed ? 0.6 : 1 })}
    >
      <Ionicons name={icon} size={22} color={C.emerald} />
    </Pressable>
  );
}
