import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminNav, type NavItem } from "@/components/admin/AdminNav";
import { requireRole } from "@/lib/auth";
import { adminCounts } from "@/lib/adminCounts";
import { setTeamLang } from "@/lib/teamLangActions";
import { makeT, type TeamLang } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

export const metadata: Metadata = {
  title: "Admin | Costa Rica Private Transfers",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={<p className="p-8 text-sm font-semibold text-[#5F6F67]">Cargando… / Loading…</p>}
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const me = await requireRole("admin");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const c = await adminCounts();
  const items: NavItem[] = [
    { href: "/admin", label: t("Panel", "Dashboard"), icon: "dashboard", count: 0, countLabel: "" },
    {
      href: "/admin/bookings",
      label: t("Reservas", "Bookings"),
      icon: "bookings",
      count: c.bookingsToAct,
      countLabel: t(`${c.bookingsToAct} sin confirmar`, `${c.bookingsToAct} not confirmed yet`),
    },
    { href: "/admin/customers", label: t("Clientes", "Customers"), icon: "customers", count: 0, countLabel: "" },
    {
      href: "/admin/live",
      label: t("Viajes en vivo", "Live trips"),
      icon: "live",
      count: c.live,
      countLabel: t(`${c.live} en curso o por salir`, `${c.live} on the road or about to start`),
    },
    {
      href: "/admin/drivers",
      label: t("Conductores", "Drivers"),
      icon: "drivers",
      count: c.driversToReview,
      countLabel: t(`${c.driversToReview} por revisar`, `${c.driversToReview} to review`),
    },
    {
      href: "/admin/flagged",
      label: t("Mensajes marcados", "Flagged messages"),
      icon: "flag",
      count: c.flagged,
      countLabel: t(`${c.flagged} sin revisar`, `${c.flagged} not reviewed`),
    },
    { href: "/admin/payouts", label: t("Pagos a conductores", "Payouts"), icon: "payouts", count: 0, countLabel: "" },
    { href: "/admin/pricing", label: t("Precios y catálogo", "Prices & catalog"), icon: "pricing", count: 0, countLabel: "" },
    { href: "/admin/users", label: t("Usuarios y roles", "Users & roles"), icon: "users", count: 0, countLabel: "" },
  ];

  return (
    <div lang={lang} className="flex min-h-screen flex-1 flex-col bg-[#F4F6F4] text-[#14231C] lg:flex-row">
      <a
        href="#admin-main"
        className="sr-only z-[60] rounded-lg bg-white px-3 py-2 font-bold text-[#047857] focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {t("Saltar al contenido", "Skip to content")}
      </a>
      <AdminNav
        items={items}
        menuLabel={t("Menú", "Menu")}
        closeLabel={t("Cerrar el menú", "Close the menu")}
        footer={<MenuFooter lang={lang} email={me.email} />}
      />
      <main id="admin-main" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-10 pt-5 outline-none sm:px-6 lg:px-8 lg:pt-7">
        <div className="mx-auto max-w-[1280px]">{children}</div>
      </main>
    </div>
  );
}

/** Language switch, who is signed in, sign out (bottom of the side menu). Works without JavaScript. */
function MenuFooter({ lang, email }: { lang: TeamLang; email: string | null }) {
  const t = makeT(lang);
  return (
    <>
      <form action={setTeamLang} className="flex gap-1 self-start rounded-xl bg-[#133D2E] p-1" aria-label={t("Idioma", "Language")}>
        {(["es", "en"] as const).map((l) => (
          <button
            key={l}
            type="submit"
            name="lang"
            value={l}
            aria-pressed={lang === l}
            title={l === "es" ? "Español" : "English"}
            className={`min-h-9 rounded-lg px-3 text-xs font-extrabold focus-visible:outline-2 focus-visible:outline-[#F5B301] ${
              lang === l ? "bg-white text-[#0B2E22]" : "text-[#D6E9DF] hover:bg-[#1F4A3A]"
            }`}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </form>
      {email && <span className="break-all text-xs text-[#9DBFAF]">{email}</span>}
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="min-h-10 rounded-xl border border-[#2C5C4A] px-3 text-sm font-bold text-[#D6E9DF] hover:bg-[#133D2E] focus-visible:outline-2 focus-visible:outline-[#F5B301]"
        >
          {t("Cerrar sesión", "Sign out")}
        </button>
      </form>
    </>
  );
}
