import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { requireRole } from "@/lib/auth";
import { addDays, todayInCostaRica } from "@/lib/dates";
import { DRIVER_DOCS, STATUS_LABEL, expiryIssues, missingDetails, type DriverRecord } from "@/lib/driverKyc";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reviewDriver } from "../actions";

type Row = DriverRecord & {
  is_on_duty: boolean;
  profiles: { full_name: string | null; email: string | null; phone: string | null; role: string } | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DriverDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("admin", `/admin/drivers/${id}`);
  if (!UUID.test(id)) notFound();
  const supabase = (await createSupabaseServerClient())!;
  const { data: d, error } = await supabase
    .from("drivers")
    .select("*, profiles!drivers_id_fkey(full_name, email, phone, role)")
    .eq("id", id)
    .maybeSingle<Row>();
  if (error) return <p className="font-semibold text-red-700">Couldn&apos;t load this driver: {error.message}</p>;
  if (!d) notFound();

  // Short-lived links (10 minutes) to the private documents.
  const paths = Object.values(d.documents ?? {});
  const links: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("driver-kyc-docs").createSignedUrls(paths, 600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) links[s.path] = s.signedUrl;
  }

  const today = todayInCostaRica();
  const issues = expiryIssues(d, today, addDays(today, 30));
  const missing = missingDetails(d);
  const phoneDigits = d.profiles?.phone?.replace(/\D/g, "") ?? "";

  return (
    <div className="space-y-6">
      <Link href="/admin/drivers" className="text-sm font-bold text-emerald-700 underline">
        ← All drivers
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">{d.profiles?.full_name || "(no name yet)"}</h1>
        <p className="text-sm text-slate-600">
          {d.profiles?.email}
          {d.profiles?.phone && (
            <>
              {" · "}
              <a href={`https://wa.me/${phoneDigits}`} className="font-bold text-emerald-700 underline" target="_blank" rel="noreferrer">
                WhatsApp {d.profiles.phone}
              </a>
            </>
          )}
        </p>
        <p className="mt-1 text-sm">
          <strong>{STATUS_LABEL[d.kyc_status]}</strong>
          {d.needs_review && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-amber-900 font-bold">Changed since last review</span>}
          {d.submitted_at && <span className="text-slate-500"> · applied {d.submitted_at.slice(0, 10)}</span>}
          {d.reviewed_at && <span className="text-slate-500"> · last reviewed {d.reviewed_at.slice(0, 10)}</span>}
          {d.ict_permit_number && <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-emerald-900 font-bold">ICT permit</span>}
        </p>
      </div>

      {(issues.length > 0 || missing.length > 0) && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {issues.map((i) => <p key={i}>⚠ {i}</p>)}
          {missing.length > 0 && <p>Missing details: {missing.join(", ")}</p>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-extrabold text-slate-900">Details (as entered by the driver)</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Item k="Cédula / passport" v={d.cedula_number} />
            <Item k="Licence" v={d.license_number} />
            <Item k="Licence expiry" v={d.license_expiry} />
            <Item k="Criminal record date" v={d.criminal_record_date} />
            <Item k="ICT permit" v={d.ict_permit_number} />
            <Item k="Vehicle" v={[d.vehicle_model, d.vehicle_year].filter(Boolean).join(" ")} />
            <Item k="Passenger seats" v={d.passenger_capacity} />
            <Item k="INS policy" v={d.ins_policy_number} />
            <Item k="Insurance until" v={d.ins_insurance_expiry} />
            <Item k="Dekra until" v={d.dekra_inspection_expiry} />
            <Item k="Marchamo" v={d.marchamo_year} />
          </dl>
          <p className="mt-3 text-xs text-slate-500">Check each one against the document before approving.</p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-extrabold text-slate-900">Documents</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {DRIVER_DOCS.map((doc) => {
              const path = d.documents?.[doc.key];
              const url = path ? links[path] : undefined;
              return (
                <li key={doc.key} className="flex items-center justify-between gap-3">
                  <span>
                    {doc.label}
                    {!doc.required && <span className="text-slate-400"> (optional)</span>}
                  </span>
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="font-bold text-emerald-700 underline whitespace-nowrap">
                      Open
                    </a>
                  ) : path ? (
                    <span className="text-red-700">File missing</span>
                  ) : (
                    <span className="text-slate-400">Not uploaded</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-slate-500">Links work for 10 minutes; reload the page for new ones.</p>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-extrabold text-slate-900">Decision</h2>
        <ActionForm action={reviewDriver} className="mt-3 space-y-4">
          <input type="hidden" name="id" value={d.id} />
          <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <legend className="sr-only">Decision</legend>
            <Radio value="approve" label="Approve (makes them a driver)" />
            {d.kyc_status === "approved" && d.needs_review && <Radio value="checked" label="Changes checked, keep approved" />}
            <Radio value="reject" label="Reject" />
            <Radio value="suspend" label="Suspend" />
          </fieldset>
          <label className="block text-sm font-bold text-slate-700">
            Message to the driver (shown in their portal; required to reject or suspend)
            <textarea name="note" rows={2} maxLength={500} defaultValue={d.kyc_note ?? ""} className="mt-1 block w-full rounded-lg border border-slate-300 p-2 font-normal" />
          </label>
        </ActionForm>
        <p className="mt-3 text-xs text-slate-500">
          Before approving: interview them (English level included), compare every document with the
          details above, and check the criminal record certificate is recent.
        </p>
      </section>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string | number | null | undefined }) {
  return (
    <>
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-semibold text-slate-900">{v || v === 0 ? v : "—"}</dd>
    </>
  );
}

function Radio({ value, label }: { value: string; label: string }) {
  return (
    <label className="flex min-h-10 items-center gap-2">
      <input type="radio" name="decision" value={value} required /> {label}
    </label>
  );
}
