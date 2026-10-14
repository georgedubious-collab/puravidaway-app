import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { addDays, todayInCostaRica } from "@/lib/dates";
import { expiryIssues, type DriverRecord } from "@/lib/driverKyc";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const STATUSES = [
  ["pending_payment", "Waiting for payment"],
  ["pending_bids", "Collecting driver offers"],
  ["confirmed", "Confirmed"],
  ["in_progress", "On the road"],
] as const;

type DriverRow = DriverRecord & { profiles: { full_name: string | null; email: string | null } | null };

export default async function AdminDashboard() {
  await requireRole("admin");
  const supabase = (await createSupabaseServerClient())!;
  const today = todayInCostaRica();
  const soon = addDays(today, 30);

  const counts = await Promise.all(
    STATUSES.map(async ([status]) => {
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      return count ?? 0;
    }),
  );

  const { data: drivers } = await supabase
    .from("drivers")
    .select("*, profiles!drivers_id_fkey(full_name, email)")
    .returns<DriverRow[]>();

  const pendingKyc = (drivers ?? []).filter((d) => d.kyc_status === "pending" || d.needs_review);
  const expiring = (drivers ?? [])
    .filter((d) => d.kyc_status === "approved")
    .map((d) => ({
      d,
      issues: expiryIssues(d, today, soon),
    }))
    .filter((x) => x.issues.length > 0);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-extrabold text-slate-900">Dashboard</h1>

      <section aria-labelledby="bookings-h">
        <h2 id="bookings-h" className="text-lg font-extrabold text-slate-900">Bookings</h2>
        <div className="mt-3 grid gap-3 grid-cols-2 md:grid-cols-4">
          {STATUSES.map(([status, label], i) => (
            <div key={status} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="text-3xl font-extrabold text-slate-900">{counts[i]}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Online bookings start with checkout (Phase 2d). Until then they arrive on WhatsApp.
        </p>
      </section>

      <section aria-labelledby="kyc-h" className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 id="kyc-h" className="font-extrabold text-slate-900">Drivers to review</h2>
          {pendingKyc.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">None right now.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {pendingKyc.map((d) => (
                <li key={d.id}>
                  <Link href={`/admin/drivers/${d.id}`} className="font-bold text-emerald-700 underline">
                    {d.profiles?.full_name || d.profiles?.email}
                  </Link>
                  {d.needs_review && <span className="text-slate-500"> · changed details</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-extrabold text-slate-900">Expired or expiring documents</h2>
          {expiring.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">All approved drivers are up to date.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {expiring.map(({ d, issues }) => (
                <li key={d.id}>
                  <Link href={`/admin/drivers/${d.id}`} className="font-bold text-emerald-700 underline">
                    {d.profiles?.full_name || d.profiles?.email}
                  </Link>
                  {issues.map((i) => (
                    <span key={i.text} className={`block ${i.blocking ? "font-bold text-red-700" : "text-amber-700"}`}>
                      {i.text}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="text-sm text-slate-600">
        Review driver applications in{" "}
        <Link href="/admin/drivers" className="font-bold text-emerald-700 underline">
          Drivers
        </Link>
        ; make someone an admin in{" "}
        <Link href="/admin/users" className="font-bold text-emerald-700 underline">
          Users &amp; roles
        </Link>
        .
      </p>
    </div>
  );
}
