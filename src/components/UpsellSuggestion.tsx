"use client";

import { Sparkles, X } from "lucide-react";
import { EXPEDITION_REGIONS, HUB_REGION, HUBS, REGION_NAMES, type HubId } from "@/lib/catalog";
import { seasonForYmd, type CatalogData } from "@/lib/catalogModel";
import { applyMultiplier, formatUSD, quoteExpedition } from "@/lib/pricing";
import { perPersonTierCents } from "@/lib/catalog";
import { useCatalog } from "./CatalogContext";

export interface Suggestion {
  kind: "day_tour" | "expedition";
  id: string;
  name: string;
  /** Season-adjusted "from" price for the suggested date. */
  fromCents: number;
}

/**
 * Up to two tours / expeditions in the drop-off's region (HUB_REGION). When the
 * region has none, the first day tour and expedition in the catalog order (the
 * order set in /admin, i.e. the ones the team features first).
 */
export function suggestionsFor(destination: HubId, date: string, catalog: CatalogData): Suggestion[] {
  const region = HUB_REGION[destination];
  const season = seasonForYmd(date, catalog);
  const tour = (id: string): Suggestion => ({
    kind: "day_tour",
    id,
    name: catalog.dayTours.find((t) => t.id === id)!.name,
    fromCents: applyMultiplier(perPersonTierCents(catalog.dayTours.find((t) => t.id === id)!.perPerson, 4), season.multiplierBps),
  });
  const exp = (id: string): Suggestion | null => {
    const tier = catalog.lodgingTiers.find((t) => !t.expeditionId || t.expeditionId === id);
    if (!tier) return null;
    return {
      kind: "expedition",
      id,
      name: catalog.expeditions.find((e) => e.id === id)!.name,
      fromCents: quoteExpedition(id, tier.id, season, catalog),
    };
  };
  const tours = region ? catalog.dayTours.filter((t) => t.region === region) : [];
  const exps = region ? catalog.expeditions.filter((e) => EXPEDITION_REGIONS[e.id]?.includes(region)) : [];
  const picked = [...tours.map((t) => tour(t.id)), ...exps.map((e) => exp(e.id))].filter((x): x is Suggestion => Boolean(x));
  if (picked.length) {
    // One of each kind when both exist, so the two suggestions aren't near-duplicates.
    const firstTour = picked.find((p) => p.kind === "day_tour");
    const firstExp = picked.find((p) => p.kind === "expedition");
    return firstTour && firstExp ? [firstTour, firstExp] : picked.slice(0, 2);
  }
  return [
    catalog.dayTours[0] ? tour(catalog.dayTours[0].id) : null,
    catalog.expeditions[0] ? exp(catalog.expeditions[0].id) : null,
  ].filter((x): x is Suggestion => Boolean(x));
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
  const list = suggestionsFor(destination, date, catalog);
  if (!list.length) return null;
  const region = HUB_REGION[destination];
  const place = region ? REGION_NAMES[region] : HUBS.find((h) => h.id === destination)?.name;
  return (
    <aside
      aria-label="Suggestions for your trip"
      className="relative rounded-2xl border border-amber-300 bg-amber-50 p-4 pr-12"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hide suggestions"
        className="absolute right-1.5 top-1.5 inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
        <Sparkles className="h-4 w-4 text-amber-600" aria-hidden />
        {region ? `While you're in ${place}` : "Make the most of your trip"}
      </p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {list.map((s) => (
          <li key={`${s.kind}-${s.id}`}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="w-full min-h-11 rounded-xl border border-amber-200 bg-white px-3 py-2 text-left hover:border-emerald-500"
            >
              <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                {s.kind === "day_tour" ? `1-day tour · from ${formatUSD(s.fromCents)} per person` : `Expedition · from ${formatUSD(s.fromCents)}`}
              </span>
              <span className="block text-sm font-bold text-slate-900">{s.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
