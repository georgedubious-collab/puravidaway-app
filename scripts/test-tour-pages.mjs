/**
 * Checks on the day tour pages' data (src/lib/tours/).
 *
 *   npm run test:tours        (Node 22.15+; Node runs the TypeScript directly)
 *
 * Importing src/lib/tours/index.ts already runs its build-time check (assertTourPages: every
 * built-in tour has a page and every page a tour, unique slugs, dated answer, 5–8 FAQs, no
 * forbidden words, no clock times, every token filled). On top of that, this script checks:
 * English and Spanish both present and different, the Spanish addresses, prices filled from the
 * catalog (never typed), the booking link, the links from the travel guides, and that a broken
 * page really is rejected.
 */
import { registerHooks } from "node:module";

// The app's files import each other without ".ts"; add it for Node.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const tours = await import("../src/lib/tours/index.ts");
const { TOUR_PAGES, assertTourPages, fillTourText, tourTexts, tourPath, tourBookHref, activeTourPages, regionGuide, regionHubs, tourPerPersonCents } = tours;
const { BUILT_IN_CATALOG } = await import("../src/lib/catalogModel.ts");
const { DAY_TOURS } = await import("../src/lib/catalog.ts");
const { esPathOf, localizedHref } = await import("../src/lib/publicLang.ts");
const { ARTICLES, knownPaths, splitLinks } = await import("../src/lib/blog/index.ts");

let passed = 0;
const failures = [];
const ok = (name, cond, detail = "") => {
  if (cond) passed++;
  else failures.push(`${name}${detail ? `: ${detail}` : ""}`);
};

ok("one page per built-in tour", TOUR_PAGES.length === DAY_TOURS.length, `${TOUR_PAGES.length} vs ${DAY_TOURS.length}`);
ok("index has a Spanish address", esPathOf("/tours") === "/es/tours");
ok("all pages active with the built-in catalog", activeTourPages(BUILT_IN_CATALOG).length === TOUR_PAGES.length);

const paths = knownPaths();
for (const p of TOUR_PAGES) {
  const name = `tour ${p.id}`;
  const tour = BUILT_IN_CATALOG.dayTours.find((t) => t.id === p.id);
  ok(`${name}: Spanish address`, esPathOf(tourPath(p)) === `/es/tours/${p.slug}`);
  ok(`${name}: travel guides may link to it`, paths.has(tourPath(p)));
  ok(`${name}: booking link keeps its query in Spanish`, localizedHref(tourBookHref(p.id), "es") === `/es?tab=tours&tour=${p.id}`);
  ok(`${name}: region has a destination guide and towns`, Boolean(regionGuide(tour.region)) && regionHubs(tour.region).length > 0);
  ok(`${name}: 5–8 FAQs`, p.faqs.length >= 5 && p.faqs.length <= 8, String(p.faqs.length));
  for (const t of tourTexts(p)) {
    ok(`${name}: ${t.where} differs between languages`, t.en !== t.es, t.en.slice(0, 60));
    for (const lang of ["en", "es"]) {
      const filled = fillTourText(t[lang], p, tour, BUILT_IN_CATALOG, lang);
      ok(`${name}: ${lang} ${t.where} filled`, !/[{}]/.test(filled));
      // Prices come from the catalog through tokens: a "$" typed in the text would go stale.
      ok(`${name}: ${lang} ${t.where} has no typed price`, !/\$\s?\d/.test(t[lang]));
    }
  }
  // The answer quotes the live per-person prices.
  const answer = fillTourText(p.answer.en, p, tour, BUILT_IN_CATALOG, "en");
  const pp4 = `$${Math.round(tourPerPersonCents(tour, 4, 10000) / 100)}`;
  ok(`${name}: answer quotes the 4+ price ${pp4}`, answer.includes(pp4), answer);
  ok(`${name}: answer is dated`, /checked (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}\)\.$/.test(answer), answer);
  const answerEs = fillTourText(p.answer.es, p, tour, BUILT_IN_CATALOG, "es");
  ok(`${name}: Spanish answer is dated`, /revisado en [a-z]+ de \d{4}\)\.$/.test(answerEs), answerEs);
}

// The travel guides link to tour pages, never to a tour page that doesn't exist.
const tourLinks = new Set();
for (const a of ARTICLES) {
  for (const s of a.sections)
    for (const b of s.blocks)
      if (b.kind === "p" || b.kind === "note") for (const lang of ["en", "es"]) for (const part of splitLinks(b.text[lang])) if ("href" in part && part.href.startsWith("/tours")) tourLinks.add(part.href);
}
ok("travel guides link to at least three tour pages", tourLinks.size >= 3, [...tourLinks].join(", "));
for (const h of tourLinks) ok(`travel guide link ${h} has a page`, TOUR_PAGES.some((p) => tourPath(p) === h));

// A broken page must be rejected by the build-time check.
const broken = (patch) => {
  try {
    assertTourPages([{ ...TOUR_PAGES[0], ...patch }, ...TOUR_PAGES.slice(1)], BUILT_IN_CATALOG);
    return false;
  } catch {
    return true;
  }
};
ok("accepts the real pages", !broken({}));
ok("rejects an unknown token", broken({ intro: { en: "{pp9}", es: "{pp9}" } }));
ok("rejects an unknown town", broken({ start: { en: "{time:SJO>Nowhere}", es: "x" } }));
ok("rejects an undated answer", broken({ answer: { en: "No date", es: "Sin fecha" } }));
ok("rejects too few FAQs", broken({ faqs: TOUR_PAGES[0].faqs.slice(0, 2) }));
ok("rejects forbidden words", broken({ intro: { en: "Open 24/7", es: "Abierto" } }));
ok("rejects multi-day wording", broken({ intro: { en: "A multi-day trip", es: "Un viaje" } }));
ok("rejects a clock time", broken({ intro: { en: "Pickup at 7:30", es: "Recogida" } }));
ok("rejects a clock time (am/pm)", broken({ intro: { en: "Pickup at 7 am", es: "Recogida" } }));
ok("rejects a page for a tour not in the catalog", broken({ id: "nope" }));
ok("rejects a duplicate slug", (() => {
  try {
    assertTourPages([...TOUR_PAGES, { ...TOUR_PAGES[1], id: TOUR_PAGES[0].id }], BUILT_IN_CATALOG);
    return false;
  } catch {
    return true;
  }
})());
ok("rejects a missing page for a built-in tour", (() => {
  try {
    assertTourPages(TOUR_PAGES.slice(1), BUILT_IN_CATALOG);
    return false;
  } catch {
    return true;
  }
})());

if (failures.length) {
  console.error(`✗ ${failures.length} failed, ${passed} passed`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✓ tours: ${passed} checks passed (${TOUR_PAGES.length} tour pages)`);
