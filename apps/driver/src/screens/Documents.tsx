import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { TOWNS } from "../format";
import { supabase } from "../supabase";
import { C, S } from "../theme";
import { pickAndUpload, type UploadSource, type UploadTarget } from "../upload";
import { Btn, Card } from "../ui";

/** Same lists as the website (src/lib/driverKyc.ts). */
const DRIVER_DOCS = [
  { key: "driver_photo", label: "Your photo", hint: "A clear photo of your face for your profile." },
  { key: "id_front", label: "Cédula or passport: front" },
  { key: "id_back", label: "Cédula: back", hint: "For a passport, upload the photo page again." },
  { key: "license", label: "Driver's licence", hint: "Front and back in one photo or PDF." },
  { key: "criminal_record", label: "Criminal record certificate", hint: "Issued no more than 30 days ago." },
  { key: "ict_permit", label: "ICT tourist-transport permit", hint: "Optional. Drivers who have it get an ICT badge." },
];
const VEHICLE_DOCS = [
  { key: "insurance", label: "INS insurance policy" },
  { key: "dekra", label: "Dekra / RTV inspection" },
  { key: "marchamo", label: "Marchamo (current year)" },
  { key: "vehicle_registration", label: "Registration (tarjeta de circulación)" },
];
/** Dated documents: after the first review the date changes only with a new photo of the document. */
const RENEW: Record<string, { ask: string; placeholder: string }> = {
  license: { ask: "New expiry date", placeholder: "YYYY-MM-DD" },
  insurance: { ask: "Policy valid until", placeholder: "YYYY-MM-DD" },
  dekra: { ask: "Valid until", placeholder: "YYYY-MM-DD" },
  marchamo: { ask: "Year it covers", placeholder: "2027" },
};
const STATUS: Record<string, string> = { pending: "Waiting for review", approved: "Approved", rejected: "Not approved", suspended: "Suspended" };

