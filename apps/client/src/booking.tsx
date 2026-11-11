import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { hasContactDetails } from "./contact";
import { plural, usd } from "./format";
import { useT } from "./i18n";
import { HUBS, crDatePlus, fetchQuote, fetchTours, time12, validDate } from "./prices";
import type { Chosen, Place, Prefs, RideQuote, Sent, Tour } from "./types";

/**
 * The trip being planned. One small store shared by every booking step, so
 * going back never loses a choice, signing in half-way changes nothing, and the
 * price is only asked for again when something that affects it changes
 * (pickup, drop-off, date, travellers, stops).
 *
 * Every price comes from the server; this only holds the choices and sends
 * them back in exactly the shape the website's API expects.
 */
export interface BookingState {
  kind: "ride" | "tour";
  from: Place | null;
  to: Place | null;
  date: string;
  pax: number;
  /** Large suitcases; null = not changed, so 1 per traveller (see bagsFor). */
  bags: number | null;
  /** Carry-ons; null = not changed, so 1 per traveller (see bagsFor). */
  carryOns: number | null;
  time: string;
  /**
   * True once the traveller has looked at the date, time and group size (the "Date" panel).
   * Until then the day is only our starting guess, so the ride can't be sent with it. Never sent to the server.
   */
  whenSet: boolean;
  vehicleId: string;
  mode: "fixed" | "bid";
  offer: string;
  stopIds: string[];
  prefs: Prefs;
  driverNotes: string;
  /** Flight number or hotel name. */
  notes: string;
  tourId: string | null;
  upgrade: boolean;
  name: string;
  phone: string;
  /** The email typed by someone who isn't signed in. */
  guestEmail: string;
  payMode: "full_100" | "cash_driver";
}

const DEFAULT_PREFS: Prefs = { language: "english", wifi: false, stroller: false, childSeats: 0, pets: false };

const fresh = (): BookingState => ({
  kind: "ride",
  from: HUBS[0],
  to: null,
  date: crDatePlus(14),
  pax: 2,
  bags: null,
  carryOns: null,
  time: "09:00",
  whenSet: false,
  vehicleId: "sedan",
  mode: "fixed",
  offer: "",
  stopIds: [],
  prefs: DEFAULT_PREFS,
  driverNotes: "",
  notes: "",
  tourId: null,
  upgrade: false,
  name: "",
  phone: "",
  guestEmail: "",
  payMode: "full_100",
});

type Action = { type: "set"; patch: Partial<BookingState> } | { type: "reset"; patch?: Partial<BookingState> } | { type: "toggleStop"; id: string };

function reducer(state: BookingState, action: Action): BookingState {
  switch (action.type) {
    case "set":
      return { ...state, ...action.patch };
    case "toggleStop":
      return { ...state, stopIds: state.stopIds.includes(action.id) ? state.stopIds.filter((x) => x !== action.id) : [...state.stopIds, action.id] };
    case "reset":
      return { ...fresh(), ...action.patch };
  }
}

export const cents = (c: number) => usd(c / 100);

interface BookingValue {
  state: BookingState;
  set: (patch: Partial<BookingState>) => void;
  toggleStop: (id: string) => void;
  /** Start over (after a request is sent, or when a new plan starts from the home screen). */
  reset: (patch?: Partial<BookingState>) => void;

  quote: RideQuote | null;
  quoteBusy: boolean;
  quoteError: string;
  /** The chosen vehicle (or the first one offered). */
  vehicle: RideQuote["vehicles"][number] | undefined;
  /** Whether the chosen vehicle takes stops on the way. */
  stopsOn: boolean;
  /** The chosen vehicle comes with a Spanish-speaking driver, so "English-speaking" isn't offered. */
  spanishDriver: boolean;
  effectivePrefs: Prefs;
  minOffer: number;
  offerCents: number;
  offerValid: boolean;
  offerLow: boolean;
  notesBlocked: boolean;
  /** What the ride costs as chosen: the fixed price, or the traveller's offer. */
  itemCents: number;
  /** The cheapest vehicle, for "from $X" before one is chosen. */
  fromCents: number | null;
  rideReady: boolean;
  /** How many optional things were picked in "Make it yours". */
  extrasCount: number;

