"use client";

import { ArrowDown, Camera, Car, Check, ChevronDown, ExternalLink, Gavel, Languages, Link2, MapPin, MessageCircle, PlusCircle, Ticket, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { stopFitsRoute, stopTotalCents } from "@/lib/catalog";
import { entranceLabel, hubName } from "@/lib/catalogEs";
import { seasonForYmd } from "@/lib/catalogModel";
import { useCatalog } from "./CatalogContext";
import { BuilderHero, HERO_BUTTON, HERO_CONTROL, HeroField, StepTitle, type BuilderTabs } from "./BuilderHero";
import { PlaceInput } from "./PlaceInput";
import { Photo } from "./site/Photo";
import { usePublicLang, useT } from "./PublicLangContext";
import { localizeServerMessage } from "@/lib/serverMessagesEs";
import { hubPlace, isAirportPickup, isHubPlace, mapsDirectionsUrl, needsRoute, type RidePlace, type RideRoute } from "@/lib/places";
import { newItemId, whatsAppLink, type CartItem } from "@/lib/cart";
import { DEFAULT_PICKUP_TIME, PICKUP_TIMES, addDays, formatShortDate, formatTime12h } from "@/lib/dates";
import { applyMultiplier, ferryCents, formatDuration, formatUSD, perPersonCents, perPersonShare, quoteTransfer, rideCents } from "@/lib/pricing";
import { MAX_SHARED_PAX, rideLinkQuery, type RideLinkState } from "@/lib/shareLink";
import { MAX_BAGS, MIN_OFFER_USD } from "@/lib/tripRequest";
import { vehiclePhoto } from "@/lib/photos";
import { ridePromises } from "@/lib/trust";
import { DEFAULT_PREFS, LANGUAGE_LABEL, hasContactDetails, prefsSummary, type DriverLanguage, type RidePrefs } from "@/lib/preferences";

/** Spanish wording of LANGUAGE_LABEL for the /es storefront. */
const LANGUAGE_LABEL_ES: Record<DriverLanguage, string> = {
  english: "Conductor que habla inglés",
  spanish_ok: "Español o inglés básico está bien",
};

type PricingMode = "fixed" | "bid";

/** Lowest offer a client may broadcast in bid mode (USD). */

export function TransfersView({
  today,
  onAdd,
  initial = {},
  suggestion,
  tabs,
  cartCount,
}: {
  /** Today's date in Costa Rica (YYYY-MM-DD), computed on the server. */
  today: string;
  onAdd: (item: CartItem) => void;
  /** Pre-filled from a shared link or a route page (?from=&to=…), already validated. */
  initial?: Partial<RideLinkState>;
  /** "While you're there" suggestions after a ride is added, shown under the add button. */
  suggestion?: React.ReactNode;
  /** Transfers / Day tours / Multi-day trips switch, shown in the hero form on phones. */
  tabs: BuilderTabs;
  /** Items already in the trip: the pinned "Add to trip" bar shows only while it is 0. */
  cartCount: number;
}) {
  const lang = usePublicLang();
  const t = useT();
  const routeFailed = t("We couldn't work out this route. Please try again.", "No pudimos calcular esta ruta. Por favor, inténtelo de nuevo.");
  const [originPlace, setOriginPlace] = useState<RidePlace>(initial.origin ?? hubPlace("SJO"));
  const [destPlace, setDestPlace] = useState<RidePlace>(initial.destination ?? hubPlace("ManuelAntonio"));
  // Our town for each end (a typed place's nearest town): area factor, stops, vehicles.
  const origin = originPlace.hub;
  const destination = destPlace.hub;
  const [date, setDate] = useState(() => initial.date ?? addDays(today, 14));
  const [pickupTime, setPickupTime] = useState(initial.pickupTime ?? DEFAULT_PICKUP_TIME);
  const [pax, setPax] = useState(initial.pax ?? 2);
  const [mode, setMode] = useState<PricingMode>("fixed");
  const [vehicleId, setVehicleId] = useState(initial.vehicleId ?? "sedan");
  const [stopIds, setStopIds] = useState<string[]>(initial.stopIds ?? []);
  const [copied, setCopied] = useState(false);
  const [showAllStops, setShowAllStops] = useState(false);
  const [notes, setNotes] = useState("");
  const [prefs, setPrefs] = useState<RidePrefs>(DEFAULT_PREFS);
  const [driverNotes, setDriverNotes] = useState("");
  // "How many bags?" — "" = not changed: we count 2 per traveller (1 large suitcase + 1 carry-on).
  const [bagsPick, setBags] = useState("");
  const bags = bagsPick === "" ? String(Math.min(pax * 2, MAX_BAGS)) : bagsPick;
  const driverNotesBlocked = hasContactDetails(driverNotes);
  const [offer, setOffer] = useState("165");

  // Typed places are priced from Google's road route (fetched through our server).
  const typed = needsRoute(originPlace, destPlace);
  const samePlace = typed ? originPlace.id === destPlace.id : origin === destination;
  const routeKey = typed && !samePlace ? `${originPlace.id}>${destPlace.id}` : "";
  const [routeState, setRouteState] = useState<{ key: string; route?: RideRoute; error?: string }>({ key: "" });
  useEffect(() => {
    if (!routeKey) return;
    const ctrl = new AbortController();
    const q = new URLSearchParams({ from: originPlace.id, to: destPlace.id });
    fetch(`/api/places/route?${q}`, { signal: ctrl.signal })
      .then((res) => res.json() as Promise<{ route?: RideRoute; error?: string }>)
      .then((d) =>
        setRouteState(
          d.route
            ? { key: routeKey, route: d.route }
            : { key: routeKey, error: d.error ? localizeServerMessage(d.error, lang) : routeFailed },
        ),
      )
      .catch(() => {
        if (!ctrl.signal.aborted) setRouteState({ key: routeKey, error: routeFailed });
      });
    return () => ctrl.abort();
  }, [routeKey, originPlace.id, destPlace.id, lang, routeFailed]);
  const route = routeKey && routeState.key === routeKey ? (routeState.route ?? null) : null;
  const routeError = routeKey && routeState.key === routeKey ? routeState.error : undefined;
  const routeLoading = Boolean(routeKey) && routeState.key !== routeKey;
  // Prices can be shown: two of our towns, or the road route has arrived.
  const priceReady = !samePlace && (!typed || route !== null);

  const catalog = useCatalog();
  const season = useMemo(() => seasonForYmd(date, catalog), [date, catalog]);
  // Cards show prices for the chosen date, so they add up to the total below.
  const seasonal = (cents: number) => applyMultiplier(cents, season.multiplierBps);
  const seasonPct = Math.round((season.multiplierBps - 10000) / 100);

  // A stop is offered only when it sits on the road between pickup and drop-off.
  const availableStops = useMemo(
    () => catalog.stops.filter((s) => stopFitsRoute(s, origin, destination)),
    [catalog, origin, destination],
  );

  const availableVehicles = useMemo(
    () =>
      catalog.vehicles.filter(
        (v) =>
          v.maxPax >= pax &&
          (!v.onlyForHubs ||
            v.onlyForHubs.includes(origin) ||
            v.onlyForHubs.includes(destination)),
      ),
    [catalog, pax, origin, destination],
  );

  // Keep the selected vehicle valid when pax or route changes.
  // No vehicle fits (e.g. a large group after the van was switched off in /admin):
  // still show a price for reference, but don't allow adding the ride.
  const noVehicleFits = availableVehicles.length === 0;
  const effectiveVehicleId = availableVehicles.some((v) => v.id === vehicleId)
    ? vehicleId
    : (availableVehicles[0]?.id ?? catalog.vehicles[0].id);
  const selectedVehicle = catalog.vehicles.find((v) => v.id === effectiveVehicleId);
  // Economy is a direct ride: no stops, and the driver speaks Spanish (basic English at most).
  const stopsAllowed = selectedVehicle?.allowsStops ?? true;
  const spanishDriver = selectedVehicle?.spanishSpeakingDriver ?? false;
  const effectiveStopIds = useMemo(
    () => (stopsAllowed ? stopIds.filter((id) => availableStops.some((s) => s.id === id)) : []),
    [stopsAllowed, stopIds, availableStops],
  );
  const effectivePrefs: RidePrefs = spanishDriver ? { ...prefs, language: "spanish_ok" } : prefs;
  // "4 bags" / "4 maletas" for the trip summary and the extras line, once the traveller says.
  const bagWords = [Number(bags) === 1 ? t("1 bag", "1 maleta") : t(`${bags} bags`, `${bags} maletas`)];
  const stopsKey = effectiveStopIds.join(",");

  // Shareable link: mirror the ride choices in the address bar (debounced), never personal details.
  const skipFirstSync = useRef(true);
  useEffect(() => {
    if (skipFirstSync.current) {
      skipFirstSync.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const q = rideLinkQuery(
        { origin: originPlace, destination: destPlace, date, pickupTime, pax, vehicleId: effectiveVehicleId, stopIds: stopsKey ? stopsKey.split(",") : [] },
        window.location.search,
      );
      if (`?${q}` !== window.location.search) {
        window.history.replaceState(null, "", `${window.location.pathname}?${q}${window.location.hash}`);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [originPlace, destPlace, date, pickupTime, pax, effectiveVehicleId, stopsKey]);

  async function copyLink() {
    try {
      const q = rideLinkQuery(
        { origin: originPlace, destination: destPlace, date, pickupTime, pax, vehicleId: effectiveVehicleId, stopIds: effectiveStopIds },
        window.location.search,
      );
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?${q}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked: the address bar already has the link */
    }
  }

  const quote = useMemo(
    () =>
      quoteTransfer({
        origin,
        destination,
        vehicleId: effectiveVehicleId,
        stopIds: effectiveStopIds,
        season,
        catalog,
        route,
        pax,
      }),
    [origin, destination, effectiveVehicleId, effectiveStopIds, season, catalog, route, pax],
  );

  // Bid mode: the client's own offer (whole USD) replaces the fixed price.
  const offerNumber = Number(offer);
  const offerValid = Number.isFinite(offerNumber) && offerNumber >= MIN_OFFER_USD;
  const offerCents = offerValid ? Math.round(offerNumber * 100) : 0;
  const offerIsLow = offerValid && offerCents < quote.totalCents * 0.7;
  const itemTotalCents = mode === "bid" ? offerCents : quote.totalCents;

  // SJO / LIR pickups, picked from the list or typed: flight tracking and free waiting apply.
  const airportPickup = isAirportPickup(originPlace);
  // Our towns are named in the page's language; a typed place keeps the name Google gave it.
  const nameOf = (p: RidePlace) => (isHubPlace(p) ? hubName(p.hub, lang) : p.label);
  const originName = nameOf(originPlace);
  const destName = nameOf(destPlace);
  const paxWord = (n: number) => t(`${n} passenger${n > 1 ? "s" : ""}`, `${n} pasajero${n > 1 ? "s" : ""}`);
  const duration = (min: number) => formatDuration(min, lang);
  const vehicle = catalog.vehicles.find((v) => v.id === effectiveVehicleId)!;
  const selectedStops = catalog.stops.filter((s) => effectiveStopIds.includes(s.id));
  const cantAdd = !priceReady || noVehicleFits || (mode === "bid" && !offerValid) || driverNotesBlocked;
  const price = (cents: number) => (priceReady ? formatUSD(cents) : "…");
  // Car price on a vehicle card: the ride for the date + ferries for this group.
  const ferry = ferryCents(route, pax, catalog);
  const carCents = (v: (typeof catalog.vehicles)[number]) => seasonal(rideCents(origin, destination, v, catalog, route)) + ferry;

  // "See prices · from $X": the cheapest vehicle that fits this group.
  const fromCarCents = availableVehicles.length ? Math.min(...availableVehicles.map(carCents)) : quote.totalCents;

  function toggleStop(id: string) {
    setStopIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addToCart() {
    if (cantAdd) return;
    const names = selectedStops.map((s) => s.name).join(", ");
    const stopsText = selectedStops.length
      ? t(
          ` + ${selectedStops.length} stop${selectedStops.length > 1 ? "s" : ""} (${names})`,
          ` + ${selectedStops.length} parada${selectedStops.length > 1 ? "s" : ""} (${names})`,
        )
      : "";
    const paxText = t(`${pax} pax`, paxWord(pax));
    const prefWords = [...bagWords, ...prefsSummary(effectivePrefs, lang)];
    onAdd({
      kind: "transfer",
      id: newItemId(),
      title: `${originName} → ${destName}`,
      detail:
        (mode === "bid"
          ? t(
              `Driver bid request — your offer covers the ride${selectedStops.length ? " + stops" : ""} (fixed price would be ${formatUSD(quote.totalCents)}), ${paxText}${stopsText}${notes ? ` — ${notes}` : ""}`,
              `Solicitud de ofertas de conductores — su oferta cubre el traslado${selectedStops.length ? " + paradas" : ""} (el precio fijo sería ${formatUSD(quote.totalCents)}), ${paxText}${stopsText}${notes ? ` — ${notes}` : ""}`,
            )
          : `${vehicle.name}, ${paxText}${stopsText}${notes ? ` — ${notes}` : ""}`
        ) + (prefWords.length ? ` · ${prefWords.join(", ")}` : ""),
      date,
      totalCents: itemTotalCents,
      spec: {
        kind: "transfer",
        origin,
        destination,
        ...(isHubPlace(originPlace) ? {} : { originPlace: { id: originPlace.id, label: originPlace.label } }),
        ...(isHubPlace(destPlace) ? {} : { destinationPlace: { id: destPlace.id, label: destPlace.label } }),
        vehicleId: effectiveVehicleId,
        stopIds: effectiveStopIds,
        pax,
        pickupTime,
        pricing: mode === "bid" ? "bid" : "fixed",
        offerCents: mode === "bid" ? offerCents : undefined,
        notes: notes.trim() || undefined,
        prefs: effectivePrefs,
        driverNotes: driverNotes.trim() || undefined,
        bags: Number(bags),
      },
    });
  }

  const routeWhatsApp = whatsAppLink(
    t(
      `Hi! I'm looking at a private transfer ${originName} → ${destName} on ${date} at ${formatTime12h(pickupTime)} (Costa Rica time) for ${pax} passengers${
        selectedStops.length ? ` with stops at ${selectedStops.map((s) => s.name).join(", ")}` : ""
      }. ${
        mode === "bid" && offerValid
          ? `I'd like to offer ${formatUSD(offerCents)} for the ride${selectedStops.length ? " including the stops" : ""} (fixed price shows ${price(quote.totalCents)}).`
          : priceReady
            ? `Quoted ${formatUSD(quote.totalCents)}.`
            : ""
      } Can you confirm availability?`,
      `¡Hola! Estoy viendo un traslado privado ${originName} → ${destName} el ${date} a las ${formatTime12h(pickupTime, "es")} (hora de Costa Rica) para ${paxWord(pax)}${
        selectedStops.length ? ` con paradas en ${selectedStops.map((s) => s.name).join(", ")}` : ""
      }. ${
        mode === "bid" && offerValid
          ? `Quisiera ofrecer ${formatUSD(offerCents)} por el traslado${selectedStops.length ? ", paradas incluidas" : ""} (el precio fijo indica ${price(quote.totalCents)}).`
          : priceReady
            ? `Precio cotizado: ${formatUSD(quote.totalCents)}.`
            : ""
      } ¿Me pueden confirmar la disponibilidad?`,
    ),
  );

  // Short names for the pinned bar: "SJO Airport → Manuel Antonio".
  const shortRoute = `${originName.split(" /")[0]} → ${destName.split(" /")[0]}`;
  // The pre-filled example (not from a link, not yet changed): say so, so nobody books the sample by mistake.
  const isExample =
    !initial.origin && !initial.destination && originPlace.id === hubPlace("SJO").id && destPlace.id === hubPlace("ManuelAntonio").id;
  // Long stop lists start folded to three cards (plus any already picked).
  const STOPS_SHOWN = 3;
  const stopsFolded = availableStops.length > STOPS_SHOWN && !showAllStops;
  const shownStops = stopsFolded
    ? availableStops.filter((s, i) => i < STOPS_SHOWN || effectiveStopIds.includes(s.id))
    : availableStops;
  const prefWordsNow = [...bagWords, ...prefsSummary(effectivePrefs, lang)];
  const addLabel =
    mode === "bid" ? t("Add offer request to your trip", "Agregar solicitud de oferta a su viaje") : t("Add this ride to your trip", "Agregar este traslado a su viaje");

  return (
    <section className={`space-y-5 ${cartCount === 0 ? "pb-20 lg:pb-0" : ""}`}>
      {/* 1 · ROUTE & DATE: the hero form */}
      <BuilderHero
        tabs={tabs}
        title={t("Private transfers across Costa Rica", "Traslados privados por toda Costa Rica")}
        text={t(
          "Fixed price per car. Free cancellation up to 24 h. Add sightseeing stops on the way.",
          "Precio fijo por vehículo. Cancelación gratis hasta 24 h antes. Agregue paradas turísticas en el camino.",
        )}
      >
        <div className="grid grid-cols-2 gap-x-2 gap-y-2.5">
          <div className="col-span-2">
            <PlaceInput label={t("From", "Desde")} value={originPlace} onChange={setOriginPlace} />
          </div>
          <div className="col-span-2">
            <PlaceInput label={t("To", "Hasta")} value={destPlace} onChange={setDestPlace} />
          </div>
          <HeroField label={t("Date", "Fecha")}>
            <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className={HERO_CONTROL} />
          </HeroField>
          <HeroField label={t("Pickup time", "Hora de recogida")}>
            <select
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              aria-describedby="pickup-time-hint"
              className={HERO_CONTROL}
            >
              {PICKUP_TIMES.map((pt) => (
                <option key={pt} value={pt}>
                  {formatTime12h(pt, lang)}
                </option>
              ))}
            </select>
          </HeroField>
          <HeroField label={t("Travellers", "Viajeros")} className="col-span-2">
            <select value={pax} onChange={(e) => setPax(Number(e.target.value))} className={HERO_CONTROL}>
              {Array.from({ length: MAX_SHARED_PAX }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {t(`${n} traveller${n > 1 ? "s" : ""}`, `${n} viajero${n > 1 ? "s" : ""}`)}
                </option>
              ))}
            </select>
          </HeroField>
        </div>
        <p id="pickup-time-hint" className={airportPickup ? "mt-1.5 text-xs text-slate-600" : "sr-only"}>
          {t(
            "Costa Rica time. For airport pickups, enter your flight's landing time.",
            "Hora de Costa Rica. Para recogidas en aeropuerto, indique la hora de aterrizaje de su vuelo.",
          )}
        </p>
        {samePlace && (
          <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
            {t("Pick a different drop-off to see prices.", "Elija un destino diferente para ver los precios.")}
          </p>
        )}
        {routeLoading && (
          <p className="mt-2 text-sm font-semibold text-slate-600" aria-live="polite">
            {t("Checking the road distance…", "Verificando la distancia por carretera…")}
          </p>
        )}
        {routeError && (
          <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
            {routeError}
          </p>
        )}
        <button
          type="button"
          onClick={() => document.getElementById("step-vehicle")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className={HERO_BUTTON}
        >
          {priceReady && mode === "fixed"
            ? t(`See prices · from ${formatUSD(fromCarCents)}`, `Ver precios · desde ${formatUSD(fromCarCents)}`)
            : t("See prices", "Ver precios")}
          <ArrowDown className="h-4 w-4" aria-hidden />
        </button>
        {isExample && (
          <p className="mt-2 text-center text-xs font-semibold text-slate-600">
            {t("Example route — change it to yours.", "Ruta de ejemplo: cámbiela por la suya.")}
          </p>
        )}
      </BuilderHero>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* 2 · VEHICLE (fixed price) or OFFER (drivers bid) */}
          <div id="step-vehicle" className="scroll-mt-20">
            <Card>
              <StepTitle n={2} icon={<Car className="w-5 h-5 text-emerald-700" aria-hidden />}>
                {t("Choose your vehicle", "Elija su vehículo")}
              </StepTitle>

              <fieldset className="mt-3">
                <legend className="text-sm font-bold text-slate-700">{t("How do you want your price?", "¿Cómo desea su precio?")}</legend>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      ["fixed", t("Fixed price now", "Precio fijo ahora")],
                      ["bid", t("Name your price (drivers bid)", "Proponga su precio (los conductores ofertan)")],
                    ] as [PricingMode, string][]
                  ).map(([m, label]) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={mode === m}
                      onClick={() => setMode(m)}
                      className={`min-h-11 rounded-xl border-2 px-3 py-2 text-left text-sm font-bold transition flex items-center gap-2 ${
                        mode === m ? "border-emerald-700 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300"
                      }`}
                    >
                      <span
                        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          mode === m ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300"
                        }`}
                        aria-hidden
                      >
                        {mode === m && <Check className="h-3 w-3" strokeWidth={4} />}
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {mode === "fixed"
                    ? t(
                        "The price you see is the price you pay, per car: no surge and no fuel surcharge.",
                        "El precio que ve es el que paga, por vehículo: sin tarifas dinámicas ni recargo por combustible.",
                      )
                    : t(
                        "You propose a price, our partner drivers answer, and our team confirms the best match. It can take longer than a fixed price.",
                        "Usted propone un precio, nuestros conductores asociados responden y nuestro equipo confirma la mejor opción. Puede tardar más que un precio fijo.",
                      )}
                </p>
              </fieldset>

              {mode === "fixed" ? (
                <>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availableVehicles.map((v) => {
                      const on = v.id === effectiveVehicleId;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setVehicleId(v.id)}
                          aria-pressed={on}
                          className={`relative flex gap-3 text-left rounded-xl border-2 p-2.5 transition ${
                            on ? "border-emerald-700 bg-emerald-50" : "border-slate-200 hover:border-emerald-300 bg-white"
                          }`}
                        >
                          <Photo
                            id={vehiclePhoto(v.id)}
                            lang={lang}
                            decorative
                            sizes="112px"
                            className="w-24 sm:w-28 shrink-0 self-stretch min-h-24 rounded-lg"
                          />
                          <span className="min-w-0 flex-1 py-0.5">
                            {on && (
                              <span className="float-right ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-extrabold text-white">
                                <Check className="h-3 w-3" strokeWidth={4} aria-hidden /> {t("Selected", "Elegido")}
                              </span>
                            )}
                            <span className="block text-[15px] font-extrabold leading-snug text-slate-900">{v.name}</span>
                            <span className="mt-0.5 block text-xs font-bold text-amber-800">{v.badge}</span>
                            <span className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                              <Users className="w-3.5 h-3.5 shrink-0" aria-hidden /> {t("Up to", "Hasta")} {v.maxPax} · {v.luggage}
                            </span>
                            <span className="mt-1.5 block text-lg font-extrabold text-emerald-700">
                              {price(carCents(v))} <span className="text-xs font-bold text-slate-600">{t("per car", "por vehículo")}</span>
                            </span>
                            <span className="block text-xs font-semibold text-slate-600">
                              {t(
                                `from ${price(perPersonCents(carCents(v), v.maxPax))} per person (${perPersonShare(v.maxPax)} travellers)`,
                                `desde ${price(perPersonCents(carCents(v), v.maxPax))} por persona (${perPersonShare(v.maxPax)} viajeros)`,
                              )}
                            </span>
                            {ferry > 0 && (
                              <span className="block text-xs font-semibold text-slate-600">{t("Ferry fares included", "Tarifas del ferry incluidas")}</span>
                            )}
                            {seasonPct !== 0 && (
                              <span className="block text-xs font-bold text-amber-800">
                                {season.name} {seasonPct > 0 ? "+" : "−"}
                                {Math.abs(seasonPct)}%
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <RidePromises airport={airportPickup} />
                </>
              ) : (
                <div className="mt-4 rounded-xl border-2 border-amber-400 bg-amber-50/50 p-4">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Gavel className="w-5 h-5 text-amber-700" aria-hidden />{" "}
                    {t("Name your offer, compare driver bids", "Proponga su oferta y compare las ofertas de los conductores")}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {t(
                      `Reference fixed price for this route: ${price(quote.totalCents)}. Hand-picked local partner drivers will bid on your request.`,
                      `Precio fijo de referencia para esta ruta: ${price(quote.totalCents)}. Conductores locales asociados, elegidos uno por uno, harán ofertas por su solicitud.`,
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <label htmlFor="bid-offer" className="text-sm font-bold text-slate-700">
                      {t("Your offer (USD):", "Su oferta (USD):")}
                    </label>
                    <input
                      id="bid-offer"
                      type="number"
                      inputMode="numeric"
                      min={MIN_OFFER_USD}
                      value={offer}
                      onChange={(e) => setOffer(e.target.value)}
                      aria-invalid={!offerValid}
                      className="w-32 min-h-11 border border-slate-300 rounded-xl px-3 text-base font-bold bg-white"
                    />
                  </div>
                  {!offerValid && (
                    <p role="alert" className="text-sm font-semibold text-red-700 mt-2">
                      {t(
                        `Enter an offer of at least ${formatUSD(MIN_OFFER_USD * 100)}.`,
                        `Ingrese una oferta de al menos ${formatUSD(MIN_OFFER_USD * 100)}.`,
                      )}
                    </p>
                  )}
                  {offerIsLow && (
                    <p className="text-sm font-semibold text-amber-800 mt-2">
                      {t(
                        "That's well below the fixed price, so drivers may not accept it.",
                        "Está muy por debajo del precio fijo, por lo que es posible que los conductores no la acepten.",
                      )}
                    </p>
                  )}
                  <p className="text-sm text-slate-600 mt-3 bg-white rounded-lg p-3 border border-amber-200">
                    {t(
                      "Add this request to your trip and send it. Your offer goes to our approved partner drivers, our team confirms the best match, and you get an email with your driver's profile and car. Nothing is charged until then.",
                      "Agregue esta solicitud a su viaje y envíela. Su oferta llega a nuestros conductores asociados aprobados, nuestro equipo confirma la mejor opción y usted recibe un correo con el perfil y el vehículo de su conductor. No se cobra nada hasta entonces.",
                    )}
                  </p>
                </div>
              )}
            </Card>
          </div>

          {/* 3 · STOPS */}
          <Card>
            <div className="flex items-start justify-between gap-3">
              <StepTitle n={3} icon={<Camera className="w-5 h-5 text-emerald-700" aria-hidden />}>
                {t("Make it a sightseeing ride", "Conviértalo en un traslado con paradas")}
              </StepTitle>
              <span className="text-xs font-bold bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-full whitespace-nowrap">
                {effectiveStopIds.length} {t("added", effectiveStopIds.length === 1 ? "agregada" : "agregadas")}
              </span>
            </div>
            <p className="mt-1 mb-3 text-sm text-slate-600">
              {t(
                "Optional paid stops on the road between your pickup and drop-off. Your driver waits with your luggage in the locked vehicle while you explore.",
                "Paradas opcionales con costo en el camino entre su recogida y su destino. Su conductor espera con su equipaje en el vehículo cerrado con llave mientras usted explora.",
              )}
            </p>
            {!stopsAllowed ? (
              <p className="text-sm text-slate-600 rounded-xl bg-slate-50 border border-slate-200 p-3">
                {t(
                  `${selectedVehicle?.name ?? "This vehicle"} is a direct ride without stops. Choose another vehicle above to add sightseeing stops.`,
                  `${selectedVehicle?.name ?? "Este vehículo"} es un traslado directo sin paradas. Elija otro vehículo arriba para agregar paradas turísticas.`,
                )}
              </p>
            ) : availableStops.length === 0 ? (
              <p className="text-sm text-slate-600">
                {t(
                  "No stops on this route yet. Ask us on WhatsApp if you have one in mind.",
                  "Aún no hay paradas en esta ruta. Escríbanos por WhatsApp si tiene alguna en mente.",
                )}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {shownStops.map((s) => {
                    const on = effectiveStopIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleStop(s.id)}
                        aria-pressed={on}
                        className={`text-left rounded-xl border-2 p-3.5 transition ${
                          on ? "border-emerald-700 bg-emerald-50" : "border-slate-200 hover:border-emerald-300 bg-white"
                        }`}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-[15px] font-extrabold leading-snug text-slate-900">{s.name}</span>
                          <span
                            className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                              on ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white"
                            }`}
                            aria-hidden
                          >
                            {on && <Check className="h-3.5 w-3.5" strokeWidth={4} />}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm font-extrabold text-emerald-700">
                          +{formatUSD(seasonal(stopTotalCents(s, pax)))}
                          {s.tourPerPersonCents > 0
                            ? t(` for ${pax} traveller${pax > 1 ? "s" : ""}`, ` para ${pax} viajero${pax > 1 ? "s" : ""}`)
                            : ""}{" "}
                          · {t("adds", "agrega")} {duration(s.durationMin)}
                        </span>
                        <span className="mt-1 block text-sm text-slate-600">{s.description}</span>
                        {s.tourPerPersonCents > 0 && (
                          <span className="mt-1 block text-xs text-slate-600">
                            {t(
                              `Guided visit ${formatUSD(seasonal(s.tourPerPersonCents))} per person + ${formatUSD(seasonal(s.priceCents))} driver time`,
                              `Visita guiada ${formatUSD(seasonal(s.tourPerPersonCents))} por persona + ${formatUSD(seasonal(s.priceCents))} por el tiempo del conductor`,
                            )}
                          </span>
                        )}
                        <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-600">
                          <Ticket className="w-3.5 h-3.5" aria-hidden />
                          {entranceLabel(s.entrance, lang)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {availableStops.length > STOPS_SHOWN && (
                  <button
                    type="button"
                    onClick={() => setShowAllStops((x) => !x)}
                    aria-expanded={!stopsFolded}
                    className="mt-3 w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-emerald-800 hover:border-emerald-500 flex items-center justify-center gap-1.5"
                  >
                    {stopsFolded
                      ? t(`Show all ${availableStops.length} stops on this route`, `Ver las ${availableStops.length} paradas de esta ruta`)
                      : t("Show fewer stops", "Ver menos paradas")}
                    <ChevronDown className={`h-4 w-4 transition ${stopsFolded ? "" : "rotate-180"}`} aria-hidden />
                  </button>
                )}
              </>
            )}
          </Card>

          {/* 4 · DRIVER & EXTRAS (all optional, folded) */}
          <details className="group bg-white rounded-2xl shadow-sm border border-slate-200">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 sm:px-5 py-3 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <StepTitle n={4} icon={<Languages className="w-5 h-5 text-emerald-700" aria-hidden />}>
                  {t("Extras", "Extras")}
                  <span className="text-sm font-semibold text-slate-600">{t("(optional)", "(opcional)")}</span>
                </StepTitle>
                <span className="mt-0.5 block text-sm text-slate-600 group-open:hidden">
                  {prefWordsNow.length
                    ? prefWordsNow.join(" · ")
                    : t("Bags, driver's language, child seats, Wi-Fi, a note for your driver", "Maletas, idioma del conductor, sillas para niños, Wi-Fi, una nota para su conductor")}
                </span>
              </span>
              <ChevronDown className="h-5 w-5 shrink-0 text-slate-600 transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="px-4 sm:px-5 pb-5">
              <label className="mb-4 flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 pl-3 pr-1 py-1">
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-700">{t("How many bags?", "¿Cuántas maletas?")}</span>
                  <span className="block text-sm text-slate-600">{t("1 large suitcase + 1 carry-on per person. Change it if you bring more or less.", "1 maleta grande y 1 de mano por persona. Cámbielo si lleva más o menos.")}</span>
                </span>
                <select
                  value={bags}
                  onChange={(e) => setBags(e.target.value)}
                  className="ml-auto min-h-11 min-w-16 rounded-lg border border-slate-300 bg-white px-2 text-base font-bold"
                >
                  {Array.from({ length: MAX_BAGS + 1 }, (_, n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend className="text-sm font-bold text-slate-700 mb-2">{t("Driver's language", "Idioma del conductor")}</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(LANGUAGE_LABEL) as DriverLanguage[]).map((l) => (
                    <label
                      key={l}
                      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 text-sm font-bold ${
                        effectivePrefs.language === l ? "border-emerald-700 bg-emerald-50" : "border-slate-200"
                      } ${spanishDriver && l === "english" ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <input
                        type="radio"
                        name="driver-language"
                        checked={effectivePrefs.language === l}
                        disabled={spanishDriver && l === "english"}
                        onChange={() => setPrefs({ ...prefs, language: l })}
                        className="h-4 w-4 accent-emerald-700"
                      />
                      {t(LANGUAGE_LABEL, LANGUAGE_LABEL_ES)[l]}
                    </label>
                  ))}
                </div>
                {spanishDriver && (
                  <p className="mt-2 text-sm text-slate-600">
                    {t(
                      `${selectedVehicle?.name} has a Spanish-speaking driver. For an English-speaking driver, choose the Standard Sedan or another vehicle.`,
                      `${selectedVehicle?.name} tiene conductor de habla hispana. Si desea un conductor que hable inglés, elija el Sedán Estándar u otro vehículo.`,
                    )}
                  </p>
                )}
              </fieldset>
              <fieldset className="mt-4">
                <legend className="text-sm font-bold text-slate-700 mb-2">
                  {t("Extras (free, subject to availability)", "Extras (gratis, sujetos a disponibilidad)")}
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {(
                    [
                      ["wifi", t("Wi-Fi on board", "Wi-Fi a bordo")],
                      ["stroller", t("Stroller", "Coche de bebé")],
                      ["pets", t("Travelling with a pet", "Viaja con una mascota")],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 font-semibold">
                      <input
                        type="checkbox"
                        checked={prefs[k]}
                        onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })}
                        className="h-4 w-4 accent-emerald-700"
                      />
                      {label}
                    </label>
                  ))}
                  <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 pl-3 pr-1 font-semibold">
                    <span>{t("Baby / child seats", "Sillas para bebés / niños")}</span>
                    <select
                      value={prefs.childSeats}
                      onChange={(e) => setPrefs({ ...prefs, childSeats: Number(e.target.value) })}
                      className="ml-auto min-h-11 min-w-16 rounded-lg border border-slate-300 bg-white px-2 text-base font-bold"
                    >
                      {[0, 1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {prefs.childSeats > 0 && (
                  <p className="mt-2 text-sm text-slate-600">
                    {t(
                      "Add the children's ages in the message below so the right seats come along.",
                      "Indique las edades de los niños en el mensaje de abajo para llevar las sillas adecuadas.",
                    )}
                  </p>
                )}
              </fieldset>
              <label className="mt-4 block text-sm font-bold text-slate-700">
                {t("Message for your driver (optional)", "Mensaje para su conductor (opcional)")}
                <textarea
                  value={driverNotes}
                  onChange={(e) => setDriverNotes(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={t(
                    "e.g. Kids are 2 and 5 · we'd love a stop for fresh fruit · large surfboard bag",
                    "p. ej. Los niños tienen 2 y 5 años · nos gustaría parar a comprar fruta fresca · llevamos una tabla de surf grande",
                  )}
                  aria-invalid={driverNotesBlocked}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-base font-normal text-slate-900"
                />
              </label>
              {driverNotesBlocked && (
                <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
                  {t(
                    "Please leave out phone numbers, emails and links. Your driver gets your contact details once confirmed.",
                    "Por favor, no incluya teléfonos, correos ni enlaces. Su conductor recibe sus datos de contacto una vez confirmado.",
                  )}
                </p>
              )}
            </div>
          </details>
        </div>

        {/* 5 · SUMMARY (sticky on desktop) */}
        <div>
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-md border border-slate-200 lg:sticky lg:top-20">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-2">
              <StepTitle n={5}>{t("Live route summary", "Resumen de la ruta")}</StepTitle>
              <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-bold whitespace-nowrap">
                {priceReady ? duration(quote.totalMinutes) : "…"}
              </span>
            </div>

            <ol className="my-4 space-y-3 text-sm">
              <TimelineRow
                label={`${t("Pickup", "Recogida")} · ${formatShortDate(date, lang)} · ${formatTime12h(pickupTime, lang)}`}
                text={originName}
              />
              {selectedStops.map((s) => (
                <TimelineRow key={s.id} label={duration(s.durationMin)} text={s.name} accent />
              ))}
              <TimelineRow label={t("Drop-off", "Destino")} text={destName} />
            </ol>
            <p className="text-xs text-slate-600 -mt-2 mb-3">
              {priceReady ? (
                <>
                  {t("Driving:", "Conducción:")} {duration(quote.driveMinutes)}
                  {route?.ferries ? t(" incl. ferry", " con ferry") : ""}
                  {route ? ` · ${Math.round(route.km)} km` : ""} · {t("Stops:", "Paradas:")} {duration(quote.stopsMinutes)}
                </>
              ) : (
                t(
                  "Choose your pickup and drop-off to see the drive time.",
                  "Elija su recogida y su destino para ver el tiempo de viaje.",
                )
              )}
            </p>
            {route && (
              <a
                href={mapsDirectionsUrl(originPlace, destPlace)}
                target="_blank"
                rel="noopener noreferrer"
                className="-mt-1 mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-emerald-700 underline"
              >
                {t("See the route on Google Maps", "Ver la ruta en Google Maps")} <ExternalLink className="w-3.5 h-3.5" aria-hidden />
              </a>
            )}

            <label className="block text-xs font-bold text-slate-600">
              {airportPickup ? t("Flight number", "Número de vuelo") : t("Flight number or hotel name", "Número de vuelo o nombre del hotel")}{" "}
              <span className="font-semibold text-slate-500">{t("(optional)", "(opcional)")}</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={airportPickup ? t("e.g. AA 1234", "p. ej. AA 1234") : t("e.g. AA 1234 / Arenas del Mar", "p. ej. AA 1234 / Arenas del Mar")}
                className="mt-1 w-full min-h-11 border border-slate-300 rounded-xl px-3 text-base font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </label>
            {airportPickup && (
              <p className="mt-1 text-xs text-slate-600">{t("So we can track your flight.", "Para darle seguimiento a su vuelo.")}</p>
            )}

            <div className="mt-4 bg-slate-50 p-3.5 rounded-xl space-y-1.5 text-sm">
              {mode === "bid" ? (
                <>
                  <Row label={t("Fixed price (reference)", "Precio fijo (referencia)")} value={price(quote.totalCents)} />
                  <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                    <span>{t("Your offer", "Su oferta")}</span>
                    <span className="text-amber-700 text-lg">{offerValid ? formatUSD(offerCents) : "—"}</span>
                  </div>
                </>
              ) : (
                <>
                  {/* Same season-adjusted prices as the cards; stops take the remainder so the rows always add up. */}
                  <Row label={vehicle.name} value={price(seasonal(quote.baseCents))} />
                  {quote.stopsCents > 0 && (
                    <Row
                      label={t("Stops (optional extras)", "Paradas (extras opcionales)")}
                      value={`+${price(quote.totalCents - quote.ferryCents - seasonal(quote.baseCents))}`}
                      green
                    />
                  )}
                  {quote.ferryCents > 0 && route && (
                    <Row
                      label={t(
                        `Ferry, ${route.ferries} crossing${route.ferries > 1 ? "s" : ""} (car, driver + ${pax} passenger${pax > 1 ? "s" : ""})`,
                        `Ferry, ${route.ferries} cruce${route.ferries > 1 ? "s" : ""} (vehículo, conductor + ${paxWord(pax)})`,
                      )}
                      value={`+${price(quote.ferryCents)}`}
                    />
                  )}
                  {seasonPct !== 0 && (
                    <p className="text-xs text-slate-600">
                      {t("Prices include", "Los precios incluyen")} {season.name} {seasonPct > 0 ? "+" : "−"}
                      {Math.abs(seasonPct)}%.
                    </p>
                  )}
                  <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                    <span>{t("Total private ride", "Total del traslado privado")}</span>
                    <span className="text-emerald-700 text-lg">{price(quote.totalCents)}</span>
                  </div>
                </>
              )}
            </div>

            {noVehicleFits && (
              <p className="mt-3 text-sm font-semibold text-amber-800">
                {t(
                  `No vehicle for ${pax} passengers on this route online. Ask us on WhatsApp and we'll arrange it.`,
                  `No hay un vehículo en línea para ${paxWord(pax)} en esta ruta. Escríbanos por WhatsApp y lo organizamos.`,
                )}
              </p>
            )}
            <button
              type="button"
              onClick={addToCart}
              disabled={cantAdd}
              className="w-full mt-4 min-h-12 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-extrabold px-3 rounded-xl shadow-md text-[15px] flex items-center justify-center gap-2 transition"
            >
              <PlusCircle className="w-4 h-4 shrink-0" aria-hidden />
              {addLabel}
            </button>
            <a
              href={routeWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full mt-2 min-h-11 border border-emerald-700 text-emerald-800 hover:bg-emerald-50 font-bold px-3 rounded-xl text-sm flex items-center justify-center gap-2 transition"
            >
              <MessageCircle className="w-4 h-4 shrink-0" aria-hidden /> {t("Ask about this route on WhatsApp", "Consultar por esta ruta en WhatsApp")}
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="w-full mt-1 min-h-11 text-emerald-800 hover:text-emerald-700 font-bold text-sm flex items-center justify-center gap-2"
            >
              <Link2 className="w-4 h-4" aria-hidden /> {copied ? t("Link copied", "Enlace copiado") : t("Copy a link to this ride", "Copiar el enlace de este traslado")}
            </button>
            <p className="sr-only" aria-live="polite">
              {copied ? t("Link copied", "Enlace copiado") : ""}
            </p>
            {suggestion && <div className="mt-4">{suggestion}</div>}
          </div>
        </div>
      </div>

      {/* Phones and tablets: the ride and its price stay in view from the first tap, until something is in the trip. */}
      {cartCount === 0 && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="min-w-0" aria-live="polite">
              <p className="truncate text-xs font-semibold text-slate-600">{shortRoute}</p>
              <p className="truncate text-[15px] font-extrabold text-slate-900">
                {mode === "bid" ? t("Your offer", "Su oferta") : vehicle.name}
                {" · "}
                <span className="text-emerald-700">{mode === "bid" ? (offerValid ? formatUSD(offerCents) : "—") : price(quote.totalCents)}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={addToCart}
              disabled={cantAdd}
              aria-label={addLabel}
              className="min-h-12 shrink-0 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-extrabold whitespace-nowrap"
            >
              {t("Add to trip", "Agregar al viaje")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** What every ride includes (src/lib/trust.ts RIDE_PROMISES); luggage is on each vehicle card. */
function RidePromises({ airport }: { airport: boolean }) {
  const lang = usePublicLang();
  const t = useT();
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <p className="text-sm font-bold text-slate-700 mb-2">{t("Every ride includes", "Cada traslado incluye")}</p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 text-sm text-slate-700">
        {ridePromises(airport, lang).map((p) => (
          <li key={p.title} className="flex items-center gap-1.5 min-h-8">
            <Check className="w-4 h-4 shrink-0 text-emerald-700" aria-hidden />
            <span>
              <span className="font-bold text-slate-900">{p.title}</span>
              {p.href && (
                <>
                  {" "}
                  <a href={p.href} className="inline-flex min-h-11 items-center px-1 font-semibold text-emerald-700 underline">
                    {t("Policy", "Política")}
                  </a>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200">{children}</div>
  );
}

function Row({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="flex justify-between text-slate-600 gap-3">
      <span className="truncate">{label}</span>
      <span className={`font-bold whitespace-nowrap ${green ? "text-emerald-700" : "text-slate-900"}`}>
        {value}
      </span>
    </div>
  );
}

function TimelineRow({ label, text, accent }: { label: string; text: string; accent?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 w-6 h-6 shrink-0 rounded-full flex items-center justify-center ${
          accent ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
        }`}
      >
        <MapPin className="w-3.5 h-3.5" />
      </span>
      <div>
        <p className="text-xs font-bold text-slate-600">{label}</p>
        <p className="font-semibold text-slate-800">{text}</p>
      </div>
    </li>
  );
}