interface DriverRow {
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
interface VehicleRow {
  id: string;
  plate: string | null;
  make_model: string | null;
  year: number | null;
  color: string | null;
  passenger_capacity: number | null;
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
const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/**
 * Documents and vehicles, in the app: the driver's details, a photo of each
 * document straight from the camera, and their vehicles. Everything is saved
 * through the same server rules as the website.
 */
export function Documents({ userId, onBack, onChanged }: { userId: string; onBack: () => void; onChanged: () => void }) {
  const [driver, setDriver] = useState<DriverRow | null | undefined>(undefined);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [me, setMe] = useState<Fields>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
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
  }, [userId]);

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
    if (!a.ok) return a.error ?? "Couldn't save your details.";
    if (me.english_level) {
      const b = await api("/driver/profile", { bio: me.bio, english_level: me.english_level });
      if (!b.ok) return b.error ?? "Couldn't save your profile.";
    }
    return null;
  }

  if (driver === undefined) {
    return (
      <View style={[S.screen, S.pad]}>
        <Text style={S.muted}>Loading…</Text>
      </View>
    );
  }
  if (driver === null) {
    return (
      <ScrollView style={S.screen} contentContainerStyle={S.pad}>
        <Btn label="← Profile" alt onPress={onBack} />
        <Apply
          me={me}
          set={(k, t) => setMe((m) => ({ ...m, [k]: t }))}
          busy={busy === "apply"}
          onApply={(agree) =>
            void run(
              "apply",
              async () => {
                const res = await api("/driver/apply", { full_name: me.full_name, phone: me.phone, agree: agree ? "on" : "" });
                return res.ok ? null : (res.error ?? "Couldn't send your application.");
              },
              "Application started. Now add your details, documents and a vehicle.",
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
      <Btn label="← Profile" alt onPress={onBack} />
      <Text style={S.h1}>Documents and vehicles</Text>
      <Text style={S.muted}>
        Your application: {STATUS[driver.kyc_status] ?? driver.kyc_status}
        {driver.kyc_note ? ". Note from our team: " + driver.kyc_note : ""}
      </Text>
      {reviewed ? (
        <Text style={S.muted}>
          Replacing a licence, ID, criminal record or vehicle document pauses new jobs until our team checks it. Trips you already have are not
          affected.
        </Text>
      ) : null}
      {driver.review_hold ? <Text style={{ color: C.amber, fontWeight: "700" }}>Your new documents are being checked. New jobs are paused until then.</Text> : null}
      {msg ? <Text style={msg.ok ? { color: C.emerald, fontWeight: "700" } : S.error}>{msg.text}</Text> : null}

      <Card>
        <Text style={S.h2}>About you</Text>
        <Input label="Full name (as on your ID)" value={me.full_name} onChange={set("full_name")} />
        <Input label="WhatsApp number" value={me.phone} onChange={set("phone")} keyboard="phone-pad" />
        <Input label="Cédula or passport number" value={me.cedula_number} onChange={set("cedula_number")} />
        <Input label="Driver's licence number" value={me.license_number} onChange={set("license_number")} />
        {reviewed ? (
          <Locked label="Licence expiry" value={driver.license_expiry} />
        ) : (
          <Input label="Licence expiry (YYYY-MM-DD)" value={me.license_expiry} onChange={set("license_expiry")} placeholder="2028-05-31" />
        )}
        <Input label="Criminal record certificate: date issued (YYYY-MM-DD)" value={me.criminal_record_date} onChange={set("criminal_record_date")} />
        <Input label="ICT permit number (optional)" value={me.ict_permit_number} onChange={set("ict_permit_number")} />
        <Text style={S.label}>Where are you based?</Text>
        <Chips options={Object.entries(TOWNS)} value={me.home_hub} onChange={set("home_hub")} />
        <Text style={S.label}>Your English</Text>
        <Chips
          options={[
            ["fluent", "Fluent"],
            ["basic", "Basic"],
          ]}
          value={me.english_level}
          onChange={set("english_level")}
        />
        <Input label="Short bio for travellers (no phone numbers or links)" value={me.bio} onChange={set("bio")} multiline />
        <Btn label="Save my details" onPress={() => void run("details", saveDetails, "Details saved.")} busy={busy === "details"} />
      </Card>

      <Card>
        <Text style={S.h2}>Your documents</Text>
        {DRIVER_DOCS.map((doc) => (
          <UploadRow
            key={doc.key}
            label={doc.label}
            hint={doc.hint}
            uploaded={Boolean(driver.documents?.[doc.key])}
            renew={reviewed ? RENEW[doc.key] : undefined}
            busy={busy === "doc-" + doc.key}
            onPick={(from, renewed) =>
              void run("doc-" + doc.key, () => pickAndUpload(userId, { type: "driver", key: doc.key }, from, renewed), doc.label + ": uploaded.")
            }
          />
        ))}
      </Card>

      {vehicles.map((v) => (
        <VehicleCard key={v.id} v={v} userId={userId} busy={busy} run={run} />
      ))}
      <VehicleForm
        title="Add a vehicle"
        button="Add vehicle"
        busy={busy === "add-vehicle"}
        onSave={(f) => void run("add-vehicle", async () => {
          const r = await api("/driver/vehicles", f);
          return r.ok ? null : (r.error ?? "Couldn't add the vehicle.");
        }, "Vehicle added. Now add its documents and photos.")}
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
  const reviewed = v.status !== "pending";
  const upload = (id: string, target: UploadTarget, done: string) => (from: UploadSource, renewed?: string) =>
    void run(id, () => pickAndUpload(userId, target, from, renewed), done);
  return (
    <Card>
      <Text style={S.h2}>
        {(v.make_model ?? "Vehicle") + " " + (v.plate ?? "")} · {STATUS[v.status] ?? v.status}
      </Text>
      {v.note ? <Text style={{ color: C.amber }}>Note from our team: {v.note}</Text> : null}
      {v.review_hold ? <Text style={{ color: C.amber, fontWeight: "700" }}>Its new documents are being checked; it can&apos;t be offered until then.</Text> : null}
      <VehicleForm
        v={v}
        lockDates={reviewed}
        button="Save vehicle"
        busy={busy === "veh-" + v.id}
        onSave={(f) => void run("veh-" + v.id, async () => {
          const r = await api("/driver/vehicles/save", { vehicle_id: v.id, ...f });
          return r.ok ? null : (r.error ?? "Couldn't save the vehicle.");
        }, "Vehicle saved.")}
      />
      {VEHICLE_DOCS.map((doc) => (
        <UploadRow
          key={doc.key}
          label={doc.label}
          uploaded={Boolean(v.documents?.[doc.key])}
          renew={reviewed ? RENEW[doc.key] : undefined}
          busy={busy === "vd-" + v.id + doc.key}
          onPick={upload("vd-" + v.id + doc.key, { type: "vehicle", vehicleId: v.id, key: doc.key }, doc.label + ": uploaded.")}
        />
      ))}
      <UploadRow
        label={"Vehicle photos (" + (v.photos?.length ?? 0) + " added, at least 2)"}
        hint="Outside and inside, in daylight."
        uploaded={false}
        addLabel="Add photo"
        photosOnly
        busy={busy === "vp-" + v.id}
        onPick={upload("vp-" + v.id, { type: "photo", vehicleId: v.id }, "Photo added.")}
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
  const set = (k: string) => (t: string) => setF((m) => ({ ...m, [k]: t }));
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
      <Input label="Plate number" value={f.plate} onChange={set("plate")} caps />
      <Input label="Make and model" value={f.make_model} onChange={set("make_model")} placeholder="e.g. Toyota Hiace" />
      <Input label="Year" value={f.year} onChange={set("year")} keyboard="number-pad" />
      <Input label="Colour" value={f.color} onChange={set("color")} />
      <Input label="Passenger seats" value={f.passenger_capacity} onChange={set("passenger_capacity")} keyboard="number-pad" />
      <Input label="INS policy number" value={f.ins_policy_number} onChange={set("ins_policy_number")} />
      {lockDates ? (
        <>
          <Locked label="Insurance valid until" value={v?.ins_insurance_expiry} />
          <Locked label="Dekra valid until" value={v?.dekra_inspection_expiry} />
          <Locked label="Marchamo year" value={v?.marchamo_year} />
        </>
      ) : (
        <>
          <Input label="Insurance valid until (YYYY-MM-DD)" value={f.ins_insurance_expiry} onChange={set("ins_insurance_expiry")} />
          <Input label="Dekra valid until (YYYY-MM-DD)" value={f.dekra_inspection_expiry} onChange={set("dekra_inspection_expiry")} />
          <Input label="Marchamo year" value={f.marchamo_year} onChange={set("marchamo_year")} keyboard="number-pad" />
        </>
      )}
      <Btn label={button} onPress={() => onSave(body())} busy={busy} />
    </>
  );
  return title ? <Card>{inner}</Card> : <View style={{ gap: 6 }}>{inner}</View>;
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
  renew?: { ask: string; placeholder: string };
  busy: boolean;
  addLabel?: string;
  /** Vehicle photos: pictures only, no PDF button. */
  photosOnly?: boolean;
  onPick: (from: UploadSource, renewed?: string) => void;
}) {
  const [renewed, setRenewed] = useState("");
  const [need, setNeed] = useState(false);
  const go = (from: UploadSource) => {
    if (renew && !renewed.trim()) return setNeed(true);
    setNeed(false);
    onPick(from, renew ? renewed.trim() : undefined);
  };
  return (
    <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, marginTop: 4 }}>
      <Text style={[S.text, { fontWeight: "700" }]}>
        {uploaded ? "✓ " : ""}
        {label}
      </Text>
      {hint ? <Text style={S.muted}>{hint}</Text> : null}
      {renew ? (
        <TextInput
          accessibilityLabel={renew.ask}
          value={renewed}
          onChangeText={setRenewed}
          placeholder={renew.ask + " (" + renew.placeholder + ")"}
          style={S.input}
        />
      ) : null}
      {need && renew ? <Text style={S.error}>Enter the {renew.ask.toLowerCase()} first.</Text> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Btn label={addLabel ?? (uploaded ? "Retake photo" : "Take photo")} onPress={() => go("camera")} busy={busy} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label="Choose photo" alt onPress={() => go("library")} disabled={busy} />
        </View>
      </View>
      {!photosOnly ? <Btn label="Choose a PDF or file" alt onPress={() => go("file")} disabled={busy} /> : null}
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
  return (
    <Card>
      <Text style={S.h2}>Drive with Costa Rica Private Transfers</Text>
      <Text style={S.muted}>
        Partner drivers and transport companies receive private transfer and tour requests and choose which trips to take. Start with your
        name and WhatsApp; next you&apos;ll add your documents and vehicles, and our team will contact you for a short interview.
      </Text>
      <Input label="Full name (as on your ID)" value={me.full_name ?? ""} onChange={(t) => set("full_name", t)} />
      <Input label="WhatsApp number" value={me.phone ?? ""} onChange={(t) => set("phone", t)} keyboard="phone-pad" placeholder="+506 8888 8888" />
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
          {agree ? <Text style={{ color: "#fff", fontWeight: "800" }}>✓</Text> : null}
        </View>
        <Text style={[S.text, { flex: 1 }]}>
          I work as an independent driver or transport company. I hold, and will keep current, the licences, permits and insurance the law
          requires for the trips I accept, and the information I give is true.
        </Text>
      </Pressable>
      <Btn label="Start my application" onPress={() => onApply(agree)} busy={busy} disabled={!agree || !(me.full_name ?? "").trim() || !(me.phone ?? "").trim()} />
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
    <View style={{ gap: 2 }}>
      <Text style={S.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboard}
        multiline={multiline}
        autoCapitalize={caps ? "characters" : "sentences"}
        style={[S.input, multiline ? { minHeight: 90, textAlignVertical: "top" } : null]}
      />
    </View>
  );
}

function Locked({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={S.label}>{label}</Text>
      <Text style={S.text}>{value ?? "—"}</Text>
      <Text style={S.muted}>To change it, upload the renewed document below with its new date.</Text>
    </View>
  );
}

function Chips({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map(([id, label]) => (
        <Pressable
          key={id}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === id }}
          onPress={() => onChange(id)}
          style={{
            borderWidth: 2,
            borderColor: value === id ? C.emerald : C.border,
            backgroundColor: value === id ? C.emeraldSoft : "#fff",
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          <Text style={{ fontWeight: "700", color: C.text }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
