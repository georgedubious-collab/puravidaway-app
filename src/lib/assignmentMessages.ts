/**
 * What is sent when a driver gets a booking (Jorge, 2026-11-12): the SAME messages whether the team
 * accepts the driver's offer or assigns the driver by hand (booking page or dispatch calendar).
 *   - Traveller: "your ride is confirmed" push + email, in the language they booked in
 *     (rideConfirmedPush / rideConfirmedEmail, src/lib/travellerMessages.ts).
 *   - Driver: "you've got the ride" push + email, in their app language (profiles.app_lang,
 *     Spanish unless "en"). It holds the route, pickup time and the driver's own payout; never the
 *     traveller's contact details or the price the traveller paid.
 * Sent once per assignment: only when the driver changes to someone new (shouldNotifyAssignment).
 * A driver removed from a booking is handled elsewhere; the traveller hears about the new driver.
 *
 * Pure (no database, no sending) so `npm run test:dispatch` can check it;
 * src/lib/assignmentNotices.ts loads the booking and sends.
 */
import { usd } from "./bookings";
import { placeNameFor } from "./catalogEs";
import { formatScheduledAt, formatScheduledAtFor } from "./dates";
import type { Email } from "./emailHtml";
import type { PublicLang } from "./publicLang";
import { clientLanguageNote, driverFirstName, rideConfirmedEmail, rideConfirmedPush } from "./travellerMessages";

/** A new driver was set (none → driver, or driver A → driver B). Same driver re-saved: nothing. */
export function shouldNotifyAssignment(beforeDriverId: string | null | undefined, afterDriverId: string | null | undefined): boolean {
  return Boolean(afterDriverId) && afterDriverId !== (beforeDriverId ?? null);
}

export interface AssignmentContext {
  bookingId: string;
  ref: string;
  serviceType: string | null;
  origin: string | null;
  destination: string | null;
  scheduledAt: string | null;
  /** What the driver is paid (their offer, or the booking's suggested payout). */
  payout: number | string | null;
  /** true: the team accepted the driver's offer; false: assigned by hand. */
  viaOffer: boolean;
  driver: { id: string; fullName: string | null; email: string | null; appLang: string | null };
  guest: { name: string | null; email: string | null; accessToken: string | null; language: string | null } | null;
  siteUrl: string;
}

type Push = { title: string; body: string; data?: Record<string, string> };
type Mail = Email;

export type Outgoing =
  | { kind: "traveller_push"; toEmail: string; message: Push }
  | { kind: "traveller_email"; email: Mail }
  | { kind: "driver_push"; userId: string; message: Push }
  | { kind: "driver_email"; email: Mail };

const langOf = (v: string | null | undefined): PublicLang => (v === "es" ? "es" : "en");

/** Every message for one assignment, in the order they are sent. */
export function assignmentMessages(c: AssignmentContext): Outgoing[] {
  const out: Outgoing[] = [];
  const g = c.guest;
  if (g?.email) {
    const gl = langOf(g.language);
    const driver = driverFirstName(gl, c.driver.fullName);
    const when = c.scheduledAt ? formatScheduledAtFor(c.scheduledAt, gl) : "";
    out.push({
      kind: "traveller_push",
      toEmail: g.email,
      message: { ...rideConfirmedPush(gl, { driver, when }), data: { screen: "trip", id: c.bookingId } },
    });
    out.push({
      kind: "traveller_email",
      email: {
        to: g.email,
        ...rideConfirmedEmail(gl, {
          ride: c.serviceType === "transfer",
          guestName: g.name,
          driver,
          ref: c.ref,
          origin: placeNameFor(c.origin, gl),
          destination: placeNameFor(c.destination, gl),
          when,
          tripUrl: `${c.siteUrl}/trip/${g.accessToken ?? ""}`,
        }),
      },
    });
  }

  const es = c.driver.appLang !== "en";
  const dl: PublicLang = es ? "es" : "en";
  const when = c.scheduledAt ? formatScheduledAt(c.scheduledAt, dl) : "";
  const route = `${placeNameFor(c.origin, dl)} → ${placeNameFor(c.destination, dl)}`;
  const pay = c.payout != null && c.payout !== "" ? usd(c.payout) : null;
  out.push({
    kind: "driver_push",
    userId: c.driver.id,
    message: {
      title: es ? `Tiene el viaje ${c.ref}` : `You've got the ride ${c.ref}`,
      body: `${route} · ${when}${pay ? (es ? ` · su pago ${pay}` : ` · payout ${pay}`) : ""}`,
      data: { screen: "trip", id: c.bookingId },
    },
  });
  if (c.driver.email) {
    const first = (c.driver.fullName ?? "").split(" ")[0];
    out.push({
      kind: "driver_email",
      email: {
        to: c.driver.email,
        lang: dl,
        subject: es ? `Tiene el viaje ${c.ref} · ${when}` : `You've got the ride ${c.ref} · ${when}`,
        lines: [
          es ? (first ? `Hola ${first},` : "Hola,") : `Hi ${first || "there"},`,
          c.viaOffer
            ? es
              ? `Aceptamos su oferta: ${c.ref}, ${route}, recogida ${when} (hora de Costa Rica).`
              : `Your offer was accepted: ${c.ref}, ${route}, pickup ${when} (Costa Rica time).`
            : es
              ? `Nuestro equipo le asignó el viaje ${c.ref}, ${route}, recogida ${when} (hora de Costa Rica).`
              : `Our team assigned you the ride ${c.ref}, ${route}, pickup ${when} (Costa Rica time).`,
          pay ? (es ? `Su pago: ${pay}.` : `Your payout: ${pay}.`) : "",
          g ? clientLanguageNote(langOf(g.language)) : "",
          es
            ? "Abra el viaje para ver el lugar exacto de recogida, lo que pidió el viajero y el chat. Preséntese ahí hoy, por favor."
            : "Open the trip for the exact pickup place, the traveller's requests and the chat. Please introduce yourself there today.",
        ].filter(Boolean),
        button: { label: es ? "Abrir el viaje" : "Open the trip", url: `${c.siteUrl}/driver/trips/${c.bookingId}` },
      },
    });
  }
  return out;
}
