"use client";

import { Sparkles, X } from "lucide-react";
import { HUB_REGION, perPersonTierCents, type HubId } from "@/lib/catalog";
import { hubName, regionName } from "@/lib/catalogEs";
import { seasonForYmd, type CatalogData } from "@/lib/catalogModel";
import { applyMultiplier, formatUSD } from "@/lib/pricing";
import { useCatalog } from "./CatalogContext";
import { usePublicLang, useT } from "./PublicLangContext";

export interface Suggestion {
  kind: "day_tour";
  id: string;
  name: string;
  /** Season-adjusted "from" price for the suggested date. */
  fromCents: number;
}

/**
 * Up to two 1-day tours in the drop-off's region (HUB_REGION). When the region has none,
 * the first day tour in the catalog order (the order set in /admin, i.e. the one the team
 * features first).
 */
export function suggestionsFor(destination: HubId, date: string, catalog: CatalogData): Suggestion[] {
  const region = HUB_REGION[destination];
  const season = seasonForYmd(date, catalog);
  const tour = (t: CatalogData["dayTours"][number]): Suggestion => ({
    kind: "day_tour",
    id: t.id,
    name: t.name,
    fromCents: applyMultiplier(perPersonTierCents(t.perPerson, 4), season.multiplierBps),
  });
  const inRegion = region ? catalog.dayTours.filter((t) => t.region === region) : [];
  if (inRegion.length) return inRegion.slice(0, 2).map(tour);
  return catalog.dayTours.slice(0, 1).map(tour);
}

/** Welcome Pickups-style nudge after a ride is added. Inline and dismissible, never a modal. */
export function UpsellSuggestion({
  destination,
  date,
  onPick,
  onDismiss,
}: {
  destination: HubId;
  /** Suggested start date (the day after the ride). */
  date: string;
  onPick: (s: Suggestion) => void;
  onDismiss: () => void;
}) {
  const catalog = useCatalog();
  const lang = usePublicLang();
  const t = useT();
  const list = suggestionsFor(destination, date, catalog);
  if (!list.length) return null;
  const region = HUB_REGION[destination];
  const place = region ? regionName(region, lang) : hubName(destination, lang);
  return (
    <aside
      aria-label={t("Suggestions for your trip", "Sugerencias para su viaje")}
      className="relative rounded-2xl border border-amber-300 bg-amber-50 p-4 pr-12"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("Hide suggestions", "Ocultar sugerencias")}
        className="absolute right-1.5 top-1.5 inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
        <Sparkles className="h-4 w-4 text-amber-600" aria-hidden />
        {region
          ? t(`While you're in ${place}`, `Mientras esté en ${place}`)
          : t("Make the most of your trip", "Aproveche su viaje al máximo")}
      </p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {list.map((s) => (
          <li key={`${s.kind}-${s.id}`}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="w-full min-h-11 rounded-xl border border-amber-200 bg-white px-3 py-2 text-left hover:border-emerald-500"
            >
              <span className="block text-xs font-bold text-emerald-800">
                {t(`1-day tour · from ${formatUSD(s.fromCents)} per person`, `Tour de un día · desde ${formatUSD(s.fromCents)} por persona`)}
              </span>
              <span className="block text-sm font-bold text-slate-900">{s.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
