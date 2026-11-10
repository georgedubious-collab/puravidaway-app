import { ArrowRight, MapPin, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";
import { localizedHref, t, type PublicLang } from "@/lib/publicLang";
import { DriverStandards } from "../../trust/DriverStandards";
import { PageSection, PublicPage } from "../PublicPage";

/*
 * Driver wording rules: docs/PROJECT.md §10 and src/lib/trust.ts. The ICT
 * permit is a per-driver badge, never a blanket claim.
 */

export const DRIVERS_PATH = "/our-drivers";

export function driversMeta(lang: PublicLang) {
  return {
    title: t(lang, "Our drivers & safety", "Nuestros conductores y seguridad"),
    description: t(
      lang,
      "How we vet our local partner drivers in Costa Rica: interviews, criminal and driving record checks, licence, INS commercial insurance, Dekra (RTV) and Marchamo. Ratings after every trip and location sharing on the day.",
      "Cómo verificamos a nuestros conductores locales en Costa Rica: entrevista, antecedentes penales y de manejo, licencia, seguro comercial del INS, Dekra (RTV) y Marchamo. Calificaciones después de cada viaje.",
    ),
  };
}

export function OurDriversPage({ lang }: { lang: PublicLang }) {
  const docs = t(
    lang,
    [
      ["Driver's licence", "Valid licence, with its expiry date on file."],
      ["Criminal record certificate", "A current certificate (hoja de delincuencia)."],
      ["INS commercial insurance", "Insurance for carrying passengers, kept current."],
      ["Dekra (RTV) inspection", "The vehicle's technical inspection, kept current."],
      ["Marchamo", "The vehicle's yearly circulation permit."],
      ["ICT tourism permit", "Shown as a badge on the profile of drivers who hold one."],
    ],
    [
      ["Licencia de conducir", "Licencia vigente, con su fecha de vencimiento registrada."],
      ["Hoja de delincuencia", "Un certificado de antecedentes penales reciente."],
      ["Seguro comercial del INS", "Seguro para el transporte de pasajeros, al día."],
      ["Revisión técnica (Dekra / RTV)", "La inspección técnica del vehículo, al día."],
      ["Marchamo", "El derecho de circulación anual del vehículo."],
      ["Permiso de turismo del ICT", "Se muestra como insignia en el perfil de los conductores que lo tienen."],
    ],
  );
  const onTrip = t(
    lang,
    [
      {
        Icon: ShieldCheck,
        title: "Documents tracked, not just checked once",
        text: "Our team records each document's expiry date. A driver or vehicle with an expired licence, insurance, Dekra or Marchamo can't be given trips until it is renewed, and changed documents are reviewed again before new jobs.",
      },
      {
        Icon: MapPin,
        title: "Location sharing on the day",
        text: "With the driver's consent, their position is shared from up to 3 hours before your pickup until the trip ends. You see it on your trip page; our team sees it too, and is alerted if a driver looks likely to be late.",
      },
      {
        Icon: Star,
        title: "Rated after every trip",
        text: "Travellers rate their driver from 1 to 5 stars after each trip. Ratings help decide which driver we choose for the next trips.",
      },
    ],
    [
      {
        Icon: ShieldCheck,
        title: "Documentos vigilados, no solo revisados una vez",
        text: "Nuestro equipo registra el vencimiento de cada documento. Un conductor o vehículo con licencia, seguro, Dekra o Marchamo vencido no puede recibir viajes hasta renovarlo, y los documentos que cambian se revisan de nuevo antes de nuevos viajes.",
      },
      {
        Icon: MapPin,
        title: "Ubicación compartida el día del viaje",
        text: "Con el consentimiento del conductor, su posición se comparte desde hasta 3 horas antes de la recogida hasta que termina el viaje. Usted la ve en la página de su viaje; nuestro equipo también, y recibe una alerta si el conductor podría llegar tarde.",
      },
      {
        Icon: Star,
        title: "Calificado después de cada viaje",
        text: "Los viajeros califican a su conductor de 1 a 5 estrellas después de cada viaje. Las calificaciones ayudan a decidir qué conductor elegimos para los próximos viajes.",
      },
    ],
  );

  return (
    <PublicPage
      lang={lang}
      current="drivers"
      photo="gulf-sunset-ferry"
      path={localizedHref(DRIVERS_PATH, lang)}
      crumbs={[{ label: t(lang, "Our drivers & safety", "Nuestros conductores") }]}
      eyebrow={t(lang, "Our drivers & safety", "Conductores y seguridad")}
      title={t(lang, "Vetted local drivers you meet before the trip", "Conductores locales verificados que usted conoce antes del viaje")}
      lead={
        <p>
          {t(
            lang,
            "Every ride is with an independent local partner driver we have interviewed and checked: criminal and driving records, licence, INS commercial insurance, and the vehicle's Dekra (RTV) inspection and Marchamo. You see your driver's name, photo and car on your trip page before you travel.",
            "Cada viaje es con un conductor local independiente asociado que hemos entrevistado y verificado: antecedentes penales y de manejo, licencia, seguro comercial del INS, y la revisión técnica (Dekra / RTV) y el Marchamo del vehículo. Usted ve el nombre, la foto y el vehículo de su conductor en la página de su viaje antes de viajar.",
          )}
        </p>
      }
    >
      <DriverStandards lang={lang} />

      <PageSection id="documents" title={t(lang, "Documents we check", "Documentos que revisamos")}>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th scope="col" className="p-4 font-bold">{t(lang, "Document", "Documento")}</th>
                <th scope="col" className="p-4 font-bold">{t(lang, "What we check", "Qué revisamos")}</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(([k, v]) => (
                <tr key={k} className="border-t border-slate-200">
                  <th scope="row" className="p-4 align-top font-bold text-slate-900">{k}</th>
                  <td className="p-4 text-slate-700">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection id="on-trip" tone="white" title={t(lang, "Safety before and during your trip", "Seguridad antes y durante su viaje")}>
        <div className="grid gap-4 md:grid-cols-3">
          {onTrip.map(({ Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-slate-200 p-6">
              <Icon className="w-6 h-6 text-emerald-600" aria-hidden />
              <h3 className="mt-3 text-lg font-extrabold text-slate-900">{title}</h3>
              <p className="mt-2 leading-relaxed text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        id="drive"
        title={t(lang, "Drive with us", "Conduzca con nosotros")}
        intro={
          <p>
            {t(
              lang,
              "Are you a professional driver in Costa Rica with your own vehicle? Apply online, upload your documents, and once approved you can send offers on trips that suit your area and schedule.",
              "¿Es usted conductor profesional en Costa Rica con vehículo propio? Aplique en línea, suba sus documentos y, una vez aprobado, podrá enviar ofertas en viajes que se ajusten a su zona y horario.",
            )}
          </p>
        }
      >
        <Link
          href="/driver"
          className="min-h-12 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 font-extrabold text-slate-950 inline-flex items-center gap-2"
        >
          {t(lang, "Apply as a driver", "Aplicar como conductor")} <ArrowRight className="w-4 h-4" aria-hidden />
        </Link>
      </PageSection>
    </PublicPage>
  );
}
