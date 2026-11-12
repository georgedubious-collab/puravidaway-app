/**
 * One-tap WhatsApp messages from the booking page (team only). Each button opens
 * https://wa.me/<traveller's number>?text=<message> in a new tab; the message is built here from
 * the booking, never typed, in the traveller's booking language (trips.language): English, or
 * Spanish with "usted". The team still reads it in WhatsApp and presses send.
 * Drivers never get the traveller's number; this is for our team only.
 *
 * Plain TypeScript without imports, so `npm run test:crm` runs it with Node.
 */

export type WaKind = "received" | "driver_confirmed" | "day_before" | "looking_into_it" | "payment_reminder";
export const WA_KINDS: readonly WaKind[] = ["received", "driver_confirmed", "day_before", "looking_into_it", "payment_reminder"];

export interface WaFacts {
  lang: "en" | "es";
  guestName: string | null;
  ref: string;
  /** "SJO Airport → Manuel Antonio" or the tour's name, already in `lang`. */
  what: string;
  /** The pickup, already formatted in `lang` (formatScheduledAtFor). */
  when: string;
  tripUrl: string | null;
  /** First name of the assigned driver, if any. */
  driver: string | null;
  /** The vehicle as the trip page shows it: "Toyota Hiace 2021 · white · plate BCD123". */
  vehicle: string | null;
  /** What the name sign says (rides only). */
  sign: string | null;
  /** Still to pay online, USD (0 = nothing). */
  amountDue: number;
}

/** Digits of a phone number for wa.me; null when it can't be a real number (fewer than 7 digits). */
export function waDigits(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "").replace(/^00/, "");
  return d.length >= 7 && d.length <= 15 ? d : null;
}

export function waLink(phone: string | null | undefined, text: string): string | null {
  const d = waDigits(phone);
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : null;
}

/** "Toyota Hiace 2021 · white · plate BCD123" (make + year, colour, plate), like the trip page. */
export function vehicleText(
  v: { make_model?: string | null; year?: number | null; color?: string | null; plate?: string | null } | null | undefined,
  lang: "en" | "es",
): string | null {
  if (!v) return null;
  const name = [v.make_model, v.year].filter(Boolean).join(" ");
  const parts = [name, v.color ?? "", v.plate ? `${lang === "es" ? "placa" : "plate"} ${v.plate}` : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

const first = (name: string | null) => (name ?? "").trim().split(/\s+/)[0] ?? "";
const usd = (n: number) => `$${n.toFixed(2)}`;

/** Why a message can't be sent yet (the button is shown disabled with this), or null. */
export function waUnavailable(kind: WaKind, f: Pick<WaFacts, "driver" | "amountDue" | "tripUrl" | "lang">, teamLang: "es" | "en"): string | null {
  const es = teamLang === "es";
  if ((kind === "driver_confirmed" || kind === "day_before") && !f.driver)
    return es ? "Primero asigne un conductor." : "Assign a driver first.";
  if (kind === "payment_reminder" && !(f.amountDue > 0))
    return es ? "No hay saldo pendiente en línea." : "Nothing left to pay online.";
  if (kind === "payment_reminder" && !f.tripUrl) return es ? "Esta reserva no tiene página de viaje." : "This booking has no trip page.";
  return null;
}

export function waMessage(kind: WaKind, f: WaFacts): string {
  const es = f.lang === "es";
  const n = first(f.guestName);
  const hi = es ? (n ? `¡Hola ${n}!` : "¡Hola!") : n ? `Hi ${n}!` : "Hi!";
  const page = f.tripUrl ?? "";
  const sign = f.sign ? (es ? ` Le esperará con un rótulo que dice «${f.sign}».` : ` They'll be holding a sign that says "${f.sign}".`) : "";
  const car = f.vehicle ? `, ${f.vehicle}` : "";
  switch (kind) {
    case "received":
      return es
        ? `${hi} Le escribimos de Costa Rica Private Transfers. Recibimos su reserva ${f.ref}: ${f.what}, ${f.when} (hora de Costa Rica). ¿Nos confirma que los datos están correctos?${page ? ` Puede ver todo en la página de su viaje: ${page}` : ""}`
        : `${hi} This is Costa Rica Private Transfers. We received your booking ${f.ref}: ${f.what}, ${f.when} (Costa Rica time). Could you confirm the details are right?${page ? ` You can see everything on your trip page: ${page}` : ""}`;
    case "driver_confirmed":
      return es
        ? `${hi} Su conductor para ${f.ref} está confirmado: ${f.driver ?? ""}${car}. Recogida: ${f.when} (hora de Costa Rica).${sign}${page ? ` En la página de su viaje verá el perfil de su conductor, las fotos del vehículo y el chat: ${page}` : ""}`
        : `${hi} Your driver for ${f.ref} is confirmed: ${f.driver ?? ""}${car}. Pickup: ${f.when} (Costa Rica time).${sign}${page ? ` Your trip page has your driver's profile, car photos and the chat: ${page}` : ""}`;
    case "day_before":
      return es
        ? `${hi} Le recordamos su viaje de mañana: ${f.what}, recogida ${f.when} (hora de Costa Rica). Su conductor es ${f.driver ?? ""}${car}.${sign}${page ? ` Página de su viaje: ${page}` : ""} ¡Nos vemos mañana!`
        : `${hi} A reminder for tomorrow: ${f.what}, pickup ${f.when} (Costa Rica time). Your driver is ${f.driver ?? ""}${car}.${sign}${page ? ` Your trip page: ${page}` : ""} See you tomorrow!`;
    case "looking_into_it":
      return es
        ? `${hi} Gracias por su mensaje sobre ${f.ref}. Lo estamos revisando y le respondemos muy pronto. — Costa Rica Private Transfers`
        : `${hi} Thank you for your message about ${f.ref}. We're looking into it and will get back to you shortly. — Costa Rica Private Transfers`;
    case "payment_reminder":
      return es
        ? `${hi} Le recordamos que su reserva ${f.ref} (${f.what}, ${f.when}) está pendiente de pago: ${usd(f.amountDue)}. Puede pagar desde la página de su viaje: ${page}`
        : `${hi} A friendly reminder that your booking ${f.ref} (${f.what}, ${f.when}) is waiting for payment: ${usd(f.amountDue)}. You can pay from your trip page: ${page}`;
  }
}

export function waButtonLabel(kind: WaKind, teamLang: "es" | "en"): string {
  const es = teamLang === "es";
  return {
    received: es ? "Reserva recibida / confirmar datos" : "Booking received / confirm details",
    driver_confirmed: es ? "Conductor confirmado" : "Driver confirmed",
    day_before: es ? "Recordatorio del día antes" : "Day-before reminder",
    looking_into_it: es ? "«Lo estamos revisando»" : "\"We're looking into it\"",
    payment_reminder: es ? "Recordatorio de pago" : "Payment reminder",
  }[kind];
}
