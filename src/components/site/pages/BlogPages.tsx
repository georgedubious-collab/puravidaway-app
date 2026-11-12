import { ArrowRight, BookOpen, Info } from "lucide-react";
import Link from "next/link";
import { orSimilar, routeMinutes, type HubId } from "@/lib/catalog";
import { localizeCatalog } from "@/lib/catalogEs";
import type { CatalogData } from "@/lib/catalogModel";
import { getCatalog } from "@/lib/catalogSource";
import { ARTICLES, BLOG_PATH, articlePath, fillArticleText, splitLinks, type Article, type ArticleBlock } from "@/lib/blog";
import { AIRPORT_GUIDES, AIRPORTS_PATH, DESTINATION_GUIDES, DESTINATIONS_PATH, airportPath, destinationPath } from "@/lib/guides";
import { photoEntry } from "@/lib/photos";
import { formatDuration, formatUSD, perPersonCents } from "@/lib/pricing";
import { localizedHref, t, type PublicLang } from "@/lib/publicLang";
import { ROUTE_PAGES, TRANSFERS_PATH, builderHref, routeLabel, routePath } from "@/lib/routePages";
import { pageVehiclePrices } from "@/lib/routePrices";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { TOURS_PATH } from "@/lib/tours/slugs";
import { GuideCta, GuideFaqs, LinkPills, OtherWays, RidesTable, formatGuideDate, shortHubName } from "../GuideParts";
import { JsonLd } from "../JsonLd";
import { Photo } from "../Photo";
import { PageSection, PublicPage } from "../PublicPage";

/**
 * Travel guides (the blog): the article page and the index, in English and Spanish.
 * Text comes from src/lib/blog (data, both languages side by side); every number is a
 * token filled from the catalog, like the destination guides and route pages.
 */

const LINK_CLASS = "font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800";

/** A filled text with its [links](/path) (localized) and **bold** parts. */
function Rich({ text, lang }: { text: string; lang: PublicLang }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        "href" in part ? (
          <Link key={i} href={localizedHref(part.href, lang)} className={LINK_CLASS}>
            {part.label}
          </Link>
        ) : (
          part.text.split(/\*\*(.+?)\*\*/g).map((s, j) => (j % 2 === 1 ? <strong key={`${i}-${j}`} className="font-extrabold text-slate-900">{s}</strong> : s))
        ),
      )}
    </>
  );
}

