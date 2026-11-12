import { NextResponse, type NextRequest } from "next/server";
import { csvFileName, parseBookingFilters, paymentLabel, paymentState, statusShort, toCsv } from "@/lib/adminBookings";
import { allBookings, searchIds } from "@/lib/adminBookingsServer";
import { bookingTitle, vehicleClassName } from "@/lib/adminDisplay";
import { requireRole } from "@/lib/auth";
import { bookingDue, paymentModeLabel, serviceLabel, type BookingRow, type TripContact } from "@/lib/bookings";
import { localizeCatalog } from "@/lib/catalogEs";
import { getCatalog } from "@/lib/catalogSource";
import { scheduledParts, todayInCostaRica } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

type Row = BookingRow & { trips: TripContact | null };

/**
 * CSV of the bookings list with the same filters (admins only, read with the admin's own
 * session, so RLS applies). Includes the traveller's name, email and phone: this is the team's
 * own export (docs/PROJECT.md §4.2 and §7.7). Never card data (bookings hold none).
 * UTF-8 with a byte order mark so Excel shows accents.
 */
export async function GET(req: NextRequest) {
  await requireRole("admin", "/admin/bookings");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const f = parseBookingFilters(Object.fromEntries(req.nextUrl.searchParams.entries()));
  const today = todayInCostaRica();
  const db = await createSupabaseServerClient();
  if (!db) return new NextResponse(t("La base de datos no está configurada.", "The database isn't set up."), { status: 503 });

  const ids = await searchIds(db, f.q);
  const [{ data, error }, rawCatalog] = await Promise.all([
    allBookings<Row>(db, "*, trips(guest_name, guest_email, guest_phone)", f, today, ids),
    getCatalog(),
  ]);
  if (error) {
    return new NextResponse(t("No se pudo preparar el archivo. Inténtelo de nuevo.", "Couldn't build the file. Please try again."), {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const catalog = localizeCatalog(rawCatalog, lang);
  const driverIds = [...new Set(data.map((b) => b.assigned_driver_id).filter((x): x is string => Boolean(x)))];
  const { data: names } = driverIds.length
    ? await db.from("profiles").select("id, full_name").in("id", driverIds)
    : { data: [] as { id: string; full_name: string | null }[] };

  const header = [
    t("Reserva", "Booking"),
    t("Fecha de recogida (CR)", "Pickup date (CR)"),
    t("Hora de recogida (CR)", "Pickup time (CR)"),
    t("Servicio", "Service"),
    t("Ruta / tour", "Route / tour"),
    t("Pasajeros", "Passengers"),
    t("Clase de vehículo", "Vehicle class"),
    t("Conductor", "Driver"),
    t("Precio (USD)", "Price (USD)"),
    t("Cargo por efectivo (USD)", "Cash fee (USD)"),
    t("Total a cobrar (USD)", "Total due (USD)"),
    t("Monto recibido (USD)", "Amount received (USD)"),
    t("Modo de pago", "Payment mode"),
    t("Estado del pago", "Payment status"),
    t("Estado de la reserva", "Booking status"),
    t("Viajero", "Traveller"),
    t("Correo", "Email"),
    t("Teléfono", "Phone"),
    t("Recibida (UTC)", "Received (UTC)"),
  ];
  const money = (n: number | string | null | undefined) => Number(n ?? 0).toFixed(2);
  const rows = data.map((b) => {
    const when = scheduledParts(b.scheduled_at);
    return [
      b.booking_ref,
      when?.ymd ?? "",
      when?.time ?? "",
      serviceLabel(b.service_type, lang),
      bookingTitle(b, catalog, lang, false),
      b.passenger_count ?? "",
      b.service_type === "transfer" ? vehicleClassName(b.vehicle_class, catalog, lang) : "",
      b.assigned_driver_id ? (names?.find((p) => p.id === b.assigned_driver_id)?.full_name ?? "") : "",
      money(b.total_price),
      money(b.cash_fee),
      money(bookingDue(b)),
      money(b.amount_paid),
      paymentModeLabel(b.payment_mode, lang),
      paymentLabel(paymentState(b), lang),
      statusShort(b.status, lang),
      b.trips?.guest_name ?? "",
      b.trips?.guest_email ?? "",
      b.trips?.guest_phone ?? "",
      b.created_at.slice(0, 16).replace("T", " "),
    ];
  });

  return new NextResponse(toCsv([header, ...rows]), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${csvFileName(today)}"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
