import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { SITE_URL } from "../config";
import { TOWNS, plural, usd } from "../format";
import { DatePicker, longDate } from "../DatePicker";
import { useT, type Lang } from "../i18n";
import { C, R, S } from "../theme";
import { hasContactDetails } from "../contact";
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
  /** Lowest "Driver bids" offer. Older servers don't send it. */
  minOfferCents?: number;
  vehicles: {
    id: string;
    name: string;
    badge: string;
    maxPax: number;
    luggage: string;
    allowsStops: boolean;
    spanishSpeakingDriver: boolean;
    totalCents: number;
    perPersonCents?: number;
    perPersonShare?: number;
  }[];
  stops: { id: string; name: string; description: string; durationMin: number; cents: number; tourPerPersonCents?: number; entrance: string }[];
}
export interface Tour {
  id: string;
  name: string;
  durationHours: number;
  highlights: string[];
  perPersonCents: number;
  totalCents: number;
  region?: string;
  regionName?: string;
  /** With the Smart En-Route Transfer. Older servers don't send it. */
  totalWithUpgradeCents?: number;
}

/** The driver preferences the website sends (src/lib/preferences.ts RidePrefs). */
interface Prefs {
  language: "english" | "spanish_ok";
  wifi: boolean;
  stroller: boolean;
  childSeats: number;
  pets: boolean;
}
const DEFAULT_PREFS: Prefs = { language: "english", wifi: false, stroller: false, childSeats: 0, pets: false };
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
  const header = (
    <>
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
    </>
  );
  const after = (
    <>
      <View style={{ alignItems: "center" }}>
        <LinkBtn label={t("Multi-day expeditions are on our website", "Las expediciones de varios días están en nuestro sitio web")} icon="open-outline" onPress={() => void WebBrowser.openBrowserAsync(SITE_URL)} />
      </View>
    </>
  );
  // The ride form has a bar pinned to the bottom with the total and Continue, so it scrolls itself.
  if (kind === "ride") return <Ride date={date} pax={pax} onChoose={setChosen} demo={demo} header={header} after={after} />;
  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      {header}
      <Tours date={date} pax={pax} onChoose={setChosen} demo={demo?.tours} />
      {after}
    </ScrollView>
  );
}

