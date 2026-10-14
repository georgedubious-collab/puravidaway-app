import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Admin | PuraVidaWay",
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users & roles" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={<p className="p-8 text-sm font-semibold text-slate-500">Loading admin…</p>}
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const me = await requireRole("admin");
  return (
    <div className="flex-1 bg-slate-50">
      <header className="bg-emerald-950 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/admin" className="font-extrabold text-lg">
              PuraVidaWay <span className="text-amber-400">Admin</span>
            </Link>
            <nav aria-label="Admin" className="flex flex-wrap gap-1 text-sm font-bold">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="px-3 py-2.5 rounded-lg text-emerald-100 hover:bg-emerald-800/60"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-emerald-200">{me.email}</span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="min-h-10 px-3 rounded-lg border border-emerald-700 text-emerald-100 hover:bg-emerald-800/60"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 py-8">{children}</div>
    </div>
  );
}
