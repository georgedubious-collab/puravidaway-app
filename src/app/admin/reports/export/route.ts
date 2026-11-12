import { NextResponse, type NextRequest } from "next/server";
import { toCsv } from "@/lib/adminBookings";
import { requireRole } from "@/lib/auth";
import { scheduledParts, todayInCostaRica } from "@/lib/dates";
import { bookingMoney, exclusion, parseReportPeriod } from "@/lib/moneyReport";
import { loadPeriod } from "@/lib/moneyReportServer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

/**
 * CSV of the money report: one line per booking with a pickup in the period (every status, with
 * the reason when it isn't in the totals), the same numbers the page adds up (src/lib/moneyReport.ts).
 * Admins only, read with the admin's own session. Same rules as the bookings export: UTF-8 with a
 * byte order mark for Excel, every cell protected against spreadsheet formulas (toCsv). No
 * traveller names, emails or phone numbers, never card data.
 */
export async function GET(req: NextRequest) {
  await requireRole("admin", "/admin/reports");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const period = parseReportPeriod(Object.fromEntries(req.nextUrl.searchParams.entries()), todayInCostaRica());
  const db = await createSupabaseServerClient();
  if (!db) return new NextResponse(t("La base de datos no está configurada.", "The database isn't set up."), { status: 503 });
  const res = await loadPeriod(db, period.from, period.to);
  if ("error" in res) {
    return new NextResponse(t("No se pudo preparar el archivo. Inténtelo de nuevo.", "Couldn't build the file. Please try again."), {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const { bookings, redemptions, refunds, driverNames } = res.data;
  const red = new Map(redemptions.map((r) => [r.booking_id, r]));
  const ref = new Map(refunds.map((r) => [r.booking_id, r]));
  const usd = (cents: number | null) => (cents == null ? "" : (cents / 100).toFixed(2));
  const header = [
    t("Referencia", "Reference"),
    t("Recogida (CR)", "Pickup (CR)"),
    t("Estado", "Status"),
    t("En los totales", "In the totals"),
    t("Servicio", "Service"),
    t("Ruta o tour", "Route or tour"),
    t("Vehículo", "Vehicle"),
    t("Pago", "Payment"),
    t("Precio antes del descuento (USD)", "Price before discount (USD)"),
    t("Código promocional", "Promo code"),
    t("Descuento (USD)", "Discount (USD)"),
    t("Descuento: nuestra parte", "Discount: our part"),
    t("Descuento: parte del conductor", "Discount: driver's part"),
    t("Precio (USD)", "Price (USD)"),
    t("Cargo por efectivo", "Cash booking fee"),
    t("Reservado", "Booked"),
    t("Recargo nocturno", "Night premium"),
    t("Ferris", "Ferries"),
    t("Costos de la empresa", "Company costs"),
    t("Pago al conductor", "Driver payout"),
    t("Nuestra parte", "Our share"),
    t("Recibido en línea", "Received online"),
    t("Efectivo cobrado por el conductor", "Cash collected by driver"),
    t("Pendiente", "Outstanding"),
    t("Liquidación (+ le debemos / − nos debe)", "Settlement (+ we owe / − owes us)"),
    t("Liquidado", "Settled"),
    t("Conductor", "Driver"),
    t("Reembolso debido", "Refund owed"),
    t("Reembolso pagado", "Refund paid"),
  ];
  const rows = bookings.map((b) => {
    const why = exclusion(b);
    const m = bookingMoney(b, red.get(b.id));
    const f = ref.get(b.id);
    return [
      b.booking_ref,
      scheduledParts(b.scheduled_at)?.ymd ?? "",
      b.status,
      why === "test" ? t("no: prueba", "no: test") : why === "cancelled" ? t("no: cancelada", "no: cancelled") : t("sí", "yes"),
      b.service_type,
      b.route,
      b.vehicle_class ?? "",
      b.payment_mode ?? "",
      usd(m.listCents),
      b.promo_code ?? "",
      usd(m.discountCents),
      usd(m.discountPlatformCents),
      usd(m.discountDriverCents),
      usd(m.bookedCents - m.cashFeeCents),
      usd(m.cashFeeCents),
      usd(m.bookedCents),
      usd(m.nightCents),
      b.pass_through == null ? "" : usd(m.passThroughCents),
      usd(m.companyCostCents),
      usd(m.payoutCents),
      usd(m.platformCents),
      usd(m.onlineCents),
      usd(m.cashCents),
      usd(m.outstandingCents),
      usd(m.settlementCents),
      b.driver_settled_at ? t("sí", "yes") : "",
      b.assigned_driver_id ? (driverNames[b.assigned_driver_id] ?? "") : "",
      f ? Number(f.refund_due).toFixed(2) : "",
      f && f.refund_paid_amount != null ? Number(f.refund_paid_amount).toFixed(2) : "",
    ];
  });
  return new NextResponse(toCsv([header, ...rows]), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${t("informe", "report")}-${period.from}-${period.to}.csv"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
