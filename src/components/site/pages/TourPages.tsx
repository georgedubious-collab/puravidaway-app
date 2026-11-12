import { ArrowRight, Backpack, Check, Clock, Info, MapPin, Minus, Users } from "lucide-react";
import Link from "next/link";
import { REGION_NAMES, type DayTour, type Region } from "@/lib/catalog";
import { localizeCatalog, regionName } from "@/lib/catalogEs";
import type { CatalogData } from "@/lib/catalogModel";
import { getCatalog } from "@/lib/catalogSource";
import { BLOG_PATH, articlePath, articlesForHubs } from "@/lib/blog";
import { airportGuideForHub, airportPath, destinationPath } from "@/lib/guides";
import { photoEntry, tourPhoto } from "@/lib/photos";
import { formatBpsPercent, formatUSDWhole, quoteDayTour, applyMultiplier } from "@/lib/pricing";
import { localizedHref, t, type PublicLang } from "@/lib/publicLang";
import { ROUTE_PAGES, TRANSFERS_PATH } from "@/lib/routePages";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import {
  TOURS_PATH,
  TOURS_UPDATED,
  activeTourPages,
  catalogTour,
  defaultSeasonBps,
  fillTourText,
  regionGuide,
  regionHubs,
  tourBookHref,
  tourHours,
  tourPageFor,
  tourPath,
  tourPerPersonCents,
  type TourPage,
} from "@/lib/tours";
import { guarantees } from "@/lib/trust";
import { GuideCta, GuideFaqs, LinkPills, RidesTable, formatGuideDate } from "../GuideParts";
import { JsonLd } from "../JsonLd";
import { Photo } from "../Photo";
import { PageSection, PublicPage } from "../PublicPage";

/**
 * Day tour pages (/tours/<slug>, Spanish /es/tours/<slug>) and their index (/tours, /es/tours).
 * Text comes from src/lib/tours (data, both languages side by side); the tour's name, region,
 * length, highlights and every price come from the live catalog, so the pages always match the
 * booking app (src/components/DayToursView.tsx) and /admin/pricing.
 */

const AMBER_BUTTON =
  "min-h-12 px-6 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-base font-extrabold text-slate-950";
const TEXT_LINK = "font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800";
const CARD = "rounded-2xl border border-slate-200 bg-white p-5";

/** The booking app's one-line summary of a tour ("8 hours · private · guide, entrances & lunch included"). */
function tourLine(tour: Pick<DayTour, "durationHours">, lang: PublicLang): string {
  return t(lang, `${tourHours(tour.durationHours, lang)} · private · guide, entrances & lunch included`, `${tourHours(tour.durationHours, lang)} · privado · guía, entradas y almuerzo incluidos`);
}

/** Group sizes of the per-person tiers: the number used for the price, and its label. */
function tiers(lang: PublicLang): { pax: number; label: string }[] {
  return [
    { pax: 1, label: t(lang, "1 traveller", "1 viajero") },
    { pax: 2, label: t(lang, "2 or 3 travellers", "2 o 3 viajeros") },
    { pax: 4, label: t(lang, "4 or more travellers", "4 viajeros o más") },
  ];
}

const lower = (s: string) => s.replace(/^./, (c) => c.toLowerCase());

// ───────────────────────── One tour ─────────────────────────

export function tourMeta(page: TourPage, catalog: CatalogData, lang: PublicLang) {
  const tour = catalogTour(page, localizeCatalog(catalog, lang));
  const name = tour?.name ?? page.slug;
  return { title: t(lang, `${name}: private day tour`, `${name}: tour privado`), description: page.metaDescription[lang] };
}

