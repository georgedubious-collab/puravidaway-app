import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { TeamLangToggle } from "@/components/TeamLangToggle";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

/** Header for the driver area: application and trips. */
export async function DriverHeader() {
  const lang = await getTeamLang();
  const t = makeT(lang);
  return (
    <header lang={lang} className="bg-emerald-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/" aria-label={`Costa Rica Private Transfers ${t("Conductores", "Drivers")}`} className="flex min-h-11 items-center gap-2.5">
            <Logo on="dark" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">{t("Conductores", "Drivers")}</span>
          </Link>
          <nav aria-label={t("Conductor", "Driver")} className="flex flex-wrap gap-1 text-sm font-bold">
            <Link href="/driver" className="px-3 py-2.5 rounded-lg text-emerald-100 hover:bg-emerald-800/60">
              {t("Perfil y documentos", "Profile & documents")}
            </Link>
            <Link href="/driver/jobs" className="px-3 py-2.5 rounded-lg text-emerald-100 hover:bg-emerald-800/60">
              {t("Trabajos disponibles", "Open jobs")}
            </Link>
            <Link href="/driver/trips" className="px-3 py-2.5 rounded-lg text-emerald-100 hover:bg-emerald-800/60">
              {t("Mis viajes", "Your trips")}
            </Link>
            <Link href="/driver/earnings" className="px-3 py-2.5 rounded-lg text-emerald-100 hover:bg-emerald-800/60">
              {t("Ganancias", "Earnings")}
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <TeamLangToggle lang={lang} />
          <form action="/auth/signout" method="post">
            <button type="submit" className="min-h-10 px-3 rounded-lg border border-emerald-700 text-sm text-emerald-100">
              {t("Cerrar sesión", "Sign out")}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
