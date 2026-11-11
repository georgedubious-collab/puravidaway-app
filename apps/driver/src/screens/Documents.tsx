import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { townList } from "../format";
import { useT } from "../i18n";
import { supabase } from "../supabase";
import { C, S } from "../theme";
import { pickAndUpload, type UploadSource, type UploadTarget } from "../upload";
import { categoryHint, categoryLabel, isVehicleCategory } from "../vehicleCategory";
import { Badge, Btn, Card, Chip, IconLine } from "../ui";

/** Each text as [Spanish, English]. */
type Pair = [string, string];
/** Same lists as the website (src/lib/driverKyc.ts). */
const DRIVER_DOCS: { key: string; label: Pair; hint?: Pair }[] = [
  { key: "driver_photo", label: ["Su foto", "Your photo"], hint: ["Una foto clara de su cara para su perfil.", "A clear photo of your face for your profile."] },
  { key: "id_front", label: ["Cédula o pasaporte: frente", "Cédula or passport: front"] },
  { key: "id_back", label: ["Cédula: reverso", "Cédula: back"], hint: ["Si es pasaporte, suba otra vez la página de la foto.", "For a passport, upload the photo page again."] },
  { key: "license", label: ["Licencia de conducir", "Driver's licence"], hint: ["Frente y reverso en una sola foto o PDF.", "Front and back in one photo or PDF."] },
  { key: "criminal_record", label: ["Hoja de delincuencia", "Criminal record certificate"], hint: ["Emitida hace no más de 30 días.", "Issued no more than 30 days ago."] },
  {
    key: "ict_permit",
    label: ["Permiso ICT de transporte turístico", "ICT tourist-transport permit"],
    hint: ["Opcional. Los conductores que lo tienen reciben una insignia ICT.", "Optional. Drivers who have it get an ICT badge."],
  },
];
const VEHICLE_DOCS: { key: string; label: Pair }[] = [
  { key: "insurance", label: ["Póliza de seguro del INS", "INS insurance policy"] },
  { key: "dekra", label: ["Inspección Dekra / RTV", "Dekra / RTV inspection"] },
  { key: "marchamo", label: ["Marchamo (año en curso)", "Marchamo (current year)"] },
  { key: "vehicle_registration", label: ["Tarjeta de circulación", "Registration (tarjeta de circulación)"] },
];
/** Dated documents: after the first review the date changes only with a new photo of the document. */
const RENEW: Record<string, { ask: Pair; placeholder: Pair }> = {
  license: { ask: ["Nueva fecha de vencimiento", "New expiry date"], placeholder: ["AAAA-MM-DD", "YYYY-MM-DD"] },
  insurance: { ask: ["Póliza vigente hasta", "Policy valid until"], placeholder: ["AAAA-MM-DD", "YYYY-MM-DD"] },
  dekra: { ask: ["Vigente hasta", "Valid until"], placeholder: ["AAAA-MM-DD", "YYYY-MM-DD"] },
  marchamo: { ask: ["Año que cubre", "Year it covers"], placeholder: ["2027", "2027"] },
};
const STATUS: Record<string, Pair> = {
  pending: ["En revisión", "Waiting for review"],
  approved: ["Aprobado", "Approved"],
  rejected: ["No aprobado", "Not approved"],
  suspended: ["Suspendido", "Suspended"],
};

