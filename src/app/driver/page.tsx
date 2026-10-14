import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/ActionForm";
import { requireUser, type Profile } from "@/lib/auth";
import { addDays, todayInCostaRica } from "@/lib/dates";
import {
  DRIVER_DOCS,
  STATUS_LABEL,
  expiryIssues,
  missingDetails,
  missingDocs,
  type DriverRecord,
} from "@/lib/driverKyc";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applyAsDriver, saveDriverDetails } from "./actions";
import { DocumentUpload } from "./DocumentUpload";

export const metadata: Metadata = {
  title: "Drive with PuraVidaWay",
  robots: { index: false, follow: false },
};

const input = "min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base sm:text-sm";

export default function DriverPage() {
  return (
    <main className="flex-1 bg-slate-50">
      <header className="bg-emerald-950 text-white">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="font-extrabold text-lg">
            PuraVidaWay <span className="text-amber-400">Drivers</span>
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="min-h-10 px-3 rounded-lg border border-emerald-700 text-sm text-emerald-100">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Suspense fallback={<p className="text-sm font-semibold text-slate-500">Loading…</p>}>
          <DriverPortal />
        </Suspense>
      </div>
    </main>
  );
}

async function DriverPortal() {
  const me = await requireUser("/driver");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <p className="text-sm text-slate-600">Driver sign-up isn&apos;t open yet.</p>;
  const { data, error } = await supabase.from("drivers").select("*").eq("id", me.id).maybeSingle<DriverRecord>();
  if (error) {
    return <p className="font-semibold text-red-700">We couldn&apos;t load your application. Please reload the page.</p>;
  }
  return data ? <Application me={me} d={data} /> : <Apply me={me} />;
}

/* ------------------------------------------------------------------------- */

function Apply({ me }: { me: Profile }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Drive with PuraVidaWay</h1>
        <p className="mt-2 text-slate-600">
          Partner drivers and transport companies receive private transfer and tour requests from
          travellers and choose which trips to take. Tell us about you and your vehicle; next you&apos;ll
          upload your documents and our team will contact you on WhatsApp for a short interview.
        </p>
      </div>
      <Card>
        <ActionForm action={applyAsDriver} submitLabel="Start my application" savedLabel="Sent" className="space-y-6">
          <Details me={me} />
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" name="agree" required className="mt-1 h-5 w-5" />
            <span>
              I work as an independent driver or transport company. I hold, and will keep current, the
              licences, permits and insurance the law requires for the trips I accept, and the
              information I give is true.
            </span>
          </label>
        </ActionForm>
      </Card>
    </div>
  );
}

