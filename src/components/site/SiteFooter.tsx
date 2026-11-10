import { Compass, Mail, MessageCircle } from "lucide-react";
import Link from "next/link";
import { whatsAppLink } from "@/lib/cart";
import { t, type PublicLang } from "@/lib/publicLang";
import { CONTACT_EMAIL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { footerColumns } from "@/lib/siteNav";
import { SOCIAL_LINKS } from "@/lib/social";
import { CARRIER_NOTE, CARRIER_NOTE_ES } from "@/lib/trust";
import { JsonLd } from "./JsonLd";
import { SocialIcons } from "./SocialIcons";

/**
 * The public site's footer (server component, no hooks). Also carries the
 * site-wide Organization structured data, so every public page has it.
 * Only real facts: no address, phone or rating until they exist.
 */
export function SiteFooter({ lang }: { lang: PublicLang }) {
  const year = new Date().getFullYear();
  const columns = footerColumns(lang);
  return (
    <footer className="bg-emerald-950 text-emerald-100 text-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,3fr)]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center text-emerald-950">
              <Compass className="w-5 h-5" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="font-extrabold text-lg leading-tight text-white">{SITE_NAME}</span>
          </Link>
          <p className="mt-3 leading-relaxed text-emerald-200">
            {t(
              lang,
              "Private door-to-door transfers, 1-day tours and multi-day trips across Costa Rica with vetted local drivers.",
              "Traslados privados puerta a puerta, tours de un día y viajes de varios días por Costa Rica con conductores locales verificados.",
            )}
          </p>
          <ul className="mt-4 space-y-1">
            <li>
              <a
                href={whatsAppLink(
                  t(lang, "Hi! I have a question about my Costa Rica trip.", "¡Hola! Tengo una pregunta sobre mi viaje a Costa Rica."),
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-11 inline-flex items-center gap-2 font-bold text-white hover:text-amber-300"
              >
                <MessageCircle className="w-4 h-4" aria-hidden /> WhatsApp
              </a>
            </li>
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="min-h-11 inline-flex items-center gap-2 font-bold text-white hover:text-amber-300 break-all">
                <Mail className="w-4 h-4 shrink-0" aria-hidden /> {CONTACT_EMAIL}
              </a>
            </li>
          </ul>
          <div className="mt-4">
            <SocialIcons label={t(lang, "Follow us", "Síganos")} />
          </div>
        </div>

        <div className="grid gap-8 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-amber-400">{col.title}</h2>
              <ul className="mt-2">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="min-h-11 py-1.5 inline-flex items-center leading-snug text-emerald-100 hover:text-white hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t border-emerald-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-2 text-xs text-emerald-300">
          <p>
            © {year} {SITE_NAME}. {t(lang, "All prices in USD.", "Todos los precios en USD.")}
          </p>
          <p className="leading-relaxed">{lang === "es" ? CARRIER_NOTE_ES : CARRIER_NOTE}</p>
        </div>
      </div>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TravelAgency",
          "@id": `${SITE_URL}/#organization`,
          name: SITE_NAME,
          url: `${SITE_URL}/`,
          email: CONTACT_EMAIL,
          description: SITE_DESCRIPTION,
          areaServed: { "@type": "Country", name: "Costa Rica" },
          knowsLanguage: ["en", "es"],
          ...(SOCIAL_LINKS.length ? { sameAs: SOCIAL_LINKS.map((s) => s.url) } : {}),
        }}
      />
    </footer>
  );
}