export async function TourDetailPage({ page, lang }: { page: TourPage; lang: PublicLang }) {
  const catalog = localizeCatalog(await getCatalog(), lang);
  // The page is only routed when its tour is active (see the route files); this keeps TypeScript sure of it.
  const tour = catalogTour(page, catalog)!;
  const fill = (text: string) => fillTourText(text, page, tour, catalog, lang);
  const path = localizedHref(tourPath(page), lang);
  const bookHref = localizedHref(tourBookHref(tour.id), lang);
  const bps = defaultSeasonBps(catalog);
  const defaultSeason = catalog.seasons.find((s) => s.isDefault);
  const seasons = [...catalog.seasons].sort((a, b) => a.priority - b.priority);
  const fromCents = tourPerPersonCents(tour, 4, bps);
  const soloCents = tourPerPersonCents(tour, 1, bps);
  const enRouteCents = applyMultiplier(tour.enRouteUpgradeCents ?? 0, bps);
  const region = regionName(tour.region, lang);
  const guide = regionGuide(tour.region);
  const hubs = regionHubs(tour.region);
  const photo = tourPhoto(tour.id);
  const cashFee = formatBpsPercent(catalog.cashFeeBps);

  // Getting there: every route page that ends in the tour's region (airports first, like the route index).
  const rides = ROUTE_PAGES.filter((p) => hubs.includes(p.destination)).map((p) => ({ origin: p.origin, destination: p.destination }));
  const airports = (guide?.rides ?? [])
    .map((r) => airportGuideForHub(r.origin))
    .filter((a, i, all): a is NonNullable<typeof a> => Boolean(a) && all.indexOf(a) === i);
  const otherTours = activeTourPages(catalog).filter((p) => p.id !== page.id);
  const articles = articlesForHubs(hubs);
  const season = defaultSeason ?? seasons[0];

  return (
    <>
      <PublicPage
        lang={lang}
        current="tours"
        path={path}
        crumbs={[{ label: t(lang, "Day tours", "Tours de un día"), href: localizedHref(TOURS_PATH, lang) }, { label: tour.name }]}
        eyebrow={`${t(lang, "Private day tour", "Tour privado de un día")} · ${region}`}
        title={tour.name}
        photo={photo}
        photoCaption
        lead={
          <>
            {/* The dated direct answer (docs/SEO.md §6). */}
            <p>{fill(page.answer[lang])}</p>
            <p className="mt-3 text-sm text-slate-600">
              {t(lang, "Updated", "Actualizado el")} <time dateTime={page.updated}>{formatGuideDate(page.updated, lang)}</time>
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-base">
              <Fact icon={<Clock className="w-4 h-4" />} label={t(lang, "Length", "Duración")} value={tourHours(tour.durationHours, lang)} />
              <Fact icon={<MapPin className="w-4 h-4" />} label={t(lang, "Region", "Región")} value={region} />
              <Fact icon={<Users className="w-4 h-4" />} label={t(lang, "Who", "Quiénes")} value={t(lang, "Only your group", "Solo su grupo")} />
              <Fact
                icon={<Check className="w-4 h-4" />}
                label={t(lang, "Per person from", "Por persona desde")}
                value={formatUSDWhole(fromCents)}
              />
            </dl>
            <Link href={bookHref} className={`mt-5 w-full sm:w-auto ${AMBER_BUTTON}`}>
              {t(lang, "See price for your date & book", "Ver precio para su fecha y reservar")} <ArrowRight className="w-4 h-4 shrink-0" aria-hidden />
            </Link>
            <p className="mt-2 text-sm text-slate-600">
              {t(lang, "Opens the trip builder with this tour picked out. Nothing is charged when you send your request.", "Abre el planificador de viajes con este tour ya seleccionado. No se cobra nada al enviar su solicitud.")}
            </p>
          </>
        }
      >
        {/* Price per person by group size and season: the catalog's tiers × the database's season multipliers. */}
        <PageSection
          id="prices"
          tone="white"
          title={t(lang, "Price per person by group size", "Precio por persona según el tamaño del grupo")}
          intro={t(
            lang,
            "Tours are priced per person: the more of you, the less each pays. The guide, entrances and lunch are included.",
            "Los tours se cobran por persona: entre más sean, menos paga cada uno. El guía, las entradas y el almuerzo están incluidos.",
          )}
        >
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t(lang, `Price per person of the ${tour.name} tour, by group size and season`, `Precio por persona del tour ${tour.name}, según el grupo y la temporada`)}</caption>
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-3 sm:px-4 py-3">
                    {t(lang, "Group", "Grupo")}
                  </th>
                  {seasons.map((s) => (
                    <th key={s.id} scope="col" className="px-3 sm:px-4 py-3">
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {tiers(lang).map((row) => (
                  <tr key={row.pax}>
                    <th scope="row" className="px-3 sm:px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                      {row.label}
                    </th>
                    {seasons.map((s) => (
                      <td key={s.id} className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        <span className="font-extrabold text-emerald-700">{formatUSDWhole(tourPerPersonCents(tour, row.pax, s.multiplierBps))}</span>
                        <span className="block text-xs text-slate-600">{t(lang, "per person", "por persona")}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 max-w-3xl space-y-2 text-sm leading-relaxed text-slate-600">
            <p>
              {t(
                lang,
                `For example, in ${lower(season.name)}: 2 travellers pay ${formatUSDWhole(quoteDayTour(tour.id, false, 2, season, catalog))} in total, and 4 travellers ${formatUSDWhole(quoteDayTour(tour.id, false, 4, season, catalog))}. These are the same prices as in our trip builder; the exact price for your date is shown before you book.`,
                `Por ejemplo, en ${lower(season.name)}: 2 viajeros pagan ${formatUSDWhole(quoteDayTour(tour.id, false, 2, season, catalog))} en total, y 4 viajeros ${formatUSDWhole(quoteDayTour(tour.id, false, 4, season, catalog))}. Son los mismos precios de nuestro planificador de viajes; el precio exacto para su fecha aparece antes de reservar.`,
              )}
            </p>
            <p>
              {t(
                lang,
                `Pay online in full (we send a secure link once your trip is confirmed), or pay your driver in cash with a ${cashFee} cash booking fee.`,
                `Pague en línea el total (le enviamos un enlace seguro cuando su viaje esté confirmado), o pague a su conductor en efectivo con un cargo por reserva en efectivo del ${cashFee}.`,
              )}
            </p>
          </div>
        </PageSection>

        <PageSection id="the-day" title={t(lang, "What the day includes", "Qué incluye el día")} intro={<p>{fill(page.intro[lang])}</p>}>
          <ul className="grid gap-4 md:grid-cols-2">
            {page.parts.map((x) => (
              <li key={x.title.en} className={CARD}>
                <h3 className="flex items-start gap-2 font-extrabold text-slate-900">
                  <Check className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600" aria-hidden /> {x.title[lang]}
                </h3>
                <p className="mt-1.5 leading-relaxed text-slate-600">{fill(x.text[lang])}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">
            {page.partsNote ? `${fill(page.partsNote[lang])} ` : ""}
            {t(
              lang,
              "We don't publish clock times: the start time depends on where you stay and on the day's conditions, and our team confirms it with you.",
              "No publicamos horarios: la hora de inicio depende de dónde se hospede y de las condiciones del día, y nuestro equipo se la confirma.",
            )}
          </p>
        </PageSection>

        <PageSection id="included" tone="white" title={t(lang, "Included and not included", "Qué incluye y qué no")}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className={CARD}>
              <h3 className="font-extrabold text-slate-900">{t(lang, "Included", "Incluido")}</h3>
              <ul className="mt-3 space-y-2 text-slate-700">
                {[
                  t(lang, "A private vehicle with only your group", "Un vehículo privado solo para su grupo"),
                  t(lang, "A local naturalist guide", "Un guía naturalista local"),
                  t(lang, "Entrances", "Entradas"),
                  t(lang, "Lunch", "Almuerzo"),
                  ...tour.highlights,
                ].map((x) => (
                  <li key={x} className="flex gap-2">
                    <Check className="w-4 h-4 mt-1 shrink-0 text-emerald-600" aria-hidden /> {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className={CARD}>
              <h3 className="font-extrabold text-slate-900">{t(lang, "Not included", "No incluido")}</h3>
              <ul className="mt-3 space-y-2 text-slate-700">
                {[
                  t(lang, "Rides from other towns: book a private transfer (below)", "Traslados desde otros pueblos: reserve un traslado privado (más abajo)"),
                  t(
                    lang,
                    `The Smart En-Route Transfer, optional: +${formatUSDWhole(enRouteCents)} per group`,
                    `El Smart En-Route Transfer, opcional: +${formatUSDWhole(enRouteCents)} por grupo`,
                  ),
                  t(lang, `The ${cashFee} cash booking fee, only if you pay your driver in cash`, `El cargo del ${cashFee} por reserva en efectivo, solo si le paga al conductor en efectivo`),
                ].map((x) => (
                  <li key={x} className="flex gap-2">
                    <Minus className="w-4 h-4 mt-1 shrink-0 text-slate-500" aria-hidden /> {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </PageSection>

        <PageSection id="bring" title={t(lang, "What to bring", "Qué llevar")}>
          <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
            {page.bring.map((x) => (
              <li key={x.en} className="flex gap-3 text-slate-700">
                <Backpack className="w-5 h-5 mt-0.5 shrink-0 text-emerald-700" aria-hidden /> {x[lang]}
              </li>
            ))}
          </ul>
        </PageSection>

        {/* The upgrade, worded as in the booking app and /faq. */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
            <h2 className="text-xl font-extrabold text-slate-900">
              Smart En-Route Transfer{" "}
              <span className="font-bold text-amber-800">
                (+{formatUSDWhole(enRouteCents)} {t(lang, "per group", "por grupo")})
              </span>
            </h2>
            <p className="mt-2 max-w-3xl leading-relaxed text-slate-700">
              {t(
                lang,
                "Take your luggage along: we pick you up in one town, run the tour, and drop you at your next hotel, so the tour is also your transfer. Tick it when you add the tour in the trip builder.",
                "Lleve su equipaje: lo recogemos en un pueblo, hacemos el tour y lo dejamos en su siguiente hotel, así el tour también es su traslado. Márquelo al agregar el tour en el planificador de viajes.",
              )}
            </p>
          </div>
        </section>

        <PageSection
          id="getting-there"
          tone="white"
          title={t(lang, "Where the tour starts and how to get there", "Dónde empieza el tour y cómo llegar")}
          intro={<p>{fill(page.start[lang])}</p>}
        >
          {rides.length > 0 && (
            <RidesTable
              lang={lang}
              catalog={catalog}
              rows={rides}
              updated={page.updated}
              caption={t(lang, `Private transfers to ${region}: drive times and prices`, `Traslados privados a ${region}: tiempos de viaje y precios`)}
            />
          )}
          <div className="mt-5">
            <LinkPills
              links={[
                ...(guide ? [{ label: t(lang, `${guide.name.en} travel guide`, `Guía de viaje de ${guide.name.es}`), href: localizedHref(destinationPath(guide), lang) }] : []),
                ...airports.map((a) => ({ label: t(lang, `${a.name.en} arrival guide`, `Guía de llegada: ${a.name.es}`), href: localizedHref(airportPath(a), lang) })),
                { label: t(lang, "All transfer routes and prices", "Todas las rutas de traslado y precios"), href: localizedHref(TRANSFERS_PATH, lang) },
              ]}
            />
          </div>
        </PageSection>

        {page.goodToKnow.length > 0 && (
          <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
                <Info className="w-5 h-5 text-amber-600" aria-hidden /> {t(lang, "Good to know before you go", "Conviene saberlo antes de ir")}
              </h2>
              <ul className="mt-2 space-y-2 leading-relaxed text-slate-700">
                {page.goodToKnow.map((g) => (
                  <li key={g.en}>{fill(g[lang])}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* The guarantees that apply to a tour (the "driver waits with your bags" one is about ride stops). */}
            {guarantees(catalog.cashFeeBps, lang)
              .filter((_, i) => i !== 2)
              .map((g) => (
                <div key={g.title}>
                  <h3 className="font-extrabold text-slate-900">{g.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {g.text}
                    {g.href && (
                      <>
                        {" "}
                        <Link href={g.href} className={TEXT_LINK}>
                          {t(lang, "Read the cancellation policy", "Leer la política de cancelación")}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              ))}
          </div>
        </section>

        <PageSection id="faq" tone="white" title={t(lang, "Questions travellers ask", "Preguntas frecuentes")}>
          <GuideFaqs lang={lang} catalog={catalog} faqs={page.faqs.map((f) => ({ q: { en: fill(f.q[lang]), es: fill(f.q[lang]) }, a: { en: fill(f.a[lang]), es: fill(f.a[lang]) } }))} />
        </PageSection>

        <GuideCta
          lang={lang}
          title={t(lang, "Book this tour", "Reserve este tour")}
          text={t(
            lang,
            "Pick your date and number of travellers, and add the Smart En-Route Transfer if the day should end at your next hotel. You see the full price before you send your request, and nothing is charged when you send it.",
            "Elija su fecha y el número de viajeros, y agregue el Smart En-Route Transfer si el día debe terminar en su siguiente hotel. Verá el precio total antes de enviar su solicitud, y no se cobra nada al enviarla.",
          )}
          href={bookHref}
          button={t(lang, "See price & book", "Ver precio y reservar")}
        />

        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 space-y-8">
          {otherTours.length > 0 && (
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">{t(lang, "Our other private day tours", "Nuestros otros tours privados de un día")}</h2>
              <div className="mt-4">
                <LinkPills
                  links={[
                    ...otherTours.map((p) => ({ label: catalogTour(p, catalog)!.name, href: localizedHref(tourPath(p), lang) })),
                    { label: t(lang, "All day tours", "Todos los tours de un día"), href: localizedHref(TOURS_PATH, lang) },
                  ]}
                />
              </div>
            </div>
          )}
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">{t(lang, "Travel guides", "Guías de viaje")}</h2>
            <div className="mt-4">
              <LinkPills
                links={[
                  ...articles.map((a) => ({ label: a.short[lang], href: localizedHref(articlePath(a), lang) })),
                  { label: t(lang, "All travel guides", "Todas las guías de viaje"), href: localizedHref(BLOG_PATH, lang) },
                ]}
              />
            </div>
          </div>
        </section>

        {/* A tourist trip with its live per-person price range: no ratings, no reviews, no availability claims. */}
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": `${SITE_URL}${path}`,
            url: `${SITE_URL}${path}`,
            name: tour.name,
            description: page.metaDescription[lang],
            inLanguage: lang,
            dateModified: page.updated,
            isPartOf: { "@type": "WebSite", name: SITE_NAME, url: `${SITE_URL}/` },
            publisher: { "@id": `${SITE_URL}/#organization` },
            mainEntity: {
              "@type": "TouristTrip",
              name: tour.name,
              description: fill(page.answer[lang]),
              url: `${SITE_URL}${path}`,
              ...(photoEntry(photo).file ? { image: `${SITE_URL}/photos/${photoEntry(photo).file}` } : {}),
              provider: { "@id": `${SITE_URL}/#organization` },
              itinerary: {
                "@type": "ItemList",
                itemListOrder: "https://schema.org/ItemListUnordered",
                itemListElement: tour.highlights.map((h, i) => ({ "@type": "ListItem", position: i + 1, name: h })),
              },
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "USD",
                lowPrice: (fromCents / 100).toFixed(2),
                highPrice: (soloCents / 100).toFixed(2),
                offerCount: 3,
                description: t(
                  lang,
                  `Price per person by group size (1, 2–3, 4 or more travellers), ${lower(season.name)}`,
                  `Precio por persona según el grupo (1, 2–3, 4 o más viajeros), ${lower(season.name)}`,
                ),
                url: `${SITE_URL}${bookHref}`,
              },
            },
          }}
        />
      </PublicPage>

      {/* Phones: the price and the way to book stay in view. */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm text-slate-700">
            <span className="block truncate text-xs font-semibold text-slate-600">{region}</span>
            {t(lang, "From", "Desde")} <strong className="text-base font-extrabold text-emerald-700">{formatUSDWhole(fromCents)}</strong> {t(lang, "per person", "por persona")}
          </p>
          <Link
            href={bookHref}
            className="min-h-12 shrink-0 px-4 inline-flex items-center justify-center rounded-xl bg-amber-400 hover:bg-amber-300 font-extrabold text-slate-950 whitespace-nowrap"
          >
            {t(lang, "Book", "Reservar")}
          </Link>
        </div>
      </div>
      <div className="lg:hidden h-20" aria-hidden />
    </>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <span className="text-emerald-700" aria-hidden>
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-1 text-sm sm:text-base font-extrabold text-slate-900">{value}</dd>
    </div>
  );
}

// ───────────────────────── Index of all day tours ─────────────────────────

export function toursIndexMeta(lang: PublicLang) {
  return {
    title: t(lang, "Private day tours in Costa Rica", "Tours privados de un día en Costa Rica"),
    description: t(
      lang,
      "Private 1-day tours in La Fortuna / Arenal, Manuel Antonio, the Osa Peninsula and Monteverde: only your group, a local naturalist guide, entrances and lunch included. Price per person by group size.",
      "Tours privados de un día en La Fortuna / Arenal, Manuel Antonio, la península de Osa y Monteverde: solo su grupo, guía naturalista local, entradas y almuerzo incluidos. Precio por persona según el grupo.",
    ),
  };
}

export async function ToursIndexPage({ lang }: { lang: PublicLang }) {
  const catalog = localizeCatalog(await getCatalog(), lang);
  const meta = toursIndexMeta(lang);
  const path = localizedHref(TOURS_PATH, lang);
  const bps = defaultSeasonBps(catalog);
  const tours = catalog.dayTours;
  const minCents = tours.length ? Math.min(...tours.map((x) => tourPerPersonCents(x, 4, bps))) : 0;
  const minEnRoute = tours.length ? Math.min(...tours.map((x) => applyMultiplier(x.enRouteUpgradeCents ?? 0, bps))) : 0;
  const regions = (Object.keys(REGION_NAMES) as Region[]).map((r) => ({ region: r, tours: tours.filter((x) => x.region === r) })).filter((g) => g.tours.length > 0);
  const updated = activeTourPages(catalog).reduce((latest, p) => (p.updated > latest ? p.updated : latest), TOURS_UPDATED);
  const when = formatGuideDate(updated, lang);

  return (
    <PublicPage
      lang={lang}
      current="tours"
      path={path}
      crumbs={[{ label: t(lang, "Day tours", "Tours de un día") }]}
      eyebrow={t(lang, "Private day tours", "Tours privados de un día")}
      title={meta.title}
      lead={
        <>
          <p>
            {t(
              lang,
              `${tours.length} private 1-day tours in ${regions.length} regions, for your group only, with a local naturalist guide, entrances and lunch included. Priced per person, from ${formatUSDWhole(minCents)} each for 4 or more travellers (green season).`,
              `${tours.length} tours privados de un día en ${regions.length} regiones, solo para su grupo, con guía naturalista local, entradas y almuerzo incluidos. Precio por persona, desde ${formatUSDWhole(minCents)} cada uno para 4 viajeros o más (temporada verde).`,
            )}
          </p>
          <p className="mt-3 text-sm text-slate-600">
            {t(lang, "Updated", "Actualizado el")} <time dateTime={updated}>{when}</time>
          </p>
          <Link href={localizedHref("/?tab=tours", lang)} className={`mt-5 w-full sm:w-auto ${AMBER_BUTTON}`}>
            {t(lang, "See prices for your date", "Ver precios para su fecha")} <ArrowRight className="w-4 h-4 shrink-0" aria-hidden />
          </Link>
        </>
      }
    >
      {regions.map((g, i) => {
        const guide = regionGuide(g.region);
        return (
          <PageSection key={g.region} id={`region-${g.region.toLowerCase()}`} tone={i % 2 === 1 ? "white" : "plain"} title={regionName(g.region, lang)}>
            <ul className="grid gap-5 md:grid-cols-2">
              {g.tours.map((x) => (
                <TourCard key={x.id} tour={x} lang={lang} bps={bps} />
              ))}
            </ul>
            {guide && (
              <p className="mt-4 text-sm">
                <Link href={localizedHref(destinationPath(guide), lang)} className={TEXT_LINK}>
                  {t(lang, `${guide.name.en} travel guide: getting there, best time, where to stay`, `Guía de viaje de ${guide.name.es}: cómo llegar, mejor época, dónde hospedarse`)}
                </Link>
              </p>
            )}
          </PageSection>
        );
      })}

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
          <h2 className="text-xl font-extrabold text-slate-900">
            Smart En-Route Transfer{" "}
            <span className="font-bold text-amber-800">
              ({t(lang, "from", "desde")} +{formatUSDWhole(minEnRoute)} {t(lang, "per group", "por grupo")})
            </span>
          </h2>
          <p className="mt-2 max-w-3xl leading-relaxed text-slate-700">
            {t(
              lang,
              "Take your luggage along: we pick you up in one town, run the tour, and drop you at your next hotel, so the tour is also your transfer.",
              "Lleve su equipaje: lo recogemos en un pueblo, hacemos el tour y lo dejamos en su siguiente hotel, así el tour también es su traslado.",
            )}
          </p>
        </div>
      </section>

      <PageSection id="how" title={t(lang, "How booking a tour works", "Cómo se reserva un tour")}>
        <ul className="grid max-w-4xl gap-3 text-slate-700">
          {[
            t(lang, "Pick the tour, the date and the number of travellers: the price per person and the total are shown at once.", "Elija el tour, la fecha y el número de viajeros: el precio por persona y el total aparecen de inmediato."),
            t(lang, "Add rides to the same trip if you need to get there, and send your request. Nothing is charged when you send it.", "Agregue traslados al mismo viaje si los necesita para llegar, y envíe su solicitud. No se cobra nada al enviarla."),
            t(
              lang,
              `Pay online in full (we send a secure link once your trip is confirmed), or pay your driver in cash with a ${formatBpsPercent(catalog.cashFeeBps)} cash booking fee.`,
              `Pague en línea el total (le enviamos un enlace seguro cuando su viaje esté confirmado), o pague a su conductor en efectivo con un cargo por reserva en efectivo del ${formatBpsPercent(catalog.cashFeeBps)}.`,
            ),
          ].map((x) => (
            <li key={x} className="flex gap-2">
              <Check className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600" aria-hidden /> {x}
            </li>
          ))}
          <li className="flex gap-2">
            <Check className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600" aria-hidden />
            <span>
              {t(lang, "Free cancellation up to 24 hours before pickup.", "Cancelación gratuita hasta 24 horas antes de la recogida.")}{" "}
              <Link href={localizedHref("/cancellation", lang)} className={TEXT_LINK}>
                {t(lang, "Read the cancellation policy", "Leer la política de cancelación")}
              </Link>
            </span>
          </li>
        </ul>
      </PageSection>

      <GuideCta
        lang={lang}
        title={t(lang, "Getting to the tour?", "¿Cómo llegar al tour?")}
        text={t(
          lang,
          "Every tour is in one region. Our private transfers get you there door to door, with a fixed price for the whole vehicle shown before you book.",
          "Cada tour es en una región. Nuestros traslados privados lo llevan de puerta a puerta, con un precio fijo por el vehículo completo que ve antes de reservar.",
        )}
        href={localizedHref(TRANSFERS_PATH, lang)}
        button={t(lang, "Transfer routes and prices", "Rutas de traslado y precios")}
      />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: meta.title,
          itemListElement: tours.map((x, i) => {
            const page = tourPageFor(x.id);
            return {
              "@type": "ListItem",
              position: i + 1,
              name: x.name,
              url: `${SITE_URL}${localizedHref(page ? tourPath(page) : tourBookHref(x.id), lang)}`,
            };
          }),
        }}
      />
    </PublicPage>
  );
}

/** A tour on the index: photo, region, length, from-price, and a link to its page (or the booking app if it has none yet). */
function TourCard({ tour, lang, bps }: { tour: DayTour; lang: PublicLang; bps: number }) {
  const page = tourPageFor(tour.id);
  const href = localizedHref(page ? tourPath(page) : tourBookHref(tour.id), lang);
  return (
    <li className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <Photo id={tourPhoto(tour.id)} lang={lang} sizes="(min-width: 768px) 540px, 100vw" className="aspect-[16/9]" />
      <div className="p-5 flex flex-1 flex-col">
        <span className="self-start rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-extrabold text-emerald-800">{regionName(tour.region, lang)}</span>
        <h3 className="mt-2 text-lg font-extrabold leading-snug text-slate-900">
          <Link href={href} className="hover:text-emerald-700 hover:underline">
            {tour.name}
          </Link>
        </h3>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
          <Clock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> {tourLine(tour, lang)}
        </p>
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          {tour.highlights.map((h) => (
            <li key={h} className="flex gap-2">
              <span className="text-emerald-700" aria-hidden>
                •
              </span>
              {h}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-4">
          <p className="text-sm text-slate-700">
            {t(lang, "From", "Desde")} <strong className="text-xl font-extrabold text-emerald-700">{formatUSDWhole(tourPerPersonCents(tour, 4, bps))}</strong>{" "}
            {t(lang, "per person (4 or more, green season)", "por persona (4 o más, temporada verde)")}
          </p>
          <p className="text-xs text-slate-600">
            {t(lang, "1 traveller", "1 viajero")}: {formatUSDWhole(tourPerPersonCents(tour, 1, bps))} · {t(lang, "2 or 3", "2 o 3")}: {formatUSDWhole(tourPerPersonCents(tour, 2, bps))}{" "}
            {t(lang, "each", "cada uno")}
          </p>
          <Link href={href} className={`mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm ${TEXT_LINK}`}>
            {page ? t(lang, "See the tour", "Ver el tour") : t(lang, "See price & book", "Ver precio y reservar")} <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </li>
  );
}
