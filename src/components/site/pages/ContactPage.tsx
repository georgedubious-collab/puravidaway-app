import { Mail, MessageCircle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { whatsAppLink } from "@/lib/cart";
import { localizedHref, t, type PublicLang } from "@/lib/publicLang";
import { CONTACT_EMAIL } from "@/lib/site";
import { ContactForm, ContactFormFromUrl } from "../ContactForm";
import { PageSection, PublicPage } from "../PublicPage";

export const CONTACT_PATH = "/contact";

export function contactMeta(lang: PublicLang) {
  return {
    title: t(lang, "Contact us", "Contacto"),
    description: t(
      lang,
      "Contact Costa Rica Private Transfers on WhatsApp, by email at hello@costaricaprivatetransfers.com, or with our form. Trip questions, existing bookings, hotels and travel agents, drivers.",
      "Contacte a Costa Rica Private Transfers por WhatsApp, por correo a hello@costaricaprivatetransfers.com o con nuestro formulario. Preguntas de viaje, reservas, hoteles y agencias, conductores.",
    ),
  };
}

export function ContactPage({ lang }: { lang: PublicLang }) {
  return (
    <PublicPage
      lang={lang}
      current="contact"
      path={localizedHref(CONTACT_PATH, lang)}
      crumbs={[{ label: t(lang, "Contact", "Contacto") }]}
      eyebrow={t(lang, "Contact", "Contacto")}
      title={t(lang, "Talk to our team", "Hable con nuestro equipo")}
      lead={
        <p>
          {t(
            lang,
            "WhatsApp is the fastest way to reach us: a real person on our team in Costa Rica answers. You can also email us or send the form below.",
            "WhatsApp es la forma más rápida de contactarnos: le responde una persona de nuestro equipo en Costa Rica. También puede escribirnos por correo o enviar el formulario.",
          )}
        </p>
      }
    >
      <PageSection id="channels" title={t(lang, "Ways to reach us", "Cómo contactarnos")}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start">
          <div className="space-y-4">
            <a
              href={whatsAppLink(t(lang, "Hi! I have a question about my Costa Rica trip.", "¡Hola! Tengo una pregunta sobre mi viaje a Costa Rica."))}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-2xl bg-emerald-950 p-5 text-white hover:bg-emerald-900"
            >
              <span className="w-12 h-12 shrink-0 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center">
                <MessageCircle className="w-6 h-6" aria-hidden />
              </span>
              <span>
                <span className="block text-lg font-extrabold">{t(lang, "Chat on WhatsApp", "Escríbanos por WhatsApp")}</span>
                <span className="text-sm text-emerald-100">{t(lang, "Fastest answer", "La respuesta más rápida")}</span>
              </span>
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:border-emerald-500"
            >
              <span className="w-12 h-12 shrink-0 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Mail className="w-6 h-6" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-extrabold text-slate-900">{t(lang, "Email", "Correo")}</span>
                <span className="text-sm text-slate-600 break-all">{CONTACT_EMAIL}</span>
              </span>
            </a>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-600">
              <p>
                <span className="font-bold text-slate-900">{t(lang, "Already booked?", "¿Ya reservó?")}</span>{" "}
                {t(
                  lang,
                  "The fastest way to reach your driver and our team is the chat on your private trip page (the link is in your confirmation email).",
                  "La forma más rápida de hablar con su conductor y nuestro equipo es el chat en la página privada de su viaje (el enlace está en su correo de confirmación).",
                )}
              </p>
              <p className="mt-3">
                <span className="font-bold text-slate-900">{t(lang, "Want to drive with us?", "¿Quiere conducir con nosotros?")}</span>{" "}
                <Link href="/driver" className="font-semibold text-emerald-700 underline">
                  {t(lang, "Apply as a driver", "Aplique como conductor")}
                </Link>
              </p>
              <p className="mt-3">
                <Link href={localizedHref("/faq", lang)} className="font-semibold text-emerald-700 underline">
                  {t(lang, "Read the FAQ", "Vea las preguntas frecuentes")}
                </Link>
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-extrabold text-slate-900">{t(lang, "Send us a message", "Envíenos un mensaje")}</h3>
            <Suspense fallback={<ContactForm lang={lang} />}>
              <ContactFormFromUrl lang={lang} />
            </Suspense>
          </div>
        </div>
      </PageSection>
    </PublicPage>
  );
}
