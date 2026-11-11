"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  applyConsent,
  blockTracking,
  parseConsent,
  readConsentRaw,
  saveConsent,
  subscribeConsent,
  subscribeConsentOpen,
  tagsLoaded,
  trackPageView,
} from "@/lib/analytics";
import { CLARITY_ID, GA_ID, GOOGLE_ADS_ID, HAS_ADS_TOOLS, HAS_ANALYTICS_TOOLS, META_PIXEL_ID, isPrivatePath } from "@/lib/analyticsConfig";
import { langOfPath, localizedHref, t as pick } from "@/lib/publicLang";

/** What the server (and the first paint) shows: no banner, whatever the visitor chose before. */
const NOT_READ_YET = "not-read-yet";

const BUTTON =
  "min-h-11 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-sm font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500";

/**
 * The cookie banner and the loader of the measurement tools (docs/SEO.md §7), mounted once
 * in the root layout and only when at least one tool id is set.
 *
 * - No choice yet: a small card at the bottom. "Accept" and "Reject" look the same; "Choose"
 *   opens the groups, unticked. It is not a wall: the page works behind it, and it sits above
 *   the booking bar on phones (globals.css, .consent-banner).
 * - The card is drawn only in the browser and floats over the page, so it never moves content.
 * - The choice is kept on the device for six months; "Cookie settings" in the footer reopens it.
 * - Private pages (/admin, /driver, /trip/…, /login): no banner and no tools. If tools were
 *   already running when the visitor got there without a page load, the page is reloaded clean.
 */