export interface DriverRow {
  review_hold?: boolean;
  kyc_status: string;
  kyc_note: string | null;
  cedula_number: string | null;
  license_number: string | null;
  license_expiry: string | null;
  criminal_record_date: string | null;
  ict_permit_number: string | null;
  home_hub: string | null;
  bio: string | null;
  english_level: string | null;
  documents: Record<string, string> | null;
}
export interface VehicleRow {
  id: string;
  plate: string | null;
  make_model: string | null;
  year: number | null;
  color: string | null;
  passenger_capacity: number | null;
  /** Category our team gave the vehicle; null or missing = not tagged yet. Read-only for the driver. */
  vehicle_class?: string | null;
  ins_policy_number: string | null;
  ins_insurance_expiry: string | null;
  dekra_inspection_expiry: string | null;
  marchamo_year: number | null;
  documents: Record<string, string> | null;
  photos: string[] | null;
  status: string;
  note: string | null;
  review_hold?: boolean;
}
type Fields = Record<string, string>;
/** Form labels read as sentences; the small capitals are kept for section labels. */
const FIELD_LABEL = { fontSize: 13, fontWeight: "600", color: C.body } as const;
const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/**
 * Documents and vehicles, in the app: the driver's details, a photo of each
 * document straight from the camera, and their vehicles. Everything is saved
 * through the same server rules as the website.
 */
