"use client";

import { ArrowDown, Clock, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { localizedHref } from "@/lib/publicLang";
import { tourPathFor } from "@/lib/tours/slugs";
import { EN_ROUTE_UPGRADE_CENTS, REGION_NAMES, perPersonTierCents, type Region } from "@/lib/catalog";
import { regionName } from "@/lib/catalogEs";
import { usePublicLang, useT } from "./PublicLangContext";
import { seasonForYmd } from "@/lib/catalogModel";
import { useCatalog } from "./CatalogContext";
import { addDays, formatShortDate } from "@/lib/dates";
import { newItemId, type CartItem } from "@/lib/cart";
import { tourPhoto } from "@/lib/photos";
import { applyMultiplier, formatUSDWhole, quoteDayTour } from "@/lib/pricing";
import { BuilderHero, HERO_BUTTON, HERO_CONTROL, HeroField, type BuilderTabs } from "./BuilderHero";
import { Photo } from "./site/Photo";

export function DayToursView({
  today,
  onAdd,
  tabs,
  initialRegion,
  initialDate,
  highlightId,
}: {
  today: string;
  onAdd: (item: CartItem) => void;
  /** Transfers / Day tours switch, shown in the hero form on phones. */
  tabs: BuilderTabs;
  /** From a "while you're there" suggestion after adding a ride. */
  initialRegion?: Region;
  initialDate?: string;
  highlightId?: string;
}) {
  const lang = usePublicLang();
  const tr = useT();
  const travellers = (n: number) => tr(`${n} traveller${n > 1 ? "s" : ""}`, `${n} viajero${n > 1 ? "s" : ""}`);
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
  const seasonNote = season.multiplierBps !== 10000 ? ` · ${season.name}` : "";

  return (
    <section className="space-y-5">
      <BuilderHero
        tabs={tabs}
        title={tr("Private day tours in Costa Rica", "Tours privados de un día en Costa Rica")}
        text={tr(
          "Only your group, with a local naturalist guide. Guide, entrances and lunch included.",
          "Solo su grupo, con un guía naturalista local. Guía, entradas y almuerzo incluidos.",
        )}
      >
        <div className="grid grid-cols-2 gap-x-2 gap-y-2.5">
          <HeroField label={tr("Region", "Región")} className="col-span-2">
            <select value={region} onChange={(e) => setRegion(e.target.value as Region | "ALL")} className={HERO_CONTROL}>
              <option value="ALL">{tr("All regions", "Todas las regiones")}</option>
              {(Object.keys(REGION_NAMES) as Region[]).map((r) => (
                <option key={r} value={r}>
                  {regionName(r, lang)}
                </option>
              ))}
            </select>
          </HeroField>
          <HeroField label={tr("Tour date", "Fecha del tour")}>
            <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className={HERO_CONTROL} />
          </HeroField>
          <HeroField label={tr("Travellers", "Viajeros")}>
            <select value={pax} onChange={(e) => setPax(Number(e.target.value))} className={HERO_CONTROL}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {travellers(n)}
                </option>
              ))}
            </select>
          </HeroField>
        </div>
        <button
          type="button"
          onClick={() => document.getElementById("tour-list")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className={HERO_BUTTON}
        >
          {tr("See tours & prices", "Ver tours y precios")} <ArrowDown className="h-4 w-4" aria-hidden />
        </button>
      </BuilderHero>

      <div id="tour-list" className="scroll-mt-20 space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-base font-extrabold text-slate-900">
            Smart En-Route Transfer{" "}
            <span className="font-bold text-amber-800">
              ({tr("from", "desde")} +{formatUSDWhole(fromUpgradeCents)})
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            {tr(
              "Take your luggage along: we pick you up in one town, run the tour, and drop you at your next hotel, so the tour is also your transfer.",
              "Lleve su equipaje: lo recogemos en un pueblo, hacemos el tour y lo dejamos en su siguiente hotel, así el tour también es su traslado.",
            )}
          </p>
        </div>

        {tours.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            {tr("No tours in this region yet. Choose another region.", "Aún no hay tours en esta región. Elija otra región.")}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {tours.map((t) => {
            const upgrade = Boolean(upgrades[t.id]);
            const total = quoteDayTour(t.id, upgrade, pax, season, catalog);
            const perPerson = applyMultiplier(perPersonTierCents(t.perPerson, pax), season.multiplierBps);
            const upgradeCents = t.enRouteUpgradeCents ?? EN_ROUTE_UPGRADE_CENTS;
            return (
              <article
                key={t.id}
                id={`tour-${t.id}`}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col ${
                  t.id === highlightId ? "border-amber-400 ring-2 ring-amber-300" : "border-slate-200"
                }`}
              >
                <Photo id={tourPhoto(t.id)} lang={lang} sizes="(min-width: 768px) 520px, 100vw" className="aspect-[16/9]" />
                <div className="p-4 sm:p-5 flex flex-1 flex-col">
                  <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full self-start">
                    {regionName(t.region, lang)}
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900 mt-2 leading-snug">{t.name}</h3>
                  {tourPathFor(t.id) && (
                    <Link
                      href={localizedHref(tourPathFor(t.id)!, lang)}
                      className="mt-1 inline-flex min-h-11 items-center self-start text-sm font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                    >
                      {tr("Tour details: the day, what to bring, FAQ", "Detalles del tour: el día, qué llevar, preguntas")}
                    </Link>
                  )}
                  <p className="text-sm text-slate-600 mt-1 flex items-start gap-1.5">
                    <Clock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
                    {tr(
                      `${t.durationHours} hours · private · guide, entrances & lunch included`,
                      `${String(t.durationHours).replace(".", ",")} horas · privado · guía, entradas y almuerzo incluidos`,
                    )}
                  </p>
                  <ul className="text-sm text-slate-700 mt-3 space-y-1">
                    {t.highlights.map((h) => (
                      <li key={h} className="flex gap-2">
                        <span className="text-emerald-700" aria-hidden>
                          •
                        </span>{" "}
                        {h}
                      </li>
                    ))}
                  </ul>

                  <label className="mt-4 flex min-h-11 items-start gap-2.5 text-sm bg-amber-50 border border-amber-200 rounded-xl p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={upgrade}
                      onChange={(e) => setUpgrades((u) => ({ ...u, [t.id]: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-700"
                    />
                    <span>
                      <strong>Smart En-Route Transfer</strong> (+{formatUSDWhole(upgradeCents)})
                      <span className="block text-slate-700">
                        {tr(
                          "End the day at your next hotel instead of going back.",
                          "Termine el día en su siguiente hotel en lugar de regresar.",
                        )}
                      </span>
                    </span>
                  </label>

                  <div className="mt-auto pt-4">
                    <p className="text-xs font-bold text-slate-600">
                      {tr(`Price for ${formatShortDate(date, lang)}`, `Precio para el ${formatShortDate(date, lang)}`)}
                      {seasonNote}
                    </p>
                    <p className="text-2xl font-extrabold text-emerald-700">{formatUSDWhole(total)}</p>
                    <p className="text-xs font-semibold text-slate-600">
                      {formatUSDWhole(perPerson)} {tr("per person", "por persona")} · {travellers(pax)}
                      {pax < 4 ? tr(` · cheaper per person from 4`, ` · más económico por persona desde 4`) : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        onAdd({
                          kind: "day_tour",
                          id: newItemId(),
                          title: t.name,
                          detail: tr(
                            `${t.durationHours}h private tour, ${pax} traveller${pax > 1 ? "s" : ""}${upgrade ? " + Smart En-Route Transfer" : ""}`,
                            `Tour privado de ${String(t.durationHours).replace(".", ",")} h, ${travellers(pax)}${upgrade ? " + Smart En-Route Transfer" : ""}`,
                          ),
                          date,
                          totalCents: total,
                          spec: { kind: "day_tour", tourId: t.id, upgrade, pax },
                        })
                      }
                      className="mt-3 w-full min-h-12 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold px-4 rounded-xl text-[15px] flex items-center justify-center gap-2 transition"
                    >
                      <PlusCircle className="w-4 h-4" aria-hidden /> {tr("Add tour", "Agregar tour")} · {formatUSDWhole(total)}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
