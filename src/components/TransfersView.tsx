"use client";

import { Camera, Car, Check, ExternalLink, Gavel, Languages, Link2, MapPin, MessageCircle, PlusCircle, Ticket, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ENTRANCE_LABEL, stopFitsRoute, stopTotalCents } from "@/lib/catalog";
import { seasonForYmd } from "@/lib/catalogModel";
import { useCatalog } from "./CatalogContext";
import { PlaceInput } from "./PlaceInput";
import { hubPlace, isAirportPickup, isHubPlace, mapsDirectionsUrl, needsRoute, type RidePlace, type RideRoute } from "@/lib/places";
import { newItemId, whatsAppLink, type CartItem } from "@/lib/cart";
import { DEFAULT_PICKUP_TIME, PICKUP_TIMES, addDays, formatTime12h } from "@/lib/dates";
import { applyMultiplier, ferryCents, formatDuration, formatUSD, perPersonCents, perPersonShare, quoteTransfer, rideCents } from "@/lib/pricing";
import { MAX_SHARED_PAX, rideLinkQuery, type RideLinkState } from "@/lib/shareLink";
import { MIN_OFFER_USD } from "@/lib/tripRequest";
import { ridePromises } from "@/lib/trust";
import { DEFAULT_PREFS, LANGUAGE_LABEL, hasContactDetails, prefsSummary, type DriverLanguage, type RidePrefs } from "@/lib/preferences";

type PricingMode = "fixed" | "bid";

/** Lowest offer a client may broadcast in bid mode (USD). */

