import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { cleanSignText, hasContactDetails, signBlocked as signTextBlocked } from "./contact";
import { plural, usd } from "./format";
import { useT } from "./i18n";
import { HUBS, crDatePlus, fetchQuote, fetchTours, time12, validDate } from "./prices";
import type { Chosen, OwnStop, Place, Prefs, RideQuote, Sent, Tour } from "./types";

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
  stopIds: string[];
  /** "Add your own stop": places from the place search with the minutes there, in the traveller's order. */
  customStops: OwnStop[];
  prefs: Prefs;
  driverNotes: string;
  /** Flight number or hotel name. */
  notes: string;
  /** What the traveller wants on the driver's name sign; empty = their first name + last initial. */
  signText: string;
  /** "Don't show my name": the sign shows our brand name. */
  signHideName: boolean;
  tourId: string | null;
  upgrade: boolean;
  /** Day tours: the hotel or address to pick the travellers up (required; sent as spec.pickupPlace). */
  tourPickup: string;
  /** "Don't send me suggestions after my trip" (unticked by default). */
  noSuggestions: boolean;
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
  stopIds: [],
  customStops: [],
  prefs: DEFAULT_PREFS,
  driverNotes: "",
  notes: "",
  signText: "",
  signHideName: false,
  tourId: null,
  upgrade: false,
  tourPickup: "",
  noSuggestions: false,
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
  /** The server offers "add your own stop" on this ride (older servers don't). */
  ownStopsOn: boolean;
  /** The traveller's own stops as the server priced them (empty while loading, or when they can't be priced). */
  ownStops: NonNullable<RideQuote["custom"]>["stops"];
  /** Why the own stops can't be booked online, in the app's language; "" when fine. */
  ownStopsError: string;
  /** That refusal ends with "message us": show the contact button. */
  ownStopsAskUs: boolean;
  /** The chosen vehicle comes with a Spanish-speaking driver, so "English-speaking" isn't offered. */
  spanishDriver: boolean;
  effectivePrefs: Prefs;
  notesBlocked: boolean;
  /** The name-sign text is too long or has a phone number, email or link. */
  signBlocked: boolean;
  /** What the ride costs as chosen: the fixed price of the chosen vehicle (travellers book at the fixed price only). */
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

  /**
   * The promo code the server accepted for exactly what would be sent now, or null. When the
   * plan changes (vehicle, date, travellers…) the code is checked again by itself.
   */
  promo: { code: string; discountCents: number } | null;
  promoBusy: boolean;
  /** Why the last code was refused ("This code isn't valid."), in the app's language. */
  promoError: string;
  applyPromo: (code: string) => Promise<void>;
  removePromo: () => void;
}

