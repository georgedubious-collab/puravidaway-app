"use client";

import { Clock, PlusCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { EN_ROUTE_UPGRADE_CENTS, REGION_NAMES, type Region } from "@/lib/catalog";
import { seasonForYmd } from "@/lib/catalogModel";
import { useCatalog } from "./CatalogContext";
import { addDays } from "@/lib/dates";
import { newItemId, type CartItem } from "@/lib/cart";
import { formatUSD, quoteDayTour } from "@/lib/pricing";

export function DayToursView({
  today,
  onAdd,
}: {
  today: string;
  onAdd: (item: CartItem) => void;
}) {
  const [region, setRegion] = useState<Region | "ALL">("ALL");
  const [date, setDate] = useState(() => addDays(today, 14));
  const [upgrades, setUpgrades] = useState<Record<string, boolean>>({});
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
          const total = quoteDayTour(t.id, upgrade, season, catalog);
          return (
            <div
              key={t.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col"
            >
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full self-start">
                {REGION_NAMES[t.region]}
              </span>
              <h3 className="text-base font-extrabold text-slate-900 mt-2 leading-snug">{t.name}</h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {t.durationHours} hours · private
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
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onAdd({
                      kind: "day_tour",
                      id: newItemId(),
                      title: t.name,
                      detail: `${t.durationHours}h private tour${upgrade ? " + Smart En-Route Transfer" : ""}`,
                      date,
                      totalCents: total,
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
