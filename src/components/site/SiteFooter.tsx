import { Mail, MessageCircle } from "lucide-react";
import Link from "next/link";
import { HAS_CONSENT_TOOLS } from "@/lib/analyticsConfig";
import { whatsAppLink } from "@/lib/cart";
import { localizedHref, t, type PublicLang } from "@/lib/publicLang";
import { CONTACT_EMAIL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { footerColumns } from "@/lib/siteNav";
import { SOCIAL_LINKS } from "@/lib/social";
import { CARRIER_NOTE, CARRIER_NOTE_ES } from "@/lib/trust";
import { Logo } from "../brand/Logo";
import { CookieSettingsLink } from "./CookieSettingsLink";
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 grid gap-6 sm:gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,3fr)]">
        <div>
          <Link href={localizedHref("/", lang)} aria-label={SITE_NAME} className="inline-flex items-center min-h-11">
            <Logo on="dark" />
          </Link>
          <p className="mt-3 hidden sm:block leading-relaxed text-emerald-200">
            {t(
              lang,
              "Private door-to-door transfers and 1-day tours across Costa Rica with vetted local drivers.",
              "Traslados privados puerta a puerta y tours de un día por Costa Rica con conductores locales verificados.",
            )}
          </p>
          <ul className="mt-2 sm:mt-4 flex flex-wrap gap-x-5 sm:block sm:space-y-1">
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

        <div className="grid gap-x-4 gap-y-5 sm:gap-8 grid-cols-2 sm:grid-cols-3">
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-400">{col.title}</p>
              <ul className="mt-2">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="min-h-11 py-1 inline-flex items-center leading-snug text-emerald-100 hover:text-white hover:underline">
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
          {/* Only when a measurement tool is switched on (docs/SEO.md §7); otherwise there is nothing to choose. */}
          {HAS_CONSENT_TOOLS && <CookieSettingsLink lang={lang} />}
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
          logo: `${SITE_URL}/brand/logo-mark-1024.png`,
          areaServed: { "@type": "Country", name: "Costa Rica" },
          knowsLanguage: ["en", "es"],
          ...(SOCIAL_LINKS.length ? { sameAs: SOCIAL_LINKS.map((s) => s.url) } : {}),
        }}
      />
    </footer>
  );
}
