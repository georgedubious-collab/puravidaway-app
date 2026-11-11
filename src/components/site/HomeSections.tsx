import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { routeMinutes } from "@/lib/catalog";
import { hubName, localizeCatalog } from "@/lib/catalogEs";
import type { CatalogData } from "@/lib/catalogModel";
import { FAQ_GROUPS, faqAnswer, type FaqValues } from "@/lib/faq";
import { ON_THE_ROAD_PHOTOS, photoEntry, routePhoto, WILDLIFE_PHOTOS } from "@/lib/photos";
import { formatDuration, formatUSD } from "@/lib/pricing";
import { localizedHref, t, type PublicLang } from "@/lib/publicLang";
import { ROUTE_PAGES } from "@/lib/routePages";
import { routeFromPrices } from "@/lib/routePrices";
import { Photo } from "./Photo";

/**
 * The home page below the trip builder (server-rendered, passed into the
 * Storefront by HomePage): popular routes with their "from" prices, how it
 * works in three steps, photos of the road and its wildlife, and a short FAQ.
 * Section titles are H2: the page's only H1 is in the hero.
 * Only true claims (docs/PROJECT.md §10): no reviews, counts or "most popular"
 * rankings; "popular routes" are simply the routes that have their own page.
 */
export function HomeSections({ lang, catalog: rawCatalog }: { lang: PublicLang; catalog: CatalogData }) {
  const catalog = localizeCatalog(rawCatalog, lang);
  return (
    <div className="bg-white border-t border-slate-200">
      <PopularRoutes lang={lang} catalog={catalog} />
      <HowItWorks lang={lang} />
      <OnTheRoad lang={lang} />
      <Wildlife lang={lang} />
      <FaqTeaser lang={lang} values={{ cashFeeBps: catalog.cashFeeBps, nightPremium: catalog.nightPremium }} />
    </div>
  );
}

function SectionHead({ id, title, text }: { id: string; title: string; text?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
        {title}
      </h2>
      {text && <p className="mt-2 text-base leading-relaxed text-slate-600">{text}</p>}
    </div>
  );
}

const MORE_LINK = "inline-flex min-h-11 items-center gap-1.5 font-bold text-emerald-700 hover:text-emerald-800 underline underline-offset-2";

