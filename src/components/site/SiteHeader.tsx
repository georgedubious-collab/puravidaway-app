"use client";

import { Menu, MessageCircle, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { whatsAppLink } from "@/lib/cart";
import { localizedHref, t, type PublicLang } from "@/lib/publicLang";
import { DRAWER_NAV, PRIMARY_NAV } from "@/lib/siteNav";
import { Logo } from "../brand/Logo";
import { LangSwitch } from "./LangSwitch";

/**
 * The public site's header, on every public page (home, route pages, legal and
 * info pages; not /admin, /driver, /trip or /login). Desktop: menu, the language
 * flag button and WhatsApp in one bar. Phones: the flag button stays in the bar
 * next to the menu button, which opens a panel under the bar.
 * `extra` is page-specific (the booking app passes its "Your trip" button).
 */
export function SiteHeader({
  lang,
  current,
  extra,
}: {
  lang: PublicLang;
  /** id of the PRIMARY_NAV / DRAWER_NAV entry for this page, if any. */
  current?: string;
  extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wa = whatsAppLink(
    t(lang, "Hi! I have a question about my Costa Rica trip.", "¡Hola! Tengo una pregunta sobre mi viaje a Costa Rica."),
  );

  // Close the phone menu with Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="bg-emerald-950 text-white sticky top-0 z-40 shadow-lg border-b border-emerald-800">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-6 min-w-0">
          <Link
            href={localizedHref("/", lang)}
            className="flex items-center min-h-11 min-w-0"
            aria-label={t(lang, "Costa Rica Private Transfers — home", "Costa Rica Private Transfers — inicio")}
          >
            <Logo on="dark" />
          </Link>
          <nav aria-label={t(lang, "Main", "Principal")} className="hidden lg:flex items-center gap-1 text-sm font-bold">
            {PRIMARY_NAV.map((n) => (
              <Link
                key={n.id}
                href={localizedHref(n.href, lang)}
                aria-current={current === n.id ? "page" : undefined}
                className={`px-3.5 py-2.5 rounded-lg transition ${
                  current === n.id ? "bg-amber-400 text-slate-950" : "text-emerald-100 hover:bg-emerald-800/60"
                }`}
              >
                {n.label[lang]}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Always in the bar, phones included: the flag button to the other language. */}
          <LangSwitch lang={lang} />
          <div className="hidden lg:flex items-center gap-1.5">
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-sm font-bold inline-flex items-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4" aria-hidden /> WhatsApp
            </a>
          </div>
          {extra}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="site-menu"
            className="lg:hidden w-11 h-11 rounded-xl hover:bg-emerald-800/60 flex items-center justify-center"
          >
            {open ? <X className="w-6 h-6" aria-hidden /> : <Menu className="w-6 h-6" aria-hidden />}
            <span className="sr-only">{open ? t(lang, "Close menu", "Cerrar menú") : t(lang, "Open menu", "Abrir menú")}</span>
          </button>
        </div>
      </div>

      {open && (
        <div id="site-menu" className="lg:hidden border-t border-emerald-800 bg-emerald-950">
          <nav aria-label={t(lang, "Main", "Principal")} className="max-w-[1440px] mx-auto px-4 py-3 grid gap-1">
            {[...PRIMARY_NAV, ...DRAWER_NAV].map((n, i) => (
              <Link
                key={n.id}
                href={localizedHref(n.href, lang)}
                onClick={() => setOpen(false)}
                aria-current={current === n.id ? "page" : undefined}
                className={`min-h-12 px-3 rounded-xl flex items-center font-bold ${
                  i === PRIMARY_NAV.length ? "mt-2 border-t border-emerald-800 pt-2 rounded-t-none" : ""
                } ${current === n.id ? "bg-emerald-800 text-amber-300" : "text-emerald-50 hover:bg-emerald-900"}`}
              >
                {n.label[lang]}
              </Link>
            ))}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-12 px-5 rounded-xl bg-amber-400 text-slate-950 font-extrabold inline-flex items-center gap-2"
              >
                <MessageCircle className="w-5 h-5" aria-hidden /> {t(lang, "Chat on WhatsApp", "Escríbanos por WhatsApp")}
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