export function Documents({
  userId,
  onChanged,
  demo,
}: {
  userId: string;
  onChanged: () => void;
  /** Sample data for design previews; skips loading. */
  demo?: { driver: DriverRow | null; vehicles: VehicleRow[]; me: Fields };
}) {
  const [driver, setDriver] = useState<DriverRow | null | undefined>(demo ? demo.driver : undefined);
  const [vehicles, setVehicles] = useState<VehicleRow[]>(demo?.vehicles ?? []);
  const [me, setMe] = useState<Fields>(demo?.me ?? {});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const { t, lang } = useT();
  const status = (s: string) => (STATUS[s] ? t(...STATUS[s]) : s);

  const load = useCallback(async () => {
    if (demo) return;
    const [d, v, p] = await Promise.all([
      supabase.from("drivers").select("*").eq("id", userId).maybeSingle(),
      supabase.from("driver_vehicles").select("*").eq("driver_id", userId).order("created_at"),
      supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle(),
    ]);
    const row = (d.data as DriverRow | null) ?? null;
    setDriver(row);
    setVehicles((v.data as VehicleRow[] | null) ?? []);
    setMe({
      full_name: str(p.data?.full_name as string | null),
      phone: str(p.data?.phone as string | null),
      cedula_number: str(row?.cedula_number),
      license_number: str(row?.license_number),
      license_expiry: str(row?.license_expiry),
      criminal_record_date: str(row?.criminal_record_date),
      ict_permit_number: str(row?.ict_permit_number),
      home_hub: str(row?.home_hub),
      bio: str(row?.bio),
      english_level: str(row?.english_level),
    });
  }, [userId, demo]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(id: string, fn: () => Promise<string | null>, done: string) {
    setBusy(id);
    setMsg(null);
    const err = await fn();
    setBusy("");
    setMsg(err ? { ok: false, text: err } : { ok: true, text: done });
    if (!err) {
      await load();
      onChanged();
    }
  }

  async function saveDetails(): Promise<string | null> {
    const reviewed = driver?.kyc_status !== "pending";
    const body: Fields = { ...me };
    delete body.bio;
    delete body.english_level;
    // After the first review the licence date changes only with a new photo of the licence.
    if (reviewed) delete body.license_expiry;
    const a = await api("/driver/details", body);
    if (!a.ok) return a.error ?? t("No se pudieron guardar sus datos.", "Couldn't save your details.");
    if (me.english_level) {
      const b = await api("/driver/profile", { bio: me.bio, english_level: me.english_level });
      if (!b.ok) return b.error ?? t("No se pudo guardar su perfil.", "Couldn't save your profile.");
    }
    return null;
  }

  if (driver === undefined) {
    return (
      <View style={[S.screen, S.pad]}>
        <Text style={S.muted}>{t("Cargando…", "Loading…")}</Text>
      </View>
    );
  }
  if (driver === null) {
    return (
      <ScrollView style={S.screen} contentContainerStyle={S.pad}>
        <Apply
          me={me}
          set={(k, t) => setMe((m) => ({ ...m, [k]: t }))}
          busy={busy === "apply"}
          onApply={(agree) =>
            void run(
              "apply",
              async () => {
                const res = await api("/driver/apply", { full_name: me.full_name, phone: me.phone, agree: agree ? "on" : "" });
                return res.ok ? null : (res.error ?? t("No se pudo enviar su solicitud.", "Couldn't send your application."));
              },
              t("Solicitud iniciada. Ahora agregue sus datos, documentos y un vehículo.", "Application started. Now add your details, documents and a vehicle."),
            )
          }
        />
        {msg ? <Text style={msg.ok ? { color: C.emerald, fontWeight: "700" } : S.error}>{msg.text}</Text> : null}
      </ScrollView>
    );
  }
  const reviewed = driver.kyc_status !== "pending";
  const set = (k: string) => (t: string) => setMe((m) => ({ ...m, [k]: t }));

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad} keyboardShouldPersistTaps="handled">
      <Badge
        text={t("Solicitud: ", "Application: ") + status(driver.kyc_status)}
        tone={driver.kyc_status === "approved" ? undefined : driver.kyc_status === "pending" ? "amber" : "red"}
        icon={driver.kyc_status === "approved" ? "shield-checkmark" : "time-outline"}
      />
      {driver.kyc_note ? (
        <Card tone="amber">
          <IconLine icon="chatbox-ellipses-outline" color={C.amber} text={t("Nota de nuestro equipo: ", "Note from our team: ") + driver.kyc_note} />
        </Card>
      ) : null}
      {driver.review_hold ? (
        <Card tone="amber">
          <IconLine
            icon="time-outline"
            color={C.amber}
            text={t(
              "Estamos revisando sus documentos nuevos. Los trabajos nuevos quedan en pausa hasta entonces.",
              "Your new documents are being checked. New jobs are paused until then.",
            )}
          />
        </Card>
      ) : reviewed ? (
        <IconLine
          icon="information-circle-outline"
          text={t(
            "Reemplazar la licencia, la identificación, la hoja de delincuencia o un documento del vehículo pausa los trabajos nuevos hasta que nuestro equipo lo revise. Los viajes que ya tiene no se ven afectados.",
            "Replacing a licence, ID, criminal record or vehicle document pauses new jobs until our team checks it. Trips you already have are not affected.",
          )}
        />
      ) : null}
      {msg ? <Text style={msg.ok ? { color: C.emerald, fontWeight: "700" } : S.error}>{msg.text}</Text> : null}

      <Card>
        <Text style={S.h2}>{t("Sus datos", "About you")}</Text>
        <Input label={t("Nombre completo (como en su identificación)", "Full name (as on your ID)")} value={me.full_name} onChange={set("full_name")} />
        <Input label={t("Número de WhatsApp", "WhatsApp number")} value={me.phone} onChange={set("phone")} keyboard="phone-pad" />
        <Input label={t("Número de cédula o pasaporte", "Cédula or passport number")} value={me.cedula_number} onChange={set("cedula_number")} />
        <Input label={t("Número de licencia de conducir", "Driver's licence number")} value={me.license_number} onChange={set("license_number")} />
        {reviewed ? (
          <Locked label={t("Vencimiento de la licencia", "Licence expiry")} value={driver.license_expiry} />
        ) : (
          <Input
            label={t("Vencimiento de la licencia (AAAA-MM-DD)", "Licence expiry (YYYY-MM-DD)")}
            value={me.license_expiry}
            onChange={set("license_expiry")}
            placeholder="2028-05-31"
          />
        )}
        <Input
          label={t("Hoja de delincuencia: fecha de emisión (AAAA-MM-DD)", "Criminal record certificate: date issued (YYYY-MM-DD)")}
          value={me.criminal_record_date}
          onChange={set("criminal_record_date")}
        />
        <Input label={t("Número de permiso ICT (opcional)", "ICT permit number (optional)")} value={me.ict_permit_number} onChange={set("ict_permit_number")} />
        <Text style={[FIELD_LABEL, { marginTop: 4 }]}>{t("¿Dónde está su base?", "Where are you based?")}</Text>
        <Chips options={townList(lang)} value={me.home_hub} onChange={set("home_hub")} />
        <Text style={[FIELD_LABEL, { marginTop: 4 }]}>{t("Su inglés", "Your English")}</Text>
        <Chips
          options={[
            ["fluent", t("Fluido", "Fluent")],
            ["basic", t("Básico", "Basic")],
          ]}
          value={me.english_level}
          onChange={set("english_level")}
        />
        <Input
          label={t("Biografía corta para los clientes (sin números de teléfono ni enlaces)", "Short bio for travellers (no phone numbers or links)")}
          value={me.bio}
          onChange={set("bio")}
          multiline
        />
        <Btn label={t("Guardar mis datos", "Save my details")} onPress={() => void run("details", saveDetails, t("Datos guardados.", "Details saved."))} busy={busy === "details"} />
      </Card>

      <Card>
        <Text style={S.h2}>{t("Sus documentos", "Your documents")}</Text>
        {DRIVER_DOCS.map((doc) => (
          <UploadRow
            key={doc.key}
            label={t(...doc.label)}
            hint={doc.hint ? t(...doc.hint) : undefined}
            uploaded={Boolean(driver.documents?.[doc.key])}
            renew={reviewed ? RENEW[doc.key] : undefined}
            busy={busy === "doc-" + doc.key}
            onPick={(from, renewed) =>
              void run("doc-" + doc.key, () => pickAndUpload(userId, { type: "driver", key: doc.key }, from, renewed), t(...doc.label) + t(": subido.", ": uploaded."))
            }
          />
        ))}
      </Card>

      {vehicles.map((v) => (
        <VehicleCard key={v.id} v={v} userId={userId} busy={busy} run={run} />
      ))}
      <VehicleForm
        title={t("Agregar un vehículo", "Add a vehicle")}
        button={t("Agregar vehículo", "Add vehicle")}
        busy={busy === "add-vehicle"}
        onSave={(f) =>
          void run(
            "add-vehicle",
            async () => {
              const r = await api("/driver/vehicles", f);
              return r.ok ? null : (r.error ?? t("No se pudo agregar el vehículo.", "Couldn't add the vehicle."));
            },
            t("Vehículo agregado. Ahora agregue sus documentos y fotos.", "Vehicle added. Now add its documents and photos."),
          )
        }
      />
    </ScrollView>
  );
}

