import { ON_THE_ROAD_PHOTOS, photoEntry, WILDLIFE_PHOTOS } from "@/lib/photos";
import { t, type PublicLang } from "@/lib/publicLang";
import { Photo } from "./Photo";

/**
 * The home page below the trip builder (server-rendered, passed into the
 * Storefront by HomePage): photos of the road and the wildlife on the way.
 * Section titles are H2: the page's only H1 is in the hero.
 */
export function HomeSections({ lang }: { lang: PublicLang }) {
  return (
    <div className="bg-white border-t border-slate-200">
      <OnTheRoad lang={lang} />
      <Wildlife lang={lang} />
    </div>
  );
}

function SectionHead({ id, title, text }: { id: string; title: string; text: string }) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
        {title}
      </h2>
      <p className="mt-2 text-base leading-relaxed text-slate-600">{text}</p>
    </div>
  );
}

function OnTheRoad({ lang }: { lang: PublicLang }) {
  return (
    <section aria-labelledby="road-h" className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
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
    <section aria-labelledby="wildlife-h" className="max-w-6xl mx-auto px-4 sm:px-6 pb-14">
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
