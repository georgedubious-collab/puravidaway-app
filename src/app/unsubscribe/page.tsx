import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { emailFromUnsubscribeToken } from "@/lib/promoEmail";
import { t, type PublicLang } from "@/lib/publicLang";
import { resubscribe, unsubscribe } from "./actions";

export const metadata: Metadata = {
  title: "Unsubscribe | Costa Rica Private Transfers",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** "ana@example.com" → "a••@example.com": enough to recognise, not to read off a shared screen. */
function masked(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}${"•".repeat(Math.min(6, Math.max(2, user.length - 1)))}@${domain}`;
}

/**
 * The page behind the unsubscribe link in promotional emails (docs/PROJECT.md §4.7): one button
 * stops them, another undoes it. Booking emails (confirmations, reminders, rating requests, chat)
 * are not affected. The mail app's own "Unsubscribe" button uses /api/unsubscribe (one click).
 */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const done = typeof sp.done === "string" ? sp.done : "";
  const lang: PublicLang = sp.lang === "es" ? "es" : "en";
  const email = emailFromUnsubscribeToken(token);
  const button = "inline-flex min-h-11 items-center rounded-xl px-5 font-bold";

  return (
    <div className="flex-1 flex flex-col bg-slate-50" lang={lang}>
      <SiteHeader lang={lang} />
      <main className="flex-1 px-4 py-12">
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {t(lang, "Email suggestions", "Sugerencias por correo")}
          </h1>
          {!email || done === "error" ? (
            <p className="mt-4 text-slate-700">
              {t(
                lang,
                "This link isn't valid or something went wrong. Please try the link in the email again, or write to our team and we'll take you off the list.",
                "Este enlace no es válido o algo salió mal. Intente de nuevo con el enlace del correo, o escriba a nuestro equipo y lo quitaremos de la lista.",
              )}
            </p>
          ) : done === "out" ? (
            <>
              <p className="mt-4 text-slate-700">
                {t(
                  lang,
                  `Done: ${masked(email)} won't get suggestions like “book your return ride” any more. Emails about your bookings (confirmations, reminders, chat) still arrive.`,
                  `Listo: ${masked(email)} ya no recibirá sugerencias como “reserve su traslado de regreso”. Los correos de sus reservas (confirmaciones, recordatorios, chat) siguen llegando.`,
                )}
              </p>
              <form action={resubscribe} className="mt-6">
                <input type="hidden" name="t" value={token} />
                <input type="hidden" name="lang" value={lang} />
                <button className={`${button} border border-slate-300 text-slate-800`}>{t(lang, "I unsubscribed by mistake", "Me di de baja por error")}</button>
              </form>
            </>
          ) : (
            <>
              <p className="mt-4 text-slate-700">
                {done === "in"
                  ? t(lang, `You're back on the list: ${masked(email)} can get our suggestions again.`, `Está de nuevo en la lista: ${masked(email)} puede recibir nuestras sugerencias otra vez.`)
                  : t(
                      lang,
                      `Stop suggestions like “book your return ride” or day tours to ${masked(email)}? Emails about your bookings (confirmations, reminders, chat) are not affected.`,
                      `¿Dejar de enviar sugerencias como “reserve su traslado de regreso” o tours de un día a ${masked(email)}? Los correos de sus reservas (confirmaciones, recordatorios, chat) no cambian.`,
                    )}
              </p>
              {done !== "in" && (
                <form action={unsubscribe} className="mt-6">
                  <input type="hidden" name="t" value={token} />
                  <input type="hidden" name="lang" value={lang} />
                  <button className={`${button} bg-emerald-950 text-white`}>{t(lang, "Unsubscribe", "Darme de baja")}</button>
                </form>
              )}
            </>
          )}
          <p className="mt-8 text-sm">
            <Link href={lang === "es" ? "/es" : "/"} className="font-bold text-emerald-700 underline">
              {t(lang, "Back to Costa Rica Private Transfers", "Volver a Costa Rica Private Transfers")}
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
