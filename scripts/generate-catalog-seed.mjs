#!/usr/bin/env node
/**
 * Writes supabase/migrations/20261014000003_seed_catalog.sql from src/lib/catalog.ts,
 * so the database starts with exactly the catalog the storefront ships with.
 *
 *   node scripts/generate-catalog-seed.mjs
 *
 * Re-run only to regenerate the initial seed. After launch, prices are edited
 * in /admin, not here.
 *
 * Later catalog changes ship as their own migrations so databases that already
 * ran this seed get them too, e.g. 20261108000011_stop_corridors.sql (stop
 * corridors for the "both ends" rule). catalog.ts already holds those values,
 * so a fresh run of this script writes them into the seed as well; the
 * committed 0003 file is left as it was applied.
 *
 * Vehicle prices: the flat base_rate was retired in 20261109000013_ride_formula.sql,
 * which adds price_factor / extra_fee / allows_stops / spanish_speaking_driver and
 * sets them for every class. The seed writes base_rate 0 (the column must exist
 * and be non-negative at that point).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "pvw-seed-"));
execFileSync(
  join(root, "node_modules/.bin/tsc"),
  ["src/lib/catalog.ts", "src/lib/pricing.ts", "--outDir", out, "--module", "commonjs",
   "--target", "es2022", "--skipLibCheck", "--esModuleInterop"],
  { cwd: root, stdio: "inherit" },
);
const require = createRequire(import.meta.url);
const cat = require(join(out, "catalog.js"));
const { easterSunday } = require(join(out, "pricing.js"));

const q = (s) => (s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const money = (cents) => (cents / 100).toFixed(2);
const arr = (xs) => (xs && xs.length ? `array[${xs.map(q).join(", ")}]::text[]` : "'{}'::text[]");
const json = (v) => `${q(JSON.stringify(v))}::jsonb`;

const lines = [
  "-- Initial catalog, generated from src/lib/catalog.ts by scripts/generate-catalog-seed.mjs.",
  "-- `on conflict do nothing` so re-running never overwrites prices edited in /admin.",
  "",
];

cat.VEHICLE_CLASSES.forEach((v, i) => lines.push(
  `insert into public.vehicle_classes (id, name, base_rate, max_pax, luggage, badge, only_for_hubs, sort_order) values (${q(v.id)}, ${q(v.name)}, 0, ${v.maxPax}, ${q(v.luggage)}, ${q(v.badge)}, ${arr(v.onlyForHubs)}, ${i}) on conflict (id) do nothing;`));
lines.push("");
cat.SIGHTSEEING_STOPS.forEach((s, i) => lines.push(
  // price is retired (20261109000021_stop_pricing.sql): the stop price is computed from duration, detour and the per-person tour price.
  `insert into public.sightseeing_stops (id, name, description, duration_min, price, detour_km, detour_min, tour_price_pp, corridors, sort_order) values (${q(s.id)}, ${q(s.name)}, ${q(s.description)}, ${s.durationMin}, 0, ${s.detourKm}, ${s.detourMin}, ${money(s.tourPerPersonCents)}, ${arr(s.corridors)}, ${i}) on conflict (id) do nothing;`));
lines.push("");
cat.DAY_TOURS.forEach((t, i) => lines.push(
  `insert into public.day_tours (id, region, name, highlights, duration_hours, price, en_route_upgrade_price, sort_order) values (${q(t.id)}, ${q(t.region)}, ${q(t.name)}, ${arr(t.highlights)}, ${t.durationHours}, ${money(t.priceCents)}, ${money(cat.EN_ROUTE_UPGRADE_CENTS)}, ${i}) on conflict (id) do nothing;`));
lines.push("");
cat.EXPEDITIONS.forEach((e, i) => lines.push(
  `insert into public.expeditions (id, name, days, nights, base_price, includes, itinerary, sort_order) values (${q(e.id)}, ${q(e.name)}, ${e.days}, ${e.nights}, ${money(e.basePriceCents)}, ${arr(e.includes)}, ${json(e.itinerary)}, ${i}) on conflict (id) do nothing;`));
lines.push("");
cat.LODGING_TIERS.forEach((l, i) => lines.push(
  `insert into public.lodging_tiers (id, name, surcharge, sort_order) values (${q(l.id)}, ${q(l.name)}, ${money(l.surchargeCents)}, ${i}) on conflict (id) do nothing;`));
lines.push("");

// Seasons mirror seasonForDate() in src/lib/pricing.ts: green by default,
// high Dec–Apr, peak Dec 20–Jan 5 and Palm Sunday → Easter Sunday.
const priority = { green: 0, high: 1, peak: 2 };
cat.SEASONS.forEach((s) => lines.push(
  `insert into public.seasons (id, name, multiplier, priority, is_default) values (${q(s.id)}, ${q(s.name)}, ${(s.multiplierBps / 10000).toFixed(2)}, ${priority[s.id] ?? 0}, ${s.id === "green"}) on conflict (id) do nothing;`));
lines.push("");
lines.push("-- Season dates for the next few travel years. Add more years from /admin.");
lines.push("insert into public.season_ranges (season_id, starts_on, ends_on, note) values");
const ranges = [];
const ymd = (d) => d.toISOString().slice(0, 10);
for (let y = 2026; y <= 2030; y++) {
  ranges.push(`('high', '${y}-12-01', '${y + 1}-04-30', 'Dry season ${y}–${String(y + 1).slice(2)}')`);
  ranges.push(`('peak', '${y}-12-20', '${y + 1}-01-05', 'Christmas & New Year ${y}–${String(y + 1).slice(2)}')`);
}
for (let y = 2027; y <= 2031; y++) {
  const e = easterSunday(y);
  const palm = new Date(e.getTime() - 7 * 86400000);
  ranges.push(`('peak', '${ymd(palm)}', '${ymd(e)}', 'Semana Santa ${y}')`);
}
lines.push(ranges.join(",\n") + ";");
lines.push("");

const file = join(root, "supabase/migrations/20261014000003_seed_catalog.sql");
writeFileSync(file, lines.join("\n"));
console.log(`Wrote ${file}`);
