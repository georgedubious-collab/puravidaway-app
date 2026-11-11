import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { crDateTime, plural, townName, usd } from "../format";
import { useT } from "../i18n";
import { supabase } from "../supabase";
import { C, S } from "../theme";
import type { DriverInfo, Job, Names, Trip, Vehicle } from "../types";
import { seatsFit, vehicleCanServe } from "../vehicleCategory";
import { Badge, Btn, Card, Chip, Empty, IconLine, LinkBtn, RouteLine } from "../ui";

const DAY_MS = 86400000;
const CR_OFFSET_MS = 6 * 3600 * 1000;
const crDay = (iso: string) => Math.floor((new Date(iso).getTime() - CR_OFFSET_MS) / DAY_MS);

/**
 * Open jobs with a suggested payout (never the traveller's price). One tap
 * offers at the suggested payout; "Other amount" opens the full form. The team
 * picks a driver.
 */
export function Jobs({
  driver,
  vehicles,
  names,
  trips,
  focusId,
  onCount,
  demo,
}: {
  driver: DriverInfo | null;
  vehicles: Vehicle[];
  names: Names;
  trips: Trip[];
  /** A job to show first, from a tapped notification. */
  focusId?: string;
  /** Sample jobs for design previews; skips loading. */
  demo?: Job[];
  /** Told how many jobs are open after each load (the menu's gold count). */
  onCount?: (n: number) => void;
}) {
  const [jobs, setJobs] = useState<Job[] | null>(demo ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const { t } = useT();

  const load = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    const { data, error: err } = await supabase.rpc("driver_jobs");
    setLoading(false);
    if (err) return setError(true);
    setError(false);
    const list = (data as Job[] | null) ?? [];
    setJobs(list);
    onCount?.(list.length);
  }, [demo, onCount]);

  useEffect(() => {
    void load();
    // New jobs appear without the driver having to pull down.
    const t = setInterval(() => void load(), 30000);
    return () => clearInterval(t);
  }, [load]);

  const approved = driver?.kyc_status === "approved";
  const onHold = Boolean(driver?.review_hold);
  const usable = vehicles.filter((v) => v.status === "approved" && !v.review_hold);
  const sorted = [...(jobs ?? [])].sort((a, b) => Number(b.id === focusId) - Number(a.id === focusId));

  return (
    <FlatList
      style={S.screen}
      contentContainerStyle={S.pad}
      data={sorted}
      keyExtractor={(j) => j.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.emerald} />}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          {jobs?.length ? (
            <Text style={S.muted}>
              {t(
                plural(jobs.length, ["trabajo", "trabajos"], ["job", "jobs"], "es") + " en los que puede ofertar",
                plural(jobs.length, ["trabajo", "trabajos"], ["job", "jobs"], "en") + " you can offer on",
              )}
            </Text>
          ) : null}
          {onHold ? (
            <Card tone="amber">
              <IconLine
                icon="time-outline"
                color={C.amber}
                text={t(
                  "Estamos revisando sus documentos nuevos. Podrá enviar ofertas otra vez cuando nuestro equipo los apruebe; los viajes que ya tiene no se ven afectados.",
                  "Your new documents are being checked. You can send offers again once our team approves them; trips you already have are not affected.",
                )}
              />
            </Card>
          ) : null}
          {!approved && !onHold ? (
            <Card tone="amber">
              <IconLine
                icon="shield-checkmark-outline"
                color={C.amber}
                text={
                  driver
                    ? t(
                        "Podrá enviar ofertas cuando nuestro equipo apruebe su perfil y un vehículo. Agregue sus documentos en Documentos (menú ☰).",
                        "You can send offers once our team approves your profile and a vehicle. Add your documents under Documents (☰ menu).",
                      )
                    : t(
                        "Postúlese como conductor en Documentos (menú ☰). Los trabajos se habilitan cuando nuestro equipo lo apruebe.",
                        "Apply to drive under Documents (☰ menu). Jobs open up once our team approves you.",
                      )
                }
              />
            </Card>
          ) : null}
          {error ? <Text style={S.error}>{t("No se pudieron cargar los trabajos. Deslice hacia abajo para intentar de nuevo.", "Couldn't load the jobs. Pull down to try again.")}</Text> : null}
        </View>
      }
      ListEmptyComponent={
        jobs ? (
          <Empty
            icon="briefcase-outline"
            text={t("No hay trabajos disponibles ahora. Le llegará una notificación apenas se publique uno.", "No open jobs right now. You'll get a notification as soon as one is posted.")}
          />
        ) : undefined
      }
      renderItem={({ item }) => (
        <JobCard
          job={item}
          names={names}
          vehicles={usable.filter(
            // Enough seats, and a category that can take this job (the server checks both again).
            (v) => seatsFit(v.passenger_capacity, item.passenger_count) && vehicleCanServe(v.vehicle_class, item.vehicle_class),
          )}
          canOffer={approved && !onHold}
          homeHub={driver?.home_hub ?? null}
          trips={trips}
          onChanged={load}
        />
      )}
    />
  );
}

