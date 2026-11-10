import { ArrowRight, Check, Clock, Luggage, Ticket, User, Users } from "lucide-react";
import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { DriverStandards } from "@/components/trust/DriverStandards";
import { Reviews } from "@/components/trust/Reviews";
import { AIRPORT_HUBS, HUBS, routeMinutes, stopFitsRoute } from "@/lib/catalog";
import { entranceLabel, hubName, localizeCatalog } from "@/lib/catalogEs";
import { getCatalog } from "@/lib/catalogSource";
import { applyMultiplier, formatDuration, formatUSD, perPersonCents, perPersonShare, rideCents } from "@/lib/pricing";
import { bilingualAlternates, localizedHref, t, type PublicLang } from "@/lib/publicLang";
import { builderHref, fillFaq, relatedHref, type RoutePage } from "@/lib/routePages";
import { localizeRoutePage } from "@/lib/routePagesEs";
import { SITE_NAME } from "@/lib/site";
import { guarantees, ridePromises } from "@/lib/trust";

/**
 * A route landing page, shared by /transfers/[slug] (English) and
 * /es/traslados/[slug] (Spanish, same slug). Text comes from
 * src/lib/routePages.ts and src/lib/routePagesEs.ts; prices, drive times and
 * stops come from the catalog, so they are the same in both languages.
 */

/** English path of a route page (the Spanish one is derived from it). */
const enPathOf = (page: RoutePage) => `/transfers/${page.slug}`;

export async function routePageMetadata(page: RoutePage, lang: PublicLang, parent: ResolvingMetadata): Promise<Metadata> {
  const text = localizeRoutePage(page, lang);
  const title = `${text.title} | ${SITE_NAME}`;
  const path = localizedHref(enPathOf(page), lang);
  // Setting openGraph/twitter here replaces the root ones, so carry over the
  // site-wide preview image (src/app/opengraph-image.tsx).
  const inherited = await parent;
  return {
    title,
    description: text.metaDescription,
    alternates: bilingualAlternates(enPathOf(page), lang),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description: text.metaDescription,
      url: path,
      locale: lang === "es" ? "es_CR" : "en_US",
      alternateLocale: lang === "es" ? ["en_US"] : ["es_CR"],
      images: inherited.openGraph?.images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: text.metaDescription,
      images: inherited.twitter?.images,
    },
  };
}

