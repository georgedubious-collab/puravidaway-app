"use client";

import { ArrowDown, ChevronRight, PlusCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { seasonForYmd } from "@/lib/catalogModel";
import { useCatalog } from "./CatalogContext";
import { usePublicLang, useT } from "./PublicLangContext";
import { addDays, formatShortDate } from "@/lib/dates";
import { newItemId, type CartItem } from "@/lib/cart";
import { tourPhoto } from "@/lib/photos";
import { formatUSDWhole, quoteExpedition } from "@/lib/pricing";
import { BuilderHero, HERO_BUTTON, HERO_CONTROL, HeroField, type BuilderTabs } from "./BuilderHero";
import { Photo } from "./site/Photo";

/** Multi-day trips ("expeditions" in the catalog and the database). */
export function ExpeditionsView({
  today,
  onAdd,
  tabs,
  initialDate,
  highlightId,
}: {
  today: string;
  onAdd: (item: CartItem) => void;
  /** Transfers / Day tours / Multi-day trips switch, shown in the hero form on phones. */
  tabs: BuilderTabs;
  /** From a "while you're there" suggestion after adding a ride. */
  initialDate?: string;
  highlightId?: string;
}) {
  const lang = usePublicLang();
  const tr = useT();
  const [date, setDate] = useState(() => initialDate ?? addDays(today, 30));
  useEffect(() => {
    if (highlightId) document.getElementById(`expedition-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId]);
  const [tiers, setTiers] = useState<Record<string, string>>({});
  const catalog = useCatalog();
  const season = seasonForYmd(date, catalog);
  const tiersList = catalog.lodgingTiers;
  const seasonNote = season.multiplierBps !== 10000 ? ` · ${season.name}` : "";

  return (
    <section className="space-y-5">
      <BuilderHero
        tabs={tabs}
        title={tr("Multi-day trips in Costa Rica", "Viajes de varios días por Costa Rica")}
        text={tr(
          "Transfers, guides, park permits and boats arranged for you. Choose your start date and lodging.",
          "Traslados, guías, permisos de parques y lanchas organizados para usted. Elija su fecha de inicio y alojamiento.",
        )}
      >
        <HeroField label={tr("Start date", "Fecha de inicio")}>
          <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className={HERO_CONTROL} />
        </HeroField>
        <button
          type="button"
          onClick={() => document.getElementById("trip-list")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className={HERO_BUTTON}
        >
          {tr("See trips & prices", "Ver viajes y precios")} <ArrowDown className="h-4 w-4" aria-hidden />
        </button>
        <p className="mt-2 text-center text-xs font-semibold text-slate-600">
          {tr(
            "Want something different? Ask us on WhatsApp for a custom trip.",
            "¿Busca algo distinto? Pídanos por WhatsApp un viaje a la medida.",
          )}
        </p>
      </BuilderHero>

      <div id="trip-list" className="scroll-mt-20 space-y-5">
        {catalog.expeditions.map((exp) => {
          const expTiers = tiersList.filter((t) => !t.expeditionId || t.expeditionId === exp.id);
          const tier = expTiers.find((t) => t.id === tiers[exp.id]) ?? expTiers[0];
          if (!tier) return null; // no lodging offered for this trip right now
          const tierId = tier.id;
          const total = quoteExpedition(exp.id, tier.id, season, catalog);
          return (
            <article
              key={exp.id}
              id={`expedition-${exp.id}`}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                exp.id === highlightId ? "border-amber-400 ring-2 ring-amber-300" : "border-slate-200"
              }`}
            >
              <Photo id={tourPhoto(exp.id)} lang={lang} sizes="(min-width: 1280px) 1040px, 100vw" className="aspect-[16/9] sm:aspect-[3/1]" />
              <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <span className="text-xs font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full">
                    {tr(`${exp.days} days / ${exp.nights} nights`, `${exp.days} días / ${exp.nights} noches`)}
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 mt-2 leading-snug">{exp.name}</h2>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-700 mt-3">
                    {exp.includes.map((i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-emerald-700" aria-hidden>
                          ✓
                        </span>{" "}
                        {i}
                      </li>
                    ))}
                  </ul>
                  <details className="mt-3 group">
                    <summary className="min-h-11 text-sm font-bold text-emerald-800 cursor-pointer flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden">
                      <ChevronRight className="w-4 h-4 transition group-open:rotate-90" aria-hidden />{" "}
                      {tr("Day-by-day itinerary", "Itinerario día por día")}
                    </summary>
                    <ol className="mt-1 space-y-1.5 text-sm text-slate-700 pl-5">
                      {exp.itinerary.map((d) => (
                        <li key={d.day}>
                          <strong>
                            {tr("Day", "Día")} {d.day}:
                          </strong>{" "}
                          {d.title}
                        </li>
                      ))}
                    </ol>
                  </details>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 flex flex-col">
                  <p className="text-sm font-bold text-slate-700 mb-2">{tr("Lodging", "Alojamiento")}</p>
                  <div className="space-y-1.5">
                    {expTiers.map((t) => (
                      <label
                        key={t.id}
                        className={`flex min-h-11 items-center justify-between gap-2 text-sm rounded-xl border px-3 py-2 cursor-pointer ${
                          t.id === tierId ? "border-emerald-700 bg-emerald-50 font-bold" : "border-slate-200 bg-white"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`tier-${exp.id}`}
                            checked={t.id === tierId}
                            onChange={() => setTiers((x) => ({ ...x, [exp.id]: t.id }))}
                            className="h-4 w-4 shrink-0 accent-emerald-700"
                          />
                          {t.name}
                        </span>
                        <span className="text-emerald-700 whitespace-nowrap">
                          {t.surchargeCents ? `+${formatUSDWhole(t.surchargeCents)}` : tr("included", "incluido")}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-auto pt-4">
                    <p className="text-xs font-bold text-slate-600">
                      {tr(`Price for a ${formatShortDate(date, lang)} start`, `Precio iniciando el ${formatShortDate(date, lang)}`)}
                      {seasonNote}
                    </p>
                    <p className="text-2xl font-extrabold text-emerald-700">{formatUSDWhole(total)}</p>
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
                      className="w-full mt-3 min-h-12 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold px-3 rounded-xl text-[15px] flex items-center justify-center gap-2 transition"
                    >
                      <PlusCircle className="w-4 h-4" aria-hidden /> {tr("Add trip", "Agregar viaje")} · {formatUSDWhole(total)}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
