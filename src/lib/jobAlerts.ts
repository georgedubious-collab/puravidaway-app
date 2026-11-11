import "server-only";
import { usd } from "./bookings";
import { getCatalog } from "./catalogSource";
import { formatScheduledAt, formatScheduledAtFor, scheduledParts } from "./dates";
import { SITE_URL, sendEmail } from "./email";
import { townName, townOf } from "./matching";
import { sendPush } from "./push";
import { createSupabaseAdminClient } from "./supabase/admin";
import { driverCanServe } from "./vehicleEligibility";

/** At most this many drivers are emailed per job (alphabetical beyond drivers based at the pickup). */
const MAX_RECIPIENTS = 60;

/**
 * Email approved drivers that a job is open on the board (a booking moved to
 * "Open for drivers"). The email has what the job board shows: town-to-town
 * route, pickup time, travellers and the suggested payout. Never the client's
 * price, name or exact address. Drivers based in the pickup town are emailed
 * first and told it starts in their area. Only drivers whose vehicle category can
 * serve the job are told (same rule as the job board). Never throws.
 */
export async function notifyDriversOfJobs(bookingIds: string[]): Promise<void> {
  try {
    const db = createSupabaseAdminClient();
    if (!db || bookingIds.length === 0) return;
    const [{ data: jobs }, { data: drivers }, catalog] = await Promise.all([
      db
        .from("bookings")
        .select("id, booking_ref, service_type, catalog_item_id, origin, destination, origin_coords, destination_coords, scheduled_at, passenger_count, driver_payout, status, vehicle_class")
        .in("id", bookingIds)
        .eq("status", "pending_bids")
        .not("driver_payout", "is", null),
      db.from("drivers").select("id, home_hub, profiles!drivers_id_fkey(full_name, email, role, app_lang), driver_vehicles(status, vehicle_class)").eq("kyc_status", "approved"),
      getCatalog(),
    ]);
    if (!jobs?.length || !drivers?.length) return;
    type D = { id: string; home_hub: string | null; driver_vehicles: { status: string; vehicle_class: string | null }[] | null; profiles: { full_name: string | null; email: string | null; role: string; app_lang: string | null } | null };
    const list = (drivers as unknown as D[]).filter((d) => d.profiles?.email && d.profiles.role === "driver");

    const { data: blocked } = await db.from("driver_unavailable").select("driver_id, day").in("driver_id", list.map((d) => d.id));
    for (const j of jobs) {
      // Drivers who blocked that day (Costa Rica date) aren't told about the job.
      const day = scheduledParts(j.scheduled_at)?.ymd;
      const off = new Set((blocked ?? []).filter((u) => u.day === day).map((u) => u.driver_id as string));
      // Only drivers with an approved vehicle whose category can take this job (the job board's
      // rule, src/lib/vehicleEligibility.ts): untagged vehicles and day tours are not filtered.
      const available = list.filter((d) => !off.has(d.id) && driverCanServe(d.driver_vehicles ?? [], j.vehicle_class));
      const from = townOf(j.origin, j.origin_coords);
      const to = townOf(j.destination, j.destination_coords);
      const what =
        j.service_type === "transfer"
          ? `${townName(from ?? j.origin)} → ${townName(to ?? j.destination)}`
          : (catalog.dayTours.find((t) => t.id === j.catalog_item_id)?.name ?? "Day tour");
      const when = formatScheduledAt(j.scheduled_at);
      const payout = usd(Math.round(Number(j.driver_payout)));
      // Push to every approved driver's phone (driver app), then email as the backup.
      // In the driver's app language: Spanish unless they switched the app to English.
      const pax = j.passenger_count ?? 1;
      const whatEs = j.service_type === "transfer" ? what : (catalog.dayTours.find((t) => t.id === j.catalog_item_id)?.name ?? "Tour de un día");
      const inEnglish = available.filter((d) => d.profiles?.app_lang === "en").map((d) => d.id);
      const inSpanish = available.filter((d) => d.profiles?.app_lang !== "en").map((d) => d.id);
      const data = { screen: "job", id: j.id };
      await sendPush(
        inSpanish,
        { title: `Nuevo viaje: ${whatEs}`, body: `${formatScheduledAtFor(j.scheduled_at, "es")} · ${pax} ${pax > 1 ? "pasajeros" : "pasajero"} · pago sugerido ${payout}`, data },
        "driver",
      );
      await sendPush(
        inEnglish,
        { title: `New job: ${what}`, body: `${when} · ${pax} traveller${pax > 1 ? "s" : ""} · suggested payout ${payout}`, data },
        "driver",
      );
      const sorted = [...available].sort((a, b) => Number(b.home_hub === from) - Number(a.home_hub === from)).slice(0, MAX_RECIPIENTS);
      for (const d of sorted) {
        await sendEmail({
          to: d.profiles!.email!,
          subject: `New job: ${what} · ${when} · ${payout}`,
          lines: [
            `Hi ${(d.profiles!.full_name ?? "").split(" ")[0] || "there"},`,
            `A new job is open: ${what}, pickup ${when} (Costa Rica time), ${j.passenger_count ?? 1} traveller${(j.passenger_count ?? 1) > 1 ? "s" : ""}. Suggested payout: ${payout}.`,
            d.home_hub && d.home_hub === from ? "It starts in your area, so your offer gets priority." : "",
            "Send your offer on the job board. Our team picks a driver and emails you if it's yours.",
          ].filter(Boolean),
          button: { label: "See the job and send an offer", url: `${SITE_URL}/driver/jobs` },
        });
      }
    }
  } catch (e) {
    console.error("[job alerts]", e);
  }
}
