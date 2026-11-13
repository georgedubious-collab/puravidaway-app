/**
 * Checks on the route pages' data (src/lib/routePages.ts and src/lib/routes/).
 *
 *   npm run test:routes        (Node 22.15+; Node runs the TypeScript directly)
 *
 * Every route page must have: a drive time and a road distance in the catalog, a price
 * (from the same function the pages use, here with the built-in catalog), text in English
 * and Spanish whose tokens all fill, 5–8 FAQs, and no intro or FAQ set shared with another
 * page. Text may only mention a sightseeing stop that the trip builder offers on that ride.
 * Importing routePages.ts already runs its own build-time check (missing time or km throws).
 */
import { registerHooks } from "node:module";

// The app's files import each other without ".ts"; add it for Node.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const { ROUTE_PAGES, CORRIDORS, routePageFor } = await import("../src/lib/routePages.ts");
const { routeMinutes, routeKm, stopFitsRoute, SIGHTSEEING_STOPS, DRAKE_BOAT_MINUTES } = await import("../src/lib/catalog.ts");
const { BUILT_IN_CATALOG } = await import("../src/lib/catalogModel.ts");
const { fillGuideText } = await import("../src/lib/guides/index.ts");
const { pageFromPrices, pageVehiclePrices } = await import("../src/lib/routePrices.ts");

let passed = 0;
const failures = [];
const ok = (name, cond, detail = "") => {
  if (cond) passed++;
  else failures.push(`${name}${detail ? `: ${detail}` : ""}`);
};

// Slugs that were live before 2026-11-11 must keep working.
const LEGACY = [
  "sjo-airport-to-manuel-antonio",
  "sjo-airport-to-la-fortuna-arenal",
  "sjo-airport-to-monteverde",
  "liberia-airport-to-tamarindo",
  "sjo-airport-to-tamarindo",
  "sjo-airport-to-puerto-viejo",
  "la-fortuna-to-monteverde",
  "la-fortuna-to-manuel-antonio",
  "sjo-airport-to-sierpe-drake-bay",
];
for (const slug of LEGACY) ok(`legacy slug ${slug}`, ROUTE_PAGES.some((p) => p.slug === slug));
ok("legacy slugs come first (home page and footer use the first six)", LEGACY.every((slug, i) => ROUTE_PAGES[i]?.slug === slug));
ok("two pages per corridor", ROUTE_PAGES.length === CORRIDORS.length * 2, `${ROUTE_PAGES.length} pages, ${CORRIDORS.length} corridors`);

// A stop named in a page's own text must be offered on that ride by the trip builder.
const STOP_WORDS = {
  tarcoles: /crocodile|cocodrilo/i,
  carara: /Carara|macaw|lapas/i,
  poas: /Poás/i,
  rioceleste: /Río Celeste/i,
  sloth: /sloth trail|sloth and wildlife trail|sendero de perezosos/i,
};
const FORBIDDEN = /24\/7|Jorge|Travel Planner|Familia M[aá]gica|Daytrip/i;