function PopularRoutes({ lang, catalog }: { lang: PublicLang; catalog: CatalogData }) {
  const routes = ROUTE_PAGES.slice(0, 6);
  return (
    <section aria-labelledby="routes-h" className="max-w-6xl mx-auto px-4 sm:px-6 pt-12">
      <SectionHead
        id="routes-h"
        title={t(lang, "Popular routes", "Rutas populares")}
        text={t(
          lang,
          "Fixed prices for the whole car, green-season rates. Pick a route to see the drive, the stops you can add and the exact price for your date.",
          "Precios fijos por el vehículo completo, en temporada verde. Elija una ruta para ver el recorrido, las paradas que puede agregar y el precio exacto para su fecha.",
        )}
      />
      <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {routes.map((p) => {
          const price = routeFromPrices(p.origin, p.destination, catalog);
          const label = `${hubName(p.origin, lang).split(" /")[0]} → ${hubName(p.destination, lang).split(" /")[0]}`;
          return (
            <li key={p.slug}>
              <Link
                href={localizedHref(`/transfers/${p.slug}`, lang)}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-emerald-500 hover:shadow-md transition"
              >
                <Photo
                  id={routePhoto(p.origin, p.destination)}
                  lang={lang}
                  decorative
                  sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                  className="aspect-[16/9]"
                />
                <span className="flex flex-1 flex-col p-4">
                  <span className="text-lg font-extrabold leading-snug text-slate-900">{label}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                    <Clock className="h-4 w-4 shrink-0" aria-hidden /> ≈ {formatDuration(routeMinutes(p.origin, p.destination), lang)}
                  </span>
                  <span className="mt-3 text-sm text-slate-700">
                    {t(lang, "From", "Desde")} <strong className="text-lg font-extrabold text-emerald-700">{formatUSD(price.fromCents)}</strong>{" "}
                    {t(lang, "per car", "por vehículo")} · {formatUSD(price.perPersonCents)} {t(lang, "per person", "por persona")}
                  </span>
                  <span className="mt-auto pt-3 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 group-hover:text-emerald-800">
                    {t(lang, "See this route", "Ver esta ruta")} <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-slate-600">
        {t(
          lang,
          "Per person = the car shared by a full group. Going somewhere else? Type any hotel, town or address in the form above.",
          "Por persona = el vehículo compartido por un grupo completo. ¿Va a otro lugar? Escriba cualquier hotel, pueblo o dirección en el formulario de arriba.",
        )}
      </p>
    </section>
  );
}

function HowItWorks({ lang }: { lang: PublicLang }) {
  const steps = t(
    lang,
    [
      ["Tell us your route", "Pickup, drop-off, date and travellers. You see a fixed price per car right away."],
      ["Pick a vehicle, add stops", "Turn the drive into part of the trip with sightseeing stops, then send your request. Nothing is charged yet."],
      [
        "We confirm, you ride",
        "Our team confirms by email and in your trip chat. Pay online or in cash to the driver, and see your driver's name, photo and car before the trip.",
      ],
    ],
    [
      ["Díganos su ruta", "Recogida, destino, fecha y viajeros. Verá de inmediato un precio fijo por vehículo."],
      ["Elija un vehículo y agregue paradas", "Convierta el trayecto en parte del viaje con paradas turísticas y envíe su solicitud. Todavía no se cobra nada."],
      [
        "Confirmamos y usted viaja",
        "Nuestro equipo confirma por correo y en el chat de su viaje. Pague en línea o en efectivo al conductor, y vea el nombre, la foto y el vehículo de su conductor antes del viaje.",
      ],
    ],
  );
  return (
    <section aria-labelledby="how-h" className="max-w-6xl mx-auto px-4 sm:px-6 pt-14">
      <SectionHead id="how-h" title={t(lang, "How it works", "Cómo funciona")} />
      <ol className="mt-6 grid gap-4 md:grid-cols-3">
        {steps.map(([title, text], i) => (
          <li key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-950 text-base font-extrabold text-white" aria-hidden>
              {i + 1}
            </span>
            <h3 className="mt-3 text-lg font-extrabold text-slate-900">{title}</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-slate-600">{text}</p>
          </li>
        ))}
      </ol>
      <p className="mt-2">
        <Link href={localizedHref("/how-it-works", lang)} className={MORE_LINK}>
          {t(lang, "More about how it works", "Más sobre cómo funciona")} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </p>
    </section>
  );
}

function OnTheRoad({ lang }: { lang: PublicLang }) {
  return (
    <section aria-labelledby="road-h" className="max-w-6xl mx-auto px-4 sm:px-6 pt-12">
      <SectionHead
        id="road-h"
        title={t(lang, "On the road in Costa Rica", "En carretera por Costa Rica")}
        text={t(
          lang,
          "Highways, mountain passes and a ferry across the gulf: the drive is part of the trip. Your driver knows the road; you watch it go by.",
          "Autopistas, pasos de montaña y un ferry que cruza el golfo: el trayecto es parte del viaje. Su conductor conoce el camino; usted disfruta el paisaje.",
        )}
      />
      <ul className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {ON_THE_ROAD_PHOTOS.map((id) => (
          <li key={id}>
            <figure>
              <Photo id={id} lang={lang} sizes="(min-width: 1024px) 270px, 50vw" className="aspect-[3/2] rounded-xl" />
              <figcaption className="mt-2 text-sm leading-snug text-slate-600">{ROAD_CAPTIONS[id]?.[lang] ?? photoEntry(id).alt[lang]}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Short captions under the road photos (the alt text carries the full description). */
const ROAD_CAPTIONS: Record<string, Record<PublicLang, string>> = {
  "route-27-highway": { en: "Route 27, San José to the Pacific", es: "Ruta 27, de San José al Pacífico" },
  "central-valley-view": { en: "The Central Valley from the hills", es: "El Valle Central desde las colinas" },
  "gulf-ferry-crossing": { en: "The ferry across the Gulf of Nicoya", es: "El ferry por el golfo de Nicoya" },
  "mountain-sunset": { en: "Sunset from the Talamanca mountain road", es: "Atardecer desde la carretera de Talamanca" },
};

function Wildlife({ lang }: { lang: PublicLang }) {
  return (
    <section aria-labelledby="wildlife-h" className="max-w-6xl mx-auto px-4 sm:px-6 pt-12">
      <SectionHead
        id="wildlife-h"
        title={t(lang, "Who you might meet on the way", "A quién podría encontrar en el camino")}
        text={t(
          lang,
          "Sloths, monkeys, toucans and morpho butterflies live along these roads. Sightings are never guaranteed, but a sightseeing stop improves the odds.",
          "Perezosos, monos, tucanes y mariposas morfo viven a lo largo de estas rutas. Verlos nunca está garantizado, pero una parada turística mejora las probabilidades.",
        )}
      />
      <ul className="mt-6 grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {WILDLIFE_PHOTOS.map((id) => (
          <li key={id}>
            <Photo id={id} lang={lang} sizes="(min-width: 1024px) 180px, 33vw" className="aspect-[4/5] rounded-xl" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Four questions from the help center (src/lib/faq.ts), by id; the full list and its structured data live on /faq. */
const TEASER_IDS = ["per-car", "pay", "flight-delay", "cancel"];

function FaqTeaser({ lang, values }: { lang: PublicLang; values: FaqValues }) {
  const items = TEASER_IDS.flatMap((id) => FAQ_GROUPS.flatMap((g) => g.items).filter((i) => i.id === id));
  if (!items.length) return null;
  return (
    <section aria-labelledby="faq-h" className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-14">
      <SectionHead id="faq-h" title={t(lang, "Good to know", "Bueno saber")} />
      <div className="mt-5 grid gap-3 md:grid-cols-2 items-start">
        {items.map((item) => (
          <details key={item.id} className="group rounded-2xl border border-slate-200 bg-white">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-extrabold text-slate-900 [&::-webkit-details-marker]:hidden">
              <h3 className="text-base">{item.q[lang]}</h3>
              <span aria-hidden className="text-emerald-700 text-2xl leading-none group-open:rotate-45 transition">
                +
              </span>
            </summary>
            <p className="px-4 pb-4 leading-relaxed text-slate-600">{faqAnswer(item, lang, values)}</p>
          </details>
        ))}
      </div>
      <p className="mt-2">
        <Link href={localizedHref("/faq", lang)} className={MORE_LINK}>
          {t(lang, "All questions and answers", "Todas las preguntas y respuestas")} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </p>
    </section>
  );
}
