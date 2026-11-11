import { ArrowRight, Check, Clock, Info, Sun, CloudRain } from "lucide-react";
import Link from "next/link";
import { AIRPORT_HUBS, routeMinutes, stopFitsRoute, type HubId } from "@/lib/catalog";
import { entranceLabel, localizeCatalog } from "@/lib/catalogEs";
import { getCatalog } from "@/lib/catalogSource";
import { BLOG_PATH, articlePath, articlesForHubs } from "@/lib/blog";
import {
  AIRPORT_GUIDES,
  AIRPORTS_PATH,
  DESTINATION_GUIDES,
  DESTINATIONS_PATH,
  airportGuideForHub,
  airportPath,
  destinationGuideForHub,
  destinationPath,
  fillGuideText,
  guideRidePrice,
  type AirportGuide,
  type DestinationGuide,
} from "@/lib/guides";
import { applyMultiplier, formatDuration, formatUSD, formatUSDWhole } from "@/lib/pricing";
import { localizedHref, t, type PublicLang } from "@/lib/publicLang";
import { builderHref } from "@/lib/routePages";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { ridePromises } from "@/lib/trust";
import { GuideCta, GuideFaqs, LinkPills, OtherWays, RidesTable, formatGuideDate, shortHubName, type RideRow } from "../GuideParts";
import { JsonLd } from "../JsonLd";
import { Photo } from "../Photo";
import { PageSection, PublicPage } from "../PublicPage";

/**
 * Destination guides, airport guides and their two index pages, in English and
 * Spanish. Text comes from src/lib/guides (data, both languages side by side);
 * drive times, prices, stops and tours come from the catalog, like the route pages.
 */

const CARD = "rounded-2xl border border-slate-200 bg-white p-5";

function Updated({ iso, lang }: { iso: string; lang: PublicLang }) {
  return (
    <p className="mt-3 text-sm text-slate-600">
      {t(lang, "Updated", "Actualizado el")} <time dateTime={iso}>{formatGuideDate(iso, lang)}</time>
    </p>
  );
}

/** WebPage structured data about a place; never ratings or reviews. */
function GuideJsonLd({
  lang,
  path,
  title,
  description,
  updated,
  about,
}: {
  lang: PublicLang;
  path: string;
  title: string;
  description: string;
  updated: string;
  about: object;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${SITE_URL}${path}`,
        url: `${SITE_URL}${path}`,
        name: title,
        description,
        inLanguage: lang,
        dateModified: updated,
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: `${SITE_URL}/` },
        publisher: { "@id": `${SITE_URL}/#organization` },
        about,
      }}
    />
  );
}

// ───────────────────────── Destination guide ─────────────────────────

export function destinationMeta(guide: DestinationGuide, lang: PublicLang) {
  return { title: guide.title[lang], description: guide.metaDescription[lang] };
}

