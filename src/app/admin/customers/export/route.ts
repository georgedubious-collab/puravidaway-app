import { NextResponse, type NextRequest } from "next/server";
import { toCsv } from "@/lib/adminBookings";
import { requireRole } from "@/lib/auth";
import { isRepeat, parseCustomerFilters } from "@/lib/customers";
import { customersPage } from "@/lib/customersServer";
import { scheduledParts, todayInCostaRica } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

/**
 * CSV of the customers list with the same search (admins only, read with the admin's own session
 * through the admin-only database function). Same rules as the bookings export: UTF-8 with a byte
 * order mark for Excel, every cell protected against spreadsheet formulas (toCsv), never card data.
 * The team's own working copy (docs/PROJECT.md §7.7): keep it private.
 */
export async function GET(req: NextRequest) {
  await requireRole("admin", "/admin/customers");
  const t = makeT(await getTeamLang());
  const f = parseCustomerFilters(Object.fromEntries(req.nextUrl.searchParams.entries()));
  const db = await createSupabaseServerClient();
  if (!db) return new NextResponse(t("La base de datos no está configurada.", "The database isn't set up."), { status: 503 });
  const { data, error } = await customersPage(db, f, true);
  if (error) {
    return new NextResponse(t("No se pudo preparar el archivo. Inténtelo de nuevo.", "Couldn't build the file. Please try again."), {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const day = (iso: string | null) => scheduledParts(iso)?.ymd ?? "";
  const header = [
    t("Nombre", "Name"),
    t("Correo", "Email"),
    t("Teléfono", "Phone"),
    t("Idioma", "Language"),
    t("Reservas", "Bookings"),
    t("Completados", "Completed"),
    t("Cancelados", "Cancelled"),
    t("Gastado (USD)", "Spent (USD)"),
    t("Primer viaje (CR)", "First trip (CR)"),
    t("Último viaje (CR)", "Last trip (CR)"),
    t("Calificación promedio dada", "Average rating given"),
    t("Repite", "Repeat"),
    "VIP",
    t("Etiquetas", "Tags"),
  ];
  const rows = data.map((c) => [
    c.name ?? "",
    c.email ?? "",
    c.phone ?? "",
    c.language ?? "",
    c.bookings,
    c.completed,
    c.cancelled,
    Number(c.total_spent).toFixed(2),
    day(c.first_trip),
    day(c.last_trip),
    c.avg_rating != null ? Number(c.avg_rating).toFixed(2) : "",
    isRepeat(c) ? t("sí", "yes") : "",
    c.vip ? t("sí", "yes") : "",
    c.tags.join(", "),
  ]);
  return new NextResponse(toCsv([header, ...rows]), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="clientes-${todayInCostaRica()}.csv"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
