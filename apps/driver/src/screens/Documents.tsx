import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, TextInput, View, type LayoutChangeEvent, type ScrollViewInstance } from "react-native";
import { api } from "../api";
import { townList } from "../format";
import { useT } from "../i18n";
import { supabase } from "../supabase";
import { C, S } from "../theme";
import {
  MAX_VEHICLE_PHOTOS,
  MIN_VEHICLE_PHOTOS,
  capMessage,
  pickAndUpload,
  pickAndUploadPhotos,
  type PhotosResult,
  type UploadSource,
  type UploadTarget,
} from "../upload";
import { categoryHint, categoryLabel, isVehicleCategory } from "../vehicleCategory";
import { Badge, Btn, Card, Chip, IconLine, LinkBtn } from "../ui";

/** Each text as [Spanish, English]. */
type Pair = [string, string];
/** Same lists as the website (src/lib/driverKyc.ts). */
const DRIVER_DOCS: { key: string; label: Pair; hint?: Pair }[] = [
  {
    key: "driver_photo",
    label: ["Su foto", "Your photo"],
    hint: [
      "Una foto clara y amable de su cara, sin lentes de sol. Los clientes la ven cuando usted queda confirmado para su viaje.",
      "A clear, friendly photo of your face, no sunglasses. Travellers see it once you're confirmed for their trip.",
    ],
  },
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
  /** Marked electric by our team. Read-only for the driver. */
  is_electric?: boolean | null;
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
/** Design previews only: show one vehicle's photo options sheet, or its upload progress line. */
export interface DocumentsDemo {
  vehicleId?: string;
  openPhoto?: { index: number; confirm?: boolean };
  progress?: string;
}
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
  demo?: { driver: DriverRow | null; vehicles: VehicleRow[]; me: Fields } & DocumentsDemo;
}) {
  const [driver, setDriver] = useState<DriverRow | null | undefined>(demo ? demo.driver : undefined);
  const [vehicles, setVehicles] = useState<VehicleRow[]>(demo?.vehicles ?? []);
  const [me, setMe] = useState<Fields>(demo?.me ?? {});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  // The add-vehicle form is remounted (emptied) after a vehicle is added.
  const [formKey, setFormKey] = useState(0);
  // A newly added vehicle is scrolled into view so the driver sees it with its "Waiting for review" badge.
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
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

  // Messages show in a bar pinned to the bottom of the screen, so they are seen whatever
  // part of the page the driver is on. Success messages hide after 6 seconds; errors stay.
  useEffect(() => {
    if (!msg?.ok) return;
    const id = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(id);
  }, [msg]);

  /** `done` may be worked out after `fn` (how many photos were added); empty = no message. */
  async function run(id: string, fn: () => Promise<string | null>, done: string | (() => string)) {
    setBusy(id);
    setMsg(null);
    const err = await fn();
    setBusy("");
    const ok = typeof done === "function" ? done() : done;
    setMsg(err ? { ok: false, text: err } : ok ? { ok: true, text: ok } : null);
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
    <View style={{ flex: 1 }}>
    <ScrollView ref={scroll} style={S.screen} contentContainerStyle={[S.pad, { paddingBottom: 120 }]} keyboardShouldPersistTaps="handled">
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
        <View
          key={v.id}
          onLayout={(e: LayoutChangeEvent) => {
            if (justAdded === v.id) {
              scroll.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - 12), animated: true });
              setJustAdded(null);
            }
          }}
        >
          <VehicleCard v={v} userId={userId} busy={busy} run={run} demo={demo} />
        </View>
      ))}
      <VehicleForm
        key={"new-" + formKey}
        title={t("Agregar un vehículo", "Add a vehicle")}
        button={t("Agregar vehículo", "Add vehicle")}
        busy={busy === "add-vehicle"}
        onSave={(f) =>
          void run(
            "add-vehicle",
            async () => {
              const before = new Set(vehicles.map((x) => x.id));
              const r = await api("/driver/vehicles", f);
              if (!r.ok) return r.error ?? t("No se pudo agregar el vehículo.", "Couldn't add the vehicle.");
              setFormKey((k) => k + 1);
              // After the list reloads, scroll to the vehicle that wasn't there before.
              const { data } = await supabase.from("driver_vehicles").select("id").eq("driver_id", userId);
              const added = (data ?? []).map((x) => x.id as string).find((id) => !before.has(id));
              if (added) setJustAdded(added);
              return null;
            },
            t(
              "Vehículo enviado. Está en revisión: agregue sus documentos y fotos abajo de su tarjeta.",
              "Vehicle sent. It's waiting for review: add its documents and photos on its card.",
            ),
          )
        }
      />
    </ScrollView>
    {msg ? (
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole={msg.ok ? "text" : "alert"}
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 20,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 14,
          borderRadius: 14,
          backgroundColor: msg.ok ? C.emerald : C.red,
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Ionicons name={msg.ok ? "checkmark-circle" : "alert-circle"} size={22} color="#FFFFFF" />
        <Text style={{ flex: 1, color: "#FFFFFF", fontWeight: "700", fontSize: 15, lineHeight: 20 }}>{msg.text}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Cerrar", "Close")} hitSlop={12} onPress={() => setMsg(null)}>
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    ) : null}
    </View>
  );
}