export function ConsentManager() {
  const pathname = usePathname() ?? "/";
  const raw = useSyncExternalStore(subscribeConsent, readConsentRaw, () => NOT_READ_YET);
  const ready = raw !== NOT_READ_YET;
  const choice = useMemo(() => (ready ? parseConsent(raw) : null), [ready, raw]);
  const isPrivate = isPrivatePath(pathname);
  const lang = langOfPath(pathname);
  const t = <T,>(en: T, es: T): T => pick(lang, en, es);

  // Reopened from the footer link (a choice already exists).
  const [reopened, setReopened] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [ads, setAds] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const id = useId();

  // Load what was accepted, clear what was not, and count the page.
  useEffect(() => {
    if (!ready) return;
    if (isPrivate) {
      if (tagsLoaded()) {
        blockTracking();
        window.location.reload();
      }
      return;
    }
    applyConsent(choice);
    trackPageView();
  }, [ready, isPrivate, pathname, choice]);

  useEffect(
    () =>
      subscribeConsentOpen(() => {
        const current = parseConsent(readConsentRaw());
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setAnalytics(Boolean(current?.analytics));
        setAds(Boolean(current?.ads));
        setChoosing(true);
        setReopened(true);
        // After the card is drawn, move the keyboard and screen readers to it.
        window.setTimeout(() => titleRef.current?.focus(), 0);
      }),
    [],
  );

  const visible = ready && !isPrivate && (choice === null || reopened);

  function close() {
    setReopened(false);
    setChoosing(false);
    returnFocus.current?.focus();
    returnFocus.current = null;
  }
  function decide(next: { analytics: boolean; ads: boolean }) {
    saveConsent(next);
    close();
  }

  // Escape closes the reopened card (the earlier choice stays as it was).
  useEffect(() => {
    if (!visible || !reopened) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setReopened(false);
      setChoosing(false);
      returnFocus.current?.focus();
      returnFocus.current = null;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, reopened]);

  if (!visible) return null;

  const analyticsTools = [GA_ID && "Google Analytics", CLARITY_ID && "Microsoft Clarity"].filter(Boolean).join(t(" and ", " y "));
  const adsTools = [GOOGLE_ADS_ID && "Google Ads", META_PIXEL_ID && "Meta (Facebook, Instagram)"].filter(Boolean).join(t(" and ", " y "));

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-text`}
      lang={lang}
      className="consent-banner print:hidden fixed z-[35] inset-x-2 sm:inset-x-auto sm:left-4 sm:w-[26rem] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-[0_8px_40px_rgba(2,44,34,0.28)]"
    >
      <h2 id={`${id}-title`} ref={titleRef} tabIndex={-1} className="text-base font-extrabold text-emerald-950 outline-none">
        {t("Cookies: your choice", "Cookies: usted decide")}
      </h2>
      <p id={`${id}-text`} className="mt-1 text-sm leading-snug text-slate-700">
        {HAS_ANALYTICS_TOOLS &&
          t(
            `With your OK we use ${analyticsTools} to see which pages and routes are useful and improve the site. `,
            `Con su permiso usamos ${analyticsTools} para saber qué páginas y rutas son útiles y mejorar el sitio. `,
          )}
        {HAS_ADS_TOOLS &&
          t(
            `${HAS_ANALYTICS_TOOLS ? "We also" : "With your OK we"} use ${adsTools} to measure our ads. `,
            `${HAS_ANALYTICS_TOOLS ? "También usamos" : "Con su permiso usamos"} ${adsTools} para medir nuestros anuncios. `,
          )}
        {t(
          "Nothing is switched on unless you accept, and booking works the same either way. ",
          "Nada se activa si usted no acepta, y puede reservar igual en ambos casos. ",
        )}
        <Link href={localizedHref("/privacy", lang)} className="font-semibold text-emerald-800 underline">
          {t("Privacy Policy", "Política de privacidad")}
        </Link>
      </p>

      {choosing && (
        <fieldset className="mt-3 space-y-2">
          <legend className="sr-only">{t("Choose which cookies to allow", "Elija qué cookies permitir")}</legend>
          {HAS_ANALYTICS_TOOLS && (
            <Group
              checked={analytics}
              onChange={setAnalytics}
              title={t("Analytics", "Analítica")}
              text={t(
                `${analyticsTools}: pages visited and booking steps used. No names, emails or phone numbers.`,
                `${analyticsTools}: páginas visitadas y pasos de la reserva. Sin nombres, correos ni teléfonos.`,
              )}
            />
          )}
          {HAS_ADS_TOOLS && (
            <Group
              checked={ads}
              onChange={setAds}
              title={t("Advertising", "Publicidad")}
              text={t(
                `${adsTools}: shows whether our ads bring visits and trip requests.`,
                `${adsTools}: muestra si nuestros anuncios traen visitas y solicitudes de viaje.`,
              )}
            />
          )}
        </fieldset>
      )}

      {choosing && (
        <button
          type="button"
          onClick={() => decide({ analytics, ads })}
          className="mt-3 w-full min-h-11 px-4 rounded-xl border-2 border-emerald-800 bg-white hover:bg-emerald-50 text-emerald-900 text-sm font-extrabold transition"
        >
          {t("Save my choice", "Guardar mi elección")}
        </button>
      )}
      <div className={`${choosing ? "mt-2" : "mt-3"} grid grid-cols-2 gap-2`}>
        <button type="button" onClick={() => decide({ analytics: false, ads: false })} className={BUTTON}>
          {choosing ? t("Reject all", "Rechazar todo") : t("Reject", "Rechazar")}
        </button>
        <button type="button" onClick={() => decide({ analytics: HAS_ANALYTICS_TOOLS, ads: HAS_ADS_TOOLS })} className={BUTTON}>
          {choosing ? t("Accept all", "Aceptar todo") : t("Accept", "Aceptar")}
        </button>
      </div>
      {(!choosing || reopened) && (
        <div className="mt-1 flex items-center justify-between gap-2">
          {!choosing ? (
            <button type="button" onClick={() => setChoosing(true)} className="min-h-11 px-1 text-sm font-bold text-emerald-800 underline">
              {t("Choose", "Elegir")}
            </button>
          ) : (
            <span />
          )}
          {reopened && (
            <button type="button" onClick={close} className="min-h-11 px-1 text-sm font-semibold text-slate-600 underline">
              {t("Close", "Cerrar")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Group({
  checked,
  onChange,
  title,
  text,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  title: string;
  text: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-700"
      />
      <span className="min-w-0">
        <span className="block text-sm font-extrabold text-slate-900">{title}</span>
        <span className="block text-xs leading-snug text-slate-600">{text}</span>
      </span>
    </label>
  );
}
