import { ArrowRight, Check, Clock, Luggage, Milestone, Ticket, Users } from "lucide-react";
import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { GuideCta, GuideFaqs, LinkPills, OtherWays, RidesTable, formatGuideDate, shortHubName } from "@/components/site/GuideParts";
import { JsonLd } from "@/components/site/JsonLd";
import { Photo } from "@/components/site/Photo";
import { PageSection, PublicPage } from "@/components/site/PublicPage";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { DriverStandards } from "@/components/trust/DriverStandards";
import { Reviews } from "@/components/trust/Reviews";
import { AIRPORT_HUBS, DRAKE_BOAT_MINUTES, HUB_IDS, HUB_REGION, HUBS, orSimilar, routeKm, routeMinutes, stopFitsRoute } from "@/lib/catalog";
import { entranceLabel, hubName, localizeCatalog, regionName } from "@/lib/catalogEs";
import { getCatalog } from "@/lib/catalogSource";
import { articlePath, articlesForPair } from "@/lib/blog";
import { airportGuideForHub, airportPath, destinationGuideForHub, destinationPath, fillGuideText } from "@/lib/guides";
import { nightSentence } from "@/lib/nightPremium";
import { bilingualMetadata } from "@/lib/pageMeta";
import { drivePhoto, routePhoto } from "@/lib/photos";
import { formatDuration, formatUSD, formatUSDWhole, applyMultiplier } from "@/lib/pricing";
import { localizedHref, t, type PublicLang } from "@/lib/publicLang";
import { ROUTE_PAGES, TRANSFERS_PATH, builderHref, routePageFor, routePath, type RoutePage } from "@/lib/routePages";
import { pageFromPrices, pageVehiclePrices } from "@/lib/routePrices";
import { HUB_BLOCKS } from "@/lib/routes/hubs";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { tourBookHref, tourPathFor } from "@/lib/tours/slugs";
import { guarantees, ridePromises } from "@/lib/trust";

/**
 * A route landing page, shared by /transfers/[slug] (English) and /es/traslados/[slug]
 * (Spanish, same slug), and the index of all routes (/transfers, /es/traslados).
 * Text comes from src/lib/routePages.ts (data in src/lib/routes/); prices, drive times,
 * distances and stops come from the catalog, so they are the same in both languages
 * and the same as in the trip builder.
 */

export async function routePageMetadata(page: RoutePage, lang: PublicLang, parent: ResolvingMetadata): Promise<Metadata> {
  return bilingualMetadata(parent, { enPath: routePath(page), lang, title: page.title[lang], description: page.metaDescription[lang] });
}

const AMBER_BUTTON = "min-h-12 px-6 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 font-extrabold text-slate-950";
const TEXT_LINK = "font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800";