const seenLead = new Map();
const seenFaqSet = new Map();
for (const p of ROUTE_PAGES) {
  const name = p.slug;
  const boat = p.origin === "DrakeBay" || p.destination === "DrakeBay";
  ok(`${name}: drive time`, routeMinutes(p.origin, p.destination) - (boat ? DRAKE_BOAT_MINUTES : 0) > 0);
  ok(`${name}: road distance`, routeKm(p.origin, p.destination) > 0);
  const price = pageFromPrices(p.origin, p.destination, BUILT_IN_CATALOG);
  ok(`${name}: price source`, Number.isInteger(price.fromCents) && price.fromCents > 0, String(price.fromCents));
  const classes = pageVehiclePrices(p.origin, p.destination, BUILT_IN_CATALOG);
  ok(`${name}: vehicle classes`, classes.length > 0 && classes.every((c) => c.cents >= price.fromCents));
  ok(`${name}: reverse page exists`, Boolean(routePageFor(p.destination, p.origin)));
  ok(`${name}: 5 to 8 FAQs`, p.faqs.length >= 5 && p.faqs.length <= 8, String(p.faqs.length));

  for (const lang of ["en", "es"]) {
    const texts = [
      p.title[lang],
      p.metaDescription[lang],
      p.answer[lang],
      p.lead[lang],
      p.road[lang],
      p.stopsNote?.[lang] ?? "",
      p.pickupPlace[lang],
      p.dropoffPlace[lang],
      ...p.ways.map((w) => w.text[lang]),
      ...p.faqs.flatMap((f) => [f.q[lang], f.a[lang]]),
    ];
    let filled = [];
    try {
      filled = texts.map((x) => fillGuideText(x, BUILT_IN_CATALOG, lang));
      passed++;
    } catch (e) {
      failures.push(`${name} (${lang}): ${e.message}`);
    }
    ok(`${name} (${lang}): no unfilled token`, filled.every((x) => !/[{}]/.test(x)), filled.find((x) => /[{}]/.test(x)));
    ok(`${name} (${lang}): no forbidden wording`, filled.every((x) => !FORBIDDEN.test(x)), filled.find((x) => FORBIDDEN.test(x)));
    ok(`${name} (${lang}): meta description length`, p.metaDescription[lang].length <= 330, String(p.metaDescription[lang].length));

    // Stops mentioned in the text that belongs to this pair and direction (not the town blocks).
    const own = [p.metaDescription[lang], p.lead[lang], p.road[lang], ...p.faqs.slice(0, 4).flatMap((f) => [f.q[lang], f.a[lang]])].join(" ");
    for (const stop of SIGHTSEEING_STOPS) {
      const word = STOP_WORDS[stop.id];
      if (word && word.test(own)) ok(`${name} (${lang}): mentions ${stop.id}, which the builder offers`, stopFitsRoute(stop, p.origin, p.destination));
    }

    const leadKey = `${lang}:${p.lead[lang]}`;
    ok(`${name} (${lang}): intro not shared`, !seenLead.has(leadKey), seenLead.get(leadKey));
    seenLead.set(leadKey, name);
    const faqKey = `${lang}:${p.faqs.map((f) => f.q[lang]).sort().join("|")}`;
    ok(`${name} (${lang}): FAQ set not shared`, !seenFaqSet.has(faqKey), seenFaqSet.get(faqKey));
    seenFaqSet.set(faqKey, name);
  }
  ok(`${name}: Spanish is not the English text`, p.lead.es !== p.lead.en && p.road.es !== p.road.en && p.faqs.every((f) => f.a.es !== f.a.en));
}

// Pinned route prices (docs/PRICING.md §4.5): the pages of a pinned route show the pinned
// "from" price in both directions, and removing the pin brings the formula back.
{
  const noPins = { ...BUILT_IN_CATALOG, pinnedPrices: [] };
  for (const slug of ["sjo-airport-to-puerto-jimenez", "puerto-jimenez-to-sjo-airport"]) {
    const p = ROUTE_PAGES.find((x) => x.slug === slug);
    ok(`${slug}: page exists`, Boolean(p));
    if (!p) continue;
    const pinned = pageFromPrices(p.origin, p.destination, BUILT_IN_CATALOG);
    ok(`${slug}: "from" is the pinned Economy price`, pinned.fromCents === 48900 && pinned.cheapest.id === "economy", String(pinned.fromCents));
    const table = pageVehiclePrices(p.origin, p.destination, BUILT_IN_CATALOG).map((c) => c.cents).join(",");
    ok(`${slug}: class table is the pinned prices`, table === "48900,49900,54900,58500,60500", table);
    const formula = pageFromPrices(p.origin, p.destination, noPins);
    ok(`${slug}: without the pin the formula price is back`, formula.fromCents === (p.origin === "SJO" ? 38100 : 43800), String(formula.fromCents));
  }
  const other = ROUTE_PAGES.filter((p) => !(p.origin === "PuertoJimenez" || p.destination === "PuertoJimenez"));
  ok("every other route page keeps its formula price", other.every((p) => pageFromPrices(p.origin, p.destination, BUILT_IN_CATALOG).fromCents === pageFromPrices(p.origin, p.destination, noPins).fromCents));
}

if (failures.length) {
  console.error(`Route pages: ${failures.length} failed, ${passed} passed`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`Route pages: ${passed} checks passed (${ROUTE_PAGES.length} pages, ${CORRIDORS.length} corridors)`);
