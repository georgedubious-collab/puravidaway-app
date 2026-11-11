import { ArrowRight, Bus, Car, CarTaxiFront, MessageCircle, Plane, Smartphone, Users } from "lucide-react";
import Link from "next/link";
import { whatsAppLink } from "@/lib/cart";
import { routeMinutes, type HubId } from "@/lib/catalog";
import { hubName } from "@/lib/catalogEs";
import type { CatalogData } from "@/lib/catalogModel";
import { fillGuideText, guideRidePrice, type GuideFaq, type L, type OtherWay } from "@/lib/guides";
import { formatDuration, formatUSD } from "@/lib/pricing";
import { localizedHref, t, type PublicLang } from "@/lib/publicLang";
import { relatedHref } from "@/lib/routePages";
import { JsonLd } from "./JsonLd";

/**
 * Building blocks shared by the destination and airport guides
 * (src/components/site/pages/GuidePages.tsx). Server components, no hooks.
 * Every number shown comes from the catalog: drive times from routeMinutes()
 * and prices from guideRidePrice(), the same sources as the route pages.
 */

/** "11 November 2026" / "11 de noviembre de 2026" from an ISO date. */
export function formatGuideDate(iso: string, lang: PublicLang): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(lang === "es" ? "es-CR" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Short name of one of our towns: "SJO Airport", "La Fortuna", "Tamarindo". */
export function shortHubName(id: HubId, lang: PublicLang): string {
  return hubName(id, lang).split(" /")[0];
}

export interface RideRow {
  origin: HubId;
  destination: HubId;
  note?: L;
  /** A second link under the ride, e.g. to the destination's guide. */
  extra?: { label: string; href: string };
}

/**
 * Drive-time and price table (a real HTML table, docs/SEO.md §6). Each ride links to
 * its route page when one exists, otherwise to the trip builder with the ride filled in.
 */
export function RidesTable({
  lang,
  catalog,
  rows,
  caption,
  updated,
}: {
  lang: PublicLang;
  catalog: CatalogData;
  rows: RideRow[];
  caption: string;
  updated: string;
}) {
  const seasonName = catalog.seasons.find((s) => s.isDefault)?.name ?? t(lang, "Green season", "Temporada verde");
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-3 sm:px-4 py-3">
                {t(lang, "Ride", "Traslado")}
              </th>
              <th scope="col" className="px-3 sm:px-4 py-3 whitespace-nowrap">
                {t(lang, "Drive time", "Tiempo de viaje")}
              </th>
              <th scope="col" className="px-3 sm:px-4 py-3">
                {t(lang, "Private car from", "Vehículo privado desde")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((r) => {
              const price = guideRidePrice(r.origin, r.destination, catalog);
              return (
                <tr key={`${r.origin}-${r.destination}`} className="align-top">
                  <th scope="row" className="px-3 sm:px-4 py-3 font-normal">
                    <Link
                      href={localizedHref(relatedHref(r.origin, r.destination), lang)}
                      className="font-bold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                    >
                      {shortHubName(r.origin, lang)} → {shortHubName(r.destination, lang)}
                    </Link>
                    {r.note && <span className="mt-0.5 block text-xs text-slate-600">{r.note[lang]}</span>}
                    {r.extra && (
                      <Link href={r.extra.href} className="mt-0.5 block text-xs font-semibold text-slate-700 underline underline-offset-2 hover:text-emerald-700">
                        {r.extra.label}
                      </Link>
                    )}
                  </th>
                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-slate-800">≈ {formatDuration(routeMinutes(r.origin, r.destination), lang)}</td>
                  <td className="px-3 sm:px-4 py-3">
                    <span className="font-extrabold text-emerald-700">{formatUSD(price.fromCents)}</span>
                    <span className="block text-xs text-slate-600">
                      {price.cheapest.name} · {t(lang, "up to", "hasta")} {price.cheapest.maxPax}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        {lang === "es"
          ? `Tiempos de puerta a puerta, realistas para las carreteras de Costa Rica; el tráfico y la lluvia pueden sumar tiempo. Precios por el vehículo completo en ${seasonName.replace(/^./, (c) => c.toLowerCase())}, los mismos de nuestro planificador de viajes; el precio exacto para su fecha aparece antes de reservar. Texto revisado el ${formatGuideDate(updated, lang)}.`
          : `Door-to-door times, realistic for Costa Rica's roads; traffic and rain can add time. Prices are for the whole vehicle in ${seasonName.replace(/^./, (c) => c.toLowerCase())}, the same as in our trip builder; the exact price for your date is shown before you book. Text reviewed on ${formatGuideDate(updated, lang)}.`}
      </p>
    </div>
  );
}

const WAY: Record<OtherWay["kind"], { icon: React.ReactNode; title: L }> = {
  bus: { icon: <Bus className="w-5 h-5" aria-hidden />, title: { en: "Public bus", es: "Bus público" } },
  shuttle: { icon: <Users className="w-5 h-5" aria-hidden />, title: { en: "Shared shuttle", es: "Shuttle compartido" } },
  flight: { icon: <Plane className="w-5 h-5" aria-hidden />, title: { en: "Domestic flight", es: "Vuelo nacional" } },
  car: { icon: <Car className="w-5 h-5" aria-hidden />, title: { en: "Rental car", es: "Vehículo de alquiler" } },
  taxi: { icon: <CarTaxiFront className="w-5 h-5" aria-hidden />, title: { en: "Airport taxi", es: "Taxi del aeropuerto" } },
  rideshare: { icon: <Smartphone className="w-5 h-5" aria-hidden />, title: { en: "Ride-hailing apps", es: "Aplicaciones de transporte" } },
};

/** The honest alternatives to a private transfer, one card each. */
export function OtherWays({ lang, ways }: { lang: PublicLang; ways: OtherWay[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {ways.map((w) => (
        <li key={w.kind} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 font-extrabold text-slate-900">
            <span className="text-emerald-700">{WAY[w.kind].icon}</span>
            {WAY[w.kind].title[lang]}
          </h3>
          <p className="mt-2 leading-relaxed text-slate-600">{w.text[lang]}</p>
        </li>
      ))}
    </ul>
  );
}

/** FAQ cards + FAQPage structured data (one per page). Tokens are filled from the catalog. */
export function GuideFaqs({ lang, catalog, faqs }: { lang: PublicLang; catalog: CatalogData; faqs: GuideFaq[] }) {
  const items = faqs.map((f) => ({ q: fillGuideText(f.q[lang], catalog, lang), a: fillGuideText(f.a[lang], catalog, lang) }));
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((f) => (
          <div key={f.q} className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-extrabold text-slate-900">{f.q}</h3>
            <p className="mt-1.5 leading-relaxed text-slate-600">{f.a}</p>
          </div>
        ))}
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: lang,
          mainEntity: items.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
    </>
  );
}

/** The call to action that closes a guide: into the trip builder, or WhatsApp. */
export function GuideCta({
  lang,
  title,
  text,
  href,
  button,
}: {
  lang: PublicLang;
  title: string;
  text: string;
  /** Already in `lang`. */
  href: string;
  button: string;
}) {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <div className="rounded-2xl bg-emerald-950 text-white p-6 sm:p-10">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{title}</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-emerald-100">{text}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={href}
            className="min-h-12 px-6 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold inline-flex items-center gap-2"
          >
            {button} <ArrowRight className="w-4 h-4 shrink-0" aria-hidden />
          </Link>
          <a
            href={whatsAppLink(t(lang, "Hi! I have a question about my Costa Rica trip.", "¡Hola! Tengo una pregunta sobre mi viaje a Costa Rica."))}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-12 px-5 rounded-xl bg-emerald-800 hover:bg-emerald-700 font-bold inline-flex items-center gap-2"
          >
            <MessageCircle className="w-5 h-5" aria-hidden /> {t(lang, "Ask on WhatsApp", "Pregunte por WhatsApp")}
          </a>
        </div>
      </div>
    </section>
  );
}

/** Pill links (other guides, related pages). */
export function LinkPills({ links }: { links: { label: string; href: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <Link
          key={l.href + l.label}
          href={l.href}
          className="min-h-11 inline-flex items-center px-4 rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:border-emerald-500"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