function JobCard({
  job,
  names,
  vehicles,
  canOffer,
  homeHub,
  trips,
  onChanged,
}: {
  job: Job;
  names: Names;
  vehicles: Vehicle[];
  canOffer: boolean;
  homeHub: string | null;
  trips: Trip[];
  onChanged: () => Promise<void>;
}) {
  const payout = job.driver_payout == null ? null : Math.round(Number(job.driver_payout));
  const open = job.my_offer_status === "submitted";
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState(String(open && job.my_offer != null ? Math.round(Number(job.my_offer)) : (payout ?? "")));
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { t, lang } = useT();

  const pax = job.passenger_count ?? 1;
  const ride = job.service_type === "transfer";
  const stops = (job.sightseeing_stops ?? []).map((s) => names.stops[s.id] ?? s.id);

  // A same-day trip of theirs that ends where this job starts.
  const day = crDay(job.scheduled_at);
  const returnTrip = trips.find(
    (t) =>
      (t.status === "confirmed" || t.status === "in_progress") &&
      t.scheduled_at != null &&
      crDay(t.scheduled_at) === day &&
      new Date(t.scheduled_at).getTime() < new Date(job.scheduled_at).getTime() &&
      t.destination_coords?.town === job.origin_town,
  );

  async function send(value: string) {
    setBusy(true);
    setMsg(null);
    const res = await api("/driver/offers", { booking_id: job.id, vehicle_id: vehicleId, amount: value.trim(), note: note.trim() });
    setBusy(false);
    setMsg(
      res.ok
        ? { ok: true, text: t("Oferta enviada. Le avisaremos si el viaje es suyo.", "Offer sent. We'll notify you if it's yours.") }
        : { ok: false, text: res.error ?? t("No se pudo enviar la oferta.", "Couldn't send the offer.") },
    );
    if (res.ok) {
      setCustom(false);
      await onChanged();
    }
  }

  async function withdraw() {
    if (!job.my_offer_id) return;
    setBusy(true);
    const res = await api("/driver/offers/withdraw", { bid_id: job.my_offer_id });
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: t("Oferta retirada.", "Offer withdrawn.") } : { ok: false, text: res.error ?? t("No se pudo retirar la oferta.", "Couldn't withdraw.") });
    if (res.ok) await onChanged();
  }

  return (
    <Card>
      <View style={S.row}>
        <Badge text={crDateTime(job.scheduled_at, lang)} tone="grey" icon="calendar-outline" />
        <Text style={S.money}>{payout == null ? "—" : usd(payout)}</Text>
      </View>

      {ride ? (
        <RouteLine from={townName(job.origin_town, lang)} to={townName(job.destination_town, lang)} />
      ) : (
        <Text style={S.h2}>{names.tours[job.catalog_item_id ?? ""] ?? t("Tour de un día", "Day tour")}</Text>
      )}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Badge text={plural(pax, ["pasajero", "pasajeros"], ["passenger", "passengers"], lang)} tone="grey" icon="people-outline" />
        {stops.length ? <Badge text={plural(stops.length, ["parada", "paradas"], ["stop", "stops"], lang)} tone="grey" icon="camera-outline" /> : null}
        {returnTrip ? <Badge text={t("Regreso después de ", "Return trip after ") + returnTrip.booking_ref} icon="repeat-outline" /> : null}
        {!returnTrip && homeHub && homeHub === job.origin_town ? <Badge text={t("Sale de su zona", "Starts in your area")} tone="sky" icon="location-outline" /> : null}
      </View>
      {stops.length ? <Text style={S.muted}>{t("Paradas: ", "Stops: ") + stops.join(", ")}</Text> : null}
      {job.driver_notes ? <Text style={[S.text, { fontStyle: "italic" }]}>“{job.driver_notes}”</Text> : null}

      {open ? (
        <View style={{ backgroundColor: C.amberSoft, borderRadius: 12, padding: 12, gap: 2 }}>
          <Text style={{ color: C.amber, fontWeight: "800" }}>{t("Su oferta: ", "Your offer: ") + usd(job.my_offer)}</Text>
          <Text style={{ color: C.amber, fontSize: 13 }}>{t("Esperando a que nuestro equipo elija un conductor.", "Waiting for our team to pick a driver.")}</Text>
        </View>
      ) : null}
      {job.my_offer_status === "declined" ? <Text style={S.muted}>{t("Se eligió a otro conductor para este viaje.", "Another driver was chosen for this one.")}</Text> : null}

      {canOffer && payout != null && vehicles.length > 0 ? (
        custom ? (
          <View style={{ gap: 10, marginTop: 4 }}>
            <Text style={S.label}>
              {t("Su oferta en USD (", "Your offer in USD (") + usd(Math.round(payout * 0.7)) + t(" a ", " to ") + usd(Math.round(payout * 1.3)) + ")"}
            </Text>
            <TextInput
              accessibilityLabel={t("Mi oferta en dólares", "My offer in dollars")}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              style={[S.input, { fontSize: 20, fontWeight: "800" }]}
            />
            {vehicles.length > 1 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {vehicles.map((v) => (
                  <Chip
                    key={v.id}
                    label={(v.make_model ?? t("Vehículo", "Vehicle")) + " · " + (v.passenger_capacity ?? "?") + t(" asientos", " seats")}
                    on={v.id === vehicleId}
                    onPress={() => setVehicleId(v.id)}
                  />
                ))}
              </View>
            ) : null}
            <TextInput
              accessibilityLabel={t("Nota para el equipo", "Note for the team")}
              value={note}
              onChangeText={setNote}
              placeholder={t("Nota para el equipo (opcional)", "Note for the team (optional)")}
              placeholderTextColor={C.faint}
              maxLength={300}
              style={S.input}
            />
            <Btn label={t("Enviar oferta", "Send offer")} icon="paper-plane-outline" onPress={() => void send(amount)} busy={busy} disabled={!vehicleId || !amount.trim()} />
            <View style={{ alignItems: "center" }}>
              <LinkBtn label={t("Cancelar", "Cancel")} onPress={() => setCustom(false)} color={C.muted} />
            </View>
          </View>
        ) : open ? (
          <View style={[S.row, { marginTop: 2 }]}>
            <LinkBtn label={t("Cambiar oferta", "Change offer")} icon="create-outline" onPress={() => setCustom(true)} disabled={busy} />
            <LinkBtn label={t("Retirar oferta", "Withdraw")} icon="close-circle-outline" onPress={() => void withdraw()} color={C.red} disabled={busy} />
          </View>
        ) : (
          <View style={{ gap: 2, marginTop: 4 }}>
            <Btn
              label={t("Ofertar ", "Offer ") + usd(payout)}
              icon="checkmark-circle-outline"
              onPress={() => void send(String(payout))}
              busy={busy}
              color={C.emerald}
              disabled={!vehicleId}
            />
            <View style={{ alignItems: "center" }}>
              <LinkBtn
                label={vehicles.length > 1 ? t("Otro monto o vehículo", "Other amount or vehicle") : t("Otro monto", "Other amount")}
                onPress={() => setCustom(true)}
              />
            </View>
          </View>
        )
      ) : canOffer && payout != null ? (
        <Text style={{ color: C.amber, fontWeight: "700" }}>
          {t("Ninguno de sus vehículos aprobados tiene espacio para " + plural(pax, ["pasajero", "pasajeros"], ["", ""], "es") + ".", "None of your approved vehicles seats " + pax + ".")}
        </Text>
      ) : null}
      {msg ? <Text style={msg.ok ? { color: C.emerald, fontWeight: "700" } : S.error}>{msg.text}</Text> : null}
    </Card>
  );
}