export async function DestinationGuidePage({ guide, lang }: { guide: DestinationGuide; lang: PublicLang }) {
  const catalog = localizeCatalog(await getCatalog(), lang);
  const fill = (text: string) => fillGuideText(text, catalog, lang);
  const path = localizedHref(destinationPath(guide), lang);
  const name = guide.name[lang];
  const hubs: HubId[] = [guide.hub, ...(guide.alsoHubs ?? [])];
  // The booking link: from the first airport in the table to this destination.
  const first = guide.rides[0];
  const bookHref = localizedHref(builderHref(first.origin, first.destination), lang);

  // Sightseeing stops offered on a ride from either airport to this destination.
  const stops = catalog.stops.filter((s) => AIRPORT_HUBS.some((a) => hubs.some((h) => stopFitsRoute(s, a, h))));
  const tours = guide.region ? catalog.dayTours.filter((x) => x.region === guide.region) : [];
  const defaultSeason = catalog.seasons.find((s) => s.isDefault);
  const seasonBps = defaultSeason?.multiplierBps ?? 10000;
  const airportLinks = guide.rides
    .filter((r) => AIRPORT_HUBS.includes(r.origin))
    .map((r) => airportGuideForHub(r.origin))
    .filter((a, i, all): a is AirportGuide => Boolean(a) && all.indexOf(a) === i);

  return (
    <PublicPage
      lang={lang}
      current="destinations"
      path={path}
      crumbs={[{ label: t(lang, "Destinations", "Destinos"), href: localizedHref(DESTINATIONS_PATH, lang) }, { label: name }]}
      eyebrow={t(lang, "Destination guide", "Guía de destino")}
      title={guide.title[lang]}
      photo={guide.photo}
      lead={
        <>
          <p>{fill(guide.answer[lang])}</p>
          <Updated iso={guide.updated} lang={lang} />
          <Link
            href={bookHref}
            className="mt-5 min-h-12 w-full sm:w-auto px-6 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-base font-extrabold text-slate-950"
          >
            {t(lang, "See price & book a transfer", "Ver precio y reservar un traslado")} <ArrowRight className="w-4 h-4 shrink-0" aria-hidden />
          </Link>
        </>
      }
    >
      <PageSection
        id="getting-there"
        title={t(lang, `How to get to ${name}`, `Cómo llegar a ${name}`)}
        intro={
          <>
            <p>{guide.intro[lang]}</p>
            <p className="mt-3">{guide.airports[lang]}</p>
          </>
        }
      >
        <RidesTable
          lang={lang}
          catalog={catalog}
          rows={guide.rides}
          updated={guide.updated}
          caption={t(lang, `Drive times and private transfer prices for ${name}`, `Tiempos de viaje y precios de traslado privado para ${name}`)}
        />
        {airportLinks.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-sm font-bold text-slate-900">{t(lang, "Arriving by air?", "¿Llega en avión?")}</p>
            <LinkPills
              links={airportLinks.map((a) => ({
                label: t(lang, `${a.name.en}: arrival guide`, `${a.name.es}: guía de llegada`),
                href: localizedHref(airportPath(a), lang),
              }))}
            />
          </div>
        )}
        {stops.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-extrabold text-slate-900">{t(lang, "Stops you can add on the way", "Paradas que puede agregar en el camino")}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {t(
                lang,
                "On a private transfer the drive can be part of the trip. Each stop's price is shown in the trip builder, and your luggage stays locked in the vehicle with your driver.",
                "En un traslado privado el recorrido puede ser parte del viaje. El precio de cada parada aparece en el planificador de viajes, y su equipaje queda bajo llave en el vehículo con su conductor.",
              )}
            </p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {stops.map((s) => (
                <li key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="block font-bold text-slate-900">{s.name}</span>
                  <span className="mt-1 block text-sm text-slate-600">{s.description}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden /> {formatDuration(s.durationMin, lang)} · {entranceLabel(s.entrance, lang)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </PageSection>

      <PageSection
        id="other-ways"
        tone="white"
        title={t(lang, "Other ways to get there", "Otras formas de llegar")}
        intro={t(
          lang,
          "A private transfer is not the only option. Here is how the others compare, without the timetables and fares that go out of date.",
          "Un traslado privado no es la única opción. Así se comparan las demás, sin los horarios y tarifas que pierden vigencia.",
        )}
      >
        <OtherWays lang={lang} ways={guide.otherWays} />
      </PageSection>

      <PageSection id="best-time" title={t(lang, "Best time to go", "Mejor época para ir")}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className={CARD}>
            <h3 className="flex items-center gap-2 font-extrabold text-slate-900">
              <Sun className="w-5 h-5 text-amber-500" aria-hidden /> {t(lang, "December to April", "De diciembre a abril")}
            </h3>
            <p className="mt-2 leading-relaxed text-slate-600">{guide.bestTime.dry[lang]}</p>
          </div>
          <div className={CARD}>
            <h3 className="flex items-center gap-2 font-extrabold text-slate-900">
              <CloudRain className="w-5 h-5 text-emerald-700" aria-hidden /> {t(lang, "May to November (green season)", "De mayo a noviembre (temporada verde)")}
            </h3>
            <p className="mt-2 leading-relaxed text-slate-600">{guide.bestTime.green[lang]}</p>
          </div>
        </div>
        {guide.bestTime.note && <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">{guide.bestTime.note[lang]}</p>}
      </PageSection>

      <PageSection id="things-to-do" tone="white" title={t(lang, `What to do in ${name}`, `Qué hacer en ${name}`)}>
        <ul className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          {guide.thingsToDo.map((x) => (
            <li key={x.title.en} className="flex gap-3">
              <Check className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600" aria-hidden />
              <span>
                <span className="font-bold text-slate-900">{x.title[lang]}.</span> <span className="text-slate-600">{x.text[lang]}</span>
              </span>
            </li>
          ))}
        </ul>

        {guide.goodToKnow && guide.goodToKnow.length > 0 && (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="flex items-center gap-2 font-extrabold text-slate-900">
              <Info className="w-5 h-5 text-amber-600" aria-hidden /> {t(lang, "Good to know before you go", "Conviene saberlo antes de ir")}
            </h3>
            <ul className="mt-2 space-y-2 leading-relaxed text-slate-700">
              {guide.goodToKnow.map((g) => (
                <li key={g.en}>{g[lang]}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8">
          <h3 className="text-lg font-extrabold text-slate-900">{t(lang, "Our private day tours here", "Nuestros tours privados de un día aquí")}</h3>
          {tours.length === 0 ? (
            <p className="mt-2 text-slate-600">
              {t(lang, "We don't have a day tour that starts here yet. ", "Todavía no tenemos un tour de un día que empiece aquí. ")}
              <Link href={localizedHref("/?tab=tours", lang)} className="font-semibold text-emerald-700 underline underline-offset-2">
                {t(lang, "See all our day tours", "Ver todos nuestros tours de un día")}
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3 grid gap-4 md:grid-cols-2">
              {tours.map((x) => (
                <li key={x.id} className={CARD}>
                  <span className="block font-extrabold leading-snug text-slate-900">{x.name}</span>
                  <span className="mt-1 block text-sm text-slate-600">
                    {t(
                      lang,
                      `${x.durationHours} hours · private · guide, entrances & lunch included`,
                      `${String(x.durationHours).replace(".", ",")} horas · privado · guía, entradas y almuerzo incluidos`,
                    )}
                  </span>
                  <span className="mt-2 block text-sm text-slate-700">
                    {t(lang, "From", "Desde")}{" "}
                    <strong className="font-extrabold text-emerald-700">{formatUSDWhole(applyMultiplier(x.perPerson.groupCents, seasonBps))}</strong>{" "}
                    {t(lang, "per person (4 or more travellers, green season)", "por persona (4 viajeros o más, temporada verde)")}
                  </span>
                  <Link
                    href={localizedHref("/?tab=tours", lang)}
                    className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                  >
                    {t(lang, "See day tours and prices", "Ver tours de un día y precios")} <ArrowRight className="w-4 h-4" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PageSection>

      <PageSection
        id="where-to-stay"
        title={t(lang, "Where to stay, by area", "Dónde hospedarse, por zona")}
        intro={t(
          lang,
          "We don't recommend or sell hotels. This is simply what each area is like, so you can choose where to look.",
          "No recomendamos ni vendemos hoteles. Esto es simplemente cómo es cada zona, para que usted decida dónde buscar.",
        )}
      >
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {guide.areas.map((a) => (
            <li key={a.name.en} className={CARD}>
              <h3 className="font-extrabold text-slate-900">{a.name[lang]}</h3>
              <p className="mt-2 leading-relaxed text-slate-600">{a.text[lang]}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-600">
          {t(
            lang,
            "Wherever you stay, the transfer is door to door: type your hotel or address in the trip builder.",
            "Donde sea que se hospede, el traslado es puerta a puerta: escriba su hotel o dirección en el planificador de viajes.",
          )}
        </p>
      </PageSection>

      <PageSection id="faq" tone="white" title={t(lang, `${name}: questions travellers ask`, `${name}: preguntas frecuentes`)}>
        <GuideFaqs lang={lang} catalog={catalog} faqs={guide.faqs} />
      </PageSection>

      <GuideCta
        lang={lang}
        title={t(lang, `Book your ride to ${name}`, `Reserve su traslado a ${name}`)}
        text={t(
          lang,
          "Pick your date, travellers, vehicle and stops. You see the fixed price for the whole vehicle before you send your request, and nothing is charged when you send it.",
          "Elija su fecha, viajeros, vehículo y paradas. Verá el precio fijo por el vehículo completo antes de enviar su solicitud, y no se cobra nada al enviarla.",
        )}
        href={bookHref}
        button={t(lang, "See price & book", "Ver precio y reservar")}
      />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-8">
        <h2 className="text-xl font-extrabold text-slate-900">{t(lang, "Travel guides", "Guías de viaje")}</h2>
        <div className="mt-4">
          <LinkPills
            links={[
              ...articlesForHubs(hubs).map((a) => ({ label: a.short[lang], href: localizedHref(articlePath(a), lang) })),
              { label: t(lang, "All travel guides", "Todas las guías de viaje"), href: localizedHref(BLOG_PATH, lang) },
            ]}
          />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <h2 className="text-xl font-extrabold text-slate-900">{t(lang, "More destination guides", "Más guías de destinos")}</h2>
        <div className="mt-4">
          <LinkPills
            links={DESTINATION_GUIDES.filter((g) => g.slug !== guide.slug).map((g) => ({
              label: g.name[lang],
              href: localizedHref(destinationPath(g), lang),
            }))}
          />
        </div>
      </section>

      <GuideJsonLd
        lang={lang}
        path={path}
        title={guide.title[lang]}
        description={guide.metaDescription[lang]}
        updated={guide.updated}
        about={{
          "@type": "TouristDestination",
          name,
          description: guide.intro[lang],
          url: `${SITE_URL}${path}`,
          containedInPlace: { "@type": "Country", name: "Costa Rica" },
        }}
      />
    </PublicPage>
  );
}

// ───────────────────────── Airport guide ─────────────────────────

export function airportMeta(guide: AirportGuide, lang: PublicLang) {
  return { title: guide.title[lang], description: guide.metaDescription[lang] };
}

/** Rows of an airport's "popular rides" table, each with a link to the destination's guide. */
function airportRows(guide: AirportGuide, lang: PublicLang): RideRow[] {
  return guide.rides.map((destination) => {
    const dest = destinationGuideForHub(destination);
    return {
      origin: guide.hub,
      destination,
      extra: dest
        ? { label: t(lang, `${dest.name.en} guide`, `Guía de ${dest.name.es}`), href: localizedHref(destinationPath(dest), lang) }
        : undefined,
    };
  });
}

export async function AirportGuidePage({ guide, lang }: { guide: AirportGuide; lang: PublicLang }) {
  const catalog = localizeCatalog(await getCatalog(), lang);
  const fill = (text: string) => fillGuideText(text, catalog, lang);
  const path = localizedHref(airportPath(guide), lang);
  const name = guide.name[lang];
  const bookHref = localizedHref(builderHref(guide.hub, guide.rides[0]), lang);
  const promises = ridePromises(true, lang);
  const others = AIRPORT_GUIDES.filter((a) => a.code !== guide.code);

  return (
    <PublicPage
      lang={lang}
      current="destinations"
      path={path}
      crumbs={[{ label: t(lang, "Airports", "Aeropuertos"), href: localizedHref(AIRPORTS_PATH, lang) }, { label: name }]}
      eyebrow={t(lang, "Airport guide", "Guía de aeropuerto")}
      title={guide.title[lang]}
      lead={
        <>
          <p>{fill(guide.answer[lang])}</p>
          <Updated iso={guide.updated} lang={lang} />
          <Link
            href={bookHref}
            className="mt-5 min-h-12 w-full sm:w-auto px-6 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-base font-extrabold text-slate-950"
          >
            {t(lang, "See price & book a transfer", "Ver precio y reservar un traslado")} <ArrowRight className="w-4 h-4 shrink-0" aria-hidden />
          </Link>
        </>
      }
    >
      <PageSection
        id="rides"
        title={t(lang, `Popular rides from ${name}`, `Traslados frecuentes desde el ${name.replace(/^Aeropuerto/, "aeropuerto")}`)}
        intro={<p>{guide.intro[lang]}</p>}
      >
        <RidesTable
          lang={lang}
          catalog={catalog}
          rows={airportRows(guide, lang)}
          updated={guide.updated}
          caption={t(lang, `Drive times and private transfer prices from ${name}`, `Tiempos de viaje y precios de traslado privado desde el ${name}`)}
        />
        <p className="mt-3 text-sm text-slate-600">
          {t(
            lang,
            "Going somewhere else? Type any hotel, town or address in the trip builder to see its price.",
            "¿Va a otro lugar? Escriba cualquier hotel, pueblo o dirección en el planificador de viajes para ver su precio.",
          )}{" "}
          <Link href={localizedHref("/?tab=transfers", lang)} className="font-semibold text-emerald-700 underline underline-offset-2">
            {t(lang, "Open the trip builder", "Abrir el planificador de viajes")}
          </Link>
        </p>
      </PageSection>

      <PageSection id="pickup" tone="white" title={t(lang, "Meeting your driver, flight delays and waiting", "El encuentro con su conductor, atrasos de vuelo y espera")}>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-3 leading-relaxed text-slate-600">
            {guide.pickup.map((p, i) => (
              <p key={i}>{fill(p[lang])}</p>
            ))}
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900">{t(lang, "Every airport pickup includes", "Toda recogida en el aeropuerto incluye")}</h3>
            <ul className="mt-3 space-y-2.5 text-sm">
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
            </ul>
            <p className="mt-4 text-sm text-slate-600">
              <Link href={localizedHref("/our-drivers", lang)} className="font-semibold text-emerald-700 underline underline-offset-2">
                {t(lang, "Who our drivers are and how we check them", "Quiénes son nuestros conductores y cómo los verificamos")}
              </Link>
            </p>
          </div>
        </div>
      </PageSection>

      <PageSection
        id="other-ways"
        title={t(lang, "Other ways to leave the airport", "Otras formas de salir del aeropuerto")}
        intro={t(
          lang,
          "What each option is good for, without the fares and timetables that go out of date.",
          "Para qué sirve cada opción, sin las tarifas y horarios que pierden vigencia.",
        )}
      >
        <OtherWays lang={lang} ways={guide.otherWays} />
      </PageSection>

      <PageSection id="tips" tone="white" title={t(lang, "Practical tips for arriving", "Consejos prácticos para su llegada")}>
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {guide.tips.map((x) => (
            <li key={x.title.en} className={CARD}>
              <h3 className="font-extrabold text-slate-900">{x.title[lang]}</h3>
              <p className="mt-2 leading-relaxed text-slate-600">{x.text[lang]}</p>
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection id="faq" title={t(lang, `${name}: questions travellers ask`, `${name}: preguntas frecuentes`)}>
        <GuideFaqs lang={lang} catalog={catalog} faqs={guide.faqs} />
      </PageSection>

      <GuideCta
        lang={lang}
        title={t(lang, `Book your ride from ${name}`, `Reserve su traslado desde el ${name.replace(/^Aeropuerto/, "aeropuerto")}`)}
        text={t(
          lang,
          "Enter your flight's landing time, your destination and your travellers. You see the fixed price for the whole vehicle before you send your request, and nothing is charged when you send it.",
          "Indique la hora de aterrizaje de su vuelo, su destino y sus viajeros. Verá el precio fijo por el vehículo completo antes de enviar su solicitud, y no se cobra nada al enviarla.",
        )}
        href={bookHref}
        button={t(lang, "See price & book", "Ver precio y reservar")}
      />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <h2 className="text-xl font-extrabold text-slate-900">{t(lang, "Keep planning", "Siga planeando")}</h2>
        <div className="mt-4">
          <LinkPills
            links={[
              ...articlesForHubs([guide.hub]).map((a) => ({ label: a.short[lang], href: localizedHref(articlePath(a), lang) })),
              ...others.map((a) => ({ label: a.name[lang], href: localizedHref(airportPath(a), lang) })),
              ...DESTINATION_GUIDES.map((g) => ({ label: g.name[lang], href: localizedHref(destinationPath(g), lang) })),
            ]}
          />
        </div>
      </section>

      <GuideJsonLd
        lang={lang}
        path={path}
        title={guide.title[lang]}
        description={guide.metaDescription[lang]}
        updated={guide.updated}
        about={{
          "@type": "Airport",
          name: guide.officialName,
          iataCode: guide.iata,
          address: { "@type": "PostalAddress", addressLocality: guide.locality, addressCountry: "CR" },
        }}
      />
    </PublicPage>
  );
}

// ───────────────────────── Index pages ─────────────────────────

export function destinationsIndexMeta(lang: PublicLang) {
  return {
    title: t(lang, "Costa Rica destination guides", "Guías de destinos de Costa Rica"),
    description: t(
      lang,
      "How to get to La Fortuna, Manuel Antonio, Monteverde, Tamarindo, Puerto Viejo and Drake Bay: drive times from San José (SJO) and Liberia (LIR) airports, private transfer prices, best time to go and where to stay.",
      "Cómo llegar a La Fortuna, Manuel Antonio, Monteverde, Tamarindo, Puerto Viejo y Bahía Drake: tiempos de viaje desde los aeropuertos de San José (SJO) y Liberia (LIR), precios de traslado privado, mejor época y dónde hospedarse.",
    ),
  };
}

export function airportsIndexMeta(lang: PublicLang) {
  return {
    title: t(lang, "Costa Rica airport guides: SJO and LIR", "Guías de aeropuertos de Costa Rica: SJO y LIR"),
    description: t(
      lang,
      "San José (SJO) or Liberia (LIR)? Drive times from each airport to Costa Rica's main destinations, private transfer prices, flight-delay waiting and how to leave each airport.",
      "¿San José (SJO) o Liberia (LIR)? Tiempos de viaje desde cada aeropuerto a los principales destinos de Costa Rica, precios de traslado privado, espera por atrasos de vuelo y cómo salir de cada aeropuerto.",
    ),
  };
}

/** Drive time from each airport to every destination with a guide: one table, both airports. */
function AirportTimesTable({ lang }: { lang: PublicLang }) {
  // Drake Bay is reached through Sierpe, so the airport columns show the road to the dock.
  const roadHub = (g: DestinationGuide): HubId => (g.hub === "DrakeBay" ? "Sierpe" : g.hub);
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          {t(lang, "Drive times from San José and Liberia airports", "Tiempos de viaje desde los aeropuertos de San José y Liberia")}
        </caption>
        <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
          <tr>
            <th scope="col" className="px-3 sm:px-4 py-3">
              {t(lang, "Destination", "Destino")}
            </th>
            {AIRPORT_GUIDES.map((a) => (
              <th key={a.code} scope="col" className="px-3 sm:px-4 py-3">
                {t(lang, `From ${a.iata}`, `Desde ${a.iata}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {DESTINATION_GUIDES.map((g) => (
            <tr key={g.slug} className="align-top">
              <th scope="row" className="px-3 sm:px-4 py-3 font-normal">
                <Link href={localizedHref(destinationPath(g), lang)} className="font-bold text-emerald-700 underline underline-offset-2 hover:text-emerald-800">
                  {g.name[lang]}
                </Link>
                {g.hub === "DrakeBay" && (
                  <span className="mt-0.5 block text-xs text-slate-600">
                    {t(lang, "To the Sierpe boat dock; the boat adds about ", "Hasta el muelle de Sierpe; la lancha suma unos ")}
                    {formatDuration(routeMinutes("Sierpe", "DrakeBay"), lang)}
                  </span>
                )}
              </th>
              {AIRPORT_GUIDES.map((a) => (
                <td key={a.code} className="px-3 sm:px-4 py-3 whitespace-nowrap text-slate-800">
                  ≈ {formatDuration(routeMinutes(a.hub, roadHub(g)), lang)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AirportCards({ lang }: { lang: PublicLang }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {AIRPORT_GUIDES.map((a) => (
        <li key={a.code}>
          <Link
            href={localizedHref(airportPath(a), lang)}
            className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-emerald-500 hover:shadow-md transition"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">{a.iata}</span>
            <span className="mt-1 text-lg font-extrabold leading-snug text-slate-900">{a.name[lang]}</span>
            <span className="mt-1 text-sm text-slate-600">{a.teaser[lang]}</span>
            <span className="mt-auto pt-3 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 group-hover:text-emerald-800">
              {t(lang, "Arrival guide", "Guía de llegada")} <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const TIMES_NOTE = (lang: PublicLang) =>
  t(
    lang,
    "Door-to-door times by private car, realistic for Costa Rica's mountain roads; traffic and rain can add time.",
    "Tiempos de puerta a puerta en vehículo privado, realistas para las carreteras de montaña de Costa Rica; el tráfico y la lluvia pueden sumar tiempo.",
  );

export async function DestinationsIndexPage({ lang }: { lang: PublicLang }) {
  const catalog = localizeCatalog(await getCatalog(), lang);
  const meta = destinationsIndexMeta(lang);
  return (
    <PublicPage
      lang={lang}
      current="destinations"
      path={localizedHref(DESTINATIONS_PATH, lang)}
      crumbs={[{ label: t(lang, "Destinations", "Destinos") }]}
      eyebrow={t(lang, "Destination guides", "Guías de destinos")}
      title={meta.title}
      lead={
        <p>
          {t(
            lang,
            "Where to go in Costa Rica and how to get there: realistic drive times from both international airports, what a private transfer costs, the other ways to travel, the best time to go and where to stay, area by area.",
            "A dónde ir en Costa Rica y cómo llegar: tiempos de viaje realistas desde los dos aeropuertos internacionales, cuánto cuesta un traslado privado, las otras formas de viajar, la mejor época y dónde hospedarse, zona por zona.",
          )}
        </p>
      }
    >
      <PageSection id="guides" title={t(lang, "Choose a destination", "Elija un destino")}>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DESTINATION_GUIDES.map((g) => {
            const first = g.rides[0];
            const price = guideRidePrice(first.origin, first.destination, catalog);
            return (
              <li key={g.slug}>
                <Link
                  href={localizedHref(destinationPath(g), lang)}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-emerald-500 hover:shadow-md transition"
                >
                  <Photo id={g.photo} lang={lang} decorative sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" className="aspect-[16/9]" />
                  <span className="flex flex-1 flex-col p-4">
                    <span className="text-lg font-extrabold leading-snug text-slate-900">{g.name[lang]}</span>
                    <span className="mt-1 text-sm text-slate-600">{g.teaser[lang]}</span>
                    <span className="mt-3 flex items-center gap-1.5 text-sm text-slate-700">
                      <Clock className="h-4 w-4 shrink-0" aria-hidden />
                      {shortHubName(first.origin, lang)} → {shortHubName(first.destination, lang)}: ≈ {formatDuration(routeMinutes(first.origin, first.destination), lang)}
                    </span>
                    <span className="mt-1 text-sm text-slate-700">
                      {t(lang, "Private car from", "Vehículo privado desde")}{" "}
                      <strong className="font-extrabold text-emerald-700">{formatUSD(price.fromCents)}</strong>
                    </span>
                    <span className="mt-auto pt-3 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 group-hover:text-emerald-800">
                      {t(lang, "Read the guide", "Leer la guía")} <ArrowRight className="h-4 w-4" aria-hidden />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </PageSection>

      <PageSection
        id="drive-times"
        tone="white"
        title={t(lang, "Drive times from the two airports", "Tiempos de viaje desde los dos aeropuertos")}
        intro={TIMES_NOTE(lang)}
      >
        <AirportTimesTable lang={lang} />
      </PageSection>

      <PageSection
        id="airports"
        title={t(lang, "Airport guides", "Guías de aeropuertos")}
        intro={t(
          lang,
          "What to expect when you land, how the pickup works and how to leave each airport.",
          "Qué esperar al aterrizar, cómo funciona la recogida y cómo salir de cada aeropuerto.",
        )}
      >
        <AirportCards lang={lang} />
      </PageSection>

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

export function AirportsIndexPage({ lang }: { lang: PublicLang }) {
  const meta = airportsIndexMeta(lang);
  return (
    <PublicPage
      lang={lang}
      current="destinations"
      path={localizedHref(AIRPORTS_PATH, lang)}
      crumbs={[{ label: t(lang, "Airports", "Aeropuertos") }]}
      eyebrow={t(lang, "Airport guides", "Guías de aeropuertos")}
      title={meta.title}
      lead={
        <p>
          {t(
            lang,
            "Costa Rica has two international airports: Juan Santamaría (SJO), near San José, and Daniel Oduber (LIR), in Liberia. Which one is better depends on where you are going: the table below shows the drive from each to the main destinations.",
            "Costa Rica tiene dos aeropuertos internacionales: el Juan Santamaría (SJO), cerca de San José, y el Daniel Oduber (LIR), en Liberia. Cuál conviene más depende de a dónde va: la tabla de abajo muestra el recorrido desde cada uno a los principales destinos.",
          )}
        </p>
      }
    >
      <PageSection id="airports" title={t(lang, "Choose your airport", "Elija su aeropuerto")}>
        <AirportCards lang={lang} />
      </PageSection>

      <PageSection id="drive-times" tone="white" title={t(lang, "SJO or LIR: drive times compared", "SJO o LIR: tiempos de viaje comparados")} intro={TIMES_NOTE(lang)}>
        <AirportTimesTable lang={lang} />
      </PageSection>

      <GuideCta
        lang={lang}
        title={t(lang, "Book your airport pickup", "Reserve su recogida en el aeropuerto")}
        text={t(
          lang,
          "Enter your flight's landing time and your destination. We track the flight, and you see the fixed price for the whole vehicle before you book.",
          "Indique la hora de aterrizaje de su vuelo y su destino. Damos seguimiento al vuelo, y usted ve el precio fijo por el vehículo completo antes de reservar.",
        )}
        href={localizedHref("/?tab=transfers", lang)}
        button={t(lang, "Open the trip builder", "Abrir el planificador de viajes")}
      />
    </PublicPage>
  );
}