/** Every vehicle class on one ride: travellers, luggage, price per vehicle and per traveller. */
function ClassesTable({ origin, destination, catalog, lang }: { origin: HubId; destination: HubId; catalog: CatalogData; lang: PublicLang }) {
  const rows = pageVehiclePrices(origin, destination, catalog);
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          {t(lang, "Private transfer prices by vehicle class", "Precios de traslado privado por categoría de vehículo")}: {shortHubName(origin, lang)} → {shortHubName(destination, lang)}
        </caption>
        <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
          <tr>
            <th scope="col" className="px-3 sm:px-4 py-3">{t(lang, "Vehicle", "Vehículo")}</th>
            <th scope="col" className="px-3 sm:px-4 py-3">{t(lang, "Fits", "Capacidad")}</th>
            <th scope="col" className="px-3 sm:px-4 py-3">{t(lang, "Whole vehicle", "Vehículo completo")}</th>
            <th scope="col" className="px-3 sm:px-4 py-3">{t(lang, "Per traveller, full", "Por viajero, lleno")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map(({ vehicle: v, cents }) => (
            <tr key={v.id} className="align-top">
              <th scope="row" className="px-3 sm:px-4 py-3 font-normal">
                <span className="block font-bold text-slate-900">{v.name}</span>
                {orSimilar(v.exampleModels, lang) && <span className="block text-xs text-slate-600">{orSimilar(v.exampleModels, lang)}</span>}
              </th>
              <td className="px-3 sm:px-4 py-3 text-slate-700">
                {v.maxPax} {t(lang, "travellers", "viajeros")}
                <span className="block text-xs text-slate-600">{v.luggage}</span>
              </td>
              <td className="px-3 sm:px-4 py-3 font-extrabold text-emerald-700 whitespace-nowrap">{formatUSD(cents)}</td>
              <td className="px-3 sm:px-4 py-3 text-slate-700 whitespace-nowrap">{formatUSD(perPersonCents(cents, v.maxPax))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Short column label of one of our towns for the drive-time grid. */
const GRID_NAMES: Record<HubId, [string, string]> = {
  SJO: ["SJO airport", "Aeropuerto SJO"],
  LIR: ["LIR airport", "Aeropuerto LIR"],
  Arenal: ["La Fortuna", "La Fortuna"],
  ManuelAntonio: ["Manuel Antonio", "Manuel Antonio"],
  Monteverde: ["Monteverde", "Monteverde"],
  Sierpe: ["Sierpe dock", "Muelle de Sierpe"],
  DrakeBay: ["Drake Bay", "Bahía Drake"],
  PuertoViejo: ["Puerto Viejo", "Puerto Viejo"],
  Tamarindo: ["Tamarindo", "Tamarindo"],
};
function gridName(id: HubId, lang: PublicLang): string {
  const [en, es] = GRID_NAMES[id];
  return t(lang, en, es);
}

/** Door-to-door drive times between the listed towns (ROUTE_MINUTES), as a real HTML table. */
function DriveMatrix({ hubs, lang }: { hubs: HubId[]; lang: PublicLang }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{t(lang, "Door-to-door drive times between Costa Rica's main destinations", "Tiempos de viaje de puerta a puerta entre los principales destinos de Costa Rica")}</caption>
        <thead className="bg-slate-50 text-xs font-bold text-slate-600">
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-slate-50 px-3 py-3">{t(lang, "From ↓ / To →", "Desde ↓ / Hasta →")}</th>
            {hubs.map((h) => (
              <th key={h} scope="col" className="px-3 py-3 align-bottom">{gridName(h, lang)}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {hubs.map((from) => (
            <tr key={from}>
              <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2.5 font-bold leading-snug text-slate-900 min-w-[7rem] shadow-[1px_0_0_#e2e8f0]">{gridName(from, lang)}</th>
              {hubs.map((to) => (
                <td key={to} className={`px-3 py-2.5 whitespace-nowrap ${from === to ? "bg-slate-50 text-slate-400" : "text-slate-800"}`}>
                  {from === to ? "—" : formatDuration(routeMinutes(from, to), lang)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Block({ block, article, catalog, lang }: { block: ArticleBlock; article: Article; catalog: CatalogData; lang: PublicLang }) {
  const fill = (text: string) => fillArticleText(text, article, catalog, lang);
  switch (block.kind) {
    case "p":
      return (
        <p className="max-w-3xl leading-relaxed text-slate-700">
          <Rich text={fill(block.text[lang])} lang={lang} />
        </p>
      );
    case "list":
      return (
        <ul className="max-w-3xl list-disc space-y-2 pl-5 leading-relaxed text-slate-700 marker:text-emerald-600">
          {block.items.map((x, i) => (
            <li key={i}>
              <Rich text={fill(x[lang])} lang={lang} />
            </li>
          ))}
        </ul>
      );
    case "note":
      return (
        <div className="max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-5 leading-relaxed text-slate-700">
          <p className="flex gap-2">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <span>
              <Rich text={fill(block.text[lang])} lang={lang} />
            </span>
          </p>
        </div>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">{fill(block.caption[lang])}</caption>
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
              <tr>
                {block.head.map((h, i) => (
                  <th key={i} scope="col" className="px-3 sm:px-4 py-3">{fill(h[lang])}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {block.rows.map((row, i) => (
                <tr key={i} className="align-top">
                  {row.map((cell, j) =>
                    j === 0 ? (
                      <th key={j} scope="row" className="px-3 sm:px-4 py-3 font-bold text-slate-900">
                        <Rich text={fill(cell[lang])} lang={lang} />
                      </th>
                    ) : (
                      <td key={j} className="px-3 sm:px-4 py-3 text-slate-700">
                        <Rich text={fill(cell[lang])} lang={lang} />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "rides":
      return (
        <RidesTable
          lang={lang}
          catalog={catalog}
          caption={fill(block.caption[lang])}
          updated={article.updated}
          rows={block.rows.map((r) => ({ origin: r.origin, destination: r.destination, note: r.note && { en: fill(r.note.en), es: fill(r.note.es) } }))}
        />
      );
    case "classes":
      return <ClassesTable origin={block.origin} destination={block.destination} catalog={catalog} lang={lang} />;
    case "matrix":
      return <DriveMatrix hubs={block.hubs} lang={lang} />;
    case "ways":
      return <OtherWays lang={lang} ways={block.ways.map((w) => ({ kind: w.kind, text: { en: fill(w.text.en), es: fill(w.text.es) } }))} />;
  }
}

/** Label of an internal page for the "related" pills. */
function pathLabel(path: string, lang: PublicLang): string {
  const route = ROUTE_PAGES.find((p) => routePath(p) === path);
  if (route) return routeLabel(route, lang);
  const dest = DESTINATION_GUIDES.find((g) => destinationPath(g) === path);
  if (dest) return t(lang, `${dest.name.en} guide`, `Guía de ${dest.name.es}`);
  const airport = AIRPORT_GUIDES.find((g) => airportPath(g) === path);
  if (airport) return t(lang, `${airport.name.en} arrival guide`, `Guía de llegada: ${airport.name.es}`);
  const art = ARTICLES.find((a) => articlePath(a) === path);
  if (art) return art.short[lang];
  const fixed: Record<string, [string, string]> = {
    [TRANSFERS_PATH]: ["All routes and prices", "Todas las rutas y precios"],
    [DESTINATIONS_PATH]: ["All destination guides", "Todas las guías de destinos"],
    [AIRPORTS_PATH]: ["SJO or LIR: airport guides", "SJO o LIR: guías de aeropuertos"],
    [BLOG_PATH]: ["All travel guides", "Todas las guías de viaje"],
    "/?tab=tours": ["Private day tours", "Tours privados de un día"],
    [TOURS_PATH]: ["Private day tours", "Tours privados de un día"],
    "/?tab=transfers": ["Trip builder", "Planificador de viajes"],
  };
  const f = fixed[path];
  return f ? t(lang, f[0], f[1]) : path;
}

export function articleMeta(a: Article, lang: PublicLang) {
  return { title: a.title[lang], description: a.metaDescription[lang] };
}

function PublishedLine({ a, lang }: { a: Article; lang: PublicLang }) {
  return (
    <p className="mt-3 text-sm text-slate-600">
      {t(lang, "By the", "Por el equipo de")} {t(lang, `${SITE_NAME} team`, SITE_NAME)} · {t(lang, "Published", "Publicado el")}{" "}
      <time dateTime={a.published}>{formatGuideDate(a.published, lang)}</time>
      {a.updated !== a.published && (
        <>
          {" "}· {t(lang, "Updated", "Actualizado el")} <time dateTime={a.updated}>{formatGuideDate(a.updated, lang)}</time>
        </>
      )}
    </p>
  );
}

export async function ArticlePage({ article: a, lang }: { article: Article; lang: PublicLang }) {
  const catalog = localizeCatalog(await getCatalog(), lang);
  const fill = (text: string) => fillArticleText(text, a, catalog, lang);
  const path = localizedHref(articlePath(a), lang);
  const bookHref = localizedHref(builderHref(a.book.origin, a.book.destination), lang);
  const others = ARTICLES.filter((x) => x.slug !== a.slug);
  const photo = a.photo ? photoEntry(a.photo) : null;
  const image = photo?.file ? `${SITE_URL}/photos/${photo.file}` : `${SITE_URL}/opengraph-image`;

  return (
    <PublicPage
      lang={lang}
      current="guides"
      path={path}
      crumbs={[{ label: t(lang, "Travel guides", "Guías de viaje"), href: localizedHref(BLOG_PATH, lang) }, { label: a.short[lang] }]}
      eyebrow={t(lang, "Travel guide", "Guía de viaje")}
      title={a.title[lang]}
      photo={a.photo}
      lead={
        <>
          <p>
            <Rich text={fill(a.answer[lang])} lang={lang} />
          </p>
          <PublishedLine a={a} lang={lang} />
          <Link
            href={bookHref}
            className="mt-5 min-h-12 w-full sm:w-auto px-6 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-base font-extrabold text-slate-950"
          >
            {t(lang, "See price & book a transfer", "Ver precio y reservar un traslado")} <ArrowRight className="w-4 h-4 shrink-0" aria-hidden />
          </Link>
        </>
      }
    >
      <nav aria-label={t(lang, "On this page", "En esta página")} className="max-w-6xl mx-auto px-4 sm:px-6 pt-10">
        <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{t(lang, "On this page", "En esta página")}</p>
          <ol className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 text-sm">
            {[...a.sections.map((s) => ({ id: s.id, title: fill(s.title[lang]) })), { id: "faq", title: t(lang, "Questions travellers ask", "Preguntas frecuentes") }].map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}-h`} className="inline-flex min-h-8 items-center font-semibold text-slate-800 hover:text-emerald-700 hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      {a.sections.map((s, i) => (
        <PageSection key={s.id} id={s.id} tone={i % 2 === 1 ? "white" : "plain"} title={fill(s.title[lang])}>
          <div className="space-y-5">
            {s.blocks.map((b, j) => (
              <Block key={j} block={b} article={a} catalog={catalog} lang={lang} />
            ))}
          </div>
        </PageSection>
      ))}

      <PageSection id="faq" tone={a.sections.length % 2 === 1 ? "white" : "plain"} title={t(lang, "Questions travellers ask", "Preguntas frecuentes")}>
        <GuideFaqs
          lang={lang}
          catalog={catalog}
          faqs={a.faqs.map((f) => ({ q: { en: fill(f.q.en), es: fill(f.q.es) }, a: { en: fill(f.a.en), es: fill(f.a.es) } }))}
        />
      </PageSection>

      <GuideCta
        lang={lang}
        title={t(lang, "Book your private transfer", "Reserve su traslado privado")}
        text={t(
          lang,
          "Pick your date, travellers, vehicle and stops. You see the fixed price for the whole vehicle before you send your request, and nothing is charged when you send it.",
          "Elija su fecha, viajeros, vehículo y paradas. Verá el precio fijo por el vehículo completo antes de enviar su solicitud, y no se cobra nada al enviarla.",
        )}
        href={bookHref}
        button={t(lang, "See price & book", "Ver precio y reservar")}
      />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 space-y-8">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">{t(lang, "Related pages", "Páginas relacionadas")}</h2>
          <div className="mt-4">
            <LinkPills links={[...a.related, TOURS_PATH].map((p) => ({ label: pathLabel(p, lang), href: localizedHref(p, lang) }))} />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">{t(lang, "More travel guides", "Más guías de viaje")}</h2>
          <div className="mt-4">
            <LinkPills links={others.map((x) => ({ label: x.short[lang], href: localizedHref(articlePath(x), lang) }))} />
          </div>
        </div>
      </section>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "@id": `${SITE_URL}${path}#article`,
          mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}${path}` },
          url: `${SITE_URL}${path}`,
          headline: a.title[lang],
          description: a.metaDescription[lang],
          inLanguage: lang,
          datePublished: a.published,
          dateModified: a.updated,
          image,
          author: { "@id": `${SITE_URL}/#organization` },
          publisher: { "@id": `${SITE_URL}/#organization` },
          isPartOf: { "@type": "Blog", name: t(lang, `${SITE_NAME} travel guides`, `Guías de viaje de ${SITE_NAME}`), url: `${SITE_URL}${localizedHref(BLOG_PATH, lang)}` },
          about: { "@type": "Country", name: "Costa Rica" },
        }}
      />
    </PublicPage>
  );
}

// ───────────────────────── Index ─────────────────────────

export function blogIndexMeta(lang: PublicLang) {
  return {
    title: t(lang, "Costa Rica travel guides: getting around", "Guías de viaje de Costa Rica: cómo moverse"),
    description: t(
      lang,
      "Practical Costa Rica travel guides: how to get from San José to La Fortuna, Manuel Antonio and Monteverde, Liberia airport to Tamarindo, which airport to fly into and a drive-times table, with real drive times and prices.",
      "Guías prácticas de viaje por Costa Rica: cómo ir de San José a La Fortuna, Manuel Antonio y Monteverde, del aeropuerto de Liberia a Tamarindo, a qué aeropuerto llegar y una tabla de tiempos de viaje, con tiempos y precios reales.",
    ),
  };
}

export async function BlogIndexPage({ lang }: { lang: PublicLang }) {
  const catalog = localizeCatalog(await getCatalog(), lang);
  const meta = blogIndexMeta(lang);
  const path = localizedHref(BLOG_PATH, lang);
  return (
    <PublicPage
      lang={lang}
      current="guides"
      path={path}
      crumbs={[{ label: t(lang, "Travel guides", "Guías de viaje") }]}
      eyebrow={t(lang, "Travel guides", "Guías de viaje")}
      title={meta.title}
      lead={
        <p>
          {t(
            lang,
            "Honest, practical guides to getting around Costa Rica: every way to make the main trips, how long they really take on mountain roads, and what each option costs. Drive times and prices come from the same catalog as our trip builder.",
            "Guías honestas y prácticas para moverse por Costa Rica: todas las formas de hacer los viajes principales, cuánto tardan de verdad por carreteras de montaña y cuánto cuesta cada opción. Los tiempos y precios vienen del mismo catálogo que nuestro planificador de viajes.",
          )}
        </p>
      }
    >
      <PageSection id="articles" title={t(lang, "Read a guide", "Lea una guía")}>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ARTICLES.map((a) => (
            <li key={a.slug}>
              <Link
                href={localizedHref(articlePath(a), lang)}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-emerald-500 hover:shadow-md transition"
              >
                {a.photo ? (
                  <Photo id={a.photo} lang={lang} decorative sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" className="aspect-[16/9]" />
                ) : (
                  <span className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-100 text-emerald-700" aria-hidden>
                    <BookOpen className="h-12 w-12" />
                  </span>
                )}
                <span className="flex flex-1 flex-col p-4">
                  <span className="text-lg font-extrabold leading-snug text-slate-900">{a.title[lang]}</span>
                  <span className="mt-1 text-sm text-slate-600">{a.teaser[lang]}</span>
                  <span className="mt-2 text-xs text-slate-600">
                    {t(lang, "Updated", "Actualizada el")} <time dateTime={a.updated}>{formatGuideDate(a.updated, lang)}</time>
                  </span>
                  <span className="mt-auto pt-3 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 group-hover:text-emerald-800">
                    {t(lang, "Read the guide", "Leer la guía")} <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection
        id="popular-rides"
        tone="white"
        title={t(lang, "Popular rides at a glance", "Traslados frecuentes de un vistazo")}
        intro={t(
          lang,
          "Door-to-door drive times and private transfer prices for the trips these guides cover. Each ride links to its route page.",
          "Tiempos de viaje de puerta a puerta y precios de traslado privado de los viajes que cubren estas guías. Cada traslado lleva a su página de ruta.",
        )}
      >
        <RidesTable
          lang={lang}
          catalog={catalog}
          updated={ARTICLES.reduce((d, a) => (a.updated > d ? a.updated : d), ARTICLES[0].updated)}
          caption={t(lang, "Popular rides: drive times and prices", "Traslados frecuentes: tiempos y precios")}
          rows={ARTICLES.filter((a) => a.about.hubPairs.length > 0).map((a) => ({ origin: a.book.origin, destination: a.book.destination }))}
        />
      </PageSection>

      <PageSection id="more" title={t(lang, "More ways to plan", "Más formas de planificar")}>
        <LinkPills
          links={[
            { label: t(lang, "Destination guides", "Guías de destinos"), href: localizedHref(DESTINATIONS_PATH, lang) },
            { label: t(lang, "Airport guides", "Guías de aeropuertos"), href: localizedHref(AIRPORTS_PATH, lang) },
            { label: t(lang, "All routes and prices", "Todas las rutas y precios"), href: localizedHref(TRANSFERS_PATH, lang) },
            { label: t(lang, "Private day tours", "Tours privados de un día"), href: localizedHref(TOURS_PATH, lang) },
          ]}
        />
      </PageSection>

      <GuideCta
        lang={lang}
        title={t(lang, "Ready to book a ride?", "¿Listo para reservar un traslado?")}
        text={t(
          lang,
          "Type any hotel, town or address in Costa Rica in the trip builder and see the fixed price for the whole vehicle before you book.",
          "Escriba cualquier hotel, pueblo o dirección de Costa Rica en el planificador de viajes y vea el precio fijo por el vehículo completo antes de reservar.",
        )}
        href={localizedHref("/?tab=transfers", lang)}
        button={t(lang, "Open the trip builder", "Abrir el planificador de viajes")}
      />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          "@id": `${SITE_URL}${path}`,
          url: `${SITE_URL}${path}`,
          name: meta.title,
          description: meta.description,
          inLanguage: lang,
          publisher: { "@id": `${SITE_URL}/#organization` },
          blogPost: ARTICLES.map((a) => ({
            "@type": "BlogPosting",
            headline: a.title[lang],
            url: `${SITE_URL}${localizedHref(articlePath(a), lang)}`,
            datePublished: a.published,
            dateModified: a.updated,
          })),
        }}
      />
    </PublicPage>
  );
}

