import "server-only";
import { CUSTOMERS_PAGE_SIZE, type CustomerFilters } from "./customers";
import type { createSupabaseServerClient } from "./supabase/server";

type Db = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

/** One row of public.admin_customers() (migration 0049). */
export interface CustomerRow {
  customer_key: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  language: string | null;
  bookings: number;
  completed: number;
  cancelled: number;
  total_spent: number | string;
  first_trip: string | null;
  last_trip: string | null;
  avg_rating: number | string | null;
  ratings: number;
  tags: string[];
  vip: boolean;
  total_count: number;
}

/**
 * Customers through the admin-only database function, read with the admin's own session (it
 * returns nothing for anyone else). `limit` 0 = all of them (CSV).
 */
export async function customersPage(db: Db, f: CustomerFilters, all = false) {
  const res = await db.rpc("admin_customers", {
    p_q: f.q || null,
    p_key: null,
    p_sort: f.sort,
    p_limit: all ? 0 : CUSTOMERS_PAGE_SIZE,
    p_offset: all ? 0 : (f.page - 1) * CUSTOMERS_PAGE_SIZE,
  });
  const data = (res.data ?? []) as CustomerRow[];
  return { data, error: res.error, total: Number(data[0]?.total_count ?? 0) };
}

export async function customerByKey(db: Db, key: string) {
  const res = await db.rpc("admin_customers", { p_q: null, p_key: key, p_sort: "last", p_limit: 1, p_offset: 0 });
  return { data: ((res.data ?? []) as CustomerRow[])[0] ?? null, error: res.error };
}

export async function customerTripIds(db: Db, key: string): Promise<string[]> {
  const res = await db.rpc("admin_customer_trips", { p_key: key });
  return ((res.data ?? []) as unknown[]).map((x) => (typeof x === "string" ? x : String((x as Record<string, unknown>).admin_customer_trips ?? ""))).filter(Boolean);
}