export async function RouteLandingPage({ page: enPage, lang }: { page: RoutePage; lang: PublicLang }) {
  const page = localizeRoutePage(enPage, lang);
  const originName = hubName(page.origin, lang);
  const destName = hubName(page.destination, lang);
  const touches = (hubs?: string[]) =>
    !hubs || hubs.includes(page.origin) || hubs.includes(page.destination);
  const catalog = localizeCatalog(await getCatalog(), lang);
  const fitting = catalog.vehicles.filter((v) => touches(v.onlyForHubs));
  const vehicles = fitting.length ? fitting : catalog.vehicles;
  const defaultSeason = catalog.seasons.find((x) => x.isDefault);
  const carCents = (v: (typeof vehicles)[number]) =>
    applyMultiplier(rideCents(page.origin, page.destination, v, catalog), defaultSeason?.multiplierBps ?? 10000);
  const cheapest = vehicles.reduce((a, b) => (carCents(b) < carCents(a) ? b : a));
  const fromCents = carCents(cheapest);
  // Daytrip-style "from $X per person": the class with the lowest price per seat, shared by a full car.
  const perPerson = vehicles
    .map((v) => ({ v, cents: perPersonCents(carCents(v), v.maxPax) }))
    .reduce((a, b) => (b.cents < a.cents ? b : a));
  const promises = ridePromises(AIRPORT_HUBS.includes(page.origin), lang);
  const stops = catalog.stops.filter((s) => stopFitsRoute(s, page.origin, page.destination));
  const pct = (id: string) => {
    const season = catalog.seasons.find((x) => x.id === id);
    return season ? Math.round((season.multiplierBps - 10000) / 100) : 0;
  };
  const highPct = pct("high");
  const peakPct = pct("peak");
  const href = localizedHref(builderHref(page.origin, page.destination), lang);
  const routeLabel = `${originName.split(" /")[0]} → ${destName}`;
  // Reviews are matched to the route by its English label (src/lib/trust.ts).
  const enRouteLabel = `${HUBS.find((h) => h.id === page.origin)!.name.split(" /")[0]} → ${HUBS.find((h) => h.id === page.destination)!.name}`;
  const share = perPersonShare(perPerson.v.maxPax);
  const seasonName = defaultSeason?.name ?? t(lang, "Green season", "Temporada verde");

  return (
    <div className="flex-1 bg-slate-50">
      <SiteHeader lang={lang} current="transfers" />

      <main>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
        <Breadcrumbs
          lang={lang}
          currentPath={localizedHref(enPathOf(page), lang)}
          items={[{ label: t(lang, "Transfers", "Traslados"), href: localizedHref("/?tab=transfers", lang) }, { label: routeLabel }]}
        />
      </div>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.08]">
            {page.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">{page.intro}</p>
          <dl className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Fact
              icon={<Clock className="w-4 h-4" />}
              label={t(lang, "Drive time", "Tiempo de viaje")}
              value={`≈ ${formatDuration(routeMinutes(page.origin, page.destination), lang)}`}
            />
            <Fact icon={<Users className="w-4 h-4" />} label={t(lang, "Private car from", "Vehículo privado desde")} value={formatUSD(fromCents)} />
            <Fact
              icon={<User className="w-4 h-4" />}
              label={t(lang, "Per person from", "Por persona desde")}
              value={`${formatUSD(perPerson.cents)} (${share} ${t(lang, "travellers", "viajeros")})`}
            />
            <Fact icon={<Luggage className="w-4 h-4" />} label={t(lang, "Fits", "Capacidad")} value={cheapest.luggage} />
          </dl>
          {lang === "es" ? (
            <p className="mt-3 text-sm text-slate-500">
              Precios de {seasonName.replace(/^./, (c) => c.toLowerCase())}. El precio es por el vehículo completo: {cheapest.name}, hasta{" "}
              {cheapest.maxPax} viajeros. «Por persona» es el precio de {perPerson.v.name} compartido entre {share} viajeros.
              {highPct > 0 ? ` De diciembre a abril se suma un ${highPct}%` : ""}
              {peakPct > 0 ? `; en Navidad–Año Nuevo y Semana Santa, un ${peakPct}%.` : highPct > 0 ? "." : ""}
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              {seasonName} prices. The car price is for the whole vehicle: {cheapest.name}, up to{" "}
              {cheapest.maxPax} travelers. &ldquo;Per person&rdquo; is the {perPerson.v.name} price shared by{" "}
              {share} travellers.
              {highPct > 0 ? ` December to April adds ${highPct}%` : ""}
              {peakPct > 0 ? `; Christmas–New Year and Easter week add ${peakPct}%.` : highPct > 0 ? "." : ""}
            </p>
          )}
          <ul className="mt-6 grid gap-2 sm:grid-cols-2 text-sm">
            {promises.map((p) => (
              <li key={p.title} className="flex gap-2">
                <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" aria-hidden />
                <span>
                  <span className="font-bold text-slate-900">{p.title}.</span>{" "}
                  <span className="text-slate-600">{p.text}</span>
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
              {t(lang, "Pickup:", "Recogida:")} {originName}
            </li>
            <li>
              {t(lang, "Drop-off: your hotel in", "Destino: su hotel en")} {page.areaLabel}
            </li>
          </ul>
          <Link
            href={href}
            className="mt-5 min-h-12 px-3 text-center flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 font-extrabold text-slate-950"
          >
            {t(lang, "See price & add stops", "Ver precio y agregar paradas")} <ArrowRight className="w-4 h-4 shrink-0" aria-hidden />
          </Link>
          <p className="mt-3 text-xs text-center text-slate-500">
            {t(
              lang,
              "Opens the trip builder with this ride filled in.",
              "Abre el planificador de viajes con este traslado ya cargado.",
            )}
          </p>
        </div>
      </section>

      <section className="bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">{page.driveTitle}</h2>
            <p className="mt-3 leading-relaxed text-slate-600">{page.drive}</p>
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">{t(lang, "Stops you can add", "Paradas que puede agregar")}</h2>
            <ul className="mt-4 space-y-3">
              {stops.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4"
                >
                  <span>
                    <span className="block font-bold text-slate-900">{s.name}</span>
                    <span className="text-sm text-slate-500">
                      {formatDuration(s.durationMin, lang)} · {s.description}
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-600">
                      <Ticket className="w-3.5 h-3.5" aria-hidden />
                      {entranceLabel(s.entrance, lang)}
                    </span>
                  </span>
                  <span className="font-extrabold text-emerald-700 whitespace-nowrap">
                    +{formatUSD(s.priceCents)}
                    {s.tourPerPersonCents > 0 ? ` + ${formatUSD(s.tourPerPersonCents)}/${t(lang, "person", "persona")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-slate-500">
              {t(
                lang,
                "Your driver waits with your bags locked in the vehicle.",
                "Su conductor espera con su equipaje bajo llave en el vehículo.",
              )}
            </p>
          </div>
        </div>
      </section>

      <Reviews route={enRouteLabel} lang={lang} />

      <DriverStandards lang={lang} />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
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

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-14">
        <h2 className="text-2xl font-extrabold text-slate-900">{t(lang, "Questions travelers ask", "Preguntas frecuentes de los viajeros")}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {page.faqs.map((f) => (
            <div key={f.q} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-extrabold text-slate-900">{f.q}</h3>
              <p className="mt-1.5 text-slate-600 leading-relaxed">{fillFaq(f.a, catalog.cashFeeBps)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <h2 className="text-xl font-extrabold text-slate-900">{t(lang, "Other rides", "Otros traslados")}</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {page.related.map((r) => (
            <Link
              key={r.label}
              href={localizedHref(relatedHref(r.origin, r.destination), lang)}
              className="min-h-11 inline-flex items-center px-4 rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:border-emerald-500"
            >
              {r.label}
            </Link>
          ))}
        </div>
      </section>

      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <span className="text-emerald-600" aria-hidden>
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-1 text-base font-extrabold text-slate-900">{value}</dd>
    </div>
  );
}
