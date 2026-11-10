import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { crDateTime, plural, townName, usd } from "../format";
import { supabase } from "../supabase";
import { C, S } from "../theme";
import type { DriverInfo, Job, Names, Trip, Vehicle } from "../types";
import { Badge, Btn, Card, Chip, Empty, IconLine, LinkBtn, RouteLine, ScreenTitle } from "../ui";

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
}) {
  const [jobs, setJobs] = useState<Job[] | null>(demo ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    const { data, error: err } = await supabase.rpc("driver_jobs");
    setLoading(false);
    if (err) return setError("Couldn't load the jobs. Pull down to try again.");
    setError("");
    setJobs((data as Job[] | null) ?? []);
  }, [demo]);

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
          <ScreenTitle title="Open jobs" subtitle={jobs?.length ? plural(jobs.length, "job") + " you can offer on" : undefined} />
          {onHold ? (
            <Card tone="amber">
              <IconLine
                icon="time-outline"
                color={C.amber}
                text="Your new documents are being checked. You can send offers again once our team approves them; trips you already have are not affected."
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
                    ? "You can send offers once our team approves your profile and a vehicle. Add your documents under Profile."
                    : "Apply to drive under Profile. Jobs open up once our team approves you."
                }
              />
            </Card>
          ) : null}
          {error ? <Text style={S.error}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={jobs ? <Empty icon="briefcase-outline" text="No open jobs right now. You'll get a notification as soon as one is posted." /> : undefined}
      renderItem={({ item }) => (
        <JobCard
          job={item}
          names={names}
          vehicles={usable.filter((v) => (v.passenger_capacity ?? 0) >= (item.passenger_count ?? 1))}
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
    setMsg(res.ok ? { ok: true, text: "Offer sent. We'll notify you if it's yours." } : { ok: false, text: res.error ?? "Couldn't send the offer." });
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
    setMsg(res.ok ? { ok: true, text: "Offer withdrawn." } : { ok: false, text: res.error ?? "Couldn't withdraw." });
    if (res.ok) await onChanged();
  }

  return (
    <Card>
      <View style={S.row}>
        <Badge text={crDateTime(job.scheduled_at)} tone="grey" icon="calendar-outline" />
        <Text style={S.money}>{payout == null ? "—" : usd(payout)}</Text>
      </View>

      {ride ? <RouteLine from={townName(job.origin_town)} to={townName(job.destination_town)} /> : <Text style={S.h2}>{names.tours[job.catalog_item_id ?? ""] ?? "Day tour"}</Text>}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Badge text={plural(pax, "passenger")} tone="grey" icon="people-outline" />
        {stops.length ? <Badge text={plural(stops.length, "stop")} tone="grey" icon="camera-outline" /> : null}
        {returnTrip ? <Badge text={"Return trip after " + returnTrip.booking_ref} icon="repeat-outline" /> : null}
        {!returnTrip && homeHub && homeHub === job.origin_town ? <Badge text="Starts in your area" tone="sky" icon="location-outline" /> : null}
      </View>
      {stops.length ? <Text style={S.muted}>Stops: {stops.join(", ")}</Text> : null}
      {job.driver_notes ? <Text style={[S.text, { fontStyle: "italic" }]}>“{job.driver_notes}”</Text> : null}

      {open ? (
        <View style={{ backgroundColor: C.amberSoft, borderRadius: 12, padding: 12, gap: 2 }}>
          <Text style={{ color: C.amber, fontWeight: "800" }}>Your offer: {usd(job.my_offer)}</Text>
          <Text style={{ color: C.amber, fontSize: 13 }}>Waiting for our team to pick a driver.</Text>
        </View>
      ) : null}
      {job.my_offer_status === "declined" ? <Text style={S.muted}>Another driver was chosen for this one.</Text> : null}

      {canOffer && payout != null && vehicles.length > 0 ? (
        custom ? (
          <View style={{ gap: 10, marginTop: 4 }}>
            <Text style={S.label}>
              Your offer in USD ({usd(Math.round(payout * 0.7))} to {usd(Math.round(payout * 1.3))})
            </Text>
            <TextInput accessibilityLabel="My offer in dollars" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={[S.input, { fontSize: 20, fontWeight: "800" }]} />
            {vehicles.length > 1 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {vehicles.map((v) => (
                  <Chip key={v.id} label={(v.make_model ?? "Vehicle") + " · " + (v.passenger_capacity ?? "?") + " seats"} on={v.id === vehicleId} onPress={() => setVehicleId(v.id)} />
                ))}
              </View>
            ) : null}
            <TextInput accessibilityLabel="Note for the team" value={note} onChangeText={setNote} placeholder="Note for the team (optional)" placeholderTextColor={C.faint} maxLength={300} style={S.input} />
            <Btn label="Send offer" icon="paper-plane-outline" onPress={() => void send(amount)} busy={busy} disabled={!vehicleId || !amount.trim()} />
            <View style={{ alignItems: "center" }}>
              <LinkBtn label="Cancel" onPress={() => setCustom(false)} color={C.muted} />
            </View>
          </View>
        ) : open ? (
          <View style={[S.row, { marginTop: 2 }]}>
            <LinkBtn label="Change offer" icon="create-outline" onPress={() => setCustom(true)} disabled={busy} />
            <LinkBtn label="Withdraw" icon="close-circle-outline" onPress={() => void withdraw()} color={C.red} disabled={busy} />
          </View>
        ) : (
          <View style={{ gap: 2, marginTop: 4 }}>
            <Btn label={"Offer " + usd(payout)} icon="checkmark-circle-outline" onPress={() => void send(String(payout))} busy={busy} color={C.emerald} disabled={!vehicleId} />
            <View style={{ alignItems: "center" }}>
              <LinkBtn label={vehicles.length > 1 ? "Other amount or vehicle" : "Other amount"} onPress={() => setCustom(true)} />
            </View>
          </View>
        )
      ) : canOffer && payout != null ? (
        <Text style={{ color: C.amber, fontWeight: "700" }}>None of your approved vehicles seats {pax}.</Text>
      ) : null}
      {msg ? <Text style={msg.ok ? { color: C.emerald, fontWeight: "700" } : S.error}>{msg.text}</Text> : null}
    </Card>
  );
}
