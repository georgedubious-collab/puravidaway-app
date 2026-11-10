"use client";

import { CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { sendContactMessage } from "@/app/contact/actions";
import { CONTACT_LIMITS, CONTACT_TOPICS, isContactTopic, type ContactState } from "@/lib/contactForm";
import { t, type PublicLang } from "@/lib/publicLang";

const field =
  "mt-1 w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3.5 text-base text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20";

/** Contact form. `?topic=agents` (etc.) preselects the topic. */
export function ContactForm({ lang, presetTopic }: { lang: PublicLang; presetTopic?: string | null }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContactMessage, {});
  const preset = isContactTopic(presetTopic) ? presetTopic : "trip";

  if (state.ok) {
    return (
      <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <CheckCircle2 className="w-8 h-8 text-emerald-600" aria-hidden />
        <h3 className="mt-3 text-xl font-extrabold text-slate-900">{t(lang, "Thank you, message sent", "Gracias, mensaje enviado")}</h3>
        <p className="mt-2 text-slate-700">
          {t(
            lang,
            "Our team will reply to your email soon. For anything urgent about a trip today, please message us on WhatsApp.",
            "Nuestro equipo le responderá pronto a su correo. Si es urgente y su viaje es hoy, escríbanos por WhatsApp.",
          )}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
      <input type="hidden" name="lang" value={lang} />
      {/* Honeypot for bots: hidden from people and screen readers. */}
      <div aria-hidden className="absolute -left-[9999px] w-px h-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-bold text-slate-800">
          {t(lang, "Your name", "Su nombre")}
          <input name="name" required maxLength={CONTACT_LIMITS.name} autoComplete="name" className={field} />
        </label>
        <label className="block text-sm font-bold text-slate-800">
          {t(lang, "Email", "Correo electrónico")}
          <input name="email" type="email" required maxLength={CONTACT_LIMITS.email} autoComplete="email" className={field} />
        </label>
      </div>
      <label className="block text-sm font-bold text-slate-800">
        {t(lang, "Topic", "Tema")}
        <select name="topic" defaultValue={preset} key={preset} className={field}>
          {CONTACT_TOPICS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label[lang]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-bold text-slate-800">
        {t(lang, "Message", "Mensaje")}
        <textarea
          name="message"
          required
          minLength={CONTACT_LIMITS.minMessage}
          maxLength={CONTACT_LIMITS.message}
          rows={6}
          className={`${field} py-3`}
          placeholder={t(
            lang,
            "Dates, route, number of travellers, or your booking reference (CRPT-…)",
            "Fechas, ruta, número de viajeros o su código de reserva (CRPT-…)",
          )}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 px-6 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-white font-bold disabled:opacity-50"
        >
          {pending ? t(lang, "Sending…", "Enviando…") : t(lang, "Send message", "Enviar mensaje")}
        </button>
        <p aria-live="polite" className="text-sm font-semibold text-red-700">
          {state.error}
        </p>
      </div>
      <p className="text-xs text-slate-500">
        {t(
          lang,
          "We use your details only to answer you. Please don't send card numbers.",
          "Usamos sus datos solo para responderle. Por favor no envíe números de tarjeta.",
        )}
      </p>
    </form>
  );
}

/** Reads ?topic= from the address; wrap in <Suspense> so the page stays static. */
export function ContactFormFromUrl({ lang }: { lang: PublicLang }) {
  const params = useSearchParams();
  return <ContactForm lang={lang} presetTopic={params.get("topic")} />;
}