function Ride({
  date,
  pax,
  onChoose,
  demo,
  header,
  after,
}: {
  date: string;
  pax: number;
  onChoose: (c: Chosen) => void;
  demo?: { to?: Place; quote?: RideQuote };
  /** Title, ride/tour switch, date and travellers (from Book). */
  header: ReactNode;
  /** The expeditions link (from Book). */
  after: ReactNode;
}) {
  const { lang, t } = useT();
  const [from, setFrom] = useState<Place | null>(HUBS[0]);
  const [to, setTo] = useState<Place | null>(demo?.to ?? null);
  const [time, setTime] = useState("09:00");
  const [stopIds, setStopIds] = useState<string[]>([]);
  const [vehicleId, setVehicleId] = useState("sedan");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<"fixed" | "bid">("fixed");
  const [offer, setOffer] = useState("");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [driverNotes, setDriverNotes] = useState("");
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
  // Economy comes with a Spanish-speaking driver, so "English-speaking driver" isn't offered with it.
  const spanishDriver = vehicle?.spanishSpeakingDriver ?? false;
  const effectivePrefs: Prefs = spanishDriver ? { ...prefs, language: "spanish_ok" } : prefs;
  const minOffer = quote?.minOfferCents ?? 5000;
  const offerNumber = Number(offer.replace(",", "."));
  const offerCents = Number.isFinite(offerNumber) ? Math.round(offerNumber) * 100 : 0;
  const offerValid = offerCents >= minOffer;
  const offerLow = Boolean(vehicle) && offerValid && offerCents < (vehicle?.totalCents ?? 0) * 0.7;
  const notesBlocked = hasContactDetails(driverNotes);
  const itemCents = mode === "bid" ? offerCents : (vehicle?.totalCents ?? 0);
  const canContinue = Boolean(vehicle) && !notesBlocked && (mode === "fixed" || offerValid);

  // Start the offer at the fixed price for the chosen vehicle.
  useEffect(() => {
    if (mode === "bid" && !offer && vehicle) setOffer(String(Math.round(vehicle.totalCents / 100)));
  }, [mode, offer, vehicle]);

  function prefsText(): string {
    const p = effectivePrefs;
    const out: string[] = [];
    if (p.language === "spanish_ok") out.push(t("Spanish OK", "Español está bien"));
    if (p.childSeats) out.push(p.childSeats + t(" child seat" + (p.childSeats > 1 ? "s" : ""), p.childSeats > 1 ? " sillas de niño" : " silla de niño"));
    if (p.wifi) out.push("Wi-Fi");
    if (p.stroller) out.push(t("stroller", "coche de bebé"));
    if (p.pets) out.push(t("pet", "mascota"));
    return out.length ? " · " + out.join(", ") : "";
  }

  function choose() {
    if (!quote || !vehicle || !canContinue) return;
    const stops = stopsOn ? stopIds.filter((id) => quote.stops.some((s) => s.id === id)) : [];
    onChoose({
      title: quote.originLabel + " → " + quote.destinationLabel,
      detail:
        (mode === "bid" ? t("Your offer to drivers · ", "Su oferta a los conductores · ") : "") +
        vehicle.name +
        ", " +
        plural(pax, "traveller", lang) +
        (stops.length ? " + " + plural(stops.length, "stop", lang) : "") +
        t(" · pickup ", " · recogida ") +
        time12(time) +
        prefsText(),
      date,
      totalCents: itemCents,
      cashFeeBps: quote.cashFeeBps,
      spec: {
        kind: "transfer",
        ...quote.base,
        vehicleId: vehicle.id,
        stopIds: stops,
        pax,
        pickupTime: time,
        pricing: mode,
        ...(mode === "bid" ? { offerCents } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        prefs: effectivePrefs,
        ...(driverNotes.trim() ? { driverNotes: driverNotes.trim() } : {}),
      },
    });
  }

  return (
    <View style={S.screen}>
      <ScrollView style={S.screen} contentContainerStyle={[S.pad, vehicle && quote ? { paddingBottom: 120 } : null]} keyboardShouldPersistTaps="handled">
        {header}
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
          {quote.vehicles.length ? (
            <View style={{ flexDirection: "row", backgroundColor: "#E6ECE8", borderRadius: R.control, padding: 4, marginTop: 4 }} accessibilityRole="tablist">
              <Segment label={t("Fixed price", "Precio fijo")} icon="pricetag-outline" on={mode === "fixed"} onPress={() => setMode("fixed")} />
              <Segment label={t("Driver bids", "Ofertas de conductores")} icon="hammer-outline" on={mode === "bid"} onPress={() => setMode("bid")} />
            </View>
          ) : null}
          {mode === "bid" && vehicle ? (
            <Card tone="amber">
              <Text style={S.h2}>{t("Name your price", "Proponga su precio")}</Text>
              <Text style={S.text}>
                {t(
                  "Hand-picked local drivers see your offer and bid on it. Our team confirms the best match and emails you the driver's profile and car. Nothing is charged until then.",
                  "Conductores locales seleccionados ven su oferta y ofertan. Nuestro equipo confirma la mejor opción y le envía por correo el perfil del conductor y el vehículo. No se cobra nada hasta entonces.",
                )}
              </Text>
              <Text style={S.muted}>{t("Fixed price for the " + vehicle.name + ": ", "Precio fijo del " + vehicle.name + ": ") + cents(vehicle.totalCents)}</Text>
              <View style={[S.input, { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff" }]}>
                <Text style={{ fontSize: 22, fontWeight: "800", color: C.text }}>$</Text>
                <TextInput
                  accessibilityLabel={t("Your offer in US dollars", "Su oferta en dólares")}
                  value={offer}
                  onChangeText={(v) => setOffer(v.replace(/[^0-9]/g, "").slice(0, 5))}
                  keyboardType="number-pad"
                  style={{ flex: 1, fontSize: 22, fontWeight: "800", color: C.text, padding: 0 }}
                />
                <Text style={S.muted}>USD</Text>
              </View>
              {!offerValid ? <Text style={S.error}>{t("Enter an offer of at least ", "Ingrese una oferta de al menos ") + cents(minOffer) + "."}</Text> : null}
              {offerLow ? <Text style={{ color: C.amber, fontWeight: "700" }}>{t("That's well below the fixed price, so drivers may not accept it.", "Está muy por debajo del precio fijo, así que es posible que los conductores no la acepten.")}</Text> : null}
            </Card>
          ) : null}
          {quote.vehicles.length ? <Text style={[S.label, { marginTop: 4 }]}>{mode === "bid" ? t("Vehicle you'd like", "Vehículo que desea") : t("Choose your vehicle", "Elija su vehículo")}</Text> : null}
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
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[S.money, mode === "bid" ? { color: C.muted, fontSize: 18 } : null]}>{cents(v.totalCents)}</Text>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: C.muted }}>{t("per car", "por vehículo")}</Text>
                  {v.perPersonCents ? (
                    <Text style={{ fontSize: 11, color: C.muted, textAlign: "right" }}>
                      {t("from " + cents(v.perPersonCents) + "/person", "desde " + cents(v.perPersonCents) + "/persona")}
                    </Text>
                  ) : null}
                </View>
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
                            {s.tourPerPersonCents ? (
                              <Text style={S.muted}>
                                {t("Guided visit " + cents(s.tourPerPersonCents) + " per person, included for " + plural(pax, "traveller", "en"), "Visita guiada " + cents(s.tourPerPersonCents) + " por persona, incluida para " + plural(pax, "traveller", "es"))}
                              </Text>
                            ) : null}
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
          {vehicle ? (
            <Card>
              <Text style={S.h2}>{t("Your driver & extras", "Su conductor y extras")}</Text>
              <Text style={FIELD_LABEL}>{t("Driver's language", "Idioma del conductor")}</Text>
              <Option2
                icon="chatbubbles-outline"
                title={t("English-speaking driver", "Conductor que habla inglés")}
                on={effectivePrefs.language === "english"}
                disabled={spanishDriver}
                onPress={() => setPrefs({ ...prefs, language: "english" })}
              />
              <Option2
                icon="chatbubble-ellipses-outline"
                title={t("Spanish or basic English is fine", "Español o inglés básico está bien")}
                on={effectivePrefs.language === "spanish_ok"}
                onPress={() => setPrefs({ ...prefs, language: "spanish_ok" })}
              />
              {spanishDriver ? (
                <Text style={S.muted}>
                  {t(vehicle.name + " has a Spanish-speaking driver. For an English-speaking driver, choose another vehicle.", vehicle.name + " tiene un conductor que habla español. Para un conductor que hable inglés, elija otro vehículo.")}
                </Text>
              ) : null}
              <Text style={[FIELD_LABEL, { marginTop: 8 }]}>{t("Extras (free, subject to availability)", "Extras (gratis, según disponibilidad)")}</Text>
              <View style={[S.row, { paddingVertical: 4 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <Ionicons name="happy-outline" size={20} color={C.muted} />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{t("Baby / child seats", "Sillas para bebé / niño")}</Text>
                </View>
                <Step icon="remove" label={t("One fewer child seat", "Una silla menos")} onPress={() => setPrefs({ ...prefs, childSeats: Math.max(0, prefs.childSeats - 1) })} disabled={prefs.childSeats <= 0} />
                <Text style={{ fontSize: 18, fontWeight: "800", color: C.text, minWidth: 22, textAlign: "center" }}>{prefs.childSeats}</Text>
                <Step icon="add" label={t("One more child seat", "Una silla más")} onPress={() => setPrefs({ ...prefs, childSeats: Math.min(4, prefs.childSeats + 1) })} disabled={prefs.childSeats >= 4} />
              </View>
              {prefs.childSeats > 0 ? <Text style={S.muted}>{t("Add the children's ages in the message below so the right seats come along.", "Escriba la edad de los niños en el mensaje de abajo para llevar las sillas correctas.")}</Text> : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Toggle icon="wifi-outline" label={t("Wi-Fi on board", "Wi-Fi a bordo")} on={prefs.wifi} onPress={() => setPrefs({ ...prefs, wifi: !prefs.wifi })} />
                <Toggle icon="cart-outline" label={t("Stroller", "Coche de bebé")} on={prefs.stroller} onPress={() => setPrefs({ ...prefs, stroller: !prefs.stroller })} />
                <Toggle icon="paw-outline" label={t("Travelling with a pet", "Viajo con mascota")} on={prefs.pets} onPress={() => setPrefs({ ...prefs, pets: !prefs.pets })} />
              </View>
              <Text style={[FIELD_LABEL, { marginTop: 8 }]}>{t("Message for your driver (optional)", "Mensaje para su conductor (opcional)")}</Text>
              <TextInput
                accessibilityLabel={t("Message for your driver", "Mensaje para su conductor")}
                value={driverNotes}
                onChangeText={setDriverNotes}
                multiline
                maxLength={500}
                placeholder={t("e.g. Kids are 2 and 5 · a stop for fresh fruit · large surfboard bag", "p. ej. Los niños tienen 2 y 5 años · una parada para fruta · bolsa de tabla de surf grande")}
                placeholderTextColor={C.faint}
                style={[S.input, { minHeight: 80, textAlignVertical: "top" }]}
              />
              {notesBlocked ? (
                <Text style={S.error}>
                  {t("Please leave out phone numbers, emails and links. Your driver gets your contact details once confirmed.", "Por favor no incluya teléfonos, correos ni enlaces. Su conductor recibe sus datos de contacto una vez confirmado.")}
                </Text>
              ) : null}
            </Card>
          ) : null}
          {vehicle ? (
            <Card>
              <Text style={S.label}>{t("Every ride includes", "Cada traslado incluye")}</Text>
              {quote.airportPickup ? <IconLine icon="airplane-outline" color={C.emerald} text={t("Flight tracking: we follow your flight, so a delay doesn't leave you stranded.", "Seguimiento del vuelo: seguimos su vuelo, así que un retraso no lo deja esperando.")} /> : null}
              <IconLine icon="time-outline" color={C.emerald} text={t("60 min free waiting after your flight lands or your pickup time.", "60 min de espera gratis después de que aterrice su vuelo o de la hora de recogida.")} />
              <IconLine icon="happy-outline" color={C.emerald} text={t("Child seats free on request.", "Sillas para niños gratis si las pide.")} />
              <IconLine icon="shield-checkmark-outline" color={C.emerald} text={t("Free cancellation up to 24 hours before pickup.", "Cancelación gratis hasta 24 horas antes de la recogida.")} />
            </Card>
          ) : null}
          <Card>
            <Text style={FIELD_LABEL}>{quote.airportPickup ? t("Flight number, so we can track it", "Número de vuelo, para darle seguimiento") : t("Flight number or hotel name (optional)", "Número de vuelo o nombre del hotel (opcional)")}</Text>
            <TextInput accessibilityLabel={t("Flight number or hotel", "Número de vuelo u hotel")} value={notes} onChangeText={setNotes} maxLength={200} placeholder={t("e.g. AA 1234", "p. ej. AA 1234")} placeholderTextColor={C.faint} style={S.input} />
          </Card>
        </>
      ) : null}
        {after}
      </ScrollView>
      {quote && vehicle ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: "#fff",
            borderTopWidth: 1,
            borderTopColor: C.border,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={S.label}>{mode === "bid" ? t("Your offer", "Su oferta") : t("Total · " + vehicle.name, "Total · " + vehicle.name)}</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: C.emerald, letterSpacing: -0.5 }}>{mode === "bid" && !offerValid ? "—" : cents(itemCents)}</Text>
            <Text style={{ fontSize: 11, color: C.muted }}>{t("For the whole car, taxes included", "Por todo el vehículo, impuestos incluidos")}</Text>
          </View>
          <View style={{ minWidth: 150 }}>
            <Btn label={t("Continue", "Continuar")} icon="arrow-forward" onPress={choose} busy={busy} disabled={!canContinue} color={C.emerald} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Tours({ date, pax, onChoose, demo }: { date: string; pax: number; onChoose: (c: Chosen) => void; demo?: Tour[] }) {
  const { lang, t } = useT();
  const [tours, setTours] = useState<Tour[] | null>(demo ?? null);
  const [fee, setFee] = useState(0);
  const [error, setError] = useState("");
  const [upgrades, setUpgrades] = useState<Record<string, boolean>>({});
  const [region, setRegion] = useState("ALL");
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
  const regions = [...new Map((tours ?? []).filter((x) => x.region && x.regionName).map((x) => [x.region as string, x.regionName as string])).entries()];
  return (
    <>
      {error ? <Text style={S.error}>{error}</Text> : null}
      {regions.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label={t("All regions", "Todas las regiones")} on={region === "ALL"} onPress={() => setRegion("ALL")} />
          {regions.map(([id, name]) => (
            <Chip key={id} label={name} on={region === id} onPress={() => setRegion(id)} />
          ))}
        </ScrollView>
      ) : null}
      {(tours ?? []).filter((tour) => region === "ALL" || tour.region === region).map((tour) => {
        const upgrade = Boolean(upgrades[tour.id]) && tour.totalWithUpgradeCents != null;
        const total = upgrade ? (tour.totalWithUpgradeCents as number) : tour.totalCents;
        const upgradeCents = tour.totalWithUpgradeCents != null ? tour.totalWithUpgradeCents - tour.totalCents : 0;
        return (
        <Card key={tour.id}>
          {tour.regionName ? <Badge text={tour.regionName} icon="location-outline" /> : null}
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
          {upgradeCents > 0 ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: upgrade }}
              onPress={() => setUpgrades((u) => ({ ...u, [tour.id]: !u[tour.id] }))}
              style={({ pressed }) => ({ flexDirection: "row", gap: 10, backgroundColor: C.amberSoft, borderRadius: R.control, padding: 12, opacity: pressed ? 0.7 : 1 })}
            >
              <Ionicons name={upgrade ? "checkbox" : "square-outline"} size={22} color={upgrade ? C.emerald : C.amber} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", color: C.text }}>{"Smart En-Route Transfer (+" + cents(upgradeCents) + ")"}</Text>
                <Text style={S.muted}>{t("End the day at your next hotel instead of returning.", "Termine el día en su próximo hotel en lugar de regresar.")}</Text>
              </View>
            </Pressable>
          ) : null}
          <Divider />
          <View style={S.row}>
            <View>
              <Text style={S.label}>{plural(pax, "traveller", lang)}</Text>
              <Text style={S.muted}>{cents(tour.perPersonCents) + t(" per person", " por persona")}</Text>
            </View>
            <Text style={[S.money, { fontSize: 28 }]}>{cents(total)}</Text>
          </View>
          <Btn
            label={t("Choose this tour", "Elegir este tour")}
            color={C.emerald}
            onPress={() =>
              onChoose({
                title: tour.name,
                detail:
                  t(tour.durationHours + "h private tour, ", "Tour privado de " + tour.durationHours + " h, ") +
                  plural(pax, "traveller", lang) +
                  (upgrade ? " + Smart En-Route Transfer" : ""),
                date,
                totalCents: total,
                cashFeeBps: fee,
                spec: { kind: "day_tour", tourId: tour.id, upgrade, pax },
              })
            }
          />
        </Card>
        );
      })}
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
      // The language the traveller is using: their confirmation email and later messages follow it.
      lang,
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

/** A full-width radio choice with an icon (driver's language). */
function Option2({ icon, title, on, disabled, onPress }: { icon: IconName; title: string; on: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on, disabled: Boolean(disabled) }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 48,
        borderWidth: 2,
        borderColor: on ? C.emerald : C.border,
        backgroundColor: on ? C.emeraldTint : "#fff",
        borderRadius: R.control,
        paddingHorizontal: 12,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={on ? C.emerald : C.muted} />
      <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: C.text }}>{title}</Text>
      <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={22} color={on ? C.emerald : C.faint} />
    </Pressable>
  );
}

/** An on/off extra (Wi-Fi, stroller, pet). */
function Toggle({ icon, label, on, onPress }: { icon: IconName; label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        minHeight: 44,
        borderWidth: 1.5,
        borderColor: on ? C.emerald : C.border,
        backgroundColor: on ? C.emeraldTint : "#fff",
        borderRadius: R.pill,
        paddingHorizontal: 14,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={on ? "checkmark-circle" : icon} size={18} color={on ? C.emerald : C.muted} />
      <Text style={{ fontWeight: "700", color: on ? C.emerald : C.body, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