function Application({ me, d }: { me: Profile; d: DriverRecord }) {
  const today = todayInCostaRica();
  const docsMissing = missingDocs(d);
  const detailsMissing = missingDetails(d);
  const issues = expiryIssues(d, today, addDays(today, 30));
  const complete = docsMissing.length === 0 && detailsMissing.length === 0;

  const tone =
    d.kyc_status === "approved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : d.kyc_status === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-red-200 bg-red-50 text-red-900";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900">Your driver application</h1>

      <div className={`rounded-xl border p-4 ${tone}`} role="status">
        <p className="font-extrabold">{STATUS_LABEL[d.kyc_status]}</p>
        <p className="mt-1 text-sm">
          {d.kyc_status === "pending" &&
            (complete
              ? "Thanks! Everything is in. Our team will check your documents and message you on WhatsApp to set up a short interview."
              : "Finish the items below so we can review your application.")}
          {d.kyc_status === "approved" &&
            (d.needs_review
              ? "You're approved. We're checking the changes you made recently."
              : "You're approved to receive trip requests. Keep your documents up to date here.")}
          {d.kyc_status === "rejected" && "We can't approve your application right now."}
          {d.kyc_status === "suspended" && "Your account is paused. Contact our team on WhatsApp."}
        </p>
        {d.kyc_note && <p className="mt-2 text-sm font-semibold">Message from our team: {d.kyc_note}</p>}
      </div>

      {(detailsMissing.length > 0 || issues.length > 0) && (
        <Card>
          <h2 className="font-extrabold text-slate-900">To do</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
            {detailsMissing.map((m) => (
              <li key={m}>Add: {m}</li>
            ))}
            {issues.map((m) => (
              <li key={m} className="text-red-700 font-semibold">
                {m}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-extrabold text-slate-900">Documents</h2>
        <p className="mt-1 text-sm text-slate-600">
          Clear photos or PDFs, up to 10 MB each. Only you and our team can see them.
        </p>
        <ul className="mt-4 divide-y divide-slate-100">
          {DRIVER_DOCS.map((doc) => {
            const has = Boolean(d.documents?.[doc.key]);
            return (
              <li key={doc.key} className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-900">
                    <span aria-hidden className={has ? "text-emerald-600" : "text-slate-300"}>
                      {has ? "✓ " : "○ "}
                    </span>
                    {doc.label}
                    {!doc.required && <span className="ml-1 text-xs font-semibold text-slate-500">(optional)</span>}
                  </p>
                  {doc.hint && <p className="text-sm text-slate-500">{doc.hint}</p>}
                </div>
                <DocumentUpload userId={me.id} docKey={doc.key} label={doc.label} uploaded={has} />
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold text-slate-900">Your details</h2>
        {d.kyc_status === "approved" && (
          <p className="mt-1 text-sm text-slate-600">Changes are checked by our team again before they count.</p>
        )}
        <ActionForm action={saveDriverDetails} className="mt-4 space-y-6">
          <Details me={me} d={d} />
        </ActionForm>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function Details({ me, d }: { me: Profile; d?: DriverRecord }) {
  return (
    <>
      <Group title="About you">
        <Field l="Full name (as on your ID)">
          <input name="full_name" required autoComplete="name" defaultValue={me.full_name ?? ""} className={input} />
        </Field>
        <Field l="WhatsApp number">
          <input name="phone" type="tel" required autoComplete="tel" placeholder="+506 8888 8888" defaultValue={me.phone ?? ""} className={input} />
        </Field>
        <Field l="Cédula or passport number">
          <input name="cedula_number" defaultValue={d?.cedula_number ?? ""} className={input} />
        </Field>
        <Field l="Driver's licence number">
          <input name="license_number" defaultValue={d?.license_number ?? ""} className={input} />
        </Field>
        <Field l="Licence expiry">
          <input name="license_expiry" type="date" defaultValue={d?.license_expiry ?? ""} className={input} />
        </Field>
        <Field l="Criminal record certificate date">
          <input name="criminal_record_date" type="date" defaultValue={d?.criminal_record_date ?? ""} className={input} />
        </Field>
        <Field l="ICT permit number (optional)">
          <input name="ict_permit_number" defaultValue={d?.ict_permit_number ?? ""} className={input} />
        </Field>
      </Group>
      <Group title="Your vehicle">
        <Field l="Make and model">
          <input name="vehicle_model" placeholder="e.g. Toyota Hiace" defaultValue={d?.vehicle_model ?? ""} className={input} />
        </Field>
        <Field l="Year">
          <input name="vehicle_year" type="number" inputMode="numeric" min={1990} max={2100} defaultValue={d?.vehicle_year ?? ""} className={input} />
        </Field>
        <Field l="Passenger seats (not counting you)">
          <input name="passenger_capacity" type="number" inputMode="numeric" min={1} max={60} defaultValue={d?.passenger_capacity ?? ""} className={input} />
        </Field>
        <Field l="INS policy number">
          <input name="ins_policy_number" defaultValue={d?.ins_policy_number ?? ""} className={input} />
        </Field>
        <Field l="Insurance valid until">
          <input name="ins_insurance_expiry" type="date" defaultValue={d?.ins_insurance_expiry ?? ""} className={input} />
        </Field>
        <Field l="Dekra / RTV valid until">
          <input name="dekra_inspection_expiry" type="date" defaultValue={d?.dekra_inspection_expiry ?? ""} className={input} />
        </Field>
        <Field l="Marchamo year paid">
          <input name="marchamo_year" type="number" inputMode="numeric" min={2020} max={2100} defaultValue={d?.marchamo_year ?? ""} className={input} />
        </Field>
      </Group>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="font-extrabold text-slate-900">{title}</legend>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-bold text-slate-700">
      {l}
      <span className="mt-1 block font-normal">{children}</span>
    </label>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5">{children}</section>;
}
