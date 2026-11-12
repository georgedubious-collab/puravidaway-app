import { paymentModeLabel, usd, type BookingRow } from "@/lib/bookings";
import { formatScheduledAt } from "@/lib/dates";
import { statusShort } from "@/lib/adminBookings";
import { cancelledByText, refundMethodText, type CancelledBy } from "@/lib/refundPolicy";
import { makeT, type TeamLang } from "@/lib/teamLang";
import { waButtonLabel, type WaKind } from "@/lib/whatsappMessages";

export interface BookingEvent {
  id: string;
  at: string;
  actor_id: string | null;
  action: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

type Lookup = (id: unknown) => string | null;

/** One line of the change history in plain words, e.g. "Estado: Esperando pago → Confirmada". */
export function describeEvent(e: BookingEvent, lang: TeamLang, who: { driver: Lookup; vehicle: Lookup }): { title: string; detail?: string } {
  const t = makeT(lang);
  const b = e.before ?? {};
  const a = e.after ?? {};
  const money = (v: unknown) => (v === null || v === undefined ? "—" : usd(Number(v)));
  switch (e.action) {
    case "status":
      return { title: `${t("Estado", "Status")}: ${statusShort(String(b.status ?? "—"), lang)} → ${statusShort(String(a.status ?? "—"), lang)}` };
    case "assignment": {
      const name = (d: unknown, v: unknown) => (d ? `${who.driver(d) ?? t("Conductor", "Driver")}${v ? ` · ${who.vehicle(v) ?? t("vehículo", "vehicle")}` : ""}` : t("nadie", "nobody"));
      return { title: t("Conductor y vehículo", "Driver and vehicle"), detail: `${name(b.driver_id, b.vehicle_id)} → ${name(a.driver_id, a.vehicle_id)}` };
    }
    case "amount_paid":
      return { title: `${t("Monto recibido", "Amount received")}: ${money(b.amount_paid)} → ${money(a.amount_paid)}` };
    case "price": {
      const fee = Number(a.cash_fee ?? 0) !== Number(b.cash_fee ?? 0) ? ` · ${t("cargo por efectivo", "cash fee")} ${money(b.cash_fee)} → ${money(a.cash_fee)}` : "";
      return { title: `${t("Precio", "Price")}: ${money(b.total_price)} → ${money(a.total_price)}`, detail: fee ? fee.slice(3) : undefined };
    }
    case "payout":
      return { title: `${t("Pago al conductor", "Driver payout")}: ${money(b.driver_payout)} → ${money(a.driver_payout)}` };
    case "payment_mode":
      return {
        title: `${t("Forma de pago", "Payment mode")}: ${paymentModeLabel(b.payment_mode as BookingRow["payment_mode"], lang)} → ${paymentModeLabel(a.payment_mode as BookingRow["payment_mode"], lang)}`,
      };
    case "schedule":
      return {
        title: t("Hora de recogida cambiada", "Pickup time changed"),
        detail: `${formatScheduledAt(b.scheduled_at as string, lang) || "—"} → ${formatScheduledAt(a.scheduled_at as string, lang) || "—"}`,
      };
    case "settled":
      return { title: a.driver_settled_at ? t("Conductor liquidado (pago entregado)", "Driver settled (money changed hands)") : t("Liquidación deshecha", "Settlement undone") };
    case "sign": {
      const sign = (x: Record<string, unknown>) =>
        x.sign_text ? `“${String(x.sign_text)}”` : x.sign_hide_name ? t("sin nombre (marca)", "no name (brand)") : t("nombre e inicial", "first name + initial");
      return { title: t("Rótulo de recogida", "Name sign"), detail: `${sign(b)} → ${sign(a)}` };
    }
    case "notes":
      return { title: t("Notas internas editadas", "Internal notes edited"), detail: a.notes ? `“${String(a.notes)}”` : t("(vacías)", "(empty)") };
    case "created_by_team":
      return { title: t("Reserva ingresada por el equipo", "Booking entered by the team"), detail: a.source ? String(a.source) : undefined };
    case "trip_link_emailed":
      return { title: t("Enlace del viaje enviado al viajero por correo", "Trip link emailed to the traveller") };
    // CRM part 3 (migration 0049).
    case "cancellation":
      return {
        title: `${t("Cancelada por", "Cancelled by")}: ${cancelledByText(String(a.cancelled_by) as CancelledBy, lang)}`,
        detail: [
          `${t("Reembolso", "Refund")} ${money(a.refund_due)} ${t("de", "of")} ${money(a.amount_received)} ${t("recibidos", "received")}`,
          Number(a.refund_due) !== Number(a.refund_policy) ? `${t("la política daba", "policy gave")} ${money(a.refund_policy)}` : "",
          a.refund_reason ? `“${String(a.refund_reason)}”` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "refund":
      return {
        title: `${t("Reembolso cambiado", "Refund changed")}: ${money(b.refund_due)} → ${money(a.refund_due)}`,
        detail: a.refund_reason ? `“${String(a.refund_reason)}”` : undefined,
      };
    case "refund_paid":
      return a.amount
        ? { title: `${t("Reembolso pagado", "Refund paid")}: ${money(a.amount)}`, detail: `${String(a.on ?? "")} · ${refundMethodText(String(a.method ?? ""), lang)}` }
        : { title: t("Pago del reembolso deshecho", "Refund payment undone") };
    case "driver_removed":
      return {
        title: a.reason === "driver_dropped" ? t("El conductor se retiró del viaje", "The driver dropped out") : t("El equipo quitó al conductor", "The team removed the driver"),
        detail: `${who.driver(b.driver_id) ?? t("Conductor", "Driver")}${a.team_alerted ? ` · ${t("aviso al equipo por correo", "team alerted by email")}` : ""} · ${t("al viajero no se le avisó", "the traveller was not told")}`,
      };
    case "whatsapp_opened":
      return { title: `${t("WhatsApp abierto", "WhatsApp opened")}: ${waButtonLabel(String(a.kind) as WaKind, lang)}` };
    case "notified":
      return {
        title: t("Avisos de cancelación enviados", "Cancellation notices sent"),
        detail: [a.traveller ? t("viajero (correo)", "traveller (email)") : "", a.driver ? t("conductor (correo)", "driver (email)") : ""].filter(Boolean).join(" · ") || t("nadie", "nobody"),
      };
    default:
      return { title: e.action };
  }
}

/** The booking's change history, oldest first, starting with when it arrived. */
export function BookingTimeline({
  events,
  createdAt,
  lang,
  actorName,
  driverName,
  vehicleName,
}: {
  events: BookingEvent[];
  createdAt: string;
  lang: TeamLang;
  actorName: Lookup;
  driverName: Lookup;
  vehicleName: Lookup;
}) {
  const t = makeT(lang);
  const byTeam = events.some((e) => e.action === "created_by_team");
  const first = { title: byTeam ? null : t("Solicitud recibida del sitio web o la app", "Request received from the website or app") };
  return (
    <ol className="relative space-y-4 border-l-2 border-[#E3E8E5] pl-5">
      {first.title && (
        <Item at={createdAt} lang={lang} title={first.title} who={t("Viajero", "Traveller")} tone="grey" />
      )}
      {events.map((e) => {
        const d = describeEvent(e, lang, { driver: driverName, vehicle: vehicleName });
        const tone =
          (e.action === "status" && e.after?.status === "cancelled") || e.action === "cancellation" || e.action === "driver_removed"
            ? "red"
            : ["amount_paid", "price", "payout", "refund", "refund_paid"].includes(e.action)
              ? "amber"
              : "green";
        return (
          <Item
            key={e.id}
            at={e.at}
            lang={lang}
            title={d.title}
            detail={d.detail}
            who={actorName(e.actor_id) ?? t("Sistema o viajero", "System or traveller")}
            tone={tone}
          />
        );
      })}
    </ol>
  );
}

function Item({
  at,
  lang,
  title,
  detail,
  who,
  tone,
}: {
  at: string;
  lang: TeamLang;
  title: string;
  detail?: string;
  who: string;
  tone: "green" | "amber" | "red" | "grey";
}) {
  const dot = tone === "red" ? "bg-[#DC2626]" : tone === "amber" ? "bg-[#F59E0B]" : tone === "grey" ? "bg-[#94A3B8]" : "bg-[#047857]";
  return (
    <li className="relative">
      <span aria-hidden className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white ${dot}`} />
      <p className="text-sm font-bold text-[#14231C]">{title}</p>
      {detail && <p className="break-words text-sm text-[#33443C]">{detail}</p>}
      <p className="text-xs text-[#5F6F67]">
        <time dateTime={at}>{formatScheduledAt(at, lang)}</time> · {who}
      </p>
    </li>
  );
}
