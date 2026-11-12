import { townName } from "@/lib/matching";
import { notFound } from "next/navigation";
import { AdminActionForm, type ConfirmRule } from "@/components/admin/AdminActionForm";
import { Card, Chip, Notice, PageHeader, field, link } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { addDays, todayInCostaRica } from "@/lib/dates";
import {
  DRIVER_DOCS,
  VEHICLE_DOCS,
  canTakeTrips,
  docLabel,
  driverIssues,
  kycStatusLabel,
  missingDriverDetails,
  missingVehicleItems,
  vehicleIssues,
  type DocSpec,
  type DriverRecord,
  type Issue,
  type VehicleRecord,
} from "@/lib/driverKyc";
import { englishLevelLabel } from "@/lib/preferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT, type TeamLang } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { VEHICLE_CATEGORY_IDS, categoryHint, categoryLabel, isVehicleCategory } from "@/lib/vehicleEligibility";
import { reviewDriver, reviewVehicle, setVehicleCategory } from "../actions";
import { usd } from "@/lib/bookings";
import { scorecard, type ScoreOffer, type ScoreReview, type ScoreTrip } from "@/lib/scorecard";

type Row = DriverRecord & {
  is_on_duty: boolean;
  profiles: { full_name: string | null; email: string | null; phone: string | null; role: string } | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DriverDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("admin", `/admin/drivers/${id}`);
  if (!UUID.test(id)) notFound();
  const lang = await getTeamLang();
  const t = makeT(lang);
  const supabase = (await createSupabaseServerClient())!;
  const { data: d, error } = await supabase
    .from("drivers")
    .select("*, profiles!drivers_id_fkey(full_name, email, phone, role)")
    .eq("id", id)
    .maybeSingle<Row>();
  if (error)
    return (
      <Notice tone="red" role="alert">
        {t("No se pudo cargar este conductor", "Couldn't load this driver")}: {error.message}
      </Notice>
    );
  if (!d) notFound();
  const { data: reviews } = await supabase.from("driver_reviews").select("id, stars, comment, created_at").eq("driver_id", d.id).order("created_at", { ascending: false }).limit(50).returns<{ id: string; stars: number; comment: string | null; created_at: string }[]>();
  const { data: vehicleRows } = await supabase
    .from("driver_vehicles")
    .select("*")
    .eq("driver_id", id)
    .order("created_at")
    .returns<VehicleRecord[]>();
  const vehicles = vehicleRows ?? [];

  // Scorecard (CRM part 3, read-only; src/lib/scorecard.ts says how each number is counted).
  const [scTrips, scReviews, scOffers, scDrops] = await Promise.all([
    supabase.from("bookings").select("status, scheduled_at, late_alert_at, driver_payout, driver_settled_at").eq("assigned_driver_id", id).limit(5000).returns<ScoreTrip[]>(),
    supabase.from("driver_reviews").select("stars, comment").eq("driver_id", id).limit(5000).returns<ScoreReview[]>(),
    supabase.from("bids").select("status").eq("driver_id", id).limit(5000).returns<ScoreOffer[]>(),
    supabase
      .from("booking_events")
      .select("id", { count: "exact", head: true })
      .eq("action", "driver_removed")
      .filter("before->>driver_id", "eq", id)
      .filter("after->>reason", "eq", "driver_dropped"),
  ]);
  const sc = scorecard(scTrips.data ?? [], scReviews.data ?? [], scOffers.data ?? [], scDrops.count ?? 0);

  // Short-lived links (10 minutes) to the private documents and photos.
  const paths = [
    ...Object.values(d.documents ?? {}),
    ...vehicles.flatMap((v) => [...Object.values(v.documents ?? {}), ...(v.photos ?? [])]),
  ];
  const links: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("driver-kyc-docs").createSignedUrls(paths, 600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) links[s.path] = s.signedUrl;
  }

  const today = todayInCostaRica();
  const soon = addDays(today, 30);
  const issues = driverIssues(d, today, soon, lang);
  const missing = missingDriverDetails(d, lang);
  const phoneDigits = d.profiles?.phone?.replace(/\D/g, "") ?? "";
  const who = d.profiles?.full_name || t("este conductor", "this driver");
  const driverConfirm: ConfirmRule[] = [
    {
      kind: "equals",
      field: "decision",
      values: ["reject"],
      message: t(
        `${who} quedará rechazado: no recibe trabajos y recibe un aviso con su mensaje (app y correo).`,
        `${who} will be rejected: no jobs, and they get a notice with your message (app and email).`,
      ),
    },
    {
      kind: "equals",
      field: "decision",
      values: ["suspend"],
      message: t(
        `${who} quedará suspendido: deja de recibir trabajos desde ya y ve su mensaje en el portal. Los viajes que ya tiene asignados no se quitan solos: revíselos en Reservas.`,
        `${who} will be suspended: no new jobs from now on, and they see your message in the portal. Trips already assigned to them are not removed: check them in Bookings.`,
      ),
    },
  ];
  const vehicleConfirm = (name: string): ConfirmRule[] => [
    {
      kind: "equals",
      field: "decision",
      values: ["reject", "suspend"],
      message: t(
        `El vehículo ${name} no podrá usarse para trabajos nuevos y el conductor recibe un aviso con su mensaje. Los viajes ya asignados con él no se quitan solos: revíselos en Reservas.`,
        `The vehicle ${name} can't be used for new jobs, and the driver gets a notice with your message. Trips already assigned with it are not removed: check them in Bookings.`,
      ),
    },
  ];
  const categoryConfirm: ConfirmRule[] = [
    {
      kind: "changed",
      fields: ["vehicle_class"],
      message: t(
        "La categoría pasa de «{from}» a «{to}»: cambia desde ya qué trabajos recibe este vehículo.",
        'The category changes from "{from}" to "{to}": it changes which jobs this vehicle receives, from now on.',
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/admin/drivers", label: t("Todos los conductores", "All drivers") }}
        title={d.profiles?.full_name || t("(aún sin nombre)", "(no name yet)")}
        subtitle={
          <>
            <span className="break-all">{d.profiles?.email}</span>
            {d.profiles?.phone && (
              <>
                {" · "}
                <a href={`https://wa.me/${phoneDigits}`} className={link} target="_blank" rel="noreferrer">
                  WhatsApp {d.profiles.phone}
                </a>
              </>
            )}
            {d.submitted_at && <> · {t("se postuló el", "applied")} {d.submitted_at.slice(0, 10)}</>}
            {d.reviewed_at && <> · {t("última revisión", "last reviewed")} {d.reviewed_at.slice(0, 10)}</>}
          </>
        }
      />
      <div className="flex flex-wrap gap-1.5">
        <Chip tone={d.kyc_status === "approved" ? "green" : d.kyc_status === "pending" ? "amber" : "red"}>{kycStatusLabel(d.kyc_status, lang)}</Chip>
        {d.needs_review && <Chip tone="amber">{t("Cambió desde la última revisión", "Changed since last review")}</Chip>}
        {d.review_hold && (
          <Chip tone="red">{t("Pausado para trabajos nuevos hasta que revise los documentos nuevos", "Paused from new jobs until you check the new documents")}</Chip>
        )}
        {d.kyc_status === "approved" && !canTakeTrips(d, vehicles, today) && (
          <Chip tone="red">{t("No puede tomar viajes: documentos vencidos o ningún vehículo aprobado", "Can't take trips: expired documents or no approved vehicle")}</Chip>
        )}
        {d.ict_permit_number && <Chip tone="green">{t("Permiso ICT", "ICT permit")}</Chip>}
      </div>

      <Card title={t("Ficha del conductor", "Driver scorecard")}>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat k={t("Viajes completados", "Trips completed")} v={String(sc.completedAll)} sub={t(`${sc.completed30} en 30 días`, `${sc.completed30} in 30 days`)} />
          <Stat
            k={t("Calificación", "Rating")}
            v={sc.ratingAvg != null ? `★ ${sc.ratingAvg.toFixed(2)}` : "—"}
            sub={`${sc.ratingCount} ${t("calificaciones", "ratings")}${sc.commentShare != null ? ` · ${sc.commentShare}% ${t("con comentario", "with a comment")}` : ""}`}
          />
          <Stat
            k={t("Sin alerta de retraso", "No lateness alert")}
            v={sc.onTimeShare != null ? `${sc.onTimeShare}%` : "—"}
            sub={t(`${sc.alerts} viaje(s) con alerta`, `${sc.alerts} trip(s) with an alert`)}
          />
          <Stat k={t("Se retiró tras aceptar", "Dropped out after accepting")} v={String(sc.dropOuts)} sub={t("registrado desde 12 nov 2026", "recorded from Nov 12, 2026")} />
          <Stat
            k={t("Ofertas aceptadas", "Offers accepted")}
            v={`${sc.offersAccepted} / ${sc.offersSent}`}
            sub={sc.acceptShare != null ? `${sc.acceptShare}%` : t("sin ofertas", "no offers")}
          />
          <Stat k={t("Pagado (liquidado)", "Paid out (settled)")} v={usd(sc.paidOut)} sub={t("pago al conductor de viajes liquidados", "driver payout of settled trips")} />
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-[#5F6F67]">
          {t(
            "Solo lectura. «Alerta de retraso»: el sistema avisó al equipo antes de la recogida porque, con el tráfico, el conductor llegaría más de 20 minutos tarde, o porque no había compartido su ubicación 60 minutos antes. No distingue cuál de las dos ni guarda la hora real de llegada. «Se retiró»: veces que el equipo lo quitó porque el conductor canceló; antes del 12 nov 2026 no se registraba. La calificación aquí es el promedio simple; la que ordena las ofertas cuenta doble un comentario.",
            "Read-only. \"Lateness alert\": before the pickup the system alerted the team because, with traffic, the driver would arrive more than 20 minutes late, or because they hadn't shared their location 60 minutes before. It doesn't tell which, nor store the real arrival time. \"Dropped out\": times the team removed them because the driver cancelled; not recorded before Nov 12, 2026. The rating here is the plain average; the one that ranks offers counts a comment double.",
          )}
        </p>
      </Card>

      {(issues.length > 0 || missing.length > 0) && (
        <Notice tone="red">
          <IssueList issues={issues} />
          {missing.length > 0 && (
            <p>
              {t("Datos pendientes", "Missing details")}: {missing.join(", ")}
            </p>
          )}
        </Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("Datos (tal como los ingresó el conductor)", "Details (as entered by the driver)")}>
          <dl className=" grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Item k={t("Cédula / pasaporte", "Cédula / passport")} v={d.cedula_number} />
            <Item k={t("Licencia", "Licence")} v={d.license_number} />
            <Item k={t("Vencimiento de la licencia", "Licence expiry")} v={d.license_expiry} />
            <Item k={t("Fecha de la hoja de delincuencia", "Criminal record date")} v={d.criminal_record_date} />
            <Item k={t("Permiso ICT", "ICT permit")} v={d.ict_permit_number} />
            <Item k={t("Inglés", "English")} v={d.english_level ? englishLevelLabel(d.english_level, lang) : null} />
            <Item k={t("Vive en", "Based in")} v={d.home_hub ? townName(d.home_hub, lang) : null} />
          </dl>
          <p className="mt-3 text-xs text-[#5F6F67]">
            {t("Compare cada dato con el documento antes de aprobar.", "Check each one against the document before approving.")}
          </p>
          <h3 className="mt-4 text-sm font-extrabold text-[#14231C]">{t("Presentación que ven los clientes", "Bio shown to travellers")}</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-[#33443C]">{d.bio || "—"}</p>
          <h3 className="mt-4 text-sm font-extrabold text-[#14231C]">
            {t("Calificaciones de los clientes", "Travellers' ratings")}
            {d.rating_count
              ? lang === "en"
                ? ` · ★ ${Number(d.rating_avg).toFixed(2)} from ${d.rating_count} weighted ratings`
                : ` · ★ ${Number(d.rating_avg).toFixed(2)} de ${d.rating_count} calificaciones ponderadas`
              : ""}
          </h3>
          {(reviews ?? []).length === 0 ? (
            <p className="mt-1 text-sm text-[#5F6F67]">
              {t(
                "Aún no hay calificaciones. A los clientes se les pide calificar después de cada viaje completado; una calificación con comentario cuenta doble.",
                "No ratings yet. Travellers are asked to rate after each completed trip; a rating with a comment counts double.",
              )}
            </p>
          ) : (
            <ul className="mt-1 space-y-1.5 text-sm">
              {(reviews ?? []).map((r) => (
                <li key={r.id} className="text-[#33443C]">
                  <span className="font-bold text-amber-600">{"★".repeat(r.stars)}</span>
                  <span className="text-[#9AA8A1]">{"★".repeat(5 - r.stars)}</span> <span className="text-xs text-[#5F6F67]">{r.created_at.slice(0, 10)}</span>
                  {r.comment && <span className="block italic">&ldquo;{r.comment}&rdquo;</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("Documentos", "Documents")}>
          <DocLinks specs={DRIVER_DOCS} docs={d.documents} links={links} lang={lang} />
          <p className="mt-3 text-xs text-[#5F6F67]">
            {t(
              "Los enlaces funcionan por 10 minutos; recargue la página para obtener nuevos.",
              "Links work for 10 minutes; reload the page for new ones.",
            )}
          </p>
        </Card>
      </div>

      <Card title={t("Decisión sobre el conductor", "Decision on the driver")}>
        <AdminActionForm action={reviewDriver} lang={lang} className="space-y-4" confirm={driverConfirm}>
          <input type="hidden" name="id" value={d.id} />
          <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <legend className="sr-only">{t("Decisión", "Decision")}</legend>
            <Radio value="approve" label={t("Aprobar (lo convierte en conductor)", "Approve (makes them a driver)")} />
            {d.kyc_status === "approved" && d.needs_review && (
              <Radio value="checked" label={t("Cambios revisados, sigue aprobado", "Changes checked, keep approved")} />
            )}
            <Radio value="reject" label={t("Rechazar", "Reject")} />
            <Radio value="suspend" label={t("Suspender", "Suspend")} />
          </fieldset>
          <label className={field.label}>
            {t(
              "Mensaje para el conductor (se muestra en su portal; obligatorio para rechazar o suspender)",
              "Message to the driver (shown in their portal; required to reject or suspend)",
            )}
            <textarea name="note" rows={2} maxLength={500} defaultValue={d.kyc_note ?? ""} className={field.textarea} />
          </label>
        </AdminActionForm>
        <p className="mt-3 text-xs text-[#5F6F67]">
          {t(
            "Antes de aprobar: entrevístelo (incluido su nivel de inglés) y compare cada documento con los datos de arriba. La hoja de delincuencia debe tener como máximo 30 días de emitida (el sistema lo revisa). Apruebe cada vehículo por separado abajo.",
            "Before approving: interview them (English level included), compare every document with the details above. The criminal record certificate must be issued no more than 30 days ago (the app checks this). Approve each vehicle separately below.",
          )}
        </p>
      </Card>

      <h2 className="pt-2 text-xl font-extrabold text-[#14231C]">
        {t("Vehículos", "Vehicles")} ({vehicles.length})
      </h2>
      {vehicles.length === 0 && <p className="text-sm text-[#5F6F67]">{t("Aún no ha agregado vehículos.", "No vehicles added yet.")}</p>}
      {vehicles.map((v) => {
        const vIssues = vehicleIssues(v, today, soon, lang);
        const todo = missingVehicleItems(v, lang);
        return (
          <section key={v.id} className="space-y-4 rounded-2xl border border-[#E3E8E5] bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-extrabold text-[#14231C]">
                {v.make_model || t("Vehículo", "Vehicle")} {v.year ? `(${v.year})` : ""}
              </h3>
              {v.plate && <span className="rounded bg-[#F1F4F2] px-2 py-0.5 text-sm font-bold">{v.plate}</span>}
              <strong className="text-sm">{kycStatusLabel(v.status, lang)}</strong>
              {v.needs_review && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-sm text-amber-900 font-bold">
                  {t("Cambió desde la última revisión", "Changed since last review")}
                </span>
              )}
              {v.review_hold && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-sm text-red-900 font-bold">
                  {t(
                    "No se puede ofrecer hasta que revise sus documentos nuevos",
                    "Can't be offered until you check its new documents",
                  )}
                </span>
              )}
              {!isVehicleCategory(v.vehicle_class) && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-sm text-amber-900 font-bold">{categoryLabel(null, lang)}</span>
              )}
              {v.is_electric && (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-sm font-bold text-emerald-900">{t("Eléctrico", "Electric")}</span>
              )}
              {v.status === "approved" && !v.passenger_capacity && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-sm text-red-900 font-bold">
                  {t("Sin número de asientos: no recibe trabajos", "No seat number: receives no jobs")}
                </span>
              )}
            </div>
            {/* Which jobs this vehicle receives (migrations 0038 and 0039). Saved on its own, without a new approval decision. */}
            <AdminActionForm
              action={setVehicleCategory}
              lang={lang}
              submitLabel={t("Guardar categoría y eléctrico", "Save category and electric")}
              className="space-y-2 rounded-xl border border-[#E3E8E5] bg-[#FAFBFA] p-3.5"
              confirm={categoryConfirm}
            >
              <input type="hidden" name="vehicle_id" value={v.id} />
              <label className={field.label}>
                {t("Categoría del vehículo", "Vehicle category")}
                <select
                  name="vehicle_class"
                  defaultValue={isVehicleCategory(v.vehicle_class) ? v.vehicle_class : ""}
                  className={`${field.input} sm:max-w-md`}
                >
                  <option value="">{categoryLabel(null, lang)}</option>
                  {VEHICLE_CATEGORY_IDS.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c, lang)}
                    </option>
                  ))}
                </select>
              </label>
              {/* Not a category and no price change (migration 0042): a badge for travellers and a match for their free request. */}
              <label className="flex items-start gap-2 text-sm font-bold text-[#33443C]">
                <input type="checkbox" name="is_electric" defaultChecked={Boolean(v.is_electric)} className="mt-0.5 h-5 w-5 rounded border-slate-300" />
                <span>
                  {t("Vehículo eléctrico", "Electric vehicle")}
                  <span className="block text-xs font-normal text-[#5F6F67]">
                    {t(
                      "No cambia la categoría ni el precio. El viajero ve la insignia «Vehículo eléctrico» y puede pedir uno gratis, si hay disponible.",
                      "Doesn't change the category or the price. The traveller sees an \"Electric vehicle\" badge and can ask for one for free, if available.",
                    )}
                  </span>
                </span>
              </label>
              <p className="text-sm text-[#33443C]">
                <strong>{t("Ahora", "Now")}:</strong> {categoryHint(v.vehicle_class, lang)}
              </p>
              <ul className="text-xs text-[#5F6F67]">
                {VEHICLE_CATEGORY_IDS.map((c) => (
                  <li key={c}>
                    <strong>{categoryLabel(c, lang)}</strong>: {categoryHint(c, lang)}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-[#5F6F67]">
                {t(
                  "Un SUV compacto (RAV4, Aion V) va como Sedán: su cajuela es de sedán. Minivan (MPV) es para 4 viajeros con 4 maletas (Xpander, Avanza, Carnival). Una van no recibe trabajos de 4x4; si la van también es 4x4, use Van 4x4: recibe los trabajos de van y los de 4x4 (incluida la lancha de Sierpe). Además de la categoría, el vehículo solo recibe trabajos para los que tiene asientos suficientes.",
                  "A compact SUV (RAV4, Aion V) goes as Sedan: its boot is sedan-size. Minivan (MPV) is for 4 travellers with 4 suitcases (Xpander, Avanza, Carnival). A van doesn't receive 4x4 jobs; if the van is also a 4x4, use Van 4x4: it receives van jobs and 4x4 jobs (Sierpe boat included). Besides the category, a vehicle only receives jobs it has enough seats for.",
                )}
              </p>
            </AdminActionForm>
            {(vIssues.length > 0 || todo.length > 0) && (
              <Notice tone="red">
                <IssueList issues={vIssues} />
                {todo.length > 0 && (
                  <p>
                    {t("Falta", "Missing")}: {todo.join(", ")}
                  </p>
                )}
              </Notice>
            )}
            {(v.photos ?? []).length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {v.photos.map((p) =>
                  links[p] ? (
                    <li key={p}>
                      <a href={links[p]} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- private signed URL */}
                        <img src={links[p]} alt={t("Foto del vehículo", "Vehicle photo")} className="aspect-square w-full rounded-lg object-cover" />
                      </a>
                    </li>
                  ) : null,
                )}
              </ul>
            )}
            <div className="grid gap-6 lg:grid-cols-2">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Item k={t("Color", "Colour")} v={v.color} />
                <Item k={t("Asientos para pasajeros", "Passenger seats")} v={v.passenger_capacity} />
                <Item k={t("Póliza del INS", "INS policy")} v={v.ins_policy_number} />
                <Item k={t("Seguro hasta", "Insurance until")} v={v.ins_insurance_expiry} />
                <Item k={t("Dekra hasta", "Dekra until")} v={v.dekra_inspection_expiry} />
                <Item k="Marchamo" v={v.marchamo_year} />
                <Item
                  k={t("Ofrece", "Offers")}
                  v={
                    [
                      v.has_wifi && "Wi-Fi",
                      v.stroller_space && t("espacio para coche de bebé", "stroller space"),
                      v.pet_friendly && t("mascotas", "pets"),
                      v.child_seats > 0 && t(`${v.child_seats} asiento(s) para niños`, `${v.child_seats} child seat(s)`),
                    ]
                      .filter(Boolean)
                      .join(", ") || null
                  }
                />
              </dl>
              <DocLinks specs={VEHICLE_DOCS} docs={v.documents} links={links} lang={lang} />
            </div>
            <p className="text-xs text-[#5F6F67]">
              {t(
                "Antes de aprobar: una foto debe mostrar la placa, y debe coincidir con la tarjeta de circulación, el seguro, la Dekra y el Marchamo.",
                "Before approving: one photo must show the plate, and it must match the registration, insurance, Dekra and Marchamo.",
              )}
            </p>
            <AdminActionForm
              action={reviewVehicle}
              lang={lang}
              className="space-y-3 border-t border-[#EDF1EE] pt-4"
              confirm={vehicleConfirm(`${v.make_model ?? ""} ${v.plate ?? ""}`.trim() || "—")}
            >
              <input type="hidden" name="vehicle_id" value={v.id} />
              <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <legend className="sr-only">{t("Decisión sobre este vehículo", "Decision on this vehicle")}</legend>
                <Radio value="approve" label={t("Aprobar vehículo", "Approve vehicle")} />
                {v.status === "approved" && v.needs_review && (
                  <Radio value="checked" label={t("Cambios revisados, sigue aprobado", "Changes checked, keep approved")} />
                )}
                <Radio value="reject" label={t("Rechazar", "Reject")} />
                <Radio value="suspend" label={t("Suspender", "Suspend")} />
              </fieldset>
              <label className={field.label}>
                {t("Mensaje para el conductor sobre este vehículo", "Message to the driver about this vehicle")}
                <textarea name="note" rows={2} maxLength={500} defaultValue={v.note ?? ""} className={field.textarea} />
              </label>
            </AdminActionForm>
          </section>
        );
      })}
    </div>
  );
}

function IssueList({ issues }: { issues: Issue[] }) {
  return (
    <>
      {issues.map((i) => (
        <p key={i.text} className={i.blocking ? "font-bold" : ""}>
          {i.blocking ? "⛔ " : "⚠ "}
          {i.text}
        </p>
      ))}
    </>
  );
}

function DocLinks({
  specs,
  docs,
  links,
  lang,
}: {
  specs: DocSpec[];
  docs: Record<string, string>;
  links: Record<string, string>;
  lang: TeamLang;
}) {
  const t = makeT(lang);
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {specs.map((doc) => {
        const path = docs?.[doc.key];
        const url = path ? links[path] : undefined;
        return (
          <li key={doc.key} className="flex items-center justify-between gap-3">
            <span>
              {docLabel(doc, lang)}
              {!doc.required && <span className="text-[#9AA8A1]"> ({t("opcional", "optional")})</span>}
            </span>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" className={`whitespace-nowrap ${link}`}>
                {t("Abrir", "Open")}
              </a>
            ) : path ? (
              <span className="text-[#B91C1C]">{t("Falta el archivo", "File missing")}</span>
            ) : (
              <span className="text-[#9AA8A1]">{t("No subido", "Not uploaded")}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Item({ k, v }: { k: string; v: string | number | null | undefined }) {
  return (
    <>
      <dt className="text-[#5F6F67]">{k}</dt>
      <dd className="font-semibold text-[#14231C]">{v || v === 0 ? v : "—"}</dd>
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

/** One scorecard number (CRM part 3). */
function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#E3E8E5] bg-[#FAFBFA] p-3">
      <dt className="text-xs font-bold text-[#5F6F67]">{k}</dt>
      <dd className="mt-0.5 text-xl font-extrabold text-[#14231C]">{v}</dd>
      {sub && <dd className="text-xs text-[#5F6F67]">{sub}</dd>}
    </div>
  );
}
