import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { whatsAppLink } from "@/lib/cart";
import { FAQ_GROUPS, faqAnswer } from "@/lib/faq";
import { localizedHref, t, type PublicLang } from "@/lib/publicLang";
import { JsonLd } from "../JsonLd";
import { PublicPage } from "../PublicPage";

export const FAQ_PATH = "/faq";

export function faqMeta(lang: PublicLang) {
  return {
    title: t(lang, "Help & FAQ", "Ayuda y preguntas frecuentes"),
    description: t(
      lang,
      "Answers about private transfers and tours in Costa Rica: booking, prices and payment, flight delays and waiting time, drivers and vehicles, child seats, cancellation, ferries and Drake Bay boats.",
      "Respuestas sobre traslados y tours privados en Costa Rica: reservas, precios y pago, atrasos de vuelo y espera, conductores y vehículos, sillas para niños, cancelación, ferry y botes a Bahía Drake.",
    ),
  };
}

export function FaqPage({ lang, cashFeeBps }: { lang: PublicLang; cashFeeBps: number }) {
  return (
    <PublicPage
      lang={lang}
      current="help"
      path={localizedHref(FAQ_PATH, lang)}
      crumbs={[{ label: t(lang, "Help & FAQ", "Ayuda") }]}
      eyebrow={t(lang, "Help center", "Centro de ayuda")}
      title={t(lang, "Questions travellers ask", "Preguntas frecuentes")}
      lead={
        <p>
          {t(
            lang,
            "Quick answers about booking a private transfer, tour or multi-day trip with us. Can't find yours? Message our team on WhatsApp.",
            "Respuestas rápidas sobre cómo reservar con nosotros un traslado privado, un tour o un viaje de varios días. ¿No encuentra la suya? Escriba a nuestro equipo por WhatsApp.",
          )}
        </p>
      }
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <nav aria-label={t(lang, "Topics", "Temas")} className="mb-8 lg:mb-0 lg:sticky lg:top-24 lg:self-start">
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {FAQ_GROUPS.map((g) => (
              <li key={g.id}>
                <a
                  href={`#${g.id}`}
                  className="min-h-11 inline-flex items-center px-4 lg:px-3 rounded-full lg:rounded-lg border border-slate-300 lg:border-0 bg-white lg:bg-transparent text-sm font-semibold text-slate-700 hover:text-emerald-700"
                >
                  {g.title[lang]}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-10 min-w-0">
          {FAQ_GROUPS.map((g) => (
            <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`} className="scroll-mt-24">
              <h2 id={`${g.id}-h`} className="text-2xl font-extrabold tracking-tight text-slate-900">
                {g.title[lang]}
              </h2>
              <div className="mt-4 space-y-3">
                {g.items.map((item, i) => (
                  <details key={item.id} id={`q-${item.id}`} className="group rounded-2xl border border-slate-200 bg-white" open={i === 0}>
                    <summary className="min-h-14 cursor-pointer list-none px-5 py-4 font-extrabold text-slate-900 flex items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                      <h3 className="text-base">{item.q[lang]}</h3>
                      <span aria-hidden className="text-emerald-700 text-2xl leading-none group-open:rotate-45 transition">+</span>
                    </summary>
                    <p className="px-5 pb-5 -mt-1 leading-relaxed text-slate-600">{faqAnswer(item, lang, cashFeeBps)}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}

          <div className="rounded-2xl bg-emerald-950 text-white p-6 sm:p-8">
            <h2 className="text-xl font-extrabold">{t(lang, "Still have a question?", "¿Todavía tiene una pregunta?")}</h2>
            <p className="mt-2 text-emerald-100">
              {t(lang, "A real person on our team answers.", "Le responde una persona de nuestro equipo.")}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={whatsAppLink(t(lang, "Hi! I have a question about my Costa Rica trip.", "¡Hola! Tengo una pregunta sobre mi viaje a Costa Rica."))}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-12 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold inline-flex items-center gap-2"
              >
                <MessageCircle className="w-5 h-5" aria-hidden /> WhatsApp
              </a>
              <Link
                href={localizedHref("/contact", lang)}
                className="min-h-12 px-5 rounded-xl bg-emerald-800 hover:bg-emerald-700 font-bold inline-flex items-center"
              >
                {t(lang, "Contact us", "Contáctenos")}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: lang,
          mainEntity: FAQ_GROUPS.flatMap((g) =>
            g.items.map((item) => ({
              "@type": "Question",
              name: item.q[lang],
              acceptedAnswer: { "@type": "Answer", text: faqAnswer(item, lang, cashFeeBps) },
            })),
          ),
        }}
      />
    </PublicPage>
  );
}
