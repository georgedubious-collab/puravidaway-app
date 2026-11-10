import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatBpsPercent } from "@/lib/pricing";
import { localizedHref, t, type PublicLang } from "@/lib/publicLang";
import { PageSection, PublicPage } from "../PublicPage";

/*
 * Must match how the product works today (docs/PROJECT.md §4.1, §6.4,
 * src/lib/trust.ts, /cancellation). Online payment: the team sends a secure
 * link after confirming; never "pay now".
 */

export const HOW_PATH = "/how-it-works";

export function howMeta(lang: PublicLang) {
  return {
    title: t(lang, "How it works", "Cómo funciona"),
    description: t(
      lang,
      "How booking a private transfer or tour in Costa Rica works: plan your trip, get a fixed price or driver bids, confirm, meet your driver, follow them in the last hours and rate the ride.",
      "Cómo funciona reservar un traslado o tour privado en Costa Rica: planee su viaje, reciba un precio fijo u ofertas de conductores, confirme, conozca a su conductor y califique el viaje.",
    ),
  };
}

export function HowItWorksPage({ lang, cashFeeBps }: { lang: PublicLang; cashFeeBps: number }) {
  const fee = formatBpsPercent(cashFeeBps);
  const steps = t(
    lang,
    [
      {
        title: "Plan your trip",
        text: "Type your pickup and drop-off (airport, hotel, address or town), the date, time and travellers. Add sightseeing stops on the way, a 1-day tour or a multi-day trip, all in one trip.",
      },
      {
        title: "Fixed price or driver bids",
        text: "See a fixed price per vehicle, with the season already included, before you book. Or choose \"Driver bids\" and name your own offer; the fixed price is shown as a reference.",
      },
      {
        title: "Send your request and choose how to pay",
        text: `Send your name, email and WhatsApp number; you get your private trip page by email. Pay online in full (we send a secure payment link once our team confirms the trip), or pay your driver in cash on rides and 1-day tours, plus a ${fee} cash booking fee shown in your total. Multi-day trips are paid online in full.`,
      },
      {
        title: "Meet your driver before the trip",
        text: "Once your driver is confirmed, your trip page shows their name, photo and car, and an ICT badge if they hold a tourism permit.",
      },
      {
        title: "On the day",
        text: "Your driver meets you at arrivals or at your hotel. In the last 3 hours before pickup, while your driver shares their location, you see where they are and when they should arrive. You, your driver and our team can chat on the trip page.",
      },
      {
        title: "Rate your ride",
        text: "After the trip we email you to rate your driver from 1 to 5 stars. Ratings help us choose drivers for future trips.",
      },
    ],
    [
      {
        title: "Planee su viaje",
        text: "Escriba el punto de recogida y de destino (aeropuerto, hotel, dirección o pueblo), la fecha, la hora y los viajeros. Agregue paradas turísticas en el camino, un tour de un día o un viaje de varios días, todo en un mismo viaje.",
      },
      {
        title: "Precio fijo u ofertas de conductores",
        text: "Vea un precio fijo por vehículo, con la temporada ya incluida, antes de reservar. O elija \"Ofertas de conductores\" y proponga su propio precio; el precio fijo aparece como referencia.",
      },
      {
        title: "Envíe su solicitud y elija cómo pagar",
        text: `Envíe su nombre, correo y número de WhatsApp; recibirá por correo la página privada de su viaje. Pague en línea completo (le enviamos un enlace de pago seguro cuando nuestro equipo confirma el viaje), o pague al conductor en efectivo en traslados y tours de un día, más un cargo por reserva en efectivo del ${fee} que se muestra en su total. Los viajes de varios días se pagan en línea completos.`,
      },
      {
        title: "Conozca a su conductor antes del viaje",
        text: "Cuando su conductor está confirmado, la página del viaje muestra su nombre, foto y vehículo, y una insignia ICT si tiene permiso de turismo.",
      },
      {
        title: "El día del viaje",
        text: "Su conductor lo recibe en la salida del aeropuerto o en su hotel. En las últimas 3 horas antes de la recogida, mientras el conductor comparte su ubicación, usted ve dónde está y a qué hora debería llegar. Usted, su conductor y nuestro equipo pueden chatear en la página del viaje.",
      },
      {
        title: "Califique su viaje",
        text: "Después del viaje le enviamos un correo para calificar a su conductor de 1 a 5 estrellas. Las calificaciones nos ayudan a elegir conductores para próximos viajes.",
      },
    ],
  );
  const included = t(
    lang,
    [
      ["Flight tracking", "On airport pickups we follow your flight."],
      ["60 min free waiting", "After your flight lands, or after your pickup time."],
      ["Child seats", "Free on request; tell us the children's ages."],
      ["Free cancellation", "Up to 24 hours before pickup on rides and 1-day tours."],
    ],
    [
      ["Seguimiento del vuelo", "En recogidas en el aeropuerto seguimos su vuelo."],
      ["60 min de espera gratis", "Después de que aterriza su vuelo, o después de la hora de recogida."],
      ["Sillas para niños", "Gratis a solicitud; indíquenos las edades de los niños."],
      ["Cancelación gratuita", "Hasta 24 horas antes de la recogida en traslados y tours de un día."],
    ],
  );

  return (
    <PublicPage
      lang={lang}
      current="how"
      path={localizedHref(HOW_PATH, lang)}
      crumbs={[{ label: t(lang, "How it works", "Cómo funciona") }]}
      eyebrow={t(lang, "How it works", "Cómo funciona")}
      title={t(lang, "How booking a private ride works", "Cómo funciona reservar un viaje privado")}
      lead={
        <p>
          {t(
            lang,
            "Plan your ride, see a fixed price (or ask drivers to bid), send your request, and pay online or in cash to the driver. You meet your driver's profile before the trip, follow them in the last hours before pickup, and rate the ride afterwards.",
            "Planee su viaje, vea un precio fijo (o pida ofertas a los conductores), envíe su solicitud y pague en línea o en efectivo al conductor. Conoce el perfil de su conductor antes del viaje, lo sigue en las últimas horas antes de la recogida y califica el viaje al final.",
          )}
        </p>
      }
    >
      <PageSection id="steps" title={t(lang, "Step by step", "Paso a paso")}>
        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-slate-200 bg-white p-6">
              <span className="w-9 h-9 rounded-full bg-emerald-950 text-amber-400 font-extrabold flex items-center justify-center" aria-hidden>
                {i + 1}
              </span>
              <h3 className="mt-3 text-lg font-extrabold text-slate-900">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </PageSection>

      <PageSection id="included" tone="white" title={t(lang, "Every ride includes", "Cada viaje incluye")}>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-[15px]">
            <tbody>
              {included.map(([k, v]) => (
                <tr key={k} className="border-b border-slate-200 last:border-0">
                  <th scope="row" className="w-44 sm:w-60 bg-slate-50 p-4 align-top font-bold text-slate-900">
                    {k}
                  </th>
                  <td className="p-4 text-slate-700">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          {t(lang, "Full rules, including multi-day trips:", "Reglas completas, incluidos los viajes de varios días:")}{" "}
          <Link href={localizedHref("/cancellation", lang)} className="font-semibold text-emerald-700 underline">
            {t(lang, "Cancellation policy", "Política de cancelación")}
          </Link>
        </p>
      </PageSection>

      <PageSection id="start" title={t(lang, "Ready to plan?", "¿Listo para planear?")}>
        <div className="flex flex-wrap gap-3">
          <Link
            href={localizedHref("/", lang)}
            className="min-h-12 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 font-extrabold text-slate-950 inline-flex items-center gap-2"
          >
            {t(lang, "Plan a trip", "Planear un viaje")} <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
          <Link
            href={localizedHref("/faq", lang)}
            className="min-h-12 px-5 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 inline-flex items-center"
          >
            {t(lang, "Read the FAQ", "Ver preguntas frecuentes")}
          </Link>
        </div>
      </PageSection>
    </PublicPage>
  );
}
