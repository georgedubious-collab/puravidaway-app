import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/ActionForm";
import { requireUser, type Profile } from "@/lib/auth";
import { addDays, todayInCostaRica } from "@/lib/dates";
import {
  CRIMINAL_RECORD_MAX_AGE_DAYS,
  DRIVER_DOCS,
  MAX_VEHICLE_PHOTOS,
  MIN_VEHICLE_PHOTOS,
  RENEWABLE,
  STATUS_LABEL,
  VEHICLE_DOCS,
  canTakeTrips,
  driverIssues,
  missingDriverDetails,
  missingDriverDocs,
  missingVehicleItems,
  vehicleIssues,
  type DriverRecord,
  type Issue,
  type KycStatus,
  type VehicleRecord,
} from "@/lib/driverKyc";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addVehicle,
  applyAsDriver,
  removeVehicle,
  removeVehiclePhoto,
  saveDriverDetails,
  saveDriverProfile,
  saveVehicle,
} from "./actions";
import { DocumentUpload } from "./DocumentUpload";
import { DriverHeader } from "./DriverHeader";

export const metadata: Metadata = {
  title: "Drive with PuraVidaWay",
  robots: { index: false, follow: false },
};

const input = "min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base sm:text-sm";

export default function DriverPage() {
  return (
    <main className="flex-1 bg-slate-50">
      <DriverHeader />
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
  const [d, v] = await Promise.all([
    supabase.from("drivers").select("*").eq("id", me.id).maybeSingle<DriverRecord>(),
    supabase.from("driver_vehicles").select("*").eq("driver_id", me.id).order("created_at").returns<VehicleRecord[]>(),
  ]);
  if (d.error || v.error) {
    return <p className="font-semibold text-red-700">We couldn&apos;t load your application. Please reload the page.</p>;
  }
  if (!d.data) return <Apply me={me} />;

  // Thumbnails of the driver's own vehicle photos (private bucket, 10-minute links).
  const vehicles = v.data ?? [];
  const photoPaths = vehicles.flatMap((x) => x.photos ?? []);
  const thumbs: Record<string, string> = {};
  if (photoPaths.length) {
    const { data } = await supabase.storage.from("driver-kyc-docs").createSignedUrls(photoPaths, 600);
    for (const s of data ?? []) if (s.path && s.signedUrl) thumbs[s.path] = s.signedUrl;
  }
  return <Application me={me} d={d.data} vehicles={vehicles} thumbs={thumbs} />;
}

/* ------------------------------------------------------------------------- */

function Apply({ me }: { me: Profile }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Drive with PuraVidaWay</h1>
        <p className="mt-2 text-slate-600">
          Partner drivers and transport companies receive private transfer and tour requests from
          travellers and choose which trips to take. Start with a few details about you; next you&apos;ll
          upload your documents, add your vehicles, and our team will contact you on WhatsApp for a
          short interview.
        </p>
      </div>
      <Card>
        <ActionForm action={applyAsDriver} submitLabel="Start my application" savedLabel="Sent" className="space-y-6">
          <PersonFields me={me} />
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

function Application({
  me,
  d,
  vehicles,
  thumbs,
}: {
  me: Profile;
  d: DriverRecord;
  vehicles: VehicleRecord[];
  thumbs: Record<string, string>;
}) {
  const today = todayInCostaRica();
  const soon = addDays(today, 30);
  const reviewed = d.kyc_status !== "pending";
  const personTodo = [
    ...missingDriverDetails(d).map((m) => `Add: ${m}`),
    ...missingDriverDocs(d).map((m) => `Upload: ${m.label}`),
  ];
  const issues: Issue[] = [...driverIssues(d, today, soon), ...vehicles.flatMap((v) => vehicleIssues(v, today, soon))];
  const vehiclesComplete = vehicles.length > 0 && vehicles.every((v) => missingVehicleItems(v).length === 0);
  const complete = personTodo.length === 0 && vehiclesComplete;
  const trips = canTakeTrips(d, vehicles, today);

  const tone =
    d.kyc_status === "approved"
      ? trips
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-amber-200 bg-amber-50 text-amber-900"
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
            (trips
              ? "You're approved to receive trip requests. Keep your documents up to date here."
              : "You're approved, but you can't receive trips until the items below are fixed (expired documents, or no approved vehicle yet).")}
          {d.kyc_status === "rejected" && "We can't approve your application right now."}
          {d.kyc_status === "suspended" && "Your account is paused. Contact our team on WhatsApp."}
        </p>
        {d.kyc_note && <p className="mt-2 text-sm font-semibold">Message from our team: {d.kyc_note}</p>}
      </div>

      {(personTodo.length > 0 || issues.length > 0 || vehicles.length === 0) && (
        <Card>
          <h2 className="font-extrabold text-slate-900">To do</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
            {personTodo.map((m) => (
              <li key={m}>{m}</li>
            ))}
            {vehicles.length === 0 && <li>Add at least one vehicle (below)</li>}
            {issues.map((m) => (
              <li key={m.text} className={m.blocking ? "text-red-700 font-bold" : "text-amber-800 font-semibold"}>
                {m.text}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ----------------------------- About you ----------------------------- */}
      <Card>
        <h2 className="text-lg font-extrabold text-slate-900">About you</h2>
        <ActionForm action={saveDriverDetails} className="mt-4 space-y-6">
          <PersonFields me={me} d={d} lockLicence={reviewed} />
        </ActionForm>
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold text-slate-900">Your profile for travellers</h2>
        <p className="mt-1 text-sm text-slate-600">
          Travellers see your photo, first name, this bio and your vehicle once you&apos;re their
          driver. Tell them what makes a ride with you special: years driving, regions you know
          best, wildlife spotting, family-friendly… No phone numbers, emails or links, please.
        </p>
        <ActionForm action={saveDriverProfile} className="mt-4 space-y-4">
          <fieldset>
            <legend className="text-sm font-bold text-slate-700">Your English</legend>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <label className="flex min-h-10 items-center gap-2">
                <input type="radio" name="english_level" value="fluent" required defaultChecked={d.english_level === "fluent"} />
                I hold conversations in English
              </label>
              <label className="flex min-h-10 items-center gap-2">
                <input type="radio" name="english_level" value="basic" defaultChecked={d.english_level === "basic"} />
                Spanish, basic English
              </label>
            </div>
          </fieldset>
          <label className="block text-sm font-bold text-slate-700">
            Short bio (up to 600 characters)
            <textarea
              name="bio"
              rows={4}
              maxLength={600}
              defaultValue={d.bio ?? ""}
              placeholder="Pura vida! I'm Carlos, born in La Fortuna. I've driven travellers across Costa Rica for 12 years and love spotting sloths along the way…"
              className="mt-1 block w-full rounded-lg border border-slate-300 p-3 text-base font-normal sm:text-sm"
            />
          </label>
        </ActionForm>
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold text-slate-900">Your documents</h2>
        <p className="mt-1 text-sm text-slate-600">
          Clear photos or PDFs, up to 10 MB each. Only you and our team can see them. The criminal
          record certificate must be issued no more than {CRIMINAL_RECORD_MAX_AGE_DAYS} days before
          we approve you.
        </p>
        <ul className="mt-4 divide-y divide-slate-100">
          {DRIVER_DOCS.map((doc) => (
            <DocRow
              key={doc.key}
              label={doc.label}
              hint={doc.hint}
              required={doc.required}
              has={Boolean(d.documents?.[doc.key])}
            >
              <DocumentUpload
                userId={me.id}
                target={{ type: "driver", key: doc.key }}
                label={doc.label}
                uploaded={Boolean(d.documents?.[doc.key])}
                renew={reviewed && RENEWABLE[doc.key] ? RENEWABLE[doc.key] : undefined}
              />
            </DocRow>
          ))}
        </ul>
      </Card>

      {/* ----------------------------- Vehicles ------------------------------ */}
      <div className="pt-2">
        <h2 className="text-xl font-extrabold text-slate-900">Your vehicles</h2>
        <p className="mt-1 text-sm text-slate-600">
          Add every vehicle you&apos;ll drive. Each one needs its registration (tarjeta de
          circulación), insurance, Dekra, Marchamo and at least {MIN_VEHICLE_PHOTOS} photos, one of
          them clearly showing the licence plate. Each vehicle is approved separately. Insurance
          has a 15-day grace period after it ends; Dekra and Marchamo have none.
        </p>
      </div>

      {vehicles.map((v) => (
        <VehicleCard key={v.id} me={me} v={v} thumbs={thumbs} />
      ))}

      <Card>
        <h3 className="font-extrabold text-slate-900">{vehicles.length ? "Add another vehicle" : "Add your vehicle"}</h3>
        {/* key: a fresh, empty form after each vehicle is added */}
        <ActionForm key={vehicles.length} action={addVehicle} submitLabel="Add vehicle" savedLabel="Added" className="mt-4 space-y-6">
          <VehicleFields />
        </ActionForm>
      </Card>
    </div>
  );
}

function VehicleCard({ me, v, thumbs }: { me: Profile; v: VehicleRecord; thumbs: Record<string, string> }) {
  const reviewed = v.status !== "pending";
  const todo = missingVehicleItems(v);
  const photos = v.photos ?? [];
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-extrabold text-slate-900">
          {v.make_model || "Vehicle"} {v.year ? `(${v.year})` : ""}
          {v.plate && <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-sm font-bold text-slate-700">{v.plate}</span>}
        </h3>
        <StatusPill status={v.status} needsReview={v.needs_review} />
      </div>
      {v.note && <p className="mt-2 text-sm font-semibold text-slate-700">Message from our team: {v.note}</p>}
      {todo.length > 0 && <p className="mt-2 text-sm text-amber-800">Still needed: {todo.join(", ")}.</p>}

      <h4 className="mt-5 font-bold text-slate-900">
        Photos <span className="font-normal text-slate-500">({photos.length} of max {MAX_VEHICLE_PHOTOS})</span>
      </h4>
      <p className="text-sm text-slate-500">
        At least {MIN_VEHICLE_PHOTOS}: one showing the licence plate clearly, plus the outside and inside.
      </p>
      {photos.length > 0 && (
        <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <li key={p} className="relative">
              {thumbs[p] ? (
                // eslint-disable-next-line @next/next/no-img-element -- private signed URL
                <img src={thumbs[p]} alt="Vehicle photo" className="aspect-square w-full rounded-lg object-cover" />
              ) : (
                <div className="aspect-square w-full rounded-lg bg-slate-100" />
              )}
              <ActionForm action={removeVehiclePhoto} submitLabel="Remove" savedLabel="" className="mt-1 text-xs">
                <input type="hidden" name="vehicle_id" value={v.id} />
                <input type="hidden" name="path" value={p} />
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <DocumentUpload userId={me.id} target={{ type: "photo", vehicleId: v.id }} label="Vehicle photos" uploaded={false} />
      </div>

      <h4 className="mt-6 font-bold text-slate-900">Documents</h4>
      <ul className="mt-1 divide-y divide-slate-100">
        {VEHICLE_DOCS.map((doc) => (
          <DocRow key={doc.key} label={doc.label} hint={doc.hint} required={doc.required} has={Boolean(v.documents?.[doc.key])}>
            <DocumentUpload
              userId={me.id}
              target={{ type: "vehicle", vehicleId: v.id, key: doc.key }}
              label={doc.label}
              uploaded={Boolean(v.documents?.[doc.key])}
              renew={reviewed && RENEWABLE[doc.key] ? RENEWABLE[doc.key] : undefined}
            />
          </DocRow>
        ))}
      </ul>

      <h4 className="mt-6 font-bold text-slate-900">Details</h4>
      <ActionForm action={saveVehicle} className="mt-3 space-y-6">
        <input type="hidden" name="vehicle_id" value={v.id} />
        <VehicleFields v={v} lockDates={reviewed} />
      </ActionForm>

      <details className="mt-6 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-500">Remove this vehicle</summary>
        <ActionForm action={removeVehicle} submitLabel="Remove vehicle" savedLabel="Removed" className="mt-3 space-y-3">
          <input type="hidden" name="vehicle_id" value={v.id} />
          <label className="flex items-center gap-2">
            <input type="checkbox" name="confirm" className="h-5 w-5" /> Yes, I no longer use this vehicle
          </label>
        </ActionForm>
      </details>
    </Card>
  );
}

/* ------------------------------------------------------------------------- */

function PersonFields({ me, d, lockLicence = false }: { me: Profile; d?: DriverRecord; lockLicence?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
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
      {lockLicence ? (
        <Locked l="Licence expiry" v={d?.license_expiry} />
      ) : (
        <Field l="Licence expiry">
          <input name="license_expiry" type="date" defaultValue={d?.license_expiry ?? ""} className={input} />
        </Field>
      )}
      <Field l="Criminal record certificate: date issued">
        <input name="criminal_record_date" type="date" defaultValue={d?.criminal_record_date ?? ""} className={input} />
      </Field>
      <Field l="ICT permit number (optional)">
        <input name="ict_permit_number" defaultValue={d?.ict_permit_number ?? ""} className={input} />
      </Field>
    </div>
  );
}

function VehicleFields({ v, lockDates = false }: { v?: VehicleRecord; lockDates?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field l="Plate number">
        <input name="plate" required placeholder="e.g. TUR-1234" defaultValue={v?.plate ?? ""} className={input} />
      </Field>
      <Field l="Make and model">
        <input name="make_model" required placeholder="e.g. Toyota Hiace" defaultValue={v?.make_model ?? ""} className={input} />
      </Field>
      <Field l="Year">
        <input name="year" type="number" inputMode="numeric" min={1990} max={2100} defaultValue={v?.year ?? ""} className={input} />
      </Field>
      <Field l="Colour">
        <input name="color" defaultValue={v?.color ?? ""} className={input} />
      </Field>
      <Field l="Passenger seats (not counting you)">
        <input name="passenger_capacity" type="number" inputMode="numeric" min={1} max={60} defaultValue={v?.passenger_capacity ?? ""} className={input} />
      </Field>
      <Field l="INS policy number">
        <input name="ins_policy_number" defaultValue={v?.ins_policy_number ?? ""} className={input} />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-bold text-slate-700">What this vehicle offers</legend>
        <input type="hidden" name="features" value="1" />
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <label className="flex min-h-10 items-center gap-2">
            <input type="checkbox" name="has_wifi" defaultChecked={v?.has_wifi} /> Wi-Fi
          </label>
          <label className="flex min-h-10 items-center gap-2">
            <input type="checkbox" name="stroller_space" defaultChecked={v?.stroller_space} /> Room for a stroller
          </label>
          <label className="flex min-h-10 items-center gap-2">
            <input type="checkbox" name="pet_friendly" defaultChecked={v?.pet_friendly} /> Pets welcome
          </label>
          <label className="flex min-h-10 items-center gap-2">
            Child seats
            <select name="child_seats" defaultValue={v?.child_seats ?? 0} className="rounded-lg border border-slate-300 px-1 py-1">
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
      {lockDates ? (
        <>
          <Locked l="Insurance valid until" v={v?.ins_insurance_expiry} />
          <Locked l="Dekra / RTV valid until" v={v?.dekra_inspection_expiry} />
          <Locked l="Marchamo year paid" v={v?.marchamo_year} />
        </>
      ) : (
        <>
          <Field l="Insurance valid until">
            <input name="ins_insurance_expiry" type="date" defaultValue={v?.ins_insurance_expiry ?? ""} className={input} />
          </Field>
          <Field l="Dekra / RTV valid until">
            <input name="dekra_inspection_expiry" type="date" defaultValue={v?.dekra_inspection_expiry ?? ""} className={input} />
          </Field>
          <Field l="Marchamo year paid">
            <input name="marchamo_year" type="number" inputMode="numeric" min={2020} max={2100} defaultValue={v?.marchamo_year ?? ""} className={input} />
          </Field>
        </>
      )}
    </div>
  );
}

function DocRow({
  label,
  hint,
  required,
  has,
  children,
}: {
  label: string;
  hint?: string;
  required: boolean;
  has: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-bold text-slate-900">
          <span aria-hidden className={has ? "text-emerald-600" : "text-slate-300"}>
            {has ? "✓ " : "○ "}
          </span>
          {label}
          {!required && <span className="ml-1 text-xs font-semibold text-slate-500">(optional)</span>}
        </p>
        {hint && <p className="text-sm text-slate-500">{hint}</p>}
      </div>
      {children}
    </li>
  );
}

function StatusPill({ status, needsReview }: { status: KycStatus; needsReview: boolean }) {
  const cls =
    status === "approved"
      ? "bg-emerald-100 text-emerald-900"
      : status === "pending"
        ? "bg-amber-100 text-amber-900"
        : "bg-red-100 text-red-900";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${cls}`}>
      {STATUS_LABEL[status]}
      {needsReview && status === "approved" ? " · changes being checked" : ""}
    </span>
  );
}

function Locked({ l, v }: { l: string; v: string | number | null | undefined }) {
  return (
    <div className="text-sm font-bold text-slate-700">
      {l}
      <p className="mt-1 min-h-11 flex flex-wrap items-center gap-x-2 font-normal text-slate-900">
        {v ?? "—"}
        <span className="text-xs text-slate-500">(change it by uploading the renewed document)</span>
      </p>
    </div>
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
