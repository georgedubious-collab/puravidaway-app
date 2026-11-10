import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { SITE_URL } from "../config";
import { TOWNS, plural, usd } from "../format";
import { C, S } from "../theme";
import { Badge, Btn, Card } from "../ui";

/* Shapes returned by the website's /api/v1/client/quote and /tours (src/lib/appQuote.ts). */
interface Place {
  id: string;
  label: string;
}
interface RideQuote {
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
interface Tour {
  id: string;
  name: string;
  durationHours: number;
  highlights: string[];
  perPersonCents: number;
  totalCents: number;
}
/** What the traveller has chosen and is about to send. */
interface Chosen {
  title: string;
  detail: string;
  date: string;
  totalCents: number;
  cashFeeBps: number;
  spec: Record<string, unknown>;
}

const cents = (c: number) => usd(c / 100);
const ENTRANCE: Record<string, string> = { free: "Free stop, no entrance fee", included: "Entrance included", gate: "Entrance paid at the gate" };
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
const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d + "T00:00:00Z").getTime());

/**
 * Plan and send a trip from the app: a private ride (any hotel, airport or
 * address, with optional stops) or a day tour. Every price comes from the
 * server; the app only shows it and sends the choice back.
 */
export function Book({ email, onBooked }: { email: string; onBooked: (tripToken: string | null, payOnline: boolean, totalCents: number, testCheckout: boolean) => void }) {
  const [kind, setKind] = useState<"ride" | "tour">("ride");
  const [date, setDate] = useState(crDatePlus(14));
  const [pax, setPax] = useState(2);
  const [chosen, setChosen] = useState<Chosen | null>(null);

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      <Text style={S.h1}>Plan a trip</Text>
      {chosen ? (
        <Send chosen={chosen} email={email} onBack={() => setChosen(null)} onBooked={onBooked} />
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Private ride" on={kind === "ride"} onPress={() => setKind("ride")} />
            <Chip label="Day tour" on={kind === "tour"} onPress={() => setKind("tour")} />
          </View>
          <Card>
            <Text style={S.label}>Travel date (YYYY-MM-DD)</Text>
            <TextInput accessibilityLabel="Travel date" value={date} onChangeText={setDate} placeholder="2026-12-15" keyboardType="numbers-and-punctuation" style={S.input} />
            {!validDate(date) ? <Text style={S.error}>Enter the date as year-month-day, e.g. 2026-12-15.</Text> : null}
            <Text style={S.label}>Travellers</Text>
            <View style={[S.row, { justifyContent: "flex-start" }]}>
              <Step label="−" onPress={() => setPax((p) => Math.max(1, p - 1))} />
              <Text style={[S.h2, { minWidth: 110, textAlign: "center" }]}>{plural(pax, "traveller")}</Text>
              <Step label="+" onPress={() => setPax((p) => Math.min(10, p + 1))} />
            </View>
          </Card>
          {kind === "ride" ? <Ride date={date} pax={pax} onChoose={setChosen} /> : <Tours date={date} pax={pax} onChoose={setChosen} />}
          <Btn label="Multi-day expeditions (website)" alt onPress={() => void WebBrowser.openBrowserAsync(SITE_URL)} />
        </>
      )}
    </ScrollView>
  );
}

