"use client";

import { ChevronRight, PlusCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { seasonForYmd } from "@/lib/catalogModel";
import { useCatalog } from "./CatalogContext";
import { useT } from "./PublicLangContext";
import { addDays } from "@/lib/dates";
import { newItemId, type CartItem } from "@/lib/cart";
import { formatUSD, quoteExpedition } from "@/lib/pricing";

export function ExpeditionsView({
  today,
  onAdd,
  initialDate,
  highlightId,
}: {
  today: string;
  onAdd: (item: CartItem) => void;
  /** From a "while you're there" suggestion after adding a ride. */
  initialDate?: string;
  highlightId?: string;
}) {
  const tr = useT();
  const [date, setDate] = useState(() => initialDate ?? addDays(today, 30));
  useEffect(() => {
    if (highlightId) document.getElementById(`expedition-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId]);
  const [tiers, setTiers] = useState<Record<string, string>>({});
  const catalog = useCatalog();
  const season = seasonForYmd(date, catalog);
  const tiersList = catalog.lodgingTiers;

  return (
    <section className="space-y-6">
      <div className="bg-emerald-950 text-white rounded-2xl p-5 sm:p-6 shadow-lg flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
            {tr("Our signature expeditions", "Nuestras expediciones insignia")}
          </span>
          <h2 className="text-2xl font-extrabold mt-1">
            {tr("Multi-day eco-expeditions & custom packages", "Eco-expediciones de varios días y paquetes a la medida")}
          </h2>
          <p className="text-xs text-emerald-200 mt-1 max-w-2xl">
            {tr(
              "All-inclusive logistics: SINAC park permits, Sierpe river boats, certified Corcovado guides and private 4x4 transfers.",
              "Logística todo incluido: permisos de parques del SINAC, lanchas por el río Sierpe, guías certificados de Corcovado y traslados privados en 4x4.",
            )}
          </p>
        </div>
        <label className="text-xs font-bold">
          <span className="block text-emerald-300 mb-1">{tr("Start date", "Fecha de inicio")}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-white text-slate-900 rounded-lg px-3 py-2 text-sm font-semibold"
          />
        </label>
      </div>

      <div className="space-y-5">
        {catalog.expeditions.map((exp) => {
          const expTiers = tiersList.filter((t) => !t.expeditionId || t.expeditionId === exp.id);
          const tier = expTiers.find((t) => t.id === tiers[exp.id]) ?? expTiers[0];
          if (!tier) return null; // no lodging offered for this trip right now
          const tierId = tier.id;
          const total = quoteExpedition(exp.id, tier.id, season, catalog);
          return (
            <div
              key={exp.id}
              id={`expedition-${exp.id}`}
              className={`bg-white rounded-2xl border shadow-sm p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 ${
                exp.id === highlightId ? "border-amber-400 ring-2 ring-amber-300" : "border-slate-200"
              }`}
            >
              <div className="lg:col-span-2">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  {tr(`${exp.days} days / ${exp.nights} nights`, `${exp.days} días / ${exp.nights} noches`)}
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 mt-2 leading-snug">{exp.name}</h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 mt-3">
                  {exp.includes.map((i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-emerald-600">✓</span> {i}
                    </li>
                  ))}
                </ul>
                <details className="mt-4 group">
                  <summary className="text-xs font-bold text-emerald-700 cursor-pointer flex items-center gap-1 list-none">
                    <ChevronRight className="w-4 h-4 transition group-open:rotate-90" />{" "}
                    {tr("Day-by-day itinerary", "Itinerario día por día")}
                  </summary>
                  <ol className="mt-2 space-y-1.5 text-xs text-slate-700 pl-5">
                    {exp.itinerary.map((d) => (
                      <li key={d.day}>
                        <strong>
                          {tr("Day", "Día")} {d.day}:
                        </strong> {d.title}
                      </li>
                    ))}
                  </ol>
                </details>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 flex flex-col">
                <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                  {tr("Lodging tier", "Categoría de alojamiento")}
                </p>
                <div className="space-y-1.5">
                  {expTiers.map((t) => (
                    <label
                      key={t.id}
                      className={`flex items-center justify-between gap-2 text-xs rounded-lg border px-3 py-2 cursor-pointer ${
                        t.id === tierId
                          ? "border-emerald-600 bg-emerald-50 font-bold"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`tier-${exp.id}`}
                          checked={t.id === tierId}
                          onChange={() => setTiers((x) => ({ ...x, [exp.id]: t.id }))}
                          className="accent-emerald-600"
                        />
                        {t.name}
                      </span>
                      <span className="text-emerald-700 whitespace-nowrap">
                        {t.surchargeCents ? `+${formatUSD(t.surchargeCents)}` : tr("included", "incluido")}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-auto pt-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    {season.multiplierBps !== 10000 ? season.name : tr("Total package", "Total del paquete")}
                  </p>
                  <p className="text-2xl font-extrabold text-emerald-700">{formatUSD(total)}</p>
                  <button
                    type="button"
                    onClick={() =>
                      onAdd({
                        kind: "expedition",
                        id: newItemId(),
                        title: exp.name,
                        detail: `${exp.days}D/${exp.nights}N · ${tier.name}`,
                        date,
                        totalCents: total,
                        spec: { kind: "expedition", expeditionId: exp.id, tierId: tier.id },
                      })
                    }
                    className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <PlusCircle className="w-4 h-4" /> {tr("Add expedition to your trip", "Agregar expedición a su viaje")}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
