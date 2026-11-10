import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { localizedHref, t, type PublicLang } from "@/lib/publicLang";
import { SITE_URL } from "@/lib/site";
import { JsonLd } from "./JsonLd";

export interface Crumb {
  label: string;
  /** Omit on the current page (the last crumb). */
  href?: string;
}

/**
 * Visible breadcrumbs + BreadcrumbList JSON-LD. "Home" is added first: the
 * booking app, "/" in English and "/es" in Spanish.
 */
export function Breadcrumbs({ lang, items, currentPath }: { lang: PublicLang; items: Crumb[]; currentPath: string }) {
  const all: Crumb[] = [{ label: t(lang, "Home", "Inicio"), href: localizedHref("/", lang) }, ...items];
  return (
    <>
      <nav aria-label={t(lang, "Breadcrumb", "Ruta de navegación")} className="text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-1">
          {all.map((c, i) => (
            <li key={`${c.label}-${i}`} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-500" aria-hidden />}
              {c.href && i < all.length - 1 ? (
                <Link href={c.href} className="font-semibold hover:text-emerald-700 hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={i === all.length - 1 ? "page" : undefined} className="text-slate-700">
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: all.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.label,
            item: `${SITE_URL}${i === all.length - 1 ? currentPath : (c.href ?? currentPath)}`,
          })),
        }}
      />
    </>
  );
}