function Ride({ date, pax, onChoose }: { date: string; pax: number; onChoose: (c: Chosen) => void }) {
  const [from, setFrom] = useState<Place | null>(HUBS[0]);
  const [to, setTo] = useState<Place | null>(null);
  const [time, setTime] = useState("09:00");
  const [stopIds, setStopIds] = useState<string[]>([]);
  const [vehicleId, setVehicleId] = useState("sedan");
  const [notes, setNotes] = useState("");
  const [quote, setQuote] = useState<RideQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stopsKey = stopIds.join(",");

  const load = useCallback(async () => {
    if (!from || !to || !validDate(date)) return setQuote(null);
    setBusy(true);
    setError("");
    const res = await api<{ quote: RideQuote }>("/client/quote", { from: from.id, to: to.id, date, pax, stopIds: stopsKey ? stopsKey.split(",") : [] });
    setBusy(false);
    if (!res.ok || !res.data) {
      setQuote(null);
      return setError(res.error ?? "We couldn't price that ride.");
    }
    setQuote(res.data.quote);
  }, [from, to, date, pax, stopsKey]);

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
      detail: vehicle.name + ", " + plural(pax, "traveller") + (stops.length ? " + " + plural(stops.length, "stop") : "") + " · pickup " + time12(time),
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
        <PlaceField label="Pickup" value={from} onChange={setFrom} />
        <PlaceField label="Drop-off" value={to} onChange={setTo} />
        <Text style={S.label}>Pickup time (Costa Rica time)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {TIMES.map((t) => (
            <Chip key={t} label={time12(t)} on={t === time} onPress={() => setTime(t)} small />
          ))}
        </ScrollView>
      </Card>
      {error ? <Text style={S.error}>{error}</Text> : null}
      {busy && !quote ? <Text style={S.muted}>Checking the road distance…</Text> : null}
      {quote ? (
        <>
          <Text style={S.muted}>
            About {Math.floor(quote.minutes / 60)} h {quote.minutes % 60} min
            {quote.km != null ? " · " + quote.km + " km" : ""}
            {quote.ferries ? " · ferry fares included" : ""}
            {quote.season.percent ? " · " + quote.season.name + " " + (quote.season.percent > 0 ? "+" : "") + quote.season.percent + "%" : ""}
          </Text>
          {quote.vehicles.length === 0 ? <Text style={S.error}>No vehicle for {pax} travellers on this route. Message us on WhatsApp.</Text> : null}
          {quote.vehicles.map((v) => (
            <Pressable
              key={v.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: v.id === vehicle?.id }}
              onPress={() => setVehicleId(v.id)}
              style={[S.card, v.id === vehicle?.id ? { borderColor: C.emerald, borderWidth: 2, backgroundColor: "#ECFDF5" } : null]}
            >
              <Badge text={v.badge} tone="amber" />
              <View style={S.row}>
                <Text style={[S.h2, { flex: 1 }]}>{v.name}</Text>
                <Text style={S.money}>{cents(v.totalCents)}</Text>
              </View>
              <Text style={S.muted}>
                Up to {v.maxPax} · {v.luggage}
                {v.allowsStops ? "" : " · direct ride, no stops"}
              </Text>
            </Pressable>
          ))}
          {quote.stops.length > 0 ? (
            <Card>
              <Text style={S.h2}>Add a stop (optional)</Text>
              {!stopsOn ? <Text style={S.muted}>{vehicle?.name} is a direct ride. Choose another vehicle to add stops.</Text> : null}
              {stopsOn
                ? quote.stops.map((s) => {
                    const on = stopIds.includes(s.id);
                    return (
                      <Pressable
                        key={s.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        onPress={() => setStopIds((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))}
                        style={{ borderWidth: 2, borderColor: on ? C.emerald : C.border, backgroundColor: on ? "#ECFDF5" : "#fff", borderRadius: 12, padding: 12, gap: 2 }}
                      >
                        <Text style={[S.text, { fontWeight: "800" }]}>
                          {on ? "✓ " : ""}
                          {s.name}
                        </Text>
                        <Text style={S.muted}>{s.description}</Text>
                        <Text style={{ fontWeight: "800", color: C.emerald }}>
                          +{cents(s.cents)} · adds {s.durationMin} min
                        </Text>
                        <Text style={S.muted}>{ENTRANCE[s.entrance] ?? ""}</Text>
                      </Pressable>
                    );
                  })
                : null}
            </Card>
          ) : null}
          <Card>
            <Text style={S.label}>{quote.airportPickup ? "Flight number, so we can track it" : "Flight number or hotel name (optional)"}</Text>
            <TextInput accessibilityLabel="Flight number or hotel" value={notes} onChangeText={setNotes} maxLength={200} placeholder="e.g. AA 1234" style={S.input} />
            {vehicle ? (
              <>
                <View style={S.row}>
                  <Text style={S.h2}>Total private ride</Text>
                  <Text style={S.money}>{cents(vehicle.totalCents)}</Text>
                </View>
                <Btn label="Continue" onPress={choose} busy={busy} color={C.emerald} />
              </>
            ) : null}
          </Card>
        </>
      ) : null}
    </>
  );
}

