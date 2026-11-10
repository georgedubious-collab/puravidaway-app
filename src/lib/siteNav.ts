/**
 * Navigation of the public website: the header menu and the footer columns.
 * Hrefs are ENGLISH paths; localizedHref() (src/lib/publicLang.ts) turns them
 * into the Spanish page (every public page has one; /driver stays as it is).
 * Labels are per language.
 */
import { localizedHref, type PublicLang } from "./publicLang";
import { ROUTE_PAGES } from "./routePages";
import { localizeRoutePage } from "./routePagesEs";

export interface NavLink {
  id: string;
  label: Record<PublicLang, string>;
  /** English path; may carry a query (?tab=…) for the booking app. */
  href: string;
}

/** Top menu, in order. */
export const PRIMARY_NAV: NavLink[] = [
  // The booking app (home) opens on the matching tab: ?tab=transfers|tours|multiday (Storefront.tsx).
  { id: "transfers", label: { en: "Transfers", es: "Traslados" }, href: "/?tab=transfers" },
  { id: "tours", label: { en: "Day tours", es: "Tours de un día" }, href: "/?tab=tours" },
  { id: "multiday", label: { en: "Multi-day trips", es: "Viajes de varios días" }, href: "/?tab=multiday" },
  // LATER PRs: add these when their index pages exist (keep the order Transfers → Help):
  // { id: "destinations", label: { en: "Destinations", es: "Destinos" }, href: "/destinations" },
  // { id: "guides", label: { en: "Travel guides", es: "Guías de viaje" }, href: "/guides" },
  { id: "help", label: { en: "Help", es: "Ayuda" }, href: "/faq" },
];

/** Extra links in the phone menu, under the main ones. */
export const DRAWER_NAV: NavLink[] = [
  { id: "about", label: { en: "About us", es: "Quiénes somos" }, href: "/about" },
  { id: "how", label: { en: "How it works", es: "Cómo funciona" }, href: "/how-it-works" },
  { id: "drivers", label: { en: "Our drivers & safety", es: "Nuestros conductores" }, href: "/our-drivers" },
  { id: "contact", label: { en: "Contact", es: "Contacto" }, href: "/contact" },
];

export interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

/** Footer columns, already in `lang`. */
export function footerColumns(lang: PublicLang): FooterColumn[] {
  const es = lang === "es";
  const L = (en: string, esLabel: string, href: string) => ({ label: es ? esLabel : en, href: localizedHref(href, lang) });
  return [
    {
      title: es ? "Empresa" : "Company",
      links: [
        L("About us", "Quiénes somos", "/about"),
        L("How it works", "Cómo funciona", "/how-it-works"),
        L("Our drivers & safety", "Conductores y seguridad", "/our-drivers"),
      ],
    },
    {
      title: es ? "Socios" : "Partners",
      links: [
        L("Drive with us", "Conduzca con nosotros", "/driver"),
        { label: es ? "Hoteles y agencias" : "Hotels & agents", href: `${localizedHref("/contact", lang)}?topic=agents` },
      ],
    },
    {
      title: es ? "Rutas populares" : "Popular routes",
      links: ROUTE_PAGES.slice(0, 6).map((p) => ({
        label: es
          ? localizeRoutePage(p, "es")
              .title.replace(/^Traslado privado (del|de) /, "")
              .replace(/^./, (c) => c.toUpperCase())
          : p.title.replace(/^Private transfer from /, ""),
        href: localizedHref(`/transfers/${p.slug}`, lang),
      })),
    },
    {
      title: es ? "Soporte" : "Support",
      links: [
        L("Help & FAQ", "Ayuda y preguntas frecuentes", "/faq"),
        L("Contact", "Contacto", "/contact"),
        L("Cancellation policy", "Política de cancelación", "/cancellation"),
      ],
    },
    {
      title: "Legal",
      links: [L("Terms", "Términos", "/terms"), L("Privacy", "Privacidad", "/privacy")],
    },
  ];
}