/** What a promo check is tied to: the exact item that would be sent. */
function promoKey(c: Chosen | null): string {
  return c ? JSON.stringify([c.date, c.totalCents, c.spec]) : "";
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
  demo?: {
    state?: Partial<BookingState>;
    quote?: RideQuote | null;
    tours?: Tour[] | null;
    quoteBusy?: boolean;
    /** An accepted promo code, for design previews. */
    promo?: { code: string; discountCents: number; key: string } | null;
  };
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
  // The traveller's own stops change the price too (place, minutes, order).
  const ownKey = state.customStops.map((s) => s.id + ":" + s.minutes).join(",");
  const ownRef = useRef(state.customStops);
  ownRef.current = state.customStops;
  // The pickup time changes the price at night (night premium). Like the stops, a new time
  // keeps the prices on screen while the new ones load.
  const timeKey = state.time;
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
    const ask = () =>
      void fetchQuote({ from: fromId, to: toId, date, time: timeKey, pax, stopIds: stopsKey ? stopsKey.split(",") : [], customStops: ownRef.current, lang }).then((res) => {
        if (!live) return;
        setQuoteBusy(false);
        if (!res.ok || !res.data) {
          setQuote(null);
          return setQuoteError(res.error ?? tRef.current("We couldn't price that ride.", "No pudimos calcular el precio de ese traslado."));
        }
        setQuote(res.data.quote);
      });
    // Own stops cost the server a road lookup each: a short pause, so several quick changes ask once.
    const timer = ownKey ? setTimeout(ask, 400) : null;
    if (!timer) ask();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [routeKey, stopsKey, ownKey, timeKey, fromId, toId, date, pax, isDemo, lang]);

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
  const notesBlocked = hasContactDetails(state.driverNotes);
  const signBlocked = !state.signHideName && signTextBlocked(state.signText);
  const itemCents = vehicle?.totalCents ?? 0;
  // Own stops: offered when the server knows them; part of the ride only on a vehicle that takes
  // stops. The ride can't be sent while they are being priced or can't be priced online.
  const ownStopsOn = Boolean(quote?.custom && quote.custom.limits.maxStops > 0);
  const ownWanted = ownStopsOn && stopsOn ? state.customStops : [];
  const ownAnswer = quote?.custom;
  const ownMatches = Boolean(ownAnswer) && !ownAnswer!.error && ownAnswer!.stops.length === ownWanted.length && ownAnswer!.stops.every((s, i) => s.id === ownWanted[i].id && s.minutes === ownWanted[i].minutes);
  const ownStops = ownWanted.length && ownMatches ? ownAnswer!.stops : [];
  const ownStopsError = ownWanted.length && ownAnswer?.error ? ownAnswer.error : "";
  const ownPending = ownWanted.length > 0 && !ownMatches;
  const rideReady = Boolean(quote) && Boolean(vehicle) && !notesBlocked && !signBlocked && !ownPending;
  const fromCents = quote && quote.vehicles.length ? quote.vehicles.reduce((m, v) => Math.min(m, v.totalCents), Infinity) : null;
  const pickedStops = quote && stopsOn ? state.stopIds.filter((id) => quote.stops.some((s) => s.id === id)) : [];
  const p = effectivePrefs;
  const extrasCount = pickedStops.length + ownStops.length + (p.childSeats ? 1 : 0) + (p.boosters ? 1 : 0) + Number(p.wifi) + Number(p.stroller) + Number(p.pets) + Number(Boolean(p.electric)) + (state.driverNotes.trim() ? 1 : 0) + (state.notes.trim() ? 1 : 0);

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
        // Pickup place: servers from before 2026-11-12 ignore it.
        spec: { kind: "day_tour", tourId: tour.id, upgrade, pax, ...(cleanSignText(state.tourPickup) ? { pickupPlace: cleanSignText(state.tourPickup) } : {}) },
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
    if (p.electric) out.push(t("electric vehicle, if available", "vehículo eléctrico, si hay disponible"));
    return {
      title: quote.originLabel + " → " + quote.destinationLabel,
      detail:
        vehicle.name +
        ", " +
        plural(pax, "traveller", lang) +
        (pickedStops.length + ownStops.length ? " + " + plural(pickedStops.length + ownStops.length, "stop", lang) : "") +
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
        // The traveller's own stops; the server looks each place up and prices it again. Older servers ignore it.
        ...(ownStops.length ? { customStops: ownStops.map(({ id, label, minutes }) => ({ id, label, minutes })) } : {}),
        pax,
        pickupTime: state.time,
        // Always the fixed price. Kept in the request because servers from before 2026-11-11 require it.
        pricing: "fixed",
        ...(state.notes.trim() ? { notes: state.notes.trim() } : {}),
        prefs: p,
        ...(state.driverNotes.trim() ? { driverNotes: state.driverNotes.trim() } : {}),
        bags: bagsFor(state).large,
        carryOns: bagsFor(state).carryOns,
        // Name sign: older servers ignore both fields.
        ...(state.signHideName ? { signHideName: true } : cleanSignText(state.signText) ? { signText: cleanSignText(state.signText) } : {}),
      },
    };
    // pickedStops, ownStops and p are derived from the listed values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, tour, toursFee, quote, vehicle, rideReady, itemCents, effectivePrefs, stopsOn, lang, t, pax, date]);

  // The latest choices for callbacks that run later (sending, promo checks).
  const latest = useRef<{ chosen: Chosen | null; state: BookingState; lang: typeof lang; promo: { code: string; discountCents: number } | null }>({
    chosen,
    state,
    lang,
    promo: null,
  });

  // ---- Promo code: checked on the server for the exact item that would be sent.
  const [applied, setApplied] = useState<{ code: string; discountCents: number; key: string } | null>(demo?.promo ?? null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState("");
  const chosenKey = promoKey(chosen);
  const promo = applied && (isDemo || applied.key === chosenKey) ? { code: applied.code, discountCents: applied.discountCents } : null;
  const checkPromo = useCallback(
    async (code: string, c: Chosen, email: string) =>
      api<{ code: string; discountCents: number }>("/client/promo", {
        code,
        items: [{ id: "app-1", date: c.date, totalCents: c.totalCents, spec: c.spec }],
        email,
        lang,
      }),
    [lang],
  );
  const applyPromo = useCallback(
    async (code: string) => {
      const c = latest.current.chosen;
      if (!c || isDemo) return;
      setPromoBusy(true);
      setPromoError("");
      const res = await checkPromo(code, c, latest.current.state.guestEmail.trim());
      setPromoBusy(false);
      if (res.ok && res.data) setApplied({ code: res.data.code, discountCents: res.data.discountCents, key: promoKey(c) });
      else {
        setApplied(null);
        setPromoError(res.error ?? tRef.current("This code isn't valid.", "Este código no es válido."));
      }
    },
    // latest is a ref; checkPromo carries the language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkPromo, isDemo],
  );
  const removePromo = useCallback(() => {
    setApplied(null);
    setPromoError("");
  }, []);
  // The plan changed after a code was accepted: check it again for the new price.
  const appliedCode = applied?.code ?? "";
  const appliedKey = applied?.key ?? "";
  useEffect(() => {
    if (isDemo || !appliedCode || !chosenKey || appliedKey === chosenKey) return;
    const c = latest.current.chosen;
    if (!c) return;
    let live = true;
    void checkPromo(appliedCode, c, latest.current.state.guestEmail.trim()).then((res) => {
      if (!live) return;
      if (res.ok && res.data) setApplied({ code: res.data.code, discountCents: res.data.discountCents, key: promoKey(c) });
      else {
        setApplied(null);
        setPromoError(res.error ?? tRef.current("This code isn't valid.", "Este código no es válido."));
      }
    });
    return () => {
      live = false;
    };
  }, [chosenKey, appliedCode, appliedKey, isDemo, checkPromo]);

  latest.current = { chosen, state, lang, promo };
  const submit = useCallback(async (): Promise<{ ok: true; sent: Sent } | { ok: false; error: string }> => {
    const { chosen: c, state: s, lang: l, promo: pr } = latest.current;
    const tt = tRef.current;
    if (!c) return { ok: false, error: tt("We couldn't send your request.", "No pudimos enviar su solicitud.") };
    const res = await api<{ tripToken: string | null; testCheckout?: boolean; promoInvalid?: boolean; promoDiscountCents?: number }>("/client/trip-request", {
      items: [{ id: "app-" + Date.now(), date: c.date, totalCents: c.totalCents, spec: c.spec }],
      mode: s.payMode,
      cashFeeBps: c.cashFeeBps,
      name: s.name.trim(),
      phone: s.phone.trim(),
      notes: "",
      // The language the traveller is using: their confirmation email and later messages follow it.
      lang: l,
      // "Don't send me suggestions after my trip": older servers ignore it.
      noSuggestions: s.noSuggestions,
      // Promo code and the discount shown; the server checks both again. Older servers ignore them.
      ...(pr ? { promoCode: pr.code, promoDiscountCents: pr.discountCents } : {}),
    });
    if (!res.ok || !res.data) {
      // The code no longer applies: it comes off and the field says so. A different discount: check again.
      if (res.data?.promoInvalid) {
        setApplied(null);
        setPromoError(res.error ?? tt("This code isn't valid.", "Este código no es válido."));
      } else if (res.data?.promoDiscountCents !== undefined) setApplied((a) => (a ? { ...a, key: "" } : a));
      return { ok: false, error: res.error ?? tt("We couldn't send your request.", "No pudimos enviar su solicitud.") };
    }
    const paid = c.totalCents - (pr?.discountCents ?? 0);
    return { ok: true, sent: { tripToken: res.data.tripToken, payOnline: s.payMode === "full_100", totalCents: paid, testCheckout: Boolean(res.data.testCheckout) } };
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
    ownStopsOn,
    ownStops,
    ownStopsError,
    ownStopsAskUs: Boolean(ownStopsError && ownAnswer?.askUs),
    spanishDriver,
    effectivePrefs,
    notesBlocked,
    signBlocked,
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
    promo,
    promoBusy,
    promoError,
    applyPromo,
    removePromo,
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
