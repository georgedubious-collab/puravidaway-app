import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/ActionForm";
import { requireUser, type Profile } from "@/lib/auth";
import { EXTRA_AREAS, HUBS } from "@/lib/catalog";
import { addDays, todayInCostaRica } from "@/lib/dates";
import {
  CRIMINAL_RECORD_MAX_AGE_DAYS,
  DRIVER_DOCS,
  MAX_VEHICLE_PHOTOS,
  MIN_VEHICLE_PHOTOS,
  RENEWABLE,
  VEHICLE_DOCS,
  canTakeTrips,
  docHint,
  docLabel,
  driverIssues,
  kycStatusLabel,
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
import { makeT, type TeamLang } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { categoryHint, categoryLabel, isVehicleCategory } from "@/lib/vehicleEligibility";
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
  title: "Costa Rica Private Transfers | Conductores",
  robots: { index: false, follow: false },
};

const input = "min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base sm:text-sm";

export default function DriverPage() {
  return (
    <main className="flex-1 bg-slate-50">
      <DriverHeader />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Suspense fallback={<p className="text-sm font-semibold text-slate-500">Cargando… / Loading…</p>}>
          <DriverPortal />
        </Suspense>
      </div>
    </main>
  );
}

async function DriverPortal() {
  const me = await requireUser("/driver");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return (
      <p className="text-sm text-slate-600">
        {t("El registro de conductores todavía no está abierto.", "Driver sign-up isn't open yet.")}
      </p>
    );
  const [d, v] = await Promise.all([
    supabase.from("drivers").select("*").eq("id", me.id).maybeSingle<DriverRecord>(),
    supabase.from("driver_vehicles").select("*").eq("driver_id", me.id).order("created_at").returns<VehicleRecord[]>(),
  ]);
  if (d.error || v.error) {
    return (
      <p className="font-semibold text-red-700">
        {t("No pudimos cargar su solicitud. Recargue la página.", "We couldn't load your application. Please reload the page.")}
      </p>
    );
  }
  if (!d.data) return <Apply me={me} lang={lang} />;

  // Thumbnails of the driver's own vehicle photos (private bucket, 10-minute links).
  const vehicles = v.data ?? [];
  const photoPaths = vehicles.flatMap((x) => x.photos ?? []);
  const thumbs: Record<string, string> = {};
  if (photoPaths.length) {
    const { data } = await supabase.storage.from("driver-kyc-docs").createSignedUrls(photoPaths, 600);
    for (const s of data ?? []) if (s.path && s.signedUrl) thumbs[s.path] = s.signedUrl;
  }
  const { data: reviews } = await supabase
    .from("driver_reviews")
    .select("id, stars, comment, created_at")
    .eq("driver_id", me.id)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<{ id: string; stars: number; comment: string | null; created_at: string }[]>();
  return (
    <>
      <Application me={me} d={d.data} vehicles={vehicles} thumbs={thumbs} lang={lang} />
      {d.data.kyc_status === "approved" && <YourRating d={d.data} reviews={reviews ?? []} lang={lang} />}
    </>
  );
}