function VehicleCard({
  v,
  userId,
  busy,
  run,
}: {
  v: VehicleRow;
  userId: string;
  busy: string;
  run: (id: string, fn: () => Promise<string | null>, done: string) => Promise<void>;
}) {
  const { t, lang } = useT();
  const reviewed = v.status !== "pending";
  const tagged = isVehicleCategory(v.vehicle_class);
  const upload = (id: string, target: UploadTarget, done: string) => (from: UploadSource, renewed?: string) =>
    void run(id, () => pickAndUpload(userId, target, from, renewed), done);
  const photos = v.photos?.length ?? 0;
  return (
    <Card>
      <View style={S.row}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <Ionicons name="car-outline" size={20} color={C.emerald} />
          <Text style={[S.h2, { flex: 1 }]} numberOfLines={1}>
            {(v.make_model ?? t("Vehículo", "Vehicle")) + " " + (v.plate ?? "")}
          </Text>
        </View>
        <Badge text={STATUS[v.status] ? t(...STATUS[v.status]) : v.status} tone={v.status === "approved" ? undefined : v.status === "pending" ? "amber" : "red"} />
      </View>
      {v.note ? <IconLine icon="chatbox-ellipses-outline" color={C.amber} text={t("Nota de nuestro equipo: ", "Note from our team: ") + v.note} /> : null}
      {/* Read-only: our team sets the category, and it decides which jobs this vehicle receives. */}
      <View style={{ backgroundColor: C.bg, borderRadius: 12, padding: 12, gap: 2 }}>
        <Text style={{ color: C.text, fontWeight: "800" }}>
          {t("Categoría del vehículo: ", "Vehicle category: ") + (tagged ? categoryLabel(v.vehicle_class, lang) : t("todavía sin asignar", "not set yet"))}
        </Text>
        <Text style={S.muted}>
          {categoryHint(v.vehicle_class, lang) + (tagged ? t(" La categoría la asigna nuestro equipo.", " Our team sets the category.") : "")}
        </Text>
      </View>
      {v.review_hold ? (
        <IconLine
          icon="time-outline"
          color={C.amber}
          text={t(
            "Estamos revisando los documentos nuevos de este vehículo; no se puede usar en ofertas hasta entonces.",
            "Its new documents are being checked; it can't be offered until then.",
          )}
        />
      ) : null}
      <VehicleForm
        v={v}
        lockDates={reviewed}
        button={t("Guardar vehículo", "Save vehicle")}
        busy={busy === "veh-" + v.id}
        onSave={(f) =>
          void run(
            "veh-" + v.id,
            async () => {
              const r = await api("/driver/vehicles/save", { vehicle_id: v.id, ...f });
              return r.ok ? null : (r.error ?? t("No se pudo guardar el vehículo.", "Couldn't save the vehicle."));
            },
            t("Vehículo guardado.", "Vehicle saved."),
          )
        }
      />
      {VEHICLE_DOCS.map((doc) => (
        <UploadRow
          key={doc.key}
          label={t(...doc.label)}
          uploaded={Boolean(v.documents?.[doc.key])}
          renew={reviewed ? RENEW[doc.key] : undefined}
          busy={busy === "vd-" + v.id + doc.key}
          onPick={upload("vd-" + v.id + doc.key, { type: "vehicle", vehicleId: v.id, key: doc.key }, t(...doc.label) + t(": subido.", ": uploaded."))}
        />
      ))}
      <UploadRow
        label={t(
          "Fotos del vehículo (" + photos + (photos === 1 ? " agregada" : " agregadas") + ", mínimo 2)",
          "Vehicle photos (" + photos + " added, at least 2)",
        )}
        hint={t("Por fuera y por dentro, con luz de día.", "Outside and inside, in daylight.")}
        uploaded={false}
        addLabel={t("Agregar foto", "Add photo")}
        photosOnly
        busy={busy === "vp-" + v.id}
        onPick={upload("vp-" + v.id, { type: "photo", vehicleId: v.id }, t("Foto agregada.", "Photo added."))}
      />
    </Card>
  );
}

