import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { crDateTime, plural, townName, usd } from "../format";
import { supabase } from "../supabase";
import { C, S } from "../theme";
import type { DriverInfo, Job, Names, Trip, Vehicle } from "../types";
import { Badge, Btn, Card, Empty } from "../ui";

const DAY_MS = 86400000;
const CR_OFFSET_MS = 6 * 3600 * 1000;
const crDay = (iso: string) => Math.floor((new Date(iso).getTime() - CR_OFFSET_MS) / DAY_MS);

/**
 * Open jobs with a suggested payout (never the traveller's price). The driver
 * sends an offer at that amount or their own; the team picks a driver.
 */
export function Jobs({
  driver,
  vehicles,
  names,
  trips,
  focusId,
}: {
  driver: DriverInfo | null;
  vehicles: Vehicle[];
  names: Names;
  trips: Trip[];
  /** A job to scroll to, from a tapped notification. */
  focusId?: string;
}) {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc("driver_jobs");
    setLoading(false);
    if (err) return setError("Couldn't load the jobs. Pull down to try again.");
    setError("");
    setJobs((data as Job[] | null) ?? []);
  }, []);

  useEffect(() => {
    void load();
    // New jobs appear without the driver having to pull down.
    const t = setInterval(() => void load(), 30000);
    return () => clearInterval(t);
  }, [load]);

  const approved = driver?.kyc_status === "approved";
  const usable = vehicles.filter((v) => v.status === "approved");
  const sorted = [...(jobs ?? [])].sort((a, b) => Number(b.id === focusId) - Number(a.id === focusId));

  return (
    <FlatList
      style={S.screen}
      contentContainerStyle={S.pad}
      data={sorted}
      keyExtractor={(j) => j.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.emerald} />}
      ListHeaderComponent={
        <View style={{ gap: 8 }}>
          <Text style={S.h1}>Open jobs</Text>
          <Text style={S.muted}>Send an offer at the suggested payout, or name your own. Our team picks a driver and you get a notification.</Text>
          {!approved ? (
            <Card>
              <Text style={{ color: C.amber, fontWeight: "700" }}>
                {driver
                  ? "You can see jobs once our team approves your profile and a vehicle. Add your documents under Profile."
                  : "Apply to drive under Profile; jobs appear here once our team approves you."}
              </Text>
            </Card>
          ) : null}
          {error ? <Text style={S.error}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={jobs ? <Empty text="No open jobs right now. New ones appear here and you'll get a notification." /> : undefined}
      renderItem={({ item }) => (
        <JobCard
          job={item}
          names={names}
          vehicles={usable.filter((v) => (v.passenger_capacity ?? 0) >= (item.passenger_count ?? 1))}
          canOffer={approved}
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
  const [amount, setAmount] = useState(String(open && job.my_offer != null ? Math.round(Number(job.my_offer)) : (payout ?? "")));
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const pax = job.passenger_count ?? 1;
  const title =
    job.service_type === "transfer"
      ? townName(job.origin_town) + " → " + townName(job.destination_town)
      : (names.tours[job.catalog_item_id ?? ""] ?? "Day tour");
  const stops = (job.sightseeing_stops ?? []).map((s) => names.stops[s.id] ?? s.id).join(", ");

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

  async function send() {
    setBusy(true);
    setMsg(null);
    const res = await api("/driver/offers", { booking_id: job.id, vehicle_id: vehicleId, amount: amount.trim(), note: note.trim() });
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Offer sent. We'll notify you if it's yours." } : { ok: false, text: res.error ?? "Couldn't send the offer." });
    if (res.ok) await onChanged();
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
      <Text style={S.label}>
        {crDateTime(job.scheduled_at)} · {job.booking_ref}
      </Text>
      <View style={S.row}>
        <Text style={[S.h2, { flex: 1 }]}>{title}</Text>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={S.label}>Suggested payout</Text>
          <Text style={S.money}>{payout == null ? "—" : usd(payout)}</Text>
        </View>
      </View>
      <Text style={S.muted}>
        {plural(pax, "passenger")}
        {stops ? " · Stops: " + stops : ""}
      </Text>
      {job.driver_notes ? <Text style={[S.text, { fontStyle: "italic" }]}>“{job.driver_notes}”</Text> : null}
      {returnTrip ? <Badge text={"Return trip: fits after " + returnTrip.booking_ref} /> : null}
      {!returnTrip && homeHub && homeHub === job.origin_town ? <Badge text="Starts in your area" tone="sky" /> : null}
      {open ? <Badge text={"Your offer: " + usd(job.my_offer) + " · waiting for the team"} tone="amber" /> : null}
      {job.my_offer_status === "declined" ? <Text style={S.muted}>Another driver was chosen for this one.</Text> : null}

      {canOffer && payout != null && vehicles.length > 0 ? (
        <View style={{ gap: 8, marginTop: 6 }}>
          <Text style={S.label}>
            My offer (USD), between {usd(Math.round(payout * 0.7))} and {usd(Math.round(payout * 1.3))}
          </Text>
          <TextInput accessibilityLabel="My offer in dollars" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={S.input} />
          {vehicles.length > 1 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {vehicles.map((v) => (
                <Pressable
                  key={v.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: v.id === vehicleId }}
                  onPress={() => setVehicleId(v.id)}
                  style={{
                    borderWidth: 2,
                    borderColor: v.id === vehicleId ? C.emerald : C.border,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    backgroundColor: v.id === vehicleId ? C.emeraldSoft : "#fff",
                  }}
                >
                  <Text style={{ fontWeight: "700", color: C.text }}>
                    {(v.make_model ?? "Vehicle") + " " + (v.plate ?? "")} · {v.passenger_capacity ?? "?"} seats
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <TextInput
            accessibilityLabel="Note for the team"
            value={note}
            onChangeText={setNote}
            placeholder="Note for the team (optional)"
            maxLength={300}
            style={S.input}
          />
          <Btn label={open ? "Change my offer" : "Send my offer"} onPress={send} busy={busy} disabled={!vehicleId || !amount.trim()} />
          {open ? <Btn label="Withdraw my offer" alt onPress={withdraw} disabled={busy} /> : null}
        </View>
      ) : canOffer && payout != null ? (
        <Text style={{ color: C.amber, fontWeight: "700" }}>None of your approved vehicles seats {pax}.</Text>
      ) : null}
      {msg ? <Text style={msg.ok ? { color: C.emerald, fontWeight: "700" } : S.error}>{msg.text}</Text> : null}
    </Card>
  );
}