export function TransfersView({
  today,
  onAdd,
  initial = {},
  suggestion,
}: {
  /** Today's date in Costa Rica (YYYY-MM-DD), computed on the server. */
  today: string;
  onAdd: (item: CartItem) => void;
  /** Pre-filled from a shared link or a route page (?from=&to=…), already validated. */
  initial?: Partial<RideLinkState>;
  /** "While you're there" suggestions after a ride is added, shown under the add button. */
  suggestion?: React.ReactNode;
}) {
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
  const [notes, setNotes] = useState("");
  const [prefs, setPrefs] = useState<RidePrefs>(DEFAULT_PREFS);
  const [driverNotes, setDriverNotes] = useState("");
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
            : { key: routeKey, error: d.error ?? "We couldn't work out this route. Please try again." },
        ),
      )
      .catch(() => {
        if (!ctrl.signal.aborted) setRouteState({ key: routeKey, error: "We couldn't work out this route. Please try again." });
      });
    return () => ctrl.abort();
  }, [routeKey, originPlace.id, destPlace.id]);
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
  const stopsKey = effectiveStopIds.join(",");

  // Shareable link: mirror the ride choices in the address bar (debounced), never personal details.
  const skipFirstSync = useRef(true);
  useEffect(() => {
    if (skipFirstSync.current) {
      skipFirstSync.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      const q = rideLinkQuery(
        { origin: originPlace, destination: destPlace, date, pickupTime, pax, vehicleId: effectiveVehicleId, stopIds: stopsKey ? stopsKey.split(",") : [] },
        window.location.search,
      );
      if (`?${q}` !== window.location.search) {
        window.history.replaceState(null, "", `${window.location.pathname}?${q}${window.location.hash}`);
      }
    }, 400);
    return () => window.clearTimeout(t);
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
  const originName = originPlace.label;
  const destName = destPlace.label;
  const vehicle = catalog.vehicles.find((v) => v.id === effectiveVehicleId)!;
  const selectedStops = catalog.stops.filter((s) => effectiveStopIds.includes(s.id));
  const cantAdd = !priceReady || noVehicleFits || (mode === "bid" && !offerValid) || driverNotesBlocked;
  const price = (cents: number) => (priceReady ? formatUSD(cents) : "…");
  // Car price on a vehicle card: the ride for the date + ferries for this group.
  const ferry = ferryCents(route, pax, catalog);
  const carCents = (v: (typeof catalog.vehicles)[number]) => seasonal(rideCents(origin, destination, v, catalog, route)) + ferry;

  function toggleStop(id: string) {
    setStopIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addToCart() {
    if (cantAdd) return;
    const stopsText = selectedStops.length
      ? ` + ${selectedStops.length} stop${selectedStops.length > 1 ? "s" : ""} (${selectedStops.map((s) => s.name).join(", ")})`
      : "";
    onAdd({
      kind: "transfer",
      id: newItemId(),
      title: `${originName} → ${destName}`,
      detail:
        (mode === "bid"
          ? `Driver bid request — your offer covers the ride${selectedStops.length ? " + stops" : ""} (fixed price would be ${formatUSD(quote.totalCents)}), ${pax} pax${stopsText}${notes ? ` — ${notes}` : ""}`
          : `${vehicle.name}, ${pax} pax${stopsText}${notes ? ` — ${notes}` : ""}`
        ) + (prefsSummary(effectivePrefs).length ? ` · ${prefsSummary(effectivePrefs).join(", ")}` : ""),
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
      },
    });
  }

  const routeWhatsApp = whatsAppLink(
    `Hi! I'm looking at a private transfer ${originName} → ${destName} on ${date} at ${formatTime12h(pickupTime)} (Costa Rica time) for ${pax} passengers${
      selectedStops.length ? ` with stops at ${selectedStops.map((s) => s.name).join(", ")}` : ""
    }. ${
      mode === "bid" && offerValid
        ? `I'd like to offer ${formatUSD(offerCents)} for the ride${selectedStops.length ? " including the stops" : ""} (fixed price shows ${price(quote.totalCents)}).`
        : priceReady
          ? `Quoted ${formatUSD(quote.totalCents)}.`
          : ""
    } Can you confirm availability?`,
  );

  return (
    <section className="space-y-6">
      {/* HERO + ROUTE CONFIGURATOR */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl p-5 sm:p-6 text-white shadow-xl">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 px-3 py-1 rounded-full mb-3">
            Sightseeing transfers + driver bidding
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">
            Book a private Costa Rica transfer, or turn the drive into an adventure
          </h1>
          <p className="text-emerald-100 text-sm mt-2">
            Add curated wildlife, waterfall or volcano stops along your route, or name your price and
            let local partner drivers bid on your ride.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/15">
          <PlaceInput label="Pickup" value={originPlace} onChange={setOriginPlace} />
          <PlaceInput label="Drop-off" value={destPlace} onChange={setDestPlace} />
          <Field label="Travel date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white text-slate-900 rounded-lg px-3 py-2.5 text-sm font-semibold"
            />
          </Field>
          <Field label="Pickup time (Costa Rica time)">
            <select
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              aria-describedby="pickup-time-hint"
              className="w-full bg-white text-slate-900 rounded-lg px-3 py-2.5 text-sm font-semibold"
            >
              {PICKUP_TIMES.map((t) => (
                <option key={t} value={t}>
                  {formatTime12h(t)}
                </option>
              ))}
            </select>
            <span id="pickup-time-hint" className="block mt-1 text-[11px] text-emerald-100">
              For airport pickups, enter your flight&apos;s landing time.
            </span>
          </Field>
          <Field label="Passengers">
            <select
              value={pax}
              onChange={(e) => setPax(Number(e.target.value))}
              className="w-full bg-white text-slate-900 rounded-lg px-3 py-2.5 text-sm font-semibold"
            >
              {Array.from({ length: MAX_SHARED_PAX }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} passenger{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pricing mode" group>
            <div className="grid grid-cols-2 bg-emerald-950/80 p-1 rounded-lg border border-emerald-700">
              {(
                [
                  ["fixed", "Fixed price"],
                  ["bid", "Driver bids"],
                ] as [PricingMode, string][]
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`py-1.5 text-xs font-bold rounded-md transition ${
                    mode === m ? "bg-amber-400 text-slate-950" : "text-emerald-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
        </div>
        {samePlace && (
          <p className="mt-3 text-xs font-semibold text-amber-300">
            Pick a different drop-off to see prices.
          </p>
        )}
        {routeLoading && (
          <p className="mt-3 text-xs font-semibold text-emerald-100" aria-live="polite">
            Checking the road distance…
          </p>
        )}
        {routeError && (
          <p role="alert" className="mt-3 text-xs font-semibold text-amber-300">
            {routeError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* STOPS */}
          <Card>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-emerald-600" /> Add a stop (optional extra)
                </h2>
                <p className="text-xs text-slate-500">
                  Paid extras on the road between your pickup and drop-off. Your driver waits with
                  your luggage in a locked vehicle while you explore.
                </p>
              </div>
              <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full whitespace-nowrap">
                {effectiveStopIds.length} added
              </span>
            </div>
            {!stopsAllowed ? (
              <p className="text-sm text-slate-600 rounded-xl bg-slate-50 border border-slate-200 p-3">
                {selectedVehicle?.name ?? "This vehicle"} is a direct ride without stops. Choose another
                vehicle below to add sightseeing stops.
              </p>
            ) : availableStops.length === 0 ? (
              <p className="text-sm text-slate-500">No stops on this route yet. Ask us on WhatsApp if you have one in mind.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableStops.map((s) => {
                  const on = effectiveStopIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleStop(s.id)}
                      aria-pressed={on}
                      className={`text-left rounded-xl border-2 p-3.5 transition ${
                        on
                          ? "border-emerald-600 bg-emerald-50"
                          : "border-slate-200 hover:border-emerald-300 bg-white"
                      }`}
                    >
                      <p className="text-sm font-extrabold text-slate-900">{s.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{s.description}</p>
                      <p className="text-xs font-extrabold text-emerald-700 mt-2">
                        +{formatUSD(seasonal(stopTotalCents(s, pax)))}
                        {s.tourPerPersonCents > 0 ? ` for ${pax} traveller${pax > 1 ? "s" : ""}` : ""} · adds {formatDuration(s.durationMin)}
                      </p>
                      {s.tourPerPersonCents > 0 && (
                        <p className="text-[11px] text-slate-500">
                          Guided visit {formatUSD(seasonal(s.tourPerPersonCents))} per person + {formatUSD(seasonal(s.priceCents))} driver time
                        </p>
                      )}
                      <p className="text-[11px] font-semibold text-slate-600 mt-1 flex items-center gap-1">
                        <Ticket className="w-3.5 h-3.5" aria-hidden />
                        {ENTRANCE_LABEL[s.entrance]}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* VEHICLES or BIDDING */}
          {mode === "fixed" ? (
            <Card>
              <h2 className="font-extrabold text-base text-slate-900 mb-3 flex items-center gap-2">
                <Car className="w-5 h-5 text-emerald-600" /> Select your private vehicle
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableVehicles.map((v) => {
                  const on = v.id === effectiveVehicleId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVehicleId(v.id)}
                      aria-pressed={on}
                      className={`text-left rounded-xl border-2 p-3.5 transition ${
                        on
                          ? "border-emerald-600 bg-emerald-50"
                          : "border-slate-200 hover:border-emerald-300 bg-white"
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        {v.badge}
                      </span>
                      <p className="text-sm font-extrabold text-slate-900 mt-2">{v.name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <Users className="w-3.5 h-3.5" /> Up to {v.maxPax} · {v.luggage}
                      </p>
                      <p className="text-lg font-extrabold text-emerald-700 mt-2">
                        {price(carCents(v))}{" "}
                        <span className="text-xs font-bold text-slate-500">per car</span>
                      </p>
                      <p className="text-xs font-semibold text-slate-600">
                        from {price(perPersonCents(carCents(v), v.maxPax))} per person ({perPersonShare(v.maxPax)} travellers)
                      </p>
                      {ferry > 0 && (
                        <p className="text-[11px] font-semibold text-slate-600">Ferry fares included</p>
                      )}
                      {seasonPct !== 0 && (
                        <p className="text-[11px] font-bold text-amber-700">
                          {season.name} {seasonPct > 0 ? "+" : "−"}
                          {Math.abs(seasonPct)}%
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
              <RidePromises airport={airportPickup} />
            </Card>
          ) : (
            <div className="bg-white rounded-2xl p-5 shadow-sm border-2 border-amber-400">
              <span className="text-[11px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full">
                Driver marketplace
              </span>
              <h2 className="font-extrabold text-base text-slate-900 mt-1 flex items-center gap-2">
                <Gavel className="w-5 h-5 text-amber-600" /> Name your offer, compare driver bids
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Reference fixed price for this route: {price(quote.totalCents)}. Hand-picked
                local partner drivers will bid on your request.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <label htmlFor="bid-offer" className="text-xs font-semibold text-slate-600">
                  Your offer (USD):
                </label>
                <input
                  id="bid-offer"
                  type="number"
                  min={MIN_OFFER_USD}
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  className="w-28 border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-bold"
                />
              </div>
              {!offerValid && (
                <p className="text-xs font-semibold text-red-600 mt-2">
                  Enter an offer of at least {formatUSD(MIN_OFFER_USD * 100)}.
                </p>
              )}
              {offerIsLow && (
                <p className="text-xs font-semibold text-amber-700 mt-2">
                  That&apos;s well below the fixed price, so drivers may not accept it.
                </p>
              )}
              <p className="text-xs text-slate-500 mt-3 bg-slate-50 rounded-lg p-3">
                Add this request to your trip and send it. Your offer goes to our approved partner
                drivers, our team confirms the best match, and you get an email with your
                driver&apos;s profile and car. Nothing is charged until then.
              </p>
            </div>
          )}

          {/* DRIVER & EXTRAS */}
          <Card>
            <h2 className="font-extrabold text-base text-slate-900 mb-3 flex items-center gap-2">
              <Languages className="w-5 h-5 text-emerald-600" /> Your driver &amp; extras
            </h2>
            <fieldset>
              <legend className="text-xs font-bold text-slate-600 mb-2">Driver&apos;s language</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.keys(LANGUAGE_LABEL) as DriverLanguage[]).map((l) => (
                  <label
                    key={l}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 text-sm font-bold ${
                      effectivePrefs.language === l ? "border-emerald-600 bg-emerald-50" : "border-slate-200"
                    } ${spanishDriver && l === "english" ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="radio"
                      name="driver-language"
                      checked={effectivePrefs.language === l}
                      disabled={spanishDriver && l === "english"}
                      onChange={() => setPrefs({ ...prefs, language: l })}
                    />
                    {LANGUAGE_LABEL[l]}
                  </label>
                ))}
              </div>
              {spanishDriver && (
                <p className="mt-2 text-xs text-slate-500">
                  {selectedVehicle?.name} has a Spanish-speaking driver. For an English-speaking driver,
                  choose the Standard Sedan or another vehicle.
                </p>
              )}
            </fieldset>
            <fieldset className="mt-4">
              <legend className="text-xs font-bold text-slate-600 mb-2">Extras (free, subject to availability)</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                {(
                  [
                    ["wifi", "Wi-Fi on board"],
                    ["stroller", "Stroller"],
                    ["pets", "Travelling with a pet"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 font-semibold">
                    <input type="checkbox" checked={prefs[k]} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })} />
                    {label}
                  </label>
                ))}
                <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 font-semibold">
                  <span>Baby / child seats</span>
                  <select
                    value={prefs.childSeats}
                    onChange={(e) => setPrefs({ ...prefs, childSeats: Number(e.target.value) })}
                    className="ml-auto rounded-lg border border-slate-300 px-1 py-1"
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
                <p className="mt-2 text-xs text-slate-500">Add the children&apos;s ages in the message below so the right seats come along.</p>
              )}
            </fieldset>
            <label className="mt-4 block text-xs font-bold text-slate-600">
              Message for your driver (optional)
              <textarea
                value={driverNotes}
                onChange={(e) => setDriverNotes(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="e.g. Kids are 2 and 5 · we'd love a stop for fresh fruit · large surfboard bag"
                className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-base sm:text-sm font-normal text-slate-900"
              />
            </label>
            {driverNotesBlocked && (
              <p role="alert" className="mt-2 text-xs font-semibold text-red-700">
                Please leave out phone numbers, emails and links. Your driver gets your contact details once confirmed.
              </p>
            )}
          </Card>
        </div>

        {/* ROUTE SUMMARY */}
        <div>
          <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-200 lg:sticky lg:top-28">
            <h3 className="font-extrabold text-base text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
              <span>Live route summary</span>
              <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-bold">
                {priceReady ? formatDuration(quote.totalMinutes) : "…"}
              </span>
            </h3>

            <ol className="my-4 space-y-3 text-xs">
              <TimelineRow label={`Pickup · ${date} · ${formatTime12h(pickupTime)}`} text={originName} />
              {selectedStops.map((s) => (
                <TimelineRow
                  key={s.id}
                  label={formatDuration(s.durationMin)}
                  text={s.name}
                  accent
                />
              ))}
              <TimelineRow label="Drop-off" text={destName} />
            </ol>
            <p className="text-[11px] text-slate-500 -mt-2 mb-3">
              {priceReady ? (
                <>
                  Driving: {formatDuration(quote.driveMinutes)}
                  {route?.ferries ? " incl. ferry" : ""}
                  {route ? ` · ${Math.round(route.km)} km` : ""} · Stops: {formatDuration(quote.stopsMinutes)}
                </>
              ) : (
                "Choose your pickup and drop-off to see the drive time."
              )}
            </p>
            {route && (
              <a
                href={mapsDirectionsUrl(originPlace, destPlace)}
                target="_blank"
                rel="noopener noreferrer"
                className="-mt-1 mb-3 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 underline"
              >
                See the route on Google Maps <ExternalLink className="w-3 h-3" aria-hidden />
              </a>
            )}

            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={airportPickup ? "Flight number (e.g. AA 1234), so we can track it" : "Flight # or hotel name (e.g. AA 1234 / Arenas del Mar)"}
              aria-label={airportPickup ? "Flight number" : "Flight number or hotel name"}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
            />

            <div className="mt-4 bg-slate-50 p-3.5 rounded-xl space-y-1.5 text-xs">
              {mode === "bid" ? (
                <>
                  <Row label="Fixed price (reference)" value={price(quote.totalCents)} />
                  <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Your offer</span>
                    <span className="text-amber-600 text-lg">
                      {offerValid ? formatUSD(offerCents) : "—"}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  {/* Same season-adjusted prices as the cards; stops take the remainder so the rows always add up. */}
                  <Row label={vehicle.name} value={price(seasonal(quote.baseCents))} />
                  {quote.stopsCents > 0 && (
                    <Row
                      label="Stops (optional extras)"
                      value={`+${price(quote.totalCents - quote.ferryCents - seasonal(quote.baseCents))}`}
                      green
                    />
                  )}
                  {quote.ferryCents > 0 && route && (
                    <Row
                      label={`Ferry, ${route.ferries} crossing${route.ferries > 1 ? "s" : ""} (car, driver + ${pax} passenger${pax > 1 ? "s" : ""})`}
                      value={`+${price(quote.ferryCents)}`}
                    />
                  )}
                  {seasonPct !== 0 && (
                    <p className="text-[11px] text-slate-500">
                      Prices include {season.name} {seasonPct > 0 ? "+" : "−"}
                      {Math.abs(seasonPct)}%.
                    </p>
                  )}
                  <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Total private ride</span>
                    <span className="text-emerald-700 text-lg">{price(quote.totalCents)}</span>
                  </div>
                </>
              )}
            </div>

            {noVehicleFits && (
              <p className="mt-3 text-xs font-semibold text-amber-700">
                No vehicle for {pax} passengers on this route online. Ask us on WhatsApp and we&apos;ll
                arrange it.
              </p>
            )}
            <button
              type="button"
              onClick={addToCart}
              disabled={cantAdd}
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold py-3 rounded-xl shadow-md text-sm flex items-center justify-center gap-2 transition"
            >
              <PlusCircle className="w-4 h-4" />
              {mode === "bid" ? "Add offer request to your trip" : "Add this ride to your trip"}
            </button>
            <a
              href={routeWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full mt-2 border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition"
            >
              <MessageCircle className="w-4 h-4" /> Ask about this route on WhatsApp
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="w-full mt-2 min-h-11 text-emerald-700 hover:text-emerald-600 font-bold text-xs flex items-center justify-center gap-2"
            >
              <Link2 className="w-4 h-4" aria-hidden /> {copied ? "Link copied" : "Copy a link to this ride"}
            </button>
            <p className="sr-only" aria-live="polite">
              {copied ? "Link copied" : ""}
            </p>
            {suggestion && <div className="mt-4">{suggestion}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
  group,
}: {
  label: string;
  children: React.ReactNode;
  /** true when the control is a button group rather than a single input */
  group?: boolean;
}) {
  const cls = "text-[11px] uppercase tracking-wider text-emerald-200 font-bold block mb-1";
  if (group) {
    return (
      <div role="group" aria-label={label}>
        <span className={cls}>{label}</span>
        {children}
      </div>
    );
  }
  return (
    <label className="block">
      <span className={cls}>{label}</span>
      {children}
    </label>
  );
}

/** What every ride includes (src/lib/trust.ts RIDE_PROMISES); luggage is on each vehicle card. */
function RidePromises({ airport }: { airport: boolean }) {
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <p className="text-xs font-bold text-slate-600 mb-2">Every ride includes</p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-700">
        {ridePromises(airport).map((p) => (
          <li key={p.title} className="flex items-start gap-1.5">
            <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600" aria-hidden />
            <span>
              <span className="font-bold text-slate-900">{p.title}</span>
              {p.href && (
                <>
                  {" "}
                  <a href={p.href} className="font-semibold text-emerald-700 underline">
                    Policy
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
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">{children}</div>
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
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{label}</p>
        <p className="font-semibold text-slate-800">{text}</p>
      </div>
    </li>
  );
}