function VehicleForm({
  v,
  title,
  button,
  busy,
  lockDates,
  onSave,
}: {
  v?: VehicleRow;
  title?: string;
  button: string;
  busy: boolean;
  lockDates?: boolean;
  onSave: (f: Fields) => void;
}) {
  const [f, setF] = useState<Fields>({
    plate: str(v?.plate),
    make_model: str(v?.make_model),
    year: str(v?.year),
    color: str(v?.color),
    passenger_capacity: str(v?.passenger_capacity),
    ins_policy_number: str(v?.ins_policy_number),
    ins_insurance_expiry: str(v?.ins_insurance_expiry),
    dekra_inspection_expiry: str(v?.dekra_inspection_expiry),
    marchamo_year: str(v?.marchamo_year),
  });
  const { t } = useT();
  const set = (k: string) => (x: string) => setF((m) => ({ ...m, [k]: x }));
  const body = () => {
    const out = { ...f };
    if (lockDates) {
      delete out.ins_insurance_expiry;
      delete out.dekra_inspection_expiry;
      delete out.marchamo_year;
    }
    return out;
  };
  const inner = (
    <>
      {title ? <Text style={S.h2}>{title}</Text> : null}
      <Input label={t("Número de placa", "Plate number")} value={f.plate} onChange={set("plate")} caps />
      <Input label={t("Marca y modelo", "Make and model")} value={f.make_model} onChange={set("make_model")} placeholder={t("p. ej. Toyota Hiace", "e.g. Toyota Hiace")} />
      <Input label={t("Año", "Year")} value={f.year} onChange={set("year")} keyboard="number-pad" />
      <Input label={t("Color", "Colour")} value={f.color} onChange={set("color")} />
      <Input label={t("Asientos para pasajeros", "Passenger seats")} value={f.passenger_capacity} onChange={set("passenger_capacity")} keyboard="number-pad" />
      <Input label={t("Número de póliza del INS", "INS policy number")} value={f.ins_policy_number} onChange={set("ins_policy_number")} />
      {lockDates ? (
        <>
          <Locked label={t("Seguro vigente hasta", "Insurance valid until")} value={v?.ins_insurance_expiry} />
          <Locked label={t("Dekra vigente hasta", "Dekra valid until")} value={v?.dekra_inspection_expiry} />
          <Locked label={t("Año del marchamo", "Marchamo year")} value={v?.marchamo_year} />
        </>
      ) : (
        <>
          <Input label={t("Seguro vigente hasta (AAAA-MM-DD)", "Insurance valid until (YYYY-MM-DD)")} value={f.ins_insurance_expiry} onChange={set("ins_insurance_expiry")} />
          <Input label={t("Dekra vigente hasta (AAAA-MM-DD)", "Dekra valid until (YYYY-MM-DD)")} value={f.dekra_inspection_expiry} onChange={set("dekra_inspection_expiry")} />
          <Input label={t("Año del marchamo", "Marchamo year")} value={f.marchamo_year} onChange={set("marchamo_year")} keyboard="number-pad" />
        </>
      )}
      <Btn label={button} onPress={() => onSave(body())} busy={busy} />
    </>
  );
  return title ? <Card>{inner}</Card> : <View style={{ gap: 10 }}>{inner}</View>;
}

