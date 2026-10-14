"use client";

import { Camera, Car, Gavel, MapPin, MessageCircle, PlusCircle, Users } from "lucide-react";
import { useMemo, useState } from "react";
import {
  HUBS,
  SIGHTSEEING_STOPS,
  VEHICLE_CLASSES,
  type HubId,
} from "@/lib/catalog";
import { newItemId, whatsAppLink, type CartItem } from "@/lib/cart";
import { formatDuration, formatUSD, quoteTransfer, seasonForDate } from "@/lib/pricing";

type PricingMode = "fixed" | "bid";

function defaultDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export function TransfersView({ onAdd }: { onAdd: (item: CartItem) => void }) {
  const [origin, setOrigin] = useState<HubId>("SJO");
  const [destination, setDestination] = useState<HubId>("ManuelAntonio");
  const [date, setDate] = useState(defaultDate);
  const [pax, setPax] = useState(2);
  const [mode, setMode] = useState<PricingMode>("fixed");
  const [vehicleId, setVehicleId] = useState("suv");
  const [stopIds, setStopIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [offer, setOffer] = useState("165");

  const season = useMemo(() => seasonForDate(new Date(`${date}T12:00:00`)), [date]);

  const availableStops = useMemo(
    () =>
      SIGHTSEEING_STOPS.filter(
        (s) => s.corridors.includes(origin) || s.corridors.includes(destination),
      ),
    [origin, destination],
  );

  const availableVehicles = useMemo(
    () =>
      VEHICLE_CLASSES.filter(
        (v) =>
          v.maxPax >= pax &&
          (!v.onlyForHubs ||
            v.onlyForHubs.includes(origin) ||
            v.onlyForHubs.includes(destination)),
      ),
    [pax, origin, destination],
  );

  // Keep the selected vehicle valid when pax or route changes.
  const effectiveVehicleId = availableVehicles.some((v) => v.id === vehicleId)
    ? vehicleId
    : (availableVehicles[0]?.id ?? "van");
  const effectiveStopIds = stopIds.filter((id) => availableStops.some((s) => s.id === id));

  const quote = useMemo(
    () =>
      quoteTransfer({
        origin,
        destination,
        vehicleId: effectiveVehicleId,
        stopIds: effectiveStopIds,
        season,
      }),
    [origin, destination, effectiveVehicleId, effectiveStopIds, season],
  );

  const originName = HUBS.find((h) => h.id === origin)!.name;
  const destName = HUBS.find((h) => h.id === destination)!.name;
  const vehicle = VEHICLE_CLASSES.find((v) => v.id === effectiveVehicleId)!;
  const selectedStops = SIGHTSEEING_STOPS.filter((s) => effectiveStopIds.includes(s.id));
  const sameHub = origin === destination;

  function toggleStop(id: string) {
    setStopIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addToCart() {
    if (sameHub) return;
    const stopsText = selectedStops.length
      ? ` + ${selectedStops.length} stop${selectedStops.length > 1 ? "s" : ""} (${selectedStops.map((s) => s.name).join(", ")})`
      : "";
    onAdd({
      kind: "transfer",
      id: newItemId(),
      title: `${originName} → ${destName}`,
      detail: `${vehicle.name}, ${pax} pax${stopsText}${notes ? ` — ${notes}` : ""}${
        mode === "bid" ? " — DRIVER BID REQUEST" : ""
      }`,
      date,
      totalCents: quote.totalCents,
    });
  }

  const routeWhatsApp = whatsAppLink(
    `Hi Jorge! I'm looking at a private transfer ${originName} → ${destName} on ${date} for ${pax} passengers${
      selectedStops.length ? ` with stops at ${selectedStops.map((s) => s.name).join(", ")}` : ""
    }. Quoted ${formatUSD(quote.totalCents)}. Can you confirm availability?`,
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
            let ICT-certified drivers bid on your ride.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-6 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/15">
          <Field label="Origin pickup">
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value as HubId)}
              className="w-full bg-white text-slate-900 rounded-lg px-3 py-2.5 text-sm font-semibold"
            >
              {HUBS.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Destination drop-off">
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value as HubId)}
              className="w-full bg-white text-slate-900 rounded-lg px-3 py-2.5 text-sm font-semibold"
            >
              {HUBS.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Travel date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white text-slate-900 rounded-lg px-3 py-2.5 text-sm font-semibold"
            />
          </Field>
          <Field label="Passengers">
            <select
              value={pax}
              onChange={(e) => setPax(Number(e.target.value))}
              className="w-full bg-white text-slate-900 rounded-lg px-3 py-2.5 text-sm font-semibold"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n} passenger{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pricing mode">
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
        {sameHub && (
          <p className="mt-3 text-xs font-semibold text-amber-300">
            Pick a different destination to see prices.
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
                  <Camera className="w-5 h-5 text-emerald-600" /> Optional sightseeing stops along
                  your route
                </h2>
                <p className="text-xs text-slate-500">
                  Your driver waits with your luggage in a locked vehicle while you explore.
                </p>
              </div>
              <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full whitespace-nowrap">
                {effectiveStopIds.length} added
              </span>
            </div>
            {availableStops.length === 0 ? (
              <p className="text-sm text-slate-500">No curated stops on this corridor yet.</p>
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
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-extrabold text-slate-900">{s.name}</p>
                        <span className="text-sm font-extrabold text-emerald-700 whitespace-nowrap">
                          +{formatUSD(s.priceCents)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{s.description}</p>
                      <p className="text-[11px] font-bold text-slate-600 mt-2">
                        {formatDuration(s.durationMin)} stop
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
                        {formatUSD(v.baseRateCents)}
                      </p>
                    </button>
                  );
                })}
              </div>
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
                Reference fixed price for this route: {formatUSD(quote.totalCents)}. Verified
                ICT-certified drivers will bid on your request.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className="text-xs font-semibold text-slate-600">Your offer (USD):</span>
                <input
                  type="number"
                  min={50}
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  className="w-28 border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-bold"
                />
              </div>
              <p className="text-xs text-slate-500 mt-3 bg-slate-50 rounded-lg p-3">
                Live bidding goes online in Phase 3. For now, add this request to your cart and
                Jorge will source driver offers for you over WhatsApp.
              </p>
            </div>
          )}
        </div>

        {/* ROUTE SUMMARY */}
        <div>
          <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-200 lg:sticky lg:top-28">
            <h3 className="font-extrabold text-base text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
              <span>Live route summary</span>
              <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-bold">
                {formatDuration(quote.totalMinutes)}
              </span>
            </h3>

            <ol className="my-4 space-y-3 text-xs">
              <TimelineRow label="Pickup" text={originName} />
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
              Driving: {formatDuration(quote.driveMinutes)} · Stops:{" "}
              {formatDuration(quote.stopsMinutes)}
            </p>

            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Flight # or hotel name (e.g. AA 1234 / Arenas del Mar)"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
            />

            <div className="mt-4 bg-slate-50 p-3.5 rounded-xl space-y-1.5 text-xs">
              <Row label={mode === "bid" ? "Reference price" : vehicle.name} value={formatUSD(quote.baseCents)} />
              <Row label="Sightseeing stops" value={`+${formatUSD(quote.stopsCents)}`} green />
              {quote.seasonMultiplierBps !== 10000 && (
                <Row
                  label={`${season.name} ×${(quote.seasonMultiplierBps / 10000).toFixed(2)}`}
                  value={`+${formatUSD(quote.totalCents - quote.subtotalCents)}`}
                />
              )}
              <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total private ride</span>
                <span className="text-emerald-700 text-lg">{formatUSD(quote.totalCents)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={addToCart}
              disabled={sameHub}
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold py-3 rounded-xl shadow-md text-sm flex items-center justify-center gap-2 transition"
            >
              <PlusCircle className="w-4 h-4" />
              {mode === "bid" ? "Add bid request to cart" : "Add transfer to trip cart"}
            </button>
            <a
              href={routeWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full mt-2 border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition"
            >
              <MessageCircle className="w-4 h-4" /> Ask Jorge about this route
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-emerald-200 font-bold block mb-1">
        {label}
      </label>
      {children}
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