function VehicleCard({
  v,
  userId,
  busy,
  run,
  demo,
}: {
  v: VehicleRow;
  userId: string;
  busy: string;
  run: (id: string, fn: () => Promise<string | null>, done: string | (() => string)) => Promise<void>;
  demo?: DocumentsDemo;
}) {
  const { t, lang } = useT();
  const reviewed = v.status !== "pending";
  const tagged = isVehicleCategory(v.vehicle_class);
  const upload = (id: string, target: UploadTarget, done: string) => (from: UploadSource, renewed?: string) =>
    void run(id, () => pickAndUpload(userId, target, from, renewed), done);
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
      {v.status === "pending" ? (
        <IconLine
          icon="time-outline"
          color={C.amber}
          text={t(
            "En revisión: nuestro equipo revisará este vehículo cuando tenga sus documentos y fotos. No recibe trabajos hasta que esté aprobado.",
            "Waiting for review: our team checks this vehicle once its documents and photos are in. It gets no jobs until it is approved.",
          )}
        />
      ) : null}
      {v.note ? <IconLine icon="chatbox-ellipses-outline" color={C.amber} text={t("Nota de nuestro equipo: ", "Note from our team: ") + v.note} /> : null}
      {/* Read-only: our team sets the category, and it decides which jobs this vehicle receives. */}
      <View style={{ backgroundColor: C.bg, borderRadius: 12, padding: 12, gap: 2 }}>
        <Text style={{ color: C.text, fontWeight: "800" }}>
          {t("Categoría del vehículo: ", "Vehicle category: ") + (tagged ? categoryLabel(v.vehicle_class, lang) : t("todavía sin asignar", "not set yet")) + (v.is_electric ? t(" · Eléctrico", " · Electric") : "")}
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
      <VehiclePhotos v={v} userId={userId} busy={busy} run={run} demo={demo} />
    </Card>
  );
}

