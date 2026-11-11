/**
 * Checks on the travel guides' data (src/lib/blog/).
 *
 *   npm run test:blog        (Node 22.15+; Node runs the TypeScript directly)
 *
 * Importing src/lib/blog/index.ts already runs its build-time check (assertArticles: unique
 * slugs, dated answer, 5–8 FAQs, every link to an existing page, every token filled, no
 * forbidden words). On top of that, this script checks: English and Spanish both present and
 * different, a word count in range, internal links and route pages for each article, and that
 * a broken article really is rejected.
 */
import { registerHooks } from "node:module";

// The app's files import each other without ".ts"; add it for Node.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const { ARTICLES, articleTexts, assertArticles, fillArticleText, splitLinks, articlesForPair } = await import("../src/lib/blog/index.ts");
const { BUILT_IN_CATALOG } = await import("../src/lib/catalogModel.ts");
const { esPathOf } = await import("../src/lib/publicLang.ts");

let passed = 0;
const failures = [];
const ok = (name, cond, detail = "") => {
  if (cond) passed++;
  else failures.push(`${name}${detail ? `: ${detail}` : ""}`);
};

ok("at least one article", ARTICLES.length > 0);
ok("index has a Spanish address", esPathOf("/guides") === "/es/guias");

for (const a of ARTICLES) {
  const name = `article ${a.slug}`;
  ok(`${name}: Spanish address`, esPathOf(`/guides/${a.slug}`) === `/es/guias/${a.slug}`);
  const words = { en: 0, es: 0 };
  const links = new Set();
  for (const t of articleTexts(a)) {
    ok(`${name}: ${t.where} differs between languages`, t.en !== t.es || /^[\s{}A-Za-z:>—\-[\]()/]+$/.test(t.en) || t.en.length < 40, t.en.slice(0, 60));
    for (const lang of ["en", "es"]) {
      const filled = fillArticleText(t[lang], a, BUILT_IN_CATALOG, lang);
      ok(`${name}: ${lang} ${t.where} filled`, !/[{}]/.test(filled));
      words[lang] += filled.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").split(/\s+/).filter(Boolean).length;
      for (const part of splitLinks(t[lang])) if ("href" in part) links.add(part.href);
    }
  }
  ok(`${name}: 800–2,500 English words`, words.en >= 800 && words.en <= 2500, String(words.en));
  ok(`${name}: Spanish about as long as English`, words.es > words.en * 0.85, `${words.es} vs ${words.en}`);
  ok(`${name}: at least 4 internal links in the text`, links.size >= 4, String(links.size));
  ok(`${name}: links to a route page or the routes index`, [...links, ...a.related].some((h) => h.startsWith("/transfers")));
  ok(`${name}: answer starts with the date`, a.answer.en.startsWith("Updated {asof}") && a.answer.es.startsWith("Actualizado en {asof}"));
  for (const [x, y] of a.about.hubPairs) ok(`${name}: found by its ride ${x}>${y}`, articlesForPair(y, x).includes(a));
}

// A broken article must be rejected by the build-time check.
const broken = (patch) => {
  try {
    assertArticles([{ ...ARTICLES[0], ...patch }], BUILT_IN_CATALOG);
    return false;
  } catch {
    return true;
  }
};
ok("rejects an unknown token", broken({ answer: { en: "Updated {asof} {time:SJO>Nowhere}", es: "Actualizado en {asof}" } }));
ok("rejects an undated answer", broken({ answer: { en: "No date", es: "Sin fecha" } }));
ok("rejects a link to a missing page", broken({ related: ["/guides/does-not-exist"] }));
ok("rejects too few FAQs", broken({ faqs: ARTICLES[0].faqs.slice(0, 2) }));
ok("rejects forbidden words", broken({ teaser: { en: "Open 24/7", es: "Abierto" } }));

if (failures.length) {
  console.error(`✗ ${failures.length} failed, ${passed} passed`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✓ blog: ${passed} checks passed (${ARTICLES.length} articles)`);