  tours: Tour[] | null;
  toursError: string;
  tour: Tour | undefined;

  /** What would be sent right now, or null when the plan isn't complete. */
  chosen: Chosen | null;
  /** Send the request. The caller has already confirmed the email when nobody was signed in. */
  submit: () => Promise<{ ok: true; sent: Sent } | { ok: false; error: string }>;
  demo: boolean;
}

const Ctx = createContext<BookingValue | null>(null);

export function useBooking(): BookingValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBooking outside BookingProvider");
  return v;
}

export function BookingProvider({
  children,
  demo,
}: {
  children: ReactNode;
  /** Sample prices and choices for design previews; skips the network. */
  demo?: { state?: Partial<BookingState>; quote?: RideQuote | null; tours?: Tour[] | null; quoteBusy?: boolean };
}) {
  const { lang, t } = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const isDemo = Boolean(demo);
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ ...fresh(), ...demo?.state }));
  const [quote, setQuote] = useState<RideQuote | null>(demo?.quote ?? null);
  const [quoteBusy, setQuoteBusy] = useState(Boolean(demo?.quoteBusy));
  const [quoteError, setQuoteError] = useState("");
  const [tours, setTours] = useState<Tour[] | null>(demo?.tours ?? null);
  const [toursFee, setToursFee] = useState(isDemo ? 1000 : 0);
  const [toursError, setToursError] = useState("");

  const set = useCallback((patch: Partial<BookingState>) => dispatch({ type: "set", patch }), []);
  const toggleStop = useCallback((id: string) => dispatch({ type: "toggleStop", id }), []);
  const reset = useCallback((patch?: Partial<BookingState>) => dispatch({ type: "reset", patch }), []);

  // ---- Ride price: asked again only when one of these changes.
  const { from, to, date, pax } = state;
  const fromId = from?.id ?? "";
  const toId = to?.id ?? "";
  const stopsKey = state.stopIds.join(",");
  const routeKey = state.kind === "ride" && fromId && toId && validDate(date) ? [fromId, toId, date, pax].join("|") : "";
  const lastRoute = useRef("");
  useEffect(() => {
    if (isDemo) return;
    if (!routeKey) {
      lastRoute.current = "";
      setQuote(null);
      setQuoteBusy(false);
      setQuoteError("");
      return;
    }
    let live = true;
    // A different route, day or group: the old prices no longer apply. Only the stops changed: keep them on screen while the new total loads.
    if (lastRoute.current !== routeKey) setQuote(null);
    lastRoute.current = routeKey;
    setQuoteBusy(true);
    setQuoteError("");
    void fetchQuote({ from: fromId, to: toId, date, pax, stopIds: stopsKey ? stopsKey.split(",") : [], lang }).then((res) => {
      if (!live) return;
      setQuoteBusy(false);
      if (!res.ok || !res.data) {
        setQuote(null);
        return setQuoteError(res.error ?? tRef.current("We couldn't price that ride.", "No pudimos calcular el precio de ese traslado."));
      }
      setQuote(res.data.quote);
    });
    return () => {
      live = false;
    };
  }, [routeKey, stopsKey, fromId, toId, date, pax, isDemo, lang]);

  // ---- Tours: loaded while a tour is being planned.
  const toursKey = state.kind === "tour" && validDate(date) ? date + "|" + pax : "";
  useEffect(() => {
    if (isDemo || !toursKey) return;
    let live = true;
    setTours(null);
    void fetchTours(date, pax, lang).then((res) => {
      if (!live) return;
      if (!res.ok || !res.data) return setToursError(res.error ?? tRef.current("We couldn't load the tours.", "No pudimos cargar los tours."));
      setToursError("");
      setTours(res.data.tours);
      setToursFee(res.data.cashFeeBps);
    });
    return () => {
      live = false;
    };
  }, [toursKey, date, pax, isDemo, lang]);

  // ---- What follows from the choices (same rules as the first version of the app).
  const vehicle = quote?.vehicles.find((v) => v.id === state.vehicleId) ?? quote?.vehicles[0];
  const stopsOn = vehicle?.allowsStops ?? true;
  const spanishDriver = vehicle?.spanishSpeakingDriver ?? false;
  const effectivePrefs: Prefs = useMemo(() => (spanishDriver ? { ...state.prefs, language: "spanish_ok" } : state.prefs), [spanishDriver, state.prefs]);
  const minOffer = quote?.minOfferCents ?? 5000;
  const offerNumber = Number(state.offer.replace(",", "."));
  const offerCents = Number.isFinite(offerNumber) ? Math.round(offerNumber) * 100 : 0;
  const offerValid = offerCents >= minOffer;
  const offerLow = Boolean(vehicle) && offerValid && offerCents < (vehicle?.totalCents ?? 0) * 0.7;
  const notesBlocked = hasContactDetails(state.driverNotes);
  const itemCents = state.mode === "bid" ? offerCents : (vehicle?.totalCents ?? 0);
  const rideReady = Boolean(quote) && Boolean(vehicle) && !notesBlocked && (state.mode === "fixed" || offerValid);
  const fromCents = quote && quote.vehicles.length ? quote.vehicles.reduce((m, v) => Math.min(m, v.totalCents), Infinity) : null;
  const pickedStops = quote && stopsOn ? state.stopIds.filter((id) => quote.stops.some((s) => s.id === id)) : [];
  const p = effectivePrefs;
  const extrasCount = pickedStops.length + (p.childSeats ? 1 : 0) + (p.boosters ? 1 : 0) + Number(p.wifi) + Number(p.stroller) + Number(p.pets) + (state.driverNotes.trim() ? 1 : 0) + (state.notes.trim() ? 1 : 0);

  const tour = tours?.find((x) => x.id === state.tourId);

  const chosen = useMemo<Chosen | null>(() => {
    if (state.kind === "tour") {
      if (!tour) return null;
      const upgrade = state.upgrade && tour.totalWithUpgradeCents != null;
      const total = upgrade ? (tour.totalWithUpgradeCents as number) : tour.totalCents;
      return {
        title: tour.name,
        detail: t(tour.durationHours + "h private tour, ", "Tour privado de " + tour.durationHours + " h, ") + plural(pax, "traveller", lang) + (upgrade ? " + Smart En-Route Transfer" : ""),
        date,
        totalCents: total,
        cashFeeBps: toursFee,
        spec: { kind: "day_tour", tourId: tour.id, upgrade, pax },
      };
    }
    if (!quote || !vehicle || !rideReady || !state.whenSet) return null;
    const out: string[] = [];
    if (p.language === "spanish_ok") out.push(t("Spanish OK", "Español está bien"));
    if (p.childSeats) out.push(p.childSeats + t(" child seat" + (p.childSeats > 1 ? "s" : ""), p.childSeats > 1 ? " sillas de niño" : " silla de niño"));
    if (p.boosters) out.push(p.boosters + (p.boosters > 1 ? " boosters" : " booster"));
    if (p.wifi) out.push("Wi-Fi");
    if (p.stroller) out.push(t("stroller", "coche de bebé"));
    if (p.pets) out.push(t("pet", "mascota"));
    return {
      title: quote.originLabel + " → " + quote.destinationLabel,
      detail:
        (state.mode === "bid" ? t("Your offer to drivers · ", "Su oferta a los conductores · ") : "") +
        vehicle.name +
        ", " +
        plural(pax, "traveller", lang) +
        (pickedStops.length ? " + " + plural(pickedStops.length, "stop", lang) : "") +
        " · " + bagsSummary(bagsFor(state), lang) +
        t(" · pickup ", " · recogida ") +
        time12(state.time) +
        (out.length ? " · " + out.join(", ") : ""),
      date,
      totalCents: itemCents,
      cashFeeBps: quote.cashFeeBps,
      spec: {
        kind: "transfer",
        ...quote.base,
        vehicleId: vehicle.id,
        stopIds: pickedStops,
        pax,
        pickupTime: state.time,
        pricing: state.mode,
        ...(state.mode === "bid" ? { offerCents } : {}),
        ...(state.notes.trim() ? { notes: state.notes.trim() } : {}),
        prefs: p,
        ...(state.driverNotes.trim() ? { driverNotes: state.driverNotes.trim() } : {}),
        bags: bagsFor(state).large,
        carryOns: bagsFor(state).carryOns,
      },
    };
    // pickedStops and p are derived from the listed values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, tour, toursFee, quote, vehicle, rideReady, itemCents, offerCents, effectivePrefs, stopsOn, lang, t, pax, date]);

  const latest = useRef({ chosen, state, lang });
  latest.current = { chosen, state, lang };
  const submit = useCallback(async (): Promise<{ ok: true; sent: Sent } | { ok: false; error: string }> => {
    const { chosen: c, state: s, lang: l } = latest.current;
    const tt = tRef.current;
    if (!c) return { ok: false, error: tt("We couldn't send your request.", "No pudimos enviar su solicitud.") };
    const res = await api<{ tripToken: string | null; testCheckout?: boolean }>("/client/trip-request", {
      items: [{ id: "app-" + Date.now(), date: c.date, totalCents: c.totalCents, spec: c.spec }],
      mode: s.payMode,
      cashFeeBps: c.cashFeeBps,
      name: s.name.trim(),
      phone: s.phone.trim(),
      notes: "",
      // The language the traveller is using: their confirmation email and later messages follow it.
      lang: l,
    });
    if (!res.ok || !res.data) return { ok: false, error: res.error ?? tt("We couldn't send your request.", "No pudimos enviar su solicitud.") };
    return { ok: true, sent: { tripToken: res.data.tripToken, payOnline: s.payMode === "full_100", totalCents: c.totalCents, testCheckout: Boolean(res.data.testCheckout) } };
  }, []);

  const value: BookingValue = {
    state,
    set,
    toggleStop,
    reset,
    quote,
    quoteBusy,
    quoteError,
    vehicle,
    stopsOn,
    spanishDriver,
    effectivePrefs,
    minOffer,
    offerCents,
    offerValid,
    offerLow,
    notesBlocked,
    itemCents,
    fromCents,
    rideReady,
    extrasCount,
    tours,
    toursError,
    tour,
    chosen,
    submit,
    demo: isDemo,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Bags on this booking: large suitcases and carry-ons. Each is the traveller's number, or 1 per
 * traveller until they change that counter (Jorge, 2026-11-10). Each 0–20.
 */
export function bagsFor(state: { bags: number | null; carryOns: number | null; pax: number }): { large: number; carryOns: number } {
  const start = Math.min(state.pax, 20);
  return { large: state.bags ?? start, carryOns: state.carryOns ?? start };
}

/** "4 large bags + 4 carry-ons" / "4 maletas grandes + 4 de mano" (a part that is 0 is left out). */
export function bagsSummary({ large, carryOns }: { large: number; carryOns: number }, lang: "en" | "es"): string {
  const es = lang === "es";
  if (!large && !carryOns) return es ? "sin maletas" : "no bags";
  const parts: string[] = [];
  if (large) parts.push(es ? large + (large === 1 ? " maleta grande" : " maletas grandes") : large + (large === 1 ? " large bag" : " large bags"));
  if (carryOns) parts.push(es ? carryOns + (large ? " de mano" : carryOns === 1 ? " maleta de mano" : " maletas de mano") : carryOns + (carryOns === 1 ? " carry-on" : " carry-ons"));
  return parts.join(" + ");
}

/** Suitcases a vehicle lists ("3 suitcases" → 3); null when the text doesn't start with a number. */
export function luggageCapacity(luggage: string | null | undefined): number | null {
  const m = /^\s*(\d{1,2})\s+\S/.exec(luggage ?? "");
  return m ? Number(m[1]) : null;
}
