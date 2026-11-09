"use client";

import { Clock, PlusCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { EN_ROUTE_UPGRADE_CENTS, REGION_NAMES, perPersonTierCents, type Region } from "@/lib/catalog";
import { seasonForYmd } from "@/lib/catalogModel";
import { useCatalog } from "./CatalogContext";
import { addDays } from "@/lib/dates";
import { newItemId, type CartItem } from "@/lib/cart";
import { applyMultiplier, formatUSD, quoteDayTour } from "@/lib/pricing";

export function DayToursView({
  today,
  onAdd,
  initialRegion,
  initialDate,
  highlightId,
}: {
  today: string;
  onAdd: (item: CartItem) => void;
  /** From a "while you're there" suggestion after adding a ride. */
  initialRegion?: Region;
  initialDate?: string;
  highlightId?: string;
}) {
  const [region, setRegion] = useState<Region | "ALL">(initialRegion ?? "ALL");
  const [date, setDate] = useState(() => initialDate ?? addDays(today, 14));
  useEffect(() => {
    if (highlightId) document.getElementById(`tour-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId]);
  const [upgrades, setUpgrades] = useState<Record<string, boolean>>({});
  // Tours are per person, with a lower rate for 2–3 and for 4+ travellers.
  const [pax, setPax] = useState(2);
  const catalog = useCatalog();
  const season = seasonForYmd(date, catalog);
  const all = catalog.dayTours;
  const tours = region === "ALL" ? all : all.filter((t) => t.region === region);
  const fromUpgradeCents = all.length
    ? Math.min(...all.map((t) => t.enRouteUpgradeCents ?? EN_ROUTE_UPGRADE_CENTS))
    : EN_ROUTE_UPGRADE_CENTS;

  return (
    <section className="space-y-6">
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" /> Local naturalist guides
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900">1-Day Private Costa Rica Tours</h2>
          <p className="text-xs text-slate-600 mt-1 max-w-xl">
            Upgrade any tour with a <strong>Smart En-Route Transfer (from +{formatUSD(fromUpgradeCents)})</strong>:
            get picked up in one town and dropped off at your next hotel.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Region"
            value={region}
            onChange={(e) => setRegion(e.target.value as Region | "ALL")}
            className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold bg-slate-50"
          >
            <option value="ALL">All regions</option>
            {(Object.keys(REGION_NAMES) as Region[]).map((r) => (
              <option key={r} value={r}>
                {REGION_NAMES[r]}
              </option>
            ))}
          </select>
          <select
            aria-label="Travellers"
            value={pax}
            onChange={(e) => setPax(Number(e.target.value))}
            className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold bg-slate-50"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} traveller{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
          <input
            type="date"
            aria-label="Tour date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold bg-slate-50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {tours.map((t) => {
          const upgrade = Boolean(upgrades[t.id]);
          const total = quoteDayTour(t.id, upgrade, pax, season, catalog);
          const perPerson = applyMultiplier(perPersonTierCents(t.perPerson, pax), season.multiplierBps);
          return (
            <div
              key={t.id}
              id={`tour-${t.id}`}
              className={`bg-white rounded-2xl border shadow-sm p-5 flex flex-col ${
                t.id === highlightId ? "border-amber-400 ring-2 ring-amber-300" : "border-slate-200"
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full self-start">
                {REGION_NAMES[t.region]}
              </span>
              <h3 className="text-base font-extrabold text-slate-900 mt-2 leading-snug">{t.name}</h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {t.durationHours} hours · private · guide, entrances &amp; lunch included
              </p>
              <ul className="text-xs text-slate-600 mt-3 space-y-1">
                {t.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <span className="text-emerald-600">•</span> {h}
                  </li>
                ))}
              </ul>

              <label className="mt-4 flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg p-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={upgrade}
                  onChange={(e) => setUpgrades((u) => ({ ...u, [t.id]: e.target.checked }))}
                  className="mt-0.5 accent-emerald-600"
                />
                <span>
                  <strong>Smart En-Route Transfer</strong> (+{formatUSD(t.enRouteUpgradeCents ?? EN_ROUTE_UPGRADE_CENTS)}) — end
                  the day at your next hotel instead of returning.
                </span>
              </label>

              <div className="mt-auto pt-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    {season.multiplierBps !== 10000 ? season.name : "Total"}
                  </p>
                  <p className="text-xl font-extrabold text-emerald-700">{formatUSD(total)}</p>
                  <p className="text-[11px] font-semibold text-slate-600">
                    {formatUSD(perPerson)} per person · {pax} traveller{pax > 1 ? "s" : ""}
                    {pax < 4 ? ` · cheaper per person from 4` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onAdd({
                      kind: "day_tour",
                      id: newItemId(),
                      title: t.name,
                      detail: `${t.durationHours}h private tour, ${pax} traveller${pax > 1 ? "s" : ""}${upgrade ? " + Smart En-Route Transfer" : ""}`,
                      date,
                      totalCents: total,
                      spec: { kind: "day_tour", tourId: t.id, upgrade, pax },
                    })
                  }
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition"
                >
                  <PlusCircle className="w-4 h-4" /> Add
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
