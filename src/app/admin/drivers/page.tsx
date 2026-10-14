import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { addDays, todayInCostaRica } from "@/lib/dates";
import { STATUS_LABEL, expiryIssues, missingDetails, missingDocs, type DriverRecord } from "@/lib/driverKyc";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Row = DriverRecord & { profiles: { full_name: string | null; email: string | null; phone: string | null } | null };

export default async function DriversPage() {
  await requireRole("admin", "/admin/drivers");
  const supabase = (await createSupabaseServerClient())!;
  const { data, error } = await supabase
    .from("drivers")
    .select("*, profiles!drivers_id_fkey(full_name, email, phone)")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .returns<Row[]>();

  if (error) return <p className="font-semibold text-red-700">Couldn&apos;t load drivers: {error.message}</p>;
  const rows = data ?? [];
  const today = todayInCostaRica();
  const soon = addDays(today, 30);

  const groups: [string, Row[]][] = [
    ["Waiting for review", rows.filter((r) => r.kyc_status === "pending")],
    ["Approved drivers with changes to check", rows.filter((r) => r.kyc_status === "approved" && r.needs_review)],
    ["Approved", rows.filter((r) => r.kyc_status === "approved" && !r.needs_review)],
    ["Not approved or suspended", rows.filter((r) => r.kyc_status === "rejected" || r.kyc_status === "suspended")],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Drivers</h1>
        <p className="mt-1 text-sm text-slate-600">
          Drivers apply at <code>/driver</code> and upload their documents there. Open one to see the
          documents and approve, reject or suspend.
        </p>
      </div>
      {groups.map(([title, list]) => (
        <section key={title}>
          <h2 className="text-lg font-extrabold text-slate-900">
            {title} <span className="text-slate-400">({list.length})</span>
          </h2>
          {list.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">None.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {list.map((r) => {
                const todo = missingDocs(r).length + missingDetails(r).length;
                const issues = expiryIssues(r, today, soon);
                return (
                  <li key={r.id}>
                    <Link href={`/admin/drivers/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
                      <span>
                        <span className="font-bold text-slate-900">{r.profiles?.full_name || "(no name yet)"}</span>
                        <span className="block text-sm text-slate-500">
                          {r.profiles?.email} · {r.vehicle_model ?? "vehicle?"} · {STATUS_LABEL[r.kyc_status]}
                        </span>
                      </span>
                      <span className="text-sm font-semibold">
                        {todo > 0 ? <span className="text-amber-700">{todo} item{todo === 1 ? "" : "s"} missing</span> : <span className="text-emerald-700">Complete</span>}
                        {issues.some((i) => i.blocking) ? (
                          <span className="block text-red-700">Documents expired: no trips</span>
                        ) : issues.length > 0 ? (
                          <span className="block text-amber-700">{issues.length} expiry warning{issues.length === 1 ? "" : "s"}</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
