"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { switchHref, type PublicLang } from "@/lib/publicLang";

/**
 * The language button in the site header, on every public page, phones included:
 * a small pill with a flag. English pages show the Costa Rica flag + "ES" (go to
 * the Spanish version of this page); Spanish pages show the US flag + "EN".
 * Same idea as the customer app's toggle (apps/client/src/i18n.tsx). The flags
 * are drawn (SVG) because flag emoji don't show on Windows.
 * The page's query string is kept (e.g. /?tab=tours ↔ /es?tab=tours, shared ride links).
 */
export function LangSwitch({ lang }: { lang: PublicLang }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const other: PublicLang = lang === "es" ? "en" : "es";
  const href = switchHref(pathname, other);
  if (!href) return null;
  return (
    <Link
      href={href}
      hrefLang={other}
      lang={other}
      aria-label={other === "es" ? "Cambiar a español" : "Switch to English"}
      title={other === "es" ? "Español" : "English"}
      onClick={(e) => {
        // Read the query here instead of useSearchParams(), which would force
        // every static page that has the header to render on the client.
        const rest = window.location.search + window.location.hash;
        if (!rest || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        router.push(href + rest);
      }}
      className="shrink-0 min-h-9 px-2.5 rounded-full inline-flex items-center gap-1.5 border border-white/35 bg-white/10 hover:bg-white/20 text-xs font-extrabold text-white transition"
    >
      {other === "es" ? <CostaRicaFlag /> : <UsFlag />}
      <span>{other === "es" ? "ES" : "EN"}</span>
    </Link>
  );
}

const flagClass = "w-[22px] h-[14px] rounded-[2px] shrink-0 ring-1 ring-black/10";

/** Costa Rica: blue, white, red (double height), white, blue. */
function CostaRicaFlag() {
  return (
    <svg viewBox="0 0 20 12" className={flagClass} aria-hidden focusable="false">
      <rect width="20" height="12" fill="#002b7f" />
      <rect y="2" width="20" height="8" fill="#fff" />
      <rect y="4" width="20" height="4" fill="#ce1126" />
    </svg>
  );
}

/** United States, simplified: 13 stripes and a blue canton with a few stars as dots. */
function UsFlag() {
  return (
    <svg viewBox="0 0 20 13" className={flagClass} aria-hidden focusable="false">
      <rect width="20" height="13" fill="#b22234" />
      {[1, 3, 5, 7, 9, 11].map((y) => (
        <rect key={y} y={y} width="20" height="1" fill="#fff" />
      ))}
      <rect width="9" height="7" fill="#3c3b6e" />
      {[1.5, 3.5, 5.5].map((cy) => [1.5, 3.5, 5.5, 7.5].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.45" fill="#fff" />))}
    </svg>
  );
}
