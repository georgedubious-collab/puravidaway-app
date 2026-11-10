import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { TeamLangToggle } from "@/components/TeamLangToggle";
import { requireRole } from "@/lib/auth";
import { getTeamLang } from "@/lib/teamLangServer";

export const metadata: Metadata = {
  title: "Admin | Costa Rica Private Transfers",
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", es: "Panel", en: "Dashboard" },
  { href: "/admin/bookings", es: "Reservas", en: "Bookings" },
  { href: "/admin/live", es: "Viajes en vivo", en: "Live trips" },
  { href: "/admin/drivers", es: "Conductores", en: "Drivers" },
  { href: "/admin/payouts", es: "Pagos a conductores", en: "Payouts" },
  { href: "/admin/pricing", es: "Precios y catálogo", en: "Prices & catalog" },
  { href: "/admin/users", es: "Usuarios y roles", en: "Users & roles" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={<p className="p-8 text-sm font-semibold text-slate-500">Cargando… / Loading…</p>}
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const me = await requireRole("admin");
  const lang = await getTeamLang();
  return (
    <div lang={lang} className="flex-1 bg-slate-50">
      <header className="bg-emerald-950 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/admin" aria-label="Costa Rica Private Transfers Admin" className="flex min-h-11 items-center gap-2.5">
              <Logo on="dark" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">Admin</span>
            </Link>
            <nav aria-label="Admin" className="flex flex-wrap gap-1 text-sm font-bold">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="px-3 py-2.5 rounded-lg text-emerald-100 hover:bg-emerald-800/60"
                >
                  {lang === "en" ? n.en : n.es}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <TeamLangToggle lang={lang} />
            <span className="text-emerald-200">{me.email}</span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="min-h-10 px-3 rounded-lg border border-emerald-700 text-emerald-100 hover:bg-emerald-800/60"
              >
                {lang === "en" ? "Sign out" : "Cerrar sesión"}
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 py-8">{children}</div>
    </div>
  );
}