/** The driver's rating from travellers: weighted average (a review with a comment counts double). */
function YourRating({
  d,
  reviews,
  lang,
}: {
  d: DriverRecord;
  reviews: { id: string; stars: number; comment: string | null; created_at: string }[];
  lang: TeamLang;
}) {
  const t = makeT(lang);
  return (
    <div className="mt-6">
      <Card>
        <h2 className="text-lg font-extrabold text-slate-900">
          {t("Su calificación", "Your rating")}
          {d.rating_count
            ? t(
                `: ★ ${Number(d.rating_avg).toFixed(1)} de ${d.rating_count} calificaciones`,
                `: ★ ${Number(d.rating_avg).toFixed(1)} from ${d.rating_count} ratings`,
              )
            : ""}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t(
            "Los clientes lo califican después de cada viaje. A los conductores mejor calificados se les ofrecen más viajes. Una calificación con un comentario escrito cuenta doble, así que el buen servicio del que la gente escribe le rinde el doble.",
            "Travellers rate you after each trip. Better-rated drivers are offered more trips. A rating with a written comment counts double, so great service that people write about pays off twice.",
          )}
        </p>
        {reviews.length > 0 && (
          <ul className="mt-3 space-y-2 text-sm">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-lg bg-slate-50 p-3">
                <span className="font-bold text-amber-500">{"★".repeat(r.stars)}</span>
                <span className="text-slate-300">{"★".repeat(5 - r.stars)}</span>{" "}
                <span className="text-xs text-slate-500">{r.created_at.slice(0, 10)}</span>
                {r.comment && <p className="mt-1 italic text-slate-700">&ldquo;{r.comment}&rdquo;</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function Apply({ me, lang }: { me: Profile; lang: TeamLang }) {
  const t = makeT(lang);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">
          {t("Maneje con Costa Rica Private Transfers", "Drive with Costa Rica Private Transfers")}
        </h1>
        <p className="mt-2 text-slate-600">
          {t(
            "Los conductores y empresas de transporte asociados reciben solicitudes de traslados privados y tours de clientes y eligen qué viajes tomar. Empiece con algunos datos sobre usted; después subirá sus documentos, agregará sus vehículos y nuestro equipo lo contactará por WhatsApp para una entrevista corta.",
            "Partner drivers and transport companies receive private transfer and tour requests from travellers and choose which trips to take. Start with a few details about you; next you'll upload your documents, add your vehicles, and our team will contact you on WhatsApp for a short interview.",
          )}
        </p>
      </div>
      <Card>
        <ActionForm
          action={applyAsDriver}
          lang={lang}
          submitLabel={t("Iniciar mi solicitud", "Start my application")}
          savedLabel={t("Enviada", "Sent")}
          className="space-y-6"
        >
          <PersonFields me={me} lang={lang} />
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" name="agree" required className="mt-1 h-5 w-5" />
            <span>
              {t(
                "Trabajo como conductor independiente o empresa de transporte. Tengo, y mantendré vigentes, las licencias, permisos y seguros que la ley exige para los viajes que acepte, y la información que doy es verdadera.",
                "I work as an independent driver or transport company. I hold, and will keep current, the licences, permits and insurance the law requires for the trips I accept, and the information I give is true.",
              )}
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
  lang,
}: {
  me: Profile;
  d: DriverRecord;
  vehicles: VehicleRecord[];
  thumbs: Record<string, string>;
  lang: TeamLang;
}) {
  const t = makeT(lang);
  const today = todayInCostaRica();
  const soon = addDays(today, 30);
  const reviewed = d.kyc_status !== "pending";
  const personTodo = [
    ...missingDriverDetails(d, lang).map((m) => t(`Agregar: ${m}`, `Add: ${m}`)),
    ...missingDriverDocs(d).map((m) => t(`Subir: ${docLabel(m, lang)}`, `Upload: ${docLabel(m, lang)}`)),
  ];
  const issues: Issue[] = [
    ...driverIssues(d, today, soon, lang),
    ...vehicles.flatMap((v) => vehicleIssues(v, today, soon, lang)),
  ];
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
      <h1 className="text-2xl font-extrabold text-slate-900">{t("Su solicitud de conductor", "Your driver application")}</h1>

      <div className={`rounded-xl border p-4 ${tone}`} role="status">
        <p className="font-extrabold">{kycStatusLabel(d.kyc_status, lang)}</p>
        <p className="mt-1 text-sm">
          {d.kyc_status === "pending" &&
            (complete
              ? t(
                  "¡Gracias! Ya está todo. Nuestro equipo revisará sus documentos y le escribirá por WhatsApp para coordinar una entrevista corta.",
                  "Thanks! Everything is in. Our team will check your documents and message you on WhatsApp to set up a short interview.",
                )
              : t(
                  "Complete los puntos de abajo para que podamos revisar su solicitud.",
                  "Finish the items below so we can review your application.",
                ))}
          {d.kyc_status === "approved" &&
            (trips
              ? t(
                  "Está aprobado para recibir solicitudes de viaje. Mantenga sus documentos al día aquí.",
                  "You're approved to receive trip requests. Keep your documents up to date here.",
                )
              : t(
                  "Está aprobado, pero no puede recibir viajes hasta que se resuelvan los puntos de abajo (documentos vencidos o todavía ningún vehículo aprobado).",
                  "You're approved, but you can't receive trips until the items below are fixed (expired documents, or no approved vehicle yet).",
                ))}
          {d.kyc_status === "rejected" &&
            t("En este momento no podemos aprobar su solicitud.", "We can't approve your application right now.")}
          {d.kyc_status === "suspended" &&
            t(
              "Su cuenta está en pausa. Contacte a nuestro equipo por WhatsApp.",
              "Your account is paused. Contact our team on WhatsApp.",
            )}
        </p>
        {d.kyc_note && (
          <p className="mt-2 text-sm font-semibold">
            {t("Mensaje de nuestro equipo:", "Message from our team:")} {d.kyc_note}
          </p>
        )}
      </div>

      {(personTodo.length > 0 || issues.length > 0 || vehicles.length === 0) && (
        <Card>
          <h2 className="font-extrabold text-slate-900">{t("Pendientes", "To do")}</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
            {personTodo.map((m) => (
              <li key={m}>{m}</li>
            ))}
            {vehicles.length === 0 && <li>{t("Agregue al menos un vehículo (abajo)", "Add at least one vehicle (below)")}</li>}
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
        <h2 className="text-lg font-extrabold text-slate-900">{t("Sus datos", "About you")}</h2>
        <ActionForm action={saveDriverDetails} lang={lang} className="mt-4 space-y-6">
          <PersonFields me={me} d={d} lockLicence={reviewed} lang={lang} />
        </ActionForm>
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold text-slate-900">{t("Su perfil para los clientes", "Your profile for travellers")}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {t(
            "Los clientes ven su foto, su nombre, esta presentación y su vehículo cuando usted es su conductor. Cuénteles qué hace especial un viaje con usted: años manejando, las regiones que mejor conoce, avistamiento de animales, ideal para familias… Por favor, sin teléfonos, correos ni enlaces.",
            "Travellers see your photo, first name, this bio and your vehicle once you're their driver. Tell them what makes a ride with you special: years driving, regions you know best, wildlife spotting, family-friendly… No phone numbers, emails or links, please.",
          )}
        </p>
        <ActionForm action={saveDriverProfile} lang={lang} className="mt-4 space-y-4">
          <fieldset>
            <legend className="text-sm font-bold text-slate-700">{t("Su inglés", "Your English")}</legend>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <label className="flex min-h-10 items-center gap-2">
                <input type="radio" name="english_level" value="fluent" required defaultChecked={d.english_level === "fluent"} />
                {t("Mantengo conversaciones en inglés", "I hold conversations in English")}
              </label>
              <label className="flex min-h-10 items-center gap-2">
                <input type="radio" name="english_level" value="basic" defaultChecked={d.english_level === "basic"} />
                {t("Español, inglés básico", "Spanish, basic English")}
              </label>
            </div>
          </fieldset>
          <label className="block text-sm font-bold text-slate-700">
            {t("Presentación corta (hasta 600 caracteres)", "Short bio (up to 600 characters)")}
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
        <h2 className="text-lg font-extrabold text-slate-900">{t("Sus documentos", "Your documents")}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {t(
            `Fotos claras o PDF, de hasta 10 MB cada uno. Solo usted y nuestro equipo pueden verlos. La hoja de delincuencia debe tener como máximo ${CRIMINAL_RECORD_MAX_AGE_DAYS} días al momento en que lo aprobemos.`,
            `Clear photos or PDFs, up to 10 MB each. Only you and our team can see them. The criminal record certificate must be issued no more than ${CRIMINAL_RECORD_MAX_AGE_DAYS} days before we approve you.`,
          )}
        </p>
        <ul className="mt-4 divide-y divide-slate-100">
          {DRIVER_DOCS.map((doc) => (
            <DocRow
              key={doc.key}
              label={docLabel(doc, lang)}
              hint={docHint(doc, lang)}
              required={doc.required}
              has={Boolean(d.documents?.[doc.key])}
              lang={lang}
            >
              <DocumentUpload
                userId={me.id}
                target={{ type: "driver", key: doc.key }}
                label={docLabel(doc, lang)}
                uploaded={Boolean(d.documents?.[doc.key])}
                renew={reviewed ? renewFor(doc.key, lang) : undefined}
                lang={lang}
              />
            </DocRow>
          ))}
        </ul>
      </Card>

      {/* ----------------------------- Vehicles ------------------------------ */}
      <div className="pt-2">
        <h2 className="text-xl font-extrabold text-slate-900">{t("Sus vehículos", "Your vehicles")}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {t(
            `Agregue cada vehículo que vaya a manejar. Cada uno necesita su tarjeta de circulación, seguro, Dekra, Marchamo y al menos ${MIN_VEHICLE_PHOTOS} fotos, una de ellas donde se vea claramente la placa. Cada vehículo se aprueba por separado. El seguro tiene un periodo de gracia de 15 días después de vencer; Dekra y Marchamo no tienen.`,
            `Add every vehicle you'll drive. Each one needs its registration (tarjeta de circulación), insurance, Dekra, Marchamo and at least ${MIN_VEHICLE_PHOTOS} photos, one of them clearly showing the licence plate. Each vehicle is approved separately. Insurance has a 15-day grace period after it ends; Dekra and Marchamo have none.`,
          )}
        </p>
      </div>

      {vehicles.map((v) => (
        <VehicleCard key={v.id} me={me} v={v} thumbs={thumbs} lang={lang} />
      ))}

      <Card>
        <h3 className="font-extrabold text-slate-900">
          {vehicles.length ? t("Agregar otro vehículo", "Add another vehicle") : t("Agregar su vehículo", "Add your vehicle")}
        </h3>
        {/* key: a fresh, empty form after each vehicle is added */}
        <ActionForm
          key={vehicles.length}
          action={addVehicle}
          lang={lang}
          submitLabel={t("Agregar vehículo", "Add vehicle")}
          savedLabel={t("Agregado", "Added")}
          className="mt-4 space-y-6"
        >
          <VehicleFields lang={lang} />
        </ActionForm>
      </Card>
    </div>
  );
}

/** A renewable document's "new date" question in the page language. */
function renewFor(key: string, lang: TeamLang): { ask: string; kind: "date" | "year" } | undefined {
  const r = RENEWABLE[key];
  return r ? { ask: lang === "es" ? r.askEs : r.ask, kind: r.kind } : undefined;
}

function VehicleCard({
  me,
  v,
  thumbs,
  lang,
}: {
  me: Profile;
  v: VehicleRecord;
  thumbs: Record<string, string>;
  lang: TeamLang;
}) {
  const t = makeT(lang);
  const reviewed = v.status !== "pending";
  const todo = missingVehicleItems(v, lang);
  const photos = v.photos ?? [];
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-extrabold text-slate-900">
          {v.make_model || t("Vehículo", "Vehicle")} {v.year ? `(${v.year})` : ""}
          {v.plate && <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-sm font-bold text-slate-700">{v.plate}</span>}
        </h3>
        <StatusPill status={v.status} needsReview={v.needs_review} lang={lang} />
      </div>
      {v.note && (
        <p className="mt-2 text-sm font-semibold text-slate-700">
          {t("Mensaje de nuestro equipo:", "Message from our team:")} {v.note}
        </p>
      )}
      {todo.length > 0 && (
        <p className="mt-2 text-sm text-amber-800">
          {t("Todavía falta:", "Still needed:")} {todo.join(", ")}.
        </p>
      )}
      {/* Set by our team only (migration 0038); it decides which jobs this vehicle receives. */}
      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <span className="font-bold text-slate-900">
          {t("Categoría del vehículo:", "Vehicle category:")}{" "}
          {isVehicleCategory(v.vehicle_class) ? categoryLabel(v.vehicle_class, lang) : t("todavía sin asignar", "not set yet")}
          {/* Read-only: only our team marks a vehicle as electric (migration 0042). */}
          {v.is_electric && <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900">{t("Eléctrico", "Electric")}</span>}
        </span>
        <span className="block">
          {categoryHint(v.vehicle_class, lang)}{" "}
          {isVehicleCategory(v.vehicle_class) && t("La categoría la asigna nuestro equipo.", "Our team sets the category.")}
        </span>
      </p>

      <h4 className="mt-5 font-bold text-slate-900">
        {t("Fotos", "Photos")}{" "}
        <span className="font-normal text-slate-500">
          ({t(`${photos.length} de máx. ${MAX_VEHICLE_PHOTOS}`, `${photos.length} of max ${MAX_VEHICLE_PHOTOS}`)})
        </span>
      </h4>
      <p className="text-sm text-slate-500">
        {t(
          `Al menos ${MIN_VEHICLE_PHOTOS}: una donde se vea claramente la placa, más el exterior y el interior.`,
          `At least ${MIN_VEHICLE_PHOTOS}: one showing the licence plate clearly, plus the outside and inside.`,
        )}
      </p>
      {photos.length > 0 && (
        <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <li key={p} className="relative">
              {thumbs[p] ? (
                // eslint-disable-next-line @next/next/no-img-element -- private signed URL
                <img src={thumbs[p]} alt={t("Foto del vehículo", "Vehicle photo")} className="aspect-square w-full rounded-lg object-cover" />
              ) : (
                <div className="aspect-square w-full rounded-lg bg-slate-100" />
              )}
              <ActionForm action={removeVehiclePhoto} lang={lang} submitLabel={t("Eliminar", "Remove")} savedLabel="" className="mt-1 text-xs">
                <input type="hidden" name="vehicle_id" value={v.id} />
                <input type="hidden" name="path" value={p} />
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <DocumentUpload
          userId={me.id}
          target={{ type: "photo", vehicleId: v.id }}
          label={t("Fotos del vehículo", "Vehicle photos")}
          uploaded={false}
          lang={lang}
        />
      </div>

      <h4 className="mt-6 font-bold text-slate-900">{t("Documentos", "Documents")}</h4>
      <ul className="mt-1 divide-y divide-slate-100">
        {VEHICLE_DOCS.map((doc) => (
          <DocRow
            key={doc.key}
            label={docLabel(doc, lang)}
            hint={docHint(doc, lang)}
            required={doc.required}
            has={Boolean(v.documents?.[doc.key])}
            lang={lang}
          >
            <DocumentUpload
              userId={me.id}
              target={{ type: "vehicle", vehicleId: v.id, key: doc.key }}
              label={docLabel(doc, lang)}
              uploaded={Boolean(v.documents?.[doc.key])}
              renew={reviewed ? renewFor(doc.key, lang) : undefined}
              lang={lang}
            />
          </DocRow>
        ))}
      </ul>

      <h4 className="mt-6 font-bold text-slate-900">{t("Detalles", "Details")}</h4>
      <ActionForm action={saveVehicle} lang={lang} className="mt-3 space-y-6">
        <input type="hidden" name="vehicle_id" value={v.id} />
        <VehicleFields v={v} lockDates={reviewed} lang={lang} />
      </ActionForm>

      <details className="mt-6 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-500">{t("Eliminar este vehículo", "Remove this vehicle")}</summary>
        <ActionForm
          action={removeVehicle}
          lang={lang}
          submitLabel={t("Eliminar vehículo", "Remove vehicle")}
          savedLabel={t("Eliminado", "Removed")}
          className="mt-3 space-y-3"
        >
          <input type="hidden" name="vehicle_id" value={v.id} />
          <label className="flex items-center gap-2">
            <input type="checkbox" name="confirm" className="h-5 w-5" />{" "}
            {t("Sí, ya no uso este vehículo", "Yes, I no longer use this vehicle")}
          </label>
        </ActionForm>
      </details>
    </Card>
  );
}

/* ------------------------------------------------------------------------- */

function PersonFields({
  me,
  d,
  lockLicence = false,
  lang,
}: {
  me: Profile;
  d?: DriverRecord;
  lockLicence?: boolean;
  lang: TeamLang;
}) {
  const t = makeT(lang);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field l={t("Nombre completo (como en su identificación)", "Full name (as on your ID)")}>
        <input name="full_name" required autoComplete="name" defaultValue={me.full_name ?? ""} className={input} />
      </Field>
      <Field l={t("Número de WhatsApp", "WhatsApp number")}>
        <input name="phone" type="tel" required autoComplete="tel" placeholder="+506 8888 8888" defaultValue={me.phone ?? ""} className={input} />
      </Field>
      <Field l={t("Número de cédula o pasaporte", "Cédula or passport number")}>
        <input name="cedula_number" defaultValue={d?.cedula_number ?? ""} className={input} />
      </Field>
      <Field l={t("Número de licencia de conducir", "Driver's licence number")}>
        <input name="license_number" defaultValue={d?.license_number ?? ""} className={input} />
      </Field>
      {lockLicence ? (
        <Locked l={t("Vencimiento de la licencia", "Licence expiry")} v={d?.license_expiry} lang={lang} />
      ) : (
        <Field l={t("Vencimiento de la licencia", "Licence expiry")}>
          <input name="license_expiry" type="date" defaultValue={d?.license_expiry ?? ""} className={input} />
        </Field>
      )}
      <Field l={t("Hoja de delincuencia: fecha de emisión", "Criminal record certificate: date issued")}>
        <input name="criminal_record_date" type="date" defaultValue={d?.criminal_record_date ?? ""} className={input} />
      </Field>
      <Field l={t("Número de permiso ICT (opcional)", "ICT permit number (optional)")}>
        <input name="ict_permit_number" defaultValue={d?.ict_permit_number ?? ""} className={input} />
      </Field>
      <Field l={t("¿Dónde vive o tiene su base?", "Where are you based?")}>
        <select name="home_hub" defaultValue={d?.home_hub ?? ""} className={input}>
          <option value="">{t("Elija su pueblo o zona", "Choose your town or area")}</option>
          {HUBS.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
          {EXTRA_AREAS.map((a) => (
            <option key={a.id} value={a.id}>
              {lang === "es" ? a.name.replace("Southern Nicoya", "Sur de Nicoya") : a.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs font-normal text-slate-500">
          {t(
            "Los trabajos que empiezan cerca de usted, y los viajes de regreso después de sus destinos, se le ofrecen a usted primero.",
            "Jobs that start near you, and return trips after your drop-offs, are offered to you first.",
          )}
        </span>
      </Field>
    </div>
  );
}

function VehicleFields({ v, lockDates = false, lang }: { v?: VehicleRecord; lockDates?: boolean; lang: TeamLang }) {
  const t = makeT(lang);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field l={t("Número de placa", "Plate number")}>
        <input name="plate" required placeholder={t("ej. TUR-1234", "e.g. TUR-1234")} defaultValue={v?.plate ?? ""} className={input} />
      </Field>
      <Field l={t("Marca y modelo", "Make and model")}>
        <input name="make_model" required placeholder={t("ej. Toyota Hiace", "e.g. Toyota Hiace")} defaultValue={v?.make_model ?? ""} className={input} />
      </Field>
      <Field l={t("Año", "Year")}>
        <input name="year" type="number" inputMode="numeric" min={1990} max={2100} defaultValue={v?.year ?? ""} className={input} />
      </Field>
      <Field l={t("Color", "Colour")}>
        <input name="color" defaultValue={v?.color ?? ""} className={input} />
      </Field>
      <Field l={t("Asientos para pasajeros (sin contarlo a usted)", "Passenger seats (not counting you)")}>
        <input name="passenger_capacity" type="number" inputMode="numeric" min={1} max={60} defaultValue={v?.passenger_capacity ?? ""} className={input} />
      </Field>
      <Field l={t("Número de póliza del INS", "INS policy number")}>
        <input name="ins_policy_number" defaultValue={v?.ins_policy_number ?? ""} className={input} />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-bold text-slate-700">{t("Lo que ofrece este vehículo", "What this vehicle offers")}</legend>
        <input type="hidden" name="features" value="1" />
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <label className="flex min-h-10 items-center gap-2">
            <input type="checkbox" name="has_wifi" defaultChecked={v?.has_wifi} /> Wi-Fi
          </label>
          <label className="flex min-h-10 items-center gap-2">
            <input type="checkbox" name="stroller_space" defaultChecked={v?.stroller_space} />{" "}
            {t("Espacio para coche de bebé", "Room for a stroller")}
          </label>
          <label className="flex min-h-10 items-center gap-2">
            <input type="checkbox" name="pet_friendly" defaultChecked={v?.pet_friendly} />{" "}
            {t("Se aceptan mascotas", "Pets welcome")}
          </label>
          <label className="flex min-h-10 items-center gap-2">
            {t("Asientos para niños", "Child seats")}
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
          <Locked l={t("Seguro vigente hasta", "Insurance valid until")} v={v?.ins_insurance_expiry} lang={lang} />
          <Locked l={t("Dekra / RTV vigente hasta", "Dekra / RTV valid until")} v={v?.dekra_inspection_expiry} lang={lang} />
          <Locked l={t("Año del Marchamo pagado", "Marchamo year paid")} v={v?.marchamo_year} lang={lang} />
        </>
      ) : (
        <>
          <Field l={t("Seguro vigente hasta", "Insurance valid until")}>
            <input name="ins_insurance_expiry" type="date" defaultValue={v?.ins_insurance_expiry ?? ""} className={input} />
          </Field>
          <Field l={t("Dekra / RTV vigente hasta", "Dekra / RTV valid until")}>
            <input name="dekra_inspection_expiry" type="date" defaultValue={v?.dekra_inspection_expiry ?? ""} className={input} />
          </Field>
          <Field l={t("Año del Marchamo pagado", "Marchamo year paid")}>
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
  lang,
  children,
}: {
  label: string;
  hint?: string;
  required: boolean;
  has: boolean;
  lang: TeamLang;
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
          {!required && (
            <span className="ml-1 text-xs font-semibold text-slate-500">{lang === "en" ? "(optional)" : "(opcional)"}</span>
          )}
        </p>
        {hint && <p className="text-sm text-slate-500">{hint}</p>}
      </div>
      {children}
    </li>
  );
}

function StatusPill({ status, needsReview, lang }: { status: KycStatus; needsReview: boolean; lang: TeamLang }) {
  const cls =
    status === "approved"
      ? "bg-emerald-100 text-emerald-900"
      : status === "pending"
        ? "bg-amber-100 text-amber-900"
        : "bg-red-100 text-red-900";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${cls}`}>
      {kycStatusLabel(status, lang)}
      {needsReview && status === "approved" ? (lang === "en" ? " · changes being checked" : " · cambios en revisión") : ""}
    </span>
  );
}

function Locked({ l, v, lang }: { l: string; v: string | number | null | undefined; lang: TeamLang }) {
  return (
    <div className="text-sm font-bold text-slate-700">
      {l}
      <p className="mt-1 min-h-11 flex flex-wrap items-center gap-x-2 font-normal text-slate-900">
        {v ?? "—"}
        <span className="text-xs text-slate-500">
          {lang === "en"
            ? "(change it by uploading the renewed document)"
            : "(para cambiarlo, suba el documento renovado)"}
        </span>
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
