import { ArrowRight, Check, MessageCircle } from "lucide-react";
import Link from "next/link";
import { whatsAppLink } from "@/lib/cart";
import { localizedHref, t, type PublicLang } from "@/lib/publicLang";
import { PageSection, PublicPage } from "../PublicPage";

/*
 * Only claims that are true today (docs/PROJECT.md §10, src/lib/trust.ts):
 * no founding year, team size, review counts, awards or address. The ICT
 * permit is a per-driver badge, never a promise for every ride.
 */

export const ABOUT_PATH = "/about";

export function aboutMeta(lang: PublicLang) {
  return {
    title: t(lang, "About us", "Quiénes somos"),
    description: t(
      lang,
      "Costa Rica Private Transfers is a Costa Rica team that books private door-to-door transfers, 1-day tours and multi-day trips with vetted local drivers. Fixed prices, WhatsApp support.",
      "Costa Rica Private Transfers es un equipo en Costa Rica que reserva traslados privados puerta a puerta, tours de un día y viajes de varios días con conductores locales verificados.",
    ),
  };
}

export function AboutPage({ lang }: { lang: PublicLang }) {
  const es = lang === "es";
  const path = localizedHref(ABOUT_PATH, lang);
  const offers = es
    ? [
        {
          title: "Traslados privados puerta a puerta",
          text: "Del aeropuerto (SJO o Liberia) a su hotel, o entre destinos. Solo su grupo en el vehículo, y puede agregar paradas turísticas en el camino mientras su equipaje queda bajo llave con el conductor.",
        },
        {
          title: "Tours privados de un día",
          text: "Volcán Arenal, Manuel Antonio, Monteverde y la península de Osa, con la opción de terminar el día en su siguiente hotel.",
        },
        {
          title: "Viajes de varios días",
          text: "Rutas como Corcovado con noche en la Estación Sirena, o Arenal, Monteverde y Manuel Antonio en una semana, con permisos y botes organizados.",
        },
      ]
    : [
        {
          title: "Private door-to-door transfers",
          text: "From the airport (SJO or Liberia) to your hotel, or between destinations. Only your group in the vehicle, with optional sightseeing stops on the way while your luggage stays locked in with the driver.",
        },
        {
          title: "Private 1-day tours",
          text: "Arenal Volcano, Manuel Antonio, Monteverde and the Osa Peninsula, with the option to end the day at your next hotel.",
        },
        {
          title: "Multi-day trips",
          text: "Routes like Corcovado with a night at Sirena Station, or Arenal, Monteverde and Manuel Antonio in a week, with permits and boats arranged.",
        },
      ];
  const facts = es
    ? [
        ["Qué hacemos", "Traslados privados, tours de un día y viajes de varios días en Costa Rica"],
        ["Quién conduce", "Conductores locales independientes, entrevistados y verificados por nuestro equipo"],
        ["Precios", "Precio fijo por vehículo antes de reservar, o la opción de ofertas de conductores"],
        ["Pago", "En línea completo, o en efectivo al conductor en traslados y tours de un día"],
        ["Atención", "Por WhatsApp y correo, con nuestro equipo en Costa Rica"],
        ["Idiomas", "Inglés y español"],
      ]
    : [
        ["What we do", "Private transfers, 1-day tours and multi-day trips in Costa Rica"],
        ["Who drives", "Independent local drivers, interviewed and checked by our team"],
        ["Prices", "A fixed price per vehicle before you book, or the option of driver bids"],
        ["Payment", "Online in full, or cash to the driver on rides and 1-day tours"],
        ["Support", "WhatsApp and email, answered by our team in Costa Rica"],
        ["Languages", "English and Spanish"],
      ];

  return (
    <PublicPage
      lang={lang}
      current="about"
      photo="pacific-bay-aerial"
      path={path}
      crumbs={[{ label: t(lang, "About us", "Quiénes somos") }]}
      eyebrow={t(lang, "About us", "Quiénes somos")}
      title={t(lang, "A Costa Rica team for private transfers and tours", "Un equipo en Costa Rica para traslados y tours privados")}
      lead={
        <p>
          {t(
            lang,
            "Costa Rica Private Transfers books private door-to-door rides, 1-day tours and multi-day trips across Costa Rica with vetted local drivers. You see a fixed price before you book, and a real person on our team answers on WhatsApp.",
            "Costa Rica Private Transfers reserva traslados privados puerta a puerta, tours de un día y viajes de varios días por todo Costa Rica con conductores locales verificados. Usted ve un precio fijo antes de reservar, y una persona de nuestro equipo le responde por WhatsApp.",
          )}
        </p>
      }
    >
      <PageSection id="what" title={t(lang, "What we offer", "Lo que ofrecemos")}>
        <div className="grid gap-4 md:grid-cols-3">
          {offers.map((o) => (
            <div key={o.title} className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-extrabold text-slate-900">{o.title}</h3>
              <p className="mt-2 leading-relaxed text-slate-600">{o.text}</p>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection id="facts" tone="white" title={t(lang, "At a glance", "En resumen")}>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-[15px]">
            <tbody>
              {facts.map(([k, v]) => (
                <tr key={k} className="block sm:table-row border-b border-slate-200 last:border-0">
                  <th scope="row" className="block sm:table-cell sm:w-56 bg-slate-50 px-4 pt-3 pb-1 sm:p-4 align-top font-bold text-slate-900">
                    {k}
                  </th>
                  <td className="block sm:table-cell px-4 pt-1 pb-3 sm:p-4 bg-slate-50 sm:bg-white text-slate-700">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection
        id="drivers"
        title={t(lang, "Who drives you", "Quién lo lleva")}
        intro={
          <p>
            {t(
              lang,
              "Every ride is with an independent local partner driver. Before their first trip with us, we check their documents: driver's licence, criminal record certificate, INS commercial insurance, the vehicle's Dekra (RTV) inspection and Marchamo. Drivers who hold an ICT tourist-transport permit show an ICT badge on their profile.",
              "Cada viaje lo hace un conductor local independiente asociado. Antes de su primer viaje con nosotros revisamos sus documentos: licencia de conducir, hoja de delincuencia, seguro comercial del INS, la revisión técnica (Dekra / RTV) y el Marchamo del vehículo. Los conductores con permiso de transporte turístico del ICT muestran una insignia ICT en su perfil.",
            )}
          </p>
        }
      >
        <Link
          href={localizedHref("/our-drivers", lang)}
          className="inline-flex min-h-11 items-center gap-2 font-bold text-emerald-700 hover:underline"
        >
          {t(lang, "Our drivers & safety standards", "Nuestros conductores y estándares de seguridad")}{" "}
          <ArrowRight className="w-4 h-4" aria-hidden />
        </Link>
      </PageSection>

      <PageSection
        id="how-we-work"
        tone="white"
        title={t(lang, "How we work", "Cómo trabajamos")}
      >
        <ul className="grid gap-3 sm:grid-cols-2 max-w-4xl">
          {(es
            ? [
                "Precio fijo por vehículo, confirmado antes de pagar: sin recargos en la puerta del hotel.",
                "O elija \"ofertas de conductores\" y proponga su propio precio.",
                "Tiempos de viaje realistas para carreteras de montaña, no estimaciones en línea recta.",
                "Cancelación gratuita hasta 24 horas antes de la recogida en traslados y tours de un día.",
                "Su página privada del viaje con el perfil del conductor, el vehículo y el chat.",
                "Atención por WhatsApp primero: escríbanos y le responde una persona.",
              ]
            : [
                "A fixed price per vehicle, confirmed before you pay: nothing extra at the hotel door.",
                "Or choose \"driver bids\" and name your own price.",
                "Realistic mountain-road drive times, never straight-line estimates.",
                "Free cancellation up to 24 hours before pickup on rides and 1-day tours.",
                "Your private trip page with the driver's profile, the vehicle and a chat.",
                "WhatsApp-first support: message us and a person answers.",
              ]
          ).map((x) => (
            <li key={x} className="flex gap-3 text-slate-700">
              <Check className="w-5 h-5 shrink-0 text-emerald-600" aria-hidden />
              {x}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={localizedHref("/", lang)}
            className="min-h-12 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 font-extrabold text-slate-950 inline-flex items-center gap-2"
          >
            {t(lang, "Plan a trip", "Planear un viaje")} <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
          <a
            href={whatsAppLink(t(lang, "Hi! I have a question about my Costa Rica trip.", "¡Hola! Tengo una pregunta sobre mi viaje a Costa Rica."))}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-12 px-5 rounded-xl bg-emerald-950 text-white font-bold inline-flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4" aria-hidden /> WhatsApp
          </a>
        </div>
      </PageSection>
    </PublicPage>
  );
}
