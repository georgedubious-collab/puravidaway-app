import "server-only";
import { REMIND_FROM_HOURS, isAirportEnd, planDayBeforeReminders, type StoredCoords } from "./automationRules";
import { driverReminderEmail, driverReminderFor, driverReminderPush } from "./automationMessages";
import { bookedItemName } from "./catalog";
import { localizeCatalog, placeNameFor } from "./catalogEs";
import { getCatalog } from "./catalogSource";
import { formatScheduledAtFor } from "./dates";
import { SITE_URL, sendEmail } from "./email";
import type { RidePrefs } from "./preferences";
import { parsePublicLang, type PublicLang } from "./publicLang";
import { sendPush, sendPushToEmail } from "./push";
import { signShown } from "./sign";
import { createSupabaseAdminClient } from "./supabase/admin";
import { dayBeforeEmail, dayBeforePush, driverFirstName } from "./travellerMessages";

/**
 * The day-before reminder (rules in src/lib/automationRules.ts, docs/PROJECT.md §4.7): about 24
 * hours before each confirmed pickup, ONE push + email to the traveller (in the language they
 * booked in) and ONE push + email to the assigned driver (Spanish, or English if they use the
 * app in English). Each is marked (bookings.reminder_traveller_at / reminder_driver_at) before
 * it is sent, and only the call that marked it sends, so it never goes out twice.
 *
 * The traveller's message never has the driver's phone; the driver's never has the traveller's
 * name, phone, email or the price (it is built from what my_trips() shows the driver).
 */
const BATCH = 200;

const COLUMNS =
  "id, status, booking_ref, trip_id, service_type, catalog_item_id, origin, destination, origin_coords, destination_coords, scheduled_at, confirmed_at, " +
  "assigned_driver_id, assigned_vehicle_id, passenger_count, luggage_count, carry_on_count, flight_or_hotel_notes, driver_notes, preferences, vehicle_class, " +
  "payment_mode, total_price, cash_fee, amount_paid, sign_text, sign_hide_name, pickup_place, reminder_traveller_at, reminder_driver_at";

interface Row {
  id: string;
  status: string;
  booking_ref: string;
  trip_id: string | null;
  service_type: string;
  catalog_item_id: string | null;
  origin: string | null;
  destination: string | null;
  origin_coords: StoredCoords | null;
  destination_coords: StoredCoords | null;
  scheduled_at: string | null;
  confirmed_at: string | null;
  assigned_driver_id: string | null;
  assigned_vehicle_id: string | null;
  passenger_count: number | null;
  luggage_count: number | null;
  carry_on_count: number | null;
  flight_or_hotel_notes: string | null;
  driver_notes: string | null;
  preferences: Partial<RidePrefs> | null;
  vehicle_class: string | null;
  payment_mode: string | null;
  total_price: number | string | null;
  cash_fee: number | string | null;
  amount_paid: number | string | null;
  sign_text: string | null;
  sign_hide_name: boolean | null;
  pickup_place: string | null;
  reminder_traveller_at: string | null;
  reminder_driver_at: string | null;
}

type Db = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

/** Set the column if it is still empty; true only for the call that set it. */
async function claim(db: Db, id: string, column: "reminder_traveller_at" | "reminder_driver_at", stamp: string): Promise<boolean> {
  const { data } = await db.from("bookings").update({ [column]: stamp }).eq("id", id).is(column, null).select("id");
  return Boolean(data?.length);
}