function Tours({ date, pax, onChoose }: { date: string; pax: number; onChoose: (c: Chosen) => void }) {
  const [tours, setTours] = useState<Tour[] | null>(null);
  const [fee, setFee] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!validDate(date)) return;
    let live = true;
    void api<{ tours: Tour[]; cashFeeBps: number }>("/client/tours?date=" + date + "&pax=" + pax).then((res) => {
      if (!live) return;
      if (!res.ok || !res.data) return setError(res.error ?? "We couldn't load the tours.");
      setError("");
      setTours(res.data.tours);
      setFee(res.data.cashFeeBps);
    });
    return () => {
      live = false;
    };
  }, [date, pax]);
  return (
    <>
      {error ? <Text style={S.error}>{error}</Text> : null}
      {(tours ?? []).map((t) => (
        <Card key={t.id}>
          <Text style={S.h2}>{t.name}</Text>
          <Text style={S.muted}>{t.durationHours} hours · private · guide, entrances and lunch included</Text>
          {t.highlights.map((h) => (
            <Text key={h} style={S.text}>
              • {h}
            </Text>
          ))}
          <View style={S.row}>
            <Text style={S.muted}>
              {cents(t.perPersonCents)} per person · {plural(pax, "traveller")}
            </Text>
            <Text style={S.money}>{cents(t.totalCents)}</Text>
          </View>
          <Btn
            label="Choose this tour"
            onPress={() =>
              onChoose({
                title: t.name,
                detail: t.durationHours + "h private tour, " + plural(pax, "traveller"),
                date,
                totalCents: t.totalCents,
                cashFeeBps: fee,
                spec: { kind: "day_tour", tourId: t.id, upgrade: false, pax },
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
}: {
  chosen: Chosen;
  email: string;
  onBack: () => void;
  onBooked: (tripToken: string | null, payOnline: boolean, totalCents: number, testCheckout: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"full_100" | "cash_driver">("full_100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fee = Math.round((chosen.totalCents * chosen.cashFeeBps) / 10000);
  const total = mode === "cash_driver" ? chosen.totalCents + fee : chosen.totalCents;

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
    if (!res.ok || !res.data) return setError(res.error ?? "We couldn't send your request.");
    onBooked(res.data.tripToken, mode === "full_100", chosen.totalCents, Boolean(res.data.testCheckout));
  }

  return (
    <>
      <Btn label="← Change the trip" alt onPress={onBack} />
      <Card>
        <Text style={S.label}>{chosen.date}</Text>
        <Text style={S.h2}>{chosen.title}</Text>
        <Text style={S.muted}>{chosen.detail}</Text>
      </Card>
      <Card>
        <Text style={S.h2}>Your details</Text>
        <Text style={S.label}>Full name</Text>
        <TextInput accessibilityLabel="Full name" value={name} onChangeText={setName} autoComplete="name" style={S.input} />
        <Text style={S.label}>Mobile / WhatsApp, with country code</Text>
        <TextInput accessibilityLabel="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+1 555 123 4567" style={S.input} />
        <Text style={S.muted}>Confirmations go to {email}.</Text>
      </Card>
      <Card>
        <Text style={S.h2}>How would you like to pay?</Text>
        <Chip label={"Online in full · " + cents(chosen.totalCents)} on={mode === "full_100"} onPress={() => setMode("full_100")} />
        <Chip
          label={"Cash to the driver · " + cents(chosen.totalCents + fee) + " (includes " + chosen.cashFeeBps / 100 + "% cash booking fee)"}
          on={mode === "cash_driver"}
          onPress={() => setMode("cash_driver")}
        />
        <View style={S.row}>
          <Text style={S.h2}>Total</Text>
          <Text style={S.money}>{cents(total)}</Text>
        </View>
        {error ? <Text style={S.error}>{error}</Text> : null}
        <Btn
          label={mode === "full_100" ? "Send request and pay" : "Send request"}
          onPress={send}
          busy={busy}
          disabled={!name.trim() || phone.replace(/\D/g, "").length < 7}
          color={C.emerald}
        />
        <Text style={S.muted}>Free cancellation up to 24 hours before pickup. Our team confirms your driver and pickup time.</Text>
      </Card>
    </>
  );
}

/** A place box: our towns at once, hotels and addresses as you type (through our server, Costa Rica only). */
function PlaceField({ label, value, onChange }: { label: string; value: Place | null; onChange: (p: Place | null) => void }) {
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
      if (!data.place) return setError(data.error ?? "We couldn't find that place.");
      session.current = "s" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      onChange({ id: data.place.id, label: data.place.label });
      setText(data.place.label);
      setOpen(false);
    } catch {
      setError("We couldn't find that place. Check your connection.");
    }
  }

  const hubs = HUBS.filter((h) => q.length < 2 || q === value?.label || h.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <View style={{ gap: 4 }}>
      <Text style={S.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={text}
        onFocus={() => setOpen(true)}
        onChangeText={(t) => {
          setText(t);
          setOpen(true);
          if (value) onChange(null);
        }}
        placeholder="Airport, town, hotel or address"
        autoCorrect={false}
        style={S.input}
      />
      {error ? <Text style={S.error}>{error}</Text> : null}
      {open ? (
        <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: "#fff" }}>
          {hubs.map((h) => (
            <Option
              key={h.id}
              main={h.label}
              onPress={() => {
                onChange(h);
                setText(h.label);
                setOpen(false);
              }}
            />
          ))}
          {q.length >= 3 && q !== value?.label ? found.map((s) => <Option key={s.placeId} main={s.main} secondary={s.secondary} onPress={() => void pickGoogle(s)} />) : null}
          {found.length > 0 ? <Text style={[S.muted, { textAlign: "right", padding: 6, fontSize: 10 }]}>Powered by Google</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function Option({ main, secondary, onPress }: { main: string; secondary?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
      <Text style={[S.text, { fontWeight: "700" }]}>{main}</Text>
      {secondary ? <Text style={S.muted}>{secondary}</Text> : null}
    </Pressable>
  );
}

function Chip({ label, on, onPress, small }: { label: string; on: boolean; onPress: () => void; small?: boolean }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        borderWidth: 2,
        borderColor: on ? C.emerald : C.border,
        backgroundColor: on ? C.emeraldSoft : "#fff",
        borderRadius: 10,
        paddingHorizontal: small ? 10 : 14,
        paddingVertical: small ? 8 : 12,
      }}
    >
      <Text style={{ fontWeight: "700", color: C.text, fontSize: small ? 13 : 14 }}>{label}</Text>
    </Pressable>
  );
}

function Step({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label === "+" ? "One more traveller" : "One fewer traveller"} onPress={onPress} style={[S.btnAlt, { minWidth: 48 }]}>
      <Text style={S.btnAltText}>{label}</Text>
    </Pressable>
  );
}