export async function RouteLandingPage({ page, lang }: { page: RoutePage; lang: PublicLang }) {
  const { origin, destination } = page;
  const catalog = localizeCatalog(await getCatalog(), lang);
  const fill = (text: string) => fillGuideText(text, catalog, lang);
  const path = localizedHref(routePath(page), lang);
  const prices = pageFromPrices(origin, destination, catalog);
  const { cheapest, fromCents, defaultSeason, share } = prices;
  const vehiclePrices = pageVehiclePrices(origin, destination, catalog);
  const minutes = routeMinutes(origin, destination);
  const km = routeKm(origin, destination);
  const boat = origin === "DrakeBay" || destination === "DrakeBay";
  const promises = ridePromises(AIRPORT_HUBS.includes(origin), lang);
  const stops = catalog.stops.filter((s) => stopFitsRoute(s, origin, destination));
  const noStopClasses = vehiclePrices.filter((x) => !x.vehicle.allowsStops).map((x) => x.vehicle.name);
  const pct = (id: string) => {
    const season = catalog.seasons.find((x) => x.id === id);
    return season ? Math.round((season.multiplierBps - 10000) / 100) : 0;
  };
  const highPct = pct("high");
  const peakPct = pct("peak");
  const seasonName = (defaultSeason?.name ?? t(lang, "Green season", "Temporada verde")).replace(/^./, (c) => c.toLowerCase());
  const href = localizedHref(builderHref(origin, destination), lang);
  const from = shortHubName(origin, lang);
  const to = shortHubName(destination, lang);
  const routeLabel = `${from} → ${to}`;
  // Reviews are matched to the route by its English label (src/lib/trust.ts).
  const enRouteLabel = `${HUBS.find((h) => h.id === origin)!.name.split(" /")[0]} → ${HUBS.find((h) => h.id === destination)!.name}`;
  const roadPhoto = drivePhoto(origin, destination);
  const ctaLabel = stops.length > 0 ? t(lang, "See price & add stops", "Ver precio y agregar paradas") : t(lang, "See price & book", "Ver precio y reservar");

  // Internal links: the way back, the guides for both ends, other rides from here and to there.
  const reverse = routePageFor(destination, origin);
  const pill = (p: RoutePage) => ({
    label: `${shortHubName(p.origin, lang)} → ${shortHubName(p.destination, lang)}`,
    href: localizedHref(routePath(p), lang),
  });
  const sameOrigin = ROUTE_PAGES.filter((p) => p.origin === origin && p.slug !== page.slug);
  const sameDestination = ROUTE_PAGES.filter((p) => p.destination === destination && p.slug !== page.slug);
  const guideLinks = [destination, origin].flatMap((hub) => {
    const dest = destinationGuideForHub(hub);
    const airport = airportGuideForHub(hub);
    return [
      ...(dest ? [{ label: t(lang, `${dest.name.en} travel guide`, `Guía de viaje de ${dest.name.es}`), href: localizedHref(destinationPath(dest), lang) }] : []),
      ...(airport ? [{ label: t(lang, `${airport.name.en} arrival guide`, `Guía de llegada: ${airport.name.es}`), href: localizedHref(airportPath(airport), lang) }] : []),
    ];
  });
  // Travel guides (the blog) about this ride, either direction.
  guideLinks.unshift(...articlesForPair(origin, destination).map((a) => ({ label: a.short[lang], href: localizedHref(articlePath(a), lang) })));
  // Day tours where the ride ends (or where it starts, for rides back to an airport).
  const region = HUB_REGION[destination] ?? HUB_REGION[origin];
  const tours = region ? catalog.dayTours.filter((x) => x.region === region) : [];
  const seasonBps = defaultSeason?.multiplierBps ?? 10000;

  return (
    <div className="flex-1 bg-slate-50">
      <SiteHeader lang={lang} current="transfers" />

      <main>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
          <Breadcrumbs
            lang={lang}
            currentPath={path}
            items={[{ label: t(lang, "Transfers", "Traslados"), href: localizedHref(TRANSFERS_PATH, lang) }, { label: routeLabel }]}
          />
        </div>

        {/* Hero: the destination's photo (or its drawn placeholder) behind the H1. */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
          <div className="relative overflow-hidden rounded-2xl bg-emerald-950">
            <Photo id={routePhoto(origin, destination)} lang={lang} fill priority sizes="(min-width: 1152px) 1104px, 100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-emerald-950/45 to-emerald-950/5" aria-hidden />
            <h1 className="relative px-5 sm:px-8 pt-28 sm:pt-44 pb-5 sm:pb-7 max-w-4xl text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.08]">
              {page.title[lang]}
            </h1>
          </div>
        </div>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
          <div className="min-w-0">
            {/* The dated direct answer (docs/SEO.md §6), then what this direction is like. */}
            <p className="text-lg leading-relaxed text-slate-800">{fill(page.answer[lang])}</p>
            <p className="mt-3 text-lg leading-relaxed text-slate-600">{fill(page.lead[lang])}</p>
            <p className="mt-3 text-sm text-slate-600">
              {t(lang, "Updated", "Actualizado el")} <time dateTime={page.updated}>{formatGuideDate(page.updated, lang)}</time>
            </p>
            <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Fact icon={<Clock className="w-4 h-4" />} label={t(lang, "Door to door", "Puerta a puerta")} value={`≈ ${formatDuration(minutes, lang)}`} />
              <Fact
                icon={<Milestone className="w-4 h-4" />}
                label={boat ? t(lang, "By road, then boat", "Por carretera, luego lancha") : t(lang, "By road", "Por carretera")}
                value={boat ? `${km} km + ≈ ${formatDuration(DRAKE_BOAT_MINUTES, lang)}` : `${km} km`}
              />
              <Fact icon={<Users className="w-4 h-4" />} label={t(lang, "Whole vehicle from", "Vehículo completo desde")} value={formatUSD(fromCents)} />
              <Fact icon={<Luggage className="w-4 h-4" />} label={t(lang, "Fits", "Capacidad")} value={`${cheapest.maxPax} ${t(lang, "travellers", "viajeros")} · ${cheapest.luggage}`} />
            </dl>
            <p className="mt-4 text-lg text-slate-800">
              {t(lang, "From", "Desde")} <strong className="text-2xl font-extrabold text-emerald-700">{formatUSD(fromCents)}</strong>{" "}
              {t(lang, "per vehicle", "por vehículo")} · {formatUSD(prices.perPersonCents)} {t(lang, "per person", "por persona")} ({share}{" "}
              {t(lang, "travellers", "viajeros")})
            </p>
            <Link href={href} className={`mt-3 w-full sm:w-auto ${AMBER_BUTTON}`}>
              {ctaLabel} <ArrowRight className="w-4 h-4 shrink-0" aria-hidden />
            </Link>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2 text-sm">
              {promises.map((p) => (
                <li key={p.title} className="flex gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" aria-hidden />
                  <span>
                    <span className="font-bold text-slate-900">{p.title}.</span> <span className="text-slate-600">{p.text}</span>
                    {p.href && (
                      <>
                        {" "}
                        <Link href={p.href} className="font-semibold text-emerald-700 underline">
                          {t(lang, "Policy", "Política")}
                        </Link>
                      </>
                    )}
                  </span>
                </li>
              ))}
              <li className="flex gap-2">
                <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" aria-hidden />
                <span>
                  <span className="font-bold text-slate-900">{t(lang, "Luggage included.", "Equipaje incluido.")}</span>{" "}
                  <span className="text-slate-600">
                    {t(lang, "Each vehicle lists how many suitcases it fits.", "Cada vehículo indica cuántas maletas caben.")}
                  </span>
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-emerald-950/5">
            <h2 className="text-lg font-extrabold text-slate-900">{t(lang, "Plan this ride", "Planee este traslado")}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {t(
                lang,
                "Pick your date, travelers, vehicle and stops. You'll see the exact price before you book.",
                "Elija su fecha, viajeros, vehículo y paradas. Verá el precio exacto antes de reservar.",
              )}
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>
                <span className="font-semibold text-slate-900">{t(lang, "Pickup:", "Recogida:")}</span> {page.pickupPlace[lang]}
              </li>
              <li>
                <span className="font-semibold text-slate-900">{t(lang, "Drop-off:", "Destino:")}</span> {page.dropoffPlace[lang]}
              </li>
            </ul>
            <Link href={href} className={`mt-5 w-full text-center ${AMBER_BUTTON}`}>
              {ctaLabel} <ArrowRight className="w-4 h-4 shrink-0" aria-hidden />
            </Link>
            <p className="mt-3 text-xs text-center text-slate-500">
              {t(lang, "Opens the trip builder with this ride filled in.", "Abre el planificador de viajes con este traslado ya cargado.")}
            </p>
          </div>
        </section>

        {/* Prices by vehicle class: the same classes and prices as the trip builder. */}
        <section aria-labelledby="prices-h" className="bg-white border-y border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
            <h2 id="prices-h" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {t(lang, `${from} to ${to}: price by vehicle`, `${from} → ${to}: precio por vehículo`)}
            </h2>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  {t(lang, `Private transfer prices from ${from} to ${to} by vehicle class`, `Precios del traslado privado ${routeLabel} por categoría de vehículo`)}
                </caption>
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-3 sm:px-4 py-3">
                      {t(lang, "Vehicle", "Vehículo")}
                    </th>
                    <th scope="col" className="px-3 sm:px-4 py-3">
                      {t(lang, "Fits", "Capacidad")}
                    </th>
                    <th scope="col" className="px-3 sm:px-4 py-3 whitespace-nowrap">
                      {t(lang, "From", "Desde")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {vehiclePrices.map(({ vehicle: v, cents }) => (
                    <tr key={v.id} className="align-top">
                      <th scope="row" className="px-3 sm:px-4 py-3 font-normal">
                        <span className="block font-bold text-slate-900">{v.name}</span>
                        {orSimilar(v.exampleModels, lang) && <span className="block text-slate-600">{orSimilar(v.exampleModels, lang)}</span>}
                        <span className="mt-0.5 block text-xs text-slate-600">{v.badge}</span>
                      </th>
                      <td className="px-3 sm:px-4 py-3 text-slate-800">
                        <span className="block whitespace-nowrap">
                          {t(lang, "up to", "hasta")} {v.maxPax} {t(lang, "travellers", "viajeros")}
                        </span>
                        <span className="block text-slate-600">{v.luggage}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        <span className="font-extrabold text-emerald-700">{formatUSD(cents)}</span>
                        <span className="block text-xs text-slate-600">{t(lang, "per vehicle", "por vehículo")}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 max-w-3xl space-y-2 text-sm leading-relaxed text-slate-600">
              {lang === "es" ? (
                <p>
                  Precios de {seasonName} por el vehículo completo, no por persona, los mismos de nuestro planificador de viajes; el precio exacto para
                  su fecha aparece antes de reservar.
                  {highPct > 0 ? ` De diciembre a abril se suma un ${highPct}%` : ""}
                  {peakPct > 0 ? `; en Navidad–Año Nuevo y Semana Santa, un ${peakPct}%.` : highPct > 0 ? "." : ""} {nightSentence(catalog.nightPremium, lang)}
                </p>
              ) : (
                <p>
                  {seasonName.replace(/^./, (c) => c.toUpperCase())} prices for the whole vehicle, not per person, the same as in our trip builder; the
                  exact price for your date is shown before you book.
                  {highPct > 0 ? ` December to April adds ${highPct}%` : ""}
                  {peakPct > 0 ? `; Christmas–New Year and Easter week add ${peakPct}%.` : highPct > 0 ? "." : ""} {nightSentence(catalog.nightPremium, lang)}
                </p>
              )}
              <p>
                {t(
                  lang,
                  "Vehicle models are examples: you travel in that model or a similar one of the same category. Free requests when you book: child seats and booster seats, and an electric vehicle if one is available (same price, never guaranteed).",
                  "Los modelos de vehículo son ejemplos: usted viaja en ese modelo o en uno similar de la misma categoría. Solicitudes gratuitas al reservar: sillas para niños y boosters (asientos elevadores), y un vehículo eléctrico si hay disponible (mismo precio, nunca garantizado).",
                )}
              </p>
              {boat && reverseOrSierpe(page, lang) && (
                <p>
                  {t(
                    lang,
                    "These prices include the river boat between Sierpe and Drake Bay. If your lodge already provides the boat, see ",
                    "Estos precios incluyen la lancha entre Sierpe y Bahía Drake. Si su lodge ya le da la lancha, vea ",
                  )}
                  <Link href={reverseOrSierpe(page, lang)!.href} className={TEXT_LINK}>
                    {reverseOrSierpe(page, lang)!.label}
                  </Link>
                  .
                </p>
              )}
            </div>
          </div>
        </section>

        {/* The road, and the stops the trip builder offers on it. */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{t(lang, "What the ride is like", "Cómo es el recorrido")}</h2>
            <p className="mt-3 leading-relaxed text-slate-600">{fill(page.road[lang])}</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {t(
                lang,
                "Times are door to door and realistic for Costa Rica's roads; traffic and rain can add to them.",
                "Los tiempos son de puerta a puerta y realistas para las carreteras de Costa Rica; el tráfico y la lluvia pueden sumar tiempo.",
              )}
            </p>
            {roadPhoto && <Photo id={roadPhoto} lang={lang} sizes="(min-width: 768px) 540px, 100vw" className="mt-5 aspect-[3/2] rounded-2xl" />}
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{t(lang, "Stops you can add", "Paradas que puede agregar")}</h2>
            {stops.length === 0 ? (
              <p className="mt-3 leading-relaxed text-slate-600">
                {t(
                  lang,
                  "No sightseeing stops are sold online for this ride. Your driver still stops for restrooms, food or a photo whenever you ask.",
                  "No se venden paradas turísticas en línea para este traslado. Su conductor igual se detiene para ir al baño, comer o tomar una foto cuando usted lo pida.",
                )}
              </p>
            ) : (
              <>
                {page.stopsNote && <p className="mt-3 leading-relaxed text-slate-600">{page.stopsNote[lang]}</p>}
                <ul className="mt-4 space-y-3">
                  {stops.map((s) => (
                    <li key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <span className="block font-bold text-slate-900">{s.name}</span>
                      <span className="mt-1 block font-extrabold text-emerald-700">
                        +{formatUSD(s.priceCents)}
                        {s.tourPerPersonCents > 0 ? ` + ${formatUSD(s.tourPerPersonCents)}/${t(lang, "person", "persona")}` : ""}
                        <span className="font-semibold text-slate-600"> · {formatDuration(s.durationMin, lang)}</span>
                      </span>
                      <span className="mt-1 block text-sm text-slate-600">{s.description}</span>
                      <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-600">
                        <Ticket className="w-3.5 h-3.5" aria-hidden />
                        {entranceLabel(s.entrance, lang)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-slate-600">
                  {t(lang, "Your driver waits with your bags locked in the vehicle.", "Su conductor espera con su equipaje bajo llave en el vehículo.")}
                  {noStopClasses.length > 0 &&
                    ` ${t(lang, "Stops can be added in every class except", "Las paradas se pueden agregar en todas las categorías excepto")} ${noStopClasses.join(", ")}${t(lang, ", which is a direct ride.", ", que es un traslado directo.")}`}
                </p>
              </>
            )}
          </div>
        </section>

        <PageSection
          id="other-ways"
          tone="white"
          title={t(lang, `Other ways to get from ${from} to ${to}`, `Otras formas de ir ${HUB_BLOCKS[origin].esFrom} ${HUB_BLOCKS[destination].esTo}`)}
          intro={t(
            lang,
            "A private transfer is not the only option. Here is how the others compare, without the timetables and fares that go out of date.",
            "Un traslado privado no es la única opción. Así se comparan las demás, sin los horarios y tarifas que pierden vigencia.",
          )}
        >
          <OtherWays lang={lang} ways={page.ways} />
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">
            {t(
              lang,
              "Timetables, fares, routes and terminals change: check current times with the bus, shuttle or airline shortly before you travel. Rental companies add Costa Rica's mandatory liability insurance to the advertised rate, so ask for the full price.",
              "Los horarios, las tarifas, las rutas y las terminales cambian: confirme los horarios vigentes con la empresa de buses, el shuttle o la aerolínea poco antes de viajar. Las arrendadoras suman al precio anunciado el seguro obligatorio de responsabilidad civil de Costa Rica, así que pida el precio total.",
            )}
          </p>
        </PageSection>

        <Reviews route={enRouteLabel} lang={lang} />

        <DriverStandards lang={lang} />

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {guarantees(catalog.cashFeeBps, lang).map((g) => (
              <div key={g.title}>
                <h3 className="font-extrabold text-slate-900">{g.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {g.text}
                  {g.href && (
                    <>
                      {" "}
                      <Link href={g.href} className="font-semibold text-emerald-700 underline">
                        {t(lang, "Read the policy", "Leer la política")}
                      </Link>
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        </section>

        <PageSection id="faq" tone="white" title={t(lang, `${from} to ${to}: questions travellers ask`, `${routeLabel}: preguntas frecuentes`)}>
          <GuideFaqs lang={lang} catalog={catalog} faqs={page.faqs} />
        </PageSection>

        <section aria-labelledby="more-h" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-8">
          <h2 id="more-h" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            {t(lang, "Keep planning", "Siga planeando")}
          </h2>
          {(reverse || guideLinks.length > 0) && (
            <div>
              <h3 className="mb-3 font-extrabold text-slate-900">{t(lang, "The way back and travel guides", "El regreso y guías de viaje")}</h3>
              <LinkPills links={[...(reverse ? [pill(reverse)] : []), ...guideLinks]} />
            </div>
          )}
          {sameOrigin.length > 0 && (
            <div>
              <h3 className="mb-3 font-extrabold text-slate-900">{t(lang, `More rides from ${from}`, `Más traslados que salen ${HUB_BLOCKS[origin].esFrom}`)}</h3>
              <LinkPills links={sameOrigin.map(pill)} />
            </div>
          )}
          {sameDestination.length > 0 && (
            <div>
              <h3 className="mb-3 font-extrabold text-slate-900">{t(lang, `Other rides to ${to}`, `Otros traslados ${HUB_BLOCKS[destination].esTo}`)}</h3>
              <LinkPills links={sameDestination.map(pill)} />
            </div>
          )}
          {tours.length > 0 && (
            <div>
              <h3 className="mb-3 font-extrabold text-slate-900">{t(lang, "Private day tours", "Tours privados de un día")}: {regionName(region!, lang)}</h3>
              <ul className="grid gap-4 md:grid-cols-2">
                {tours.map((x) => (
                  <li key={x.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <span className="block font-extrabold leading-snug text-slate-900">{x.name}</span>
                    <span className="mt-2 block text-sm text-slate-700">
                      {t(lang, "From", "Desde")}{" "}
                      <strong className="font-extrabold text-emerald-700">{formatUSDWhole(applyMultiplier(x.perPerson.groupCents, seasonBps))}</strong>{" "}
                      {t(lang, "per person (4 or more travellers, green season)", "por persona (4 viajeros o más, temporada verde)")}
                    </span>
                    <Link
                      href={localizedHref(tourPathFor(x.id) ?? tourBookHref(x.id), lang)}
                      className={`mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm ${TEXT_LINK}`}
                    >
                      {tourPathFor(x.id) ? t(lang, "See the tour and prices", "Ver el tour y los precios") : t(lang, "See day tours and prices", "Ver tours de un día y precios")}{" "}
                      <ArrowRight className="w-4 h-4" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p>
            <Link href={localizedHref(TRANSFERS_PATH, lang)} className={TEXT_LINK}>
              {t(lang, "All private transfer routes and prices", "Todas las rutas de traslado privado y sus precios")}
            </Link>
          </p>
        </section>

        {/* What the page is about, for search and answer engines: a service with its live price range. No ratings, no availability claims. */}
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": `${SITE_URL}${path}`,
            url: `${SITE_URL}${path}`,
            name: page.title[lang],
            description: page.metaDescription[lang],
            inLanguage: lang,
            dateModified: page.updated,
            isPartOf: { "@type": "WebSite", name: SITE_NAME, url: `${SITE_URL}/` },
            publisher: { "@id": `${SITE_URL}/#organization` },
            mainEntity: {
              "@type": "Service",
              serviceType: t(lang, "Private transfer", "Traslado privado"),
              name: page.title[lang],
              description: fill(page.answer[lang]),
              provider: { "@id": `${SITE_URL}/#organization` },
              areaServed: { "@type": "Country", name: "Costa Rica" },
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "USD",
                lowPrice: (vehiclePrices[0].cents / 100).toFixed(2),
                highPrice: (vehiclePrices[vehiclePrices.length - 1].cents / 100).toFixed(2),
                offerCount: vehiclePrices.length,
                url: `${SITE_URL}${href}`,
              },
            },
          }}
        />
      </main>

      {/* Phones: the price and the way into the builder stay in view. */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm text-slate-700">
            <span className="block truncate text-xs font-semibold text-slate-600">{routeLabel}</span>
            {t(lang, "From", "Desde")} <strong className="text-base font-extrabold text-emerald-700">{formatUSD(fromCents)}</strong>{" "}
            {t(lang, "per car", "por vehículo")}
          </p>
          <Link
            href={href}
            className="min-h-12 shrink-0 px-4 inline-flex items-center justify-center rounded-xl bg-amber-400 hover:bg-amber-300 font-extrabold text-slate-950 whitespace-nowrap"
          >
            {t(lang, "See price", "Ver precio")}
          </Link>
        </div>
      </div>

      <div className="pb-20 lg:pb-0">
        <SiteFooter lang={lang} />
      </div>
    </div>
  );
}

/** On a Drake Bay page: the same ride ending at (or starting from) the Sierpe dock, if it has a page. */
function reverseOrSierpe(page: RoutePage, lang: PublicLang): { label: string; href: string } | null {
  const other = page.origin === "DrakeBay" ? routePageFor("Sierpe", page.destination) : routePageFor(page.origin, "Sierpe");
  if (!other) return null;
  return { label: `${shortHubName(other.origin, lang)} → ${shortHubName(other.destination, lang)}`, href: localizedHref(routePath(other), lang) };
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <span className="text-emerald-700" aria-hidden>
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-1 text-base font-extrabold text-slate-900">{value}</dd>
    </div>
  );
}

// ───────────────────────── Index of all routes ─────────────────────────

export function transfersIndexMeta(lang: PublicLang) {
  return {
    title: t(lang, "Private transfer routes and prices in Costa Rica", "Rutas y precios de traslados privados en Costa Rica"),
    description: t(
      lang,
      `Drive times and private transfer prices for ${ROUTE_PAGES.length} routes in Costa Rica: from San José (SJO) and Liberia (LIR) airports to La Fortuna, Manuel Antonio, Monteverde, Tamarindo, Puerto Viejo and Drake Bay, and between them.`,
      `Tiempos de viaje y precios de traslado privado para ${ROUTE_PAGES.length} rutas en Costa Rica: de los aeropuertos de San José (SJO) y Liberia (LIR) a La Fortuna, Manuel Antonio, Monteverde, Tamarindo, Puerto Viejo y Bahía Drake, y entre ellos.`,
    ),
  };
}

export async function TransfersIndexPage({ lang }: { lang: PublicLang }) {
  const catalog = localizeCatalog(await getCatalog(), lang);
  const meta = transfersIndexMeta(lang);
  const updated = ROUTE_PAGES.reduce((latest, p) => (p.updated > latest ? p.updated : latest), ROUTE_PAGES[0].updated);
  // One table per pickup town, in the catalog's order (airports first).
  const groups = HUB_IDS.map((hub) => ({ hub, pages: ROUTE_PAGES.filter((p) => p.origin === hub) })).filter((g) => g.pages.length > 0);
  return (
    <PublicPage
      lang={lang}
      current="transfers"
      path={localizedHref(TRANSFERS_PATH, lang)}
      crumbs={[{ label: t(lang, "Transfers", "Traslados") }]}
      eyebrow={t(lang, "Private transfers", "Traslados privados")}
      title={meta.title}
      lead={
        <>
          <p>
            {t(
              lang,
              `Door-to-door private transfers on ${ROUTE_PAGES.length} routes, with the drive time and the price of the whole vehicle for each. Prices are fixed per vehicle, not per person, and are the same as in our trip builder.`,
              `Traslados privados de puerta a puerta en ${ROUTE_PAGES.length} rutas, con el tiempo de viaje y el precio del vehículo completo de cada una. Los precios son fijos por vehículo, no por persona, y son los mismos de nuestro planificador de viajes.`,
            )}
          </p>
          <p className="mt-3 text-sm text-slate-600">
            {t(lang, "Updated", "Actualizado el")} <time dateTime={updated}>{formatGuideDate(updated, lang)}</time>
          </p>
          <Link href={localizedHref("/?tab=transfers", lang)} className={`mt-5 w-full sm:w-auto text-base ${AMBER_BUTTON}`}>
            {t(lang, "Open the trip builder", "Abrir el planificador de viajes")} <ArrowRight className="w-4 h-4 shrink-0" aria-hidden />
          </Link>
        </>
      }
    >
      {groups.map((g, i) => {
        const name = hubName(g.hub, lang);
        return (
          <PageSection
            key={g.hub}
            id={`from-${g.hub.toLowerCase()}`}
            tone={i % 2 === 1 ? "white" : "plain"}
            title={t(lang, `From ${name}`, `Salida: ${name}`)}
          >
            <RidesTable
              lang={lang}
              catalog={catalog}
              rows={g.pages.map((p) => ({ origin: p.origin, destination: p.destination }))}
              updated={updated}
              caption={t(lang, `Private transfers from ${name}: drive times and prices`, `Traslados privados desde ${name}: tiempos de viaje y precios`)}
            />
          </PageSection>
        );
      })}
      <GuideCta
        lang={lang}
        title={t(lang, "Going somewhere else?", "¿Va a otro lugar?")}
        text={t(
          lang,
          "Type any hotel, town or address in Costa Rica in the trip builder and see the fixed price for the whole vehicle before you book.",
          "Escriba cualquier hotel, pueblo o dirección de Costa Rica en el planificador de viajes y vea el precio fijo por el vehículo completo antes de reservar.",
        )}
        href={localizedHref("/?tab=transfers", lang)}
        button={t(lang, "Open the trip builder", "Abrir el planificador de viajes")}
      />
    </PublicPage>
  );
}