export async function sendDayBeforeReminders(now = new Date()): Promise<{ checked: number; travellers: number; drivers: number; error?: string }> {
  const out = { checked: 0, travellers: 0, drivers: 0 };
  const db = createSupabaseAdminClient();
  if (!db) return { ...out, error: "Database not configured" };
  const { data, error } = await db
    .from("bookings")
    .select(COLUMNS)
    .eq("status", "confirmed")
    .not("assigned_driver_id", "is", null)
    .gt("scheduled_at", now.toISOString())
    .lte("scheduled_at", new Date(now.getTime() + REMIND_FROM_HOURS * 3600 * 1000).toISOString())
    .or("reminder_traveller_at.is.null,reminder_driver_at.is.null")
    .order("scheduled_at", { ascending: true })
    .limit(BATCH)
    .returns<Row[]>();
  if (error) return { ...out, error: error.message };
  const rows = data ?? [];
  out.checked = rows.length;
  const plan = planDayBeforeReminders(now, rows);
  if (!plan.traveller.length && !plan.driver.length) return out;

  const catalog = await getCatalog();
  const stamp = now.toISOString();
  for (const b of rows) {
    const toTraveller = plan.traveller.includes(b.id);
    const toDriver = plan.driver.includes(b.id);
    if (!toTraveller && !toDriver) continue;
    try {
      const [{ data: trip }, { data: who }] = await Promise.all([
        b.trip_id
          ? db.from("trips").select("guest_name, guest_email, access_token, language").eq("id", b.trip_id).maybeSingle()
          : Promise.resolve({ data: null }),
        db.from("profiles").select("full_name, email, app_lang").eq("id", b.assigned_driver_id!).maybeSingle(),
      ]);
      const ride = b.service_type === "transfer";
      // The sign as the driver's screens show it (pickup_sign() in the database, same rule).
      const sign = ride ? signShown(b, trip?.guest_name) : null;

      if (toTraveller && (await claim(db, b.id, "reminder_traveller_at", stamp)) && trip?.guest_email) {
        const lang = parsePublicLang(trip.language);
        if (await sendTravellerReminder(db, b, trip, who?.full_name ?? null, sign, lang, catalog)) out.travellers++;
      }
      if (toDriver && (await claim(db, b.id, "reminder_driver_at", stamp))) {
        // Drivers read Spanish unless they use the app or the portal in English.
        const lang: PublicLang = who?.app_lang === "en" ? "en" : "es";
        const msg = driverReminderFor(lang, b, {
          guestName: trip?.guest_name,
          driverFullName: who?.full_name,
          tourName: ride ? null : bookedItemName(localizeCatalog(catalog, lang).dayTours, b.catalog_item_id, lang),
          siteUrl: SITE_URL,
        });
        const pushed = await sendPush([b.assigned_driver_id!], { ...driverReminderPush(lang, msg), data: { screen: "trip", id: b.id } }, "driver");
        const mailed = who?.email ? await sendEmail({ to: who.email, ...driverReminderEmail(lang, msg) }) : false;
        if (pushed > 0 || mailed) out.drivers++;
      }
    } catch (e) {
      console.error("[day-before reminder]", b.id, e);
    }
  }
  return out;
}

async function sendTravellerReminder(
  db: Db,
  b: Row,
  trip: { guest_name: string | null; guest_email: string; access_token: string },
  driverFullName: string | null,
  sign: string | null,
  lang: PublicLang,
  catalog: Awaited<ReturnType<typeof getCatalog>>,
): Promise<boolean> {
  const ride = b.service_type === "transfer";
  // The car exactly as the trip page shows it: make and model with the year, colour, plate.
  const { data: v } = b.assigned_vehicle_id
    ? await db.from("driver_vehicles").select("make_model, year, color, plate").eq("id", b.assigned_vehicle_id).maybeSingle()
    : { data: null };
  const driver = driverFirstName(lang, driverFullName);
  const when = formatScheduledAtFor(b.scheduled_at, lang);
  const tourName = bookedItemName(localizeCatalog(catalog, lang).dayTours, b.catalog_item_id, lang) ?? "Tour";
  await sendPushToEmail(trip.guest_email, { ...dayBeforePush(lang, { ride, when, driver, sign }), data: { screen: "trip", id: b.id } });
  return sendEmail({
    to: trip.guest_email,
    ...dayBeforeEmail(lang, {
      guestName: trip.guest_name,
      driver,
      ref: b.booking_ref,
      ride,
      origin: ride ? placeNameFor(b.origin, lang) : tourName,
      destination: ride ? placeNameFor(b.destination, lang) : "",
      when,
      car: v ? { name: [v.make_model, v.year].filter(Boolean).join(" ") || (lang === "es" ? "Vehículo" : "Vehicle"), color: v.color, plate: v.plate } : null,
      sign,
      airport: ride && isAirportEnd({ text: b.origin, coords: b.origin_coords }),
      pickupPlace: ride ? null : b.pickup_place,
      tripUrl: `${SITE_URL}/trip/${trip.access_token}`,
    }),
  });
}
