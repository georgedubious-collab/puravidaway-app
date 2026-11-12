import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HUBS, bookedItemName } from "./catalog";
import { getCatalog } from "./catalogSource";
import { costaRicaTimestamp } from "./dates";
import type { ReportBooking, ReportRedemption, ReportRefund } from "./moneyReport";

/**
 * Reads what the money report adds up (rules: src/lib/moneyReport.ts) with the admin's own
 * session, so the database's admin-only rules apply. Bookings with a pickup between `from` and
 * `to` (Costa Rica days, inclusive), whatever their status; the maths decides what counts.
 */

export interface PeriodData {
  bookings: ReportBooking[];
  refunds: ReportRefund[];
  redemptions: ReportRedemption[];
  /** Driver id → name. */
  driverNames: Record<string, string>;
}

const COLUMNS =
  "id, booking_ref, service_type, status, scheduled_at, origin, destination, origin_coords, destination_coords, catalog_item_id, vehicle_class, payment_mode, total_price, cash_fee, amount_paid, driver_payout, company_costs, night_premium, pass_through, promo_code, promo_discount, assigned_driver_id, driver_settled_at";

type Raw = Omit<ReportBooking, "route" | "is_test"> & {
  origin: string | null;
  destination: string | null;
  origin_coords: { town?: string } | null;
  destination_coords: { town?: string } | null;
  catalog_item_id: string | null;
};

const PAGE = 1000;
const CHUNK = 150;

function chunks<T>(xs: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += CHUNK) out.push(xs.slice(i, i + CHUNK));
  return out;
}

const hubName = (id: string | undefined) => HUBS.find((h) => h.id === id)?.name;

export async function loadPeriod(db: SupabaseClient, from: string, to: string): Promise<{ data: PeriodData } | { error: string }> {
  const start = costaRicaTimestamp(from, "00:00");
  const [y, m, d] = to.split("-").map(Number);
  const end = costaRicaTimestamp(new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10), "00:00");
  const raw: Raw[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await db
      .from("bookings")
      .select(COLUMNS)
      .gte("scheduled_at", start)
      .lt("scheduled_at", end)
      .order("scheduled_at")
      .order("id")
      .range(page * PAGE, page * PAGE + PAGE - 1)
      .returns<Raw[]>();
    if (error) return { error: error.message };
    raw.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  const ids = raw.map((b) => b.id);
  const testIds = new Set<string>();
  const refunds: ReportRefund[] = [];
  const redemptions: ReportRedemption[] = [];
  for (const part of chunks(ids)) {
    const [pay, ref, red] = await Promise.all([
      db.from("payments").select("booking_id").eq("provider", "test").in("booking_id", part),
      db.from("booking_refunds").select("booking_id, amount_received, refund_due, refund_paid_amount").in("booking_id", part),
      db.from("promo_redemptions").select("booking_id, platform_part, driver_part").in("booking_id", part),
    ]);
    if (pay.error) return { error: pay.error.message };
    if (ref.error) return { error: ref.error.message };
    if (red.error) return { error: red.error.message };
    for (const p of pay.data ?? []) testIds.add(p.booking_id as string);
    refunds.push(...((ref.data ?? []) as ReportRefund[]));
    redemptions.push(...((red.data ?? []) as ReportRedemption[]));
  }
  const catalog = await getCatalog();
  const bookings: ReportBooking[] = raw.map((b) => {
    const route =
      b.service_type === "transfer"
        ? `${hubName(b.origin_coords?.town) ?? b.origin ?? "?"} → ${hubName(b.destination_coords?.town) ?? b.destination ?? "?"}`
        : (bookedItemName(catalog.dayTours, b.catalog_item_id) ?? b.catalog_item_id ?? b.service_type);
    return {
      id: b.id,
      booking_ref: b.booking_ref,
      service_type: b.service_type,
      status: b.status,
      scheduled_at: b.scheduled_at,
      route,
      vehicle_class: b.vehicle_class,
      payment_mode: b.payment_mode,
      total_price: b.total_price,
      cash_fee: b.cash_fee,
      amount_paid: b.amount_paid,
      driver_payout: b.driver_payout,
      company_costs: b.company_costs,
      night_premium: b.night_premium,
      pass_through: b.pass_through,
      promo_code: b.promo_code,
      promo_discount: b.promo_discount,
      assigned_driver_id: b.assigned_driver_id,
      driver_settled_at: b.driver_settled_at,
      is_test: testIds.has(b.id),
    };
  });
  const driverIds = [...new Set(bookings.map((b) => b.assigned_driver_id).filter((x): x is string => Boolean(x)))];
  const driverNames: Record<string, string> = {};
  for (const part of chunks(driverIds)) {
    const { data } = await db.from("profiles").select("id, full_name").in("id", part);
    for (const p of data ?? []) driverNames[p.id as string] = (p.full_name as string | null) ?? "—";
  }
  return { data: { bookings, refunds, redemptions, driverNames } };
}