/** One document: its state, and buttons to photograph it or pick an existing photo. */
function UploadRow({
  label,
  hint,
  uploaded,
  renew,
  busy,
  addLabel,
  photosOnly,
  onPick,
}: {
  label: string;
  hint?: string;
  uploaded: boolean;
  renew?: { ask: Pair; placeholder: Pair };
  busy: boolean;
  addLabel?: string;
  /** Vehicle photos: pictures only, no PDF button. */
  photosOnly?: boolean;
  onPick: (from: UploadSource, renewed?: string) => void;
}) {
  const { t } = useT();
  const [renewed, setRenewed] = useState("");
  const [need, setNeed] = useState(false);
  const go = (from: UploadSource) => {
    if (renew && !renewed.trim()) return setNeed(true);
    setNeed(false);
    onPick(from, renew ? renewed.trim() : undefined);
  };
  return (
    <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, marginTop: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name={uploaded ? "checkmark-circle" : "ellipse-outline"} size={20} color={uploaded ? C.emerald : C.faint} />
        <Text style={{ fontSize: 15, fontWeight: "700", color: C.text, flex: 1 }}>{label}</Text>
      </View>
      {hint ? <Text style={S.muted}>{hint}</Text> : null}
      {renew ? (
        <TextInput
          accessibilityLabel={t(...renew.ask)}
          value={renewed}
          onChangeText={setRenewed}
          placeholder={t(...renew.ask) + " (" + t(...renew.placeholder) + ")"}
          placeholderTextColor={C.faint}
          style={S.input}
        />
      ) : null}
      {need && renew ? (
        <Text style={S.error}>{t("Primero complete: " + renew.ask[0].toLowerCase() + ".", "Enter the " + renew.ask[1].toLowerCase() + " first.")}</Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Btn
            label={addLabel ?? (uploaded ? t("Repetir", "Retake") : t("Tomar foto", "Take photo"))}
            icon="camera-outline"
            alt={uploaded}
            onPress={() => go("camera")}
            busy={busy}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label={t("Galería", "Gallery")} icon="images-outline" alt onPress={() => go("library")} disabled={busy} />
        </View>
        {!photosOnly ? (
          <View style={{ flex: 1 }}>
            <Btn label="PDF" icon="document-attach-outline" alt onPress={() => go("file")} disabled={busy} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** First step for someone new: name, WhatsApp and the partner statement. */
function Apply({
  me,
  set,
  busy,
  onApply,
}: {
  me: Fields;
  set: (k: string, t: string) => void;
  busy: boolean;
  onApply: (agree: boolean) => void;
}) {
  const [agree, setAgree] = useState(false);
  const { t } = useT();
  return (
    <Card>
      <Text style={S.h2}>{t("Maneje con Costa Rica Private Transfers", "Drive with Costa Rica Private Transfers")}</Text>
      <Text style={S.muted}>
        {t(
          "Los conductores socios y las empresas de transporte reciben solicitudes de traslados privados y tours, y eligen qué viajes tomar. Empiece con su nombre y su WhatsApp; después agregará sus documentos y vehículos, y nuestro equipo lo contactará para una entrevista corta.",
          "Partner drivers and transport companies receive private transfer and tour requests and choose which trips to take. Start with your name and WhatsApp; next you'll add your documents and vehicles, and our team will contact you for a short interview.",
        )}
      </Text>
      <Input label={t("Nombre completo (como en su identificación)", "Full name (as on your ID)")} value={me.full_name ?? ""} onChange={(x) => set("full_name", x)} />
      <Input
        label={t("Número de WhatsApp", "WhatsApp number")}
        value={me.phone ?? ""}
        onChange={(x) => set("phone", x)}
        keyboard="phone-pad"
        placeholder="+506 8888 8888"
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agree }}
        onPress={() => setAgree((a) => !a)}
        style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 6 }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: agree ? C.emerald : C.muted,
            backgroundColor: agree ? C.emerald : "#fff",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {agree ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
        </View>
        <Text style={[S.text, { flex: 1 }]}>
          {t(
            "Trabajo como conductor independiente o empresa de transporte. Tengo, y mantendré al día, las licencias, permisos y seguros que exige la ley para los viajes que acepte, y la información que doy es verdadera.",
            "I work as an independent driver or transport company. I hold, and will keep current, the licences, permits and insurance the law requires for the trips I accept, and the information I give is true.",
          )}
        </Text>
      </Pressable>
      <Btn label={t("Empezar mi solicitud", "Start my application")} onPress={() => onApply(agree)} busy={busy} disabled={!agree || !(me.full_name ?? "").trim() || !(me.phone ?? "").trim()} />
    </Card>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  keyboard,
  multiline,
  caps,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  keyboard?: "phone-pad" | "number-pad";
  multiline?: boolean;
  caps?: boolean;
}) {
  return (
    <View style={{ gap: 5, marginTop: 4 }}>
      <Text style={FIELD_LABEL}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        keyboardType={keyboard}
        multiline={multiline}
        autoCapitalize={caps ? "characters" : "sentences"}
        style={[S.input, multiline ? { minHeight: 90, textAlignVertical: "top" } : null]}
      />
    </View>
  );
}

function Locked({ label, value }: { label: string; value: string | number | null | undefined }) {
  const { t } = useT();
  return (
    <View style={{ gap: 2, marginTop: 4 }}>
      <Text style={FIELD_LABEL}>{label}</Text>
      <Text style={[S.text, { color: C.text, fontWeight: "700" }]}>{value ?? "—"}</Text>
      <Text style={S.muted}>{t("Para cambiarlo, suba abajo el documento renovado con su fecha nueva.", "To change it, upload the renewed document below with its new date.")}</Text>
    </View>
  );
}

function Chips({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map(([id, label]) => (
        <Chip key={id} label={label} on={value === id} onPress={() => onChange(id)} />
      ))}
    </View>
  );
}