/** A photo's address for the thumbnails: a short-lived private link, or the sample picture in design previews. */
function useThumbs(paths: string[], demo?: boolean) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.join("|");
  useEffect(() => {
    if (demo || !paths.length) return;
    let live = true;
    void supabase.storage
      .from("driver-kyc-docs")
      .createSignedUrls(paths, 3600)
      .then(({ data }) => {
        if (!live) return;
        const out: Record<string, string> = {};
        for (const s of data ?? []) if (s.path && s.signedUrl) out[s.path] = s.signedUrl;
        setUrls(out);
      });
    return () => {
      live = false;
    };
    // `key` stands for the list of paths.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, demo]);
  return (p: string) => (demo ? p : urls[p]);
}

/**
 * The vehicle's photos: thumbnails (main photo first), add several from the gallery at once
 * or one with the camera, and tap a thumbnail to make it the main photo or remove it.
 * Travellers see these photos once this driver is confirmed for their trip.
 */
function VehiclePhotos({
  v,
  userId,
  busy,
  run,
  demo,
}: {
  v: VehicleRow;
  userId: string;
  busy: string;
  run: (id: string, fn: () => Promise<string | null>, done: string | (() => string)) => Promise<void>;
  demo?: DocumentsDemo;
}) {
  const { t } = useT();
  const photos = v.photos ?? [];
  const thumb = useThumbs(photos, Boolean(demo));
  const demoHere = demo?.vehicleId === v.id ? demo : undefined;
  const [progress, setProgress] = useState<string | null>(demoHere?.progress ?? null);
  const [open, setOpen] = useState<string | null>(demoHere?.openPhoto ? (photos[demoHere.openPhoto.index] ?? null) : null);
  const full = photos.length >= MAX_VEHICLE_PHOTOS;
  const id = "vp-" + v.id;

  const add = (from: "camera" | "library") => {
    let result: PhotosResult = { added: 0, skipped: 0, error: null };
    void run(
      id,
      async () => {
        result = await pickAndUploadPhotos(userId, v.id, from, photos.length, (n, total) =>
          setProgress(total > 1 ? t("Subiendo " + n + " de " + total + "…", "Uploading " + n + " of " + total + "…") : t("Subiendo…", "Uploading…")),
        );
        setProgress(null);
        if (result.error && result.added > 0)
          return (
            t(
              result.added + (result.added === 1 ? " foto agregada. " : " fotos agregadas. "),
              result.added + (result.added === 1 ? " photo added. " : " photos added. "),
            ) + result.error
          );
        return result.error;
      },
      () =>
        result.added === 0
          ? ""
          : (result.added === 1 ? t("Foto agregada.", "Photo added.") : t(result.added + " fotos agregadas.", result.added + " photos added.")) +
            (result.skipped > 0
              ? t(
                  " " + result.skipped + (result.skipped === 1 ? " no se agregó" : " no se agregaron") + ": el máximo es " + MAX_VEHICLE_PHOTOS + " por vehículo.",
                  " " + result.skipped + (result.skipped === 1 ? " wasn't" : " weren't") + " added: the most is " + MAX_VEHICLE_PHOTOS + " per vehicle.",
                )
              : ""),
    );
  };

  const change = (action: "main" | "remove", path: string) => {
    setOpen(null);
    void run(
      id,
      async () => {
        if (demo) return null;
        const r = await api("/driver/photos", { action, vehicle_id: v.id, path });
        return r.ok
          ? null
          : (r.error ??
              (action === "main"
                ? t("No se pudo cambiar la foto principal. Intente de nuevo.", "Couldn't change the main photo. Please try again.")
                : t("No se pudo eliminar la foto. Intente de nuevo.", "Couldn't remove the photo. Please try again.")));
      },
      action === "main" ? t("Foto principal cambiada.", "Main photo changed.") : t("Foto eliminada.", "Photo removed."),
    );
  };

  const working = busy === id;
  return (
    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, marginTop: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name={photos.length >= MIN_VEHICLE_PHOTOS ? "checkmark-circle" : "ellipse-outline"} size={20} color={photos.length >= MIN_VEHICLE_PHOTOS ? C.emerald : C.faint} />
        <Text style={{ fontSize: 15, fontWeight: "700", color: C.text, flex: 1 }}>
          {t(
            "Fotos del vehículo (" + photos.length + " de " + MAX_VEHICLE_PHOTOS + ", mínimo " + MIN_VEHICLE_PHOTOS + ")",
            "Vehicle photos (" + photos.length + " of " + MAX_VEHICLE_PHOTOS + ", at least " + MIN_VEHICLE_PHOTOS + ")",
          )}
        </Text>
      </View>
      <Text style={S.muted}>
        {t(
          "El exterior del vehículo, el interior y el espacio para equipaje. Los clientes las ven cuando usted queda confirmado. Si prefiere, oculte la placa.",
          "Outside of the vehicle, the inside, and the luggage space. Travellers see these once you're confirmed. Hide the plate if you prefer.",
        )}
      </Text>
      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {photos.map((p, i) => {
            const uri = thumb(p);
            return (
              <Pressable
                key={p}
                accessibilityRole="button"
                accessibilityLabel={
                  t("Foto " + (i + 1) + " de " + photos.length, "Photo " + (i + 1) + " of " + photos.length) +
                  (i === 0 ? t(", principal", ", main") : "") +
                  t(". Toque para ver opciones.", ". Tap for options.")
                }
                disabled={working}
                onPress={() => setOpen(p)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                {uri ? (
                  <Image source={{ uri }} style={{ width: 88, height: 88, borderRadius: 12, backgroundColor: C.bg }} />
                ) : (
                  <View style={{ width: 88, height: 88, borderRadius: 12, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="image-outline" size={24} color={C.faint} />
                  </View>
                )}
                {i === 0 ? (
                  <View style={{ position: "absolute", left: 6, top: 6, backgroundColor: C.emerald, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{t("Principal", "Main")}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {photos.length > 1 ? <Text style={S.muted}>{t("Toque una foto para elegir la principal o eliminarla.", "Tap a photo to make it the main one or remove it.")}</Text> : null}
      {progress ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ActivityIndicator color={C.emerald} />
          <Text style={{ color: C.emerald, fontWeight: "700" }}>{progress}</Text>
        </View>
      ) : null}
      {full ? <IconLine icon="information-circle-outline" text={capMessage()} /> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Btn label={t("Tomar foto", "Take photo")} icon="camera-outline" onPress={() => add("camera")} busy={working} disabled={full} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label={t("Galería", "Gallery")} icon="images-outline" alt onPress={() => add("library")} disabled={working || full} />
        </View>
      </View>
      {!full ? (
        <Text style={S.muted}>
          {t(
            "En la galería puede elegir varias a la vez (le quedan " + (MAX_VEHICLE_PHOTOS - photos.length) + ").",
            "In the gallery you can choose several at once (" + (MAX_VEHICLE_PHOTOS - photos.length) + " left).",
          )}
        </Text>
      ) : null}
      <PhotoSheet
        uri={open ? thumb(open) : undefined}
        visible={open !== null}
        isMain={open !== null && photos[0] === open}
        canRemove={v.status !== "approved" || photos.length > MIN_VEHICLE_PHOTOS}
        startConfirm={Boolean(demoHere?.openPhoto?.confirm)}
        onClose={() => setOpen(null)}
        onMain={() => open && change("main", open)}
        onRemove={() => open && change("remove", open)}
      />
    </View>
  );
}

/**
 * Options for one vehicle photo, as a sheet from the bottom of the screen (the app's own
 * Modal, like the side menu): make it the main photo, or remove it after a confirmation.
 */
function PhotoSheet({
  uri,
  visible,
  isMain,
  canRemove,
  startConfirm,
  onClose,
  onMain,
  onRemove,
}: {
  uri?: string;
  visible: boolean;
  isMain: boolean;
  canRemove: boolean;
  startConfirm?: boolean;
  onClose: () => void;
  onMain: () => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const [confirm, setConfirm] = useState(Boolean(startConfirm));
  useEffect(() => {
    if (!visible) setConfirm(false);
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Cerrar", "Close")} onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(10,20,15,0.45)" }} />
      <View
        accessibilityViewIsModal
        style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 32, gap: 10 }}
      >
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
        {uri ? <Image source={{ uri }} resizeMode="cover" style={{ width: "100%", height: 200, borderRadius: 14, backgroundColor: C.bg }} /> : null}
        {confirm ? (
          <>
            <Text style={S.h2}>{t("¿Eliminar esta foto?", "Remove this photo?")}</Text>
            <Text style={S.muted}>{t("Los clientes ya no la verán. No se puede deshacer.", "Travellers won't see it any more. This can't be undone.")}</Text>
            <Btn label={t("Sí, eliminar", "Yes, remove")} icon="trash-outline" color={C.red} onPress={onRemove} />
            <Btn label={t("No, conservarla", "No, keep it")} alt onPress={() => setConfirm(false)} />
          </>
        ) : (
          <>
            {isMain ? (
              <IconLine icon="star" color={C.emerald} text={t("Esta es la foto principal: los clientes la ven primero.", "This is the main photo: travellers see it first.")} />
            ) : (
              <Btn label={t("Usar como foto principal", "Use as main photo")} icon="star-outline" onPress={onMain} />
            )}
            {canRemove ? (
              <Btn label={t("Eliminar", "Remove")} icon="trash-outline" alt onPress={() => setConfirm(true)} />
            ) : (
              <IconLine
                icon="information-circle-outline"
                color={C.amber}
                text={t(
                  "Un vehículo aprobado necesita al menos " + MIN_VEHICLE_PHOTOS + " fotos. Agregue una nueva antes de eliminar esta.",
                  "An approved vehicle needs at least " + MIN_VEHICLE_PHOTOS + " photos. Add a new one before removing this one.",
                )}
              />
            )}
            <LinkBtn label={t("Cancelar", "Cancel")} onPress={onClose} />
          </>
        )}
      </View>
    </Modal>
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
  onPick,
}: {
  label: string;
  hint?: string;
  uploaded: boolean;
  renew?: { ask: Pair; placeholder: Pair };
  busy: boolean;
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
            label={uploaded ? t("Repetir", "Retake") : t("Tomar foto", "Take photo")}
            icon="camera-outline"
            alt={uploaded}
            onPress={() => go("camera")}
            busy={busy}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label={t("Galería", "Gallery")} icon="images-outline" alt onPress={() => go("library")} disabled={busy} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label="PDF" icon="document-attach-outline" alt onPress={() => go("file")} disabled={busy} />
        </View>
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
