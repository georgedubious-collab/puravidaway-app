"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { formatScheduledAtFor } from "@/lib/dates";
import { ADMIN_EMAIL, SITE_URL, sendEmail } from "@/lib/email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { InputError, runAction, type FormState } from "@/lib/forms/formState";
import { parsePublicLang } from "@/lib/publicLang";
import { sendPushToEmail } from "@/lib/push";
import { requestDriverReview } from "@/lib/reviewRequest";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { driverDbMessage } from "@/lib/driverDbMessages";
import { makeT } from "@/lib/teamLang";
import { driverFirstName, onTheWayEmail, onTheWayPush } from "@/lib/travellerMessages";
import { getTeamLang } from "@/lib/teamLangServer";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The driver's three steps: "I'm on my way", "Client picked up", "Trip ended". The database function
 * `driver_set_trip_status` checks it is their trip and the step is allowed.
 * Completing it asks the traveller for a rating straight away.
 */
export async function setTripStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  const lang = await getTeamLang();
  const t = makeT(lang);
  return runAction(async () => {
    const me = await requireUser("/driver/trips");
    const id = String(fd.get("booking_id") ?? "");
    const step = String(fd.get("step") ?? "");
    if (!UUID.test(id) || !["en_route", "in_progress", "completed"].includes(step)) throw new InputError(t("Ese paso no está disponible.", "That step isn't available."));
    const supabase = (await createSupabaseServerClient())!;
    const { data: ref, error } = await supabase.rpc("driver_set_trip_status", { p_booking: id, p_status: step });
    if (error) {
      if (/^(Your driver account|This trip|You can start|Start the trip)/.test(error.message))
        throw new InputError(driverDbMessage(error.message, lang));
      throw new Error(error.message);
    }
    if (step === "en_route") {
      // Tell the traveller their driver has set off (once: the database keeps the first time).
      after(async () => {
        const db = createSupabaseAdminClient();
        if (!db) return;
        const { data: b } = await db.from("bookings").select("trip_id, scheduled_at, en_route_at").eq("id", id).maybeSingle();
        if (!b?.trip_id || !b.en_route_at || Date.now() - new Date(b.en_route_at).getTime() > 60000) return;
        const { data: trip } = await db.from("trips").select("guest_name, guest_email, access_token, language").eq("id", b.trip_id).maybeSingle();
        if (!trip?.guest_email) return;
        // In the language the traveller booked in.
        const guestLang = parsePublicLang(trip.language);
        const driver = driverFirstName(guestLang, me.full_name);
        const when = formatScheduledAtFor(b.scheduled_at, guestLang);
        await sendPushToEmail(trip.guest_email, { ...onTheWayPush(guestLang, { driver, when }), data: { screen: "trip", id } });
        await sendEmail({
          to: trip.guest_email,
          ...onTheWayEmail(guestLang, {
            guestName: trip.guest_name,
            driver,
            ref: String(ref),
            when,
            tripUrl: `${SITE_URL}/trip/${trip.access_token}`,
          }),
        });
      });
    }
    if (step === "completed") {
      after(async () => {
        await requestDriverReview(id);
        if (ADMIN_EMAIL) {
          await sendEmail({
            to: ADMIN_EMAIL,
            subject: `Trip completed: ${ref} (${me.full_name ?? "driver"})`,
            lines: [`${me.full_name ?? "The driver"} marked ${ref} completed. The traveller has been asked for a rating.`],
            button: { label: "Open the booking", url: `${SITE_URL}/admin/bookings/${id}` },
          });
        }
      });
    }
    revalidatePath(`/driver/trips/${id}`);
    revalidatePath("/driver/trips");
    revalidatePath(`/admin/bookings/${id}`);
  }, t("No pudimos actualizar el viaje. Recargue la página e intente de nuevo.", "We couldn't update the trip. Please reload and try again."));
}
