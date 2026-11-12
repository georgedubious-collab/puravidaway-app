/**
 * Customer profiles (/admin/customers), team only. Travellers have no accounts, so a customer is
 * every trip with the same email (lower-case, trimmed), or with no email the same phone digits,
 * or with neither, the single trip. The database does the grouping (customer_key() and
 * admin_customers(), migration 0046); customerKey() below is the same rule for links.
 *
 * Plain TypeScript without imports, so `npm run test:crm` runs it with Node.
 */

export const CUSTOMERS_PAGE_SIZE = 25;
export const TAG_MAX = 30;
export const TAGS_MAX = 12;
export const NOTE_MAX = 4000;

/** Mirrors public.customer_key() (migration 0046). */
export function customerKey(email: string | null | undefined, phone: string | null | undefined, tripId: string | null | undefined): string {
  const e = (email ?? "").trim();
  if (e) return e.toLowerCase();
  const d = (phone ?? "").replace(/\D/g, "");
  if (d) return `tel:${d}`;
  return `trip:${tripId ?? ""}`;
}

export function customerHref(key: string): string {
  return `/admin/customers/${encodeURIComponent(key)}`;
}

/** A key read back from the address: same shape as the database's check, else null. */
export function parseCustomerKey(raw: string): string | null {
  let k: string;
  try {
    k = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return k === k.trim().toLowerCase() && k.length >= 3 && k.length <= 340 ? k : null;
}

export interface CustomerFilters {
  q: string;
  sort: "last" | "spent";
  page: number;
}

/** Search text safe for the database function: letters, digits, spaces and @ . - _ + ' only. */
export function cleanCustomerSearch(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}\s@.\-_+']/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
}

export function parseCustomerFilters(p: Record<string, string | string[] | undefined>): CustomerFilters {
  const one = (k: string) => {
    const v = p[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const page = Number.parseInt(one("page"), 10);
  return {
    q: cleanCustomerSearch(one("q")),
    sort: one("sort") === "spent" ? "spent" : "last",
    page: Number.isFinite(page) && page >= 1 && page <= 10000 ? page : 1,
  };
}

export function customersHref(f: CustomerFilters, change: Partial<CustomerFilters> = {}, base = "/admin/customers"): string {
  const n = { ...f, ...change };
  const s = new URLSearchParams();
  if (n.q) s.set("q", n.q);
  if (n.sort !== "last") s.set("sort", n.sort);
  if (n.page > 1) s.set("page", String(n.page));
  const qs = s.toString();
  return qs ? `${base}?${qs}` : base;
}

/** "vip, early flyer, VIP ,," → ["vip", "early flyer"]: trimmed, ≤ 30 characters, ≤ 12, no duplicates (any case). */
export function cleanTags(raw: string): string[] {
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const t = part.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, TAG_MAX).trim();
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
    if (out.length >= TAGS_MAX) break;
  }
  return out;
}

export function isVip(tags: readonly string[] | null | undefined): boolean {
  return (tags ?? []).some((t) => t.toLowerCase() === "vip");
}

/** Repeat customer: two or more trips that weren't cancelled. */
export function isRepeat(c: { bookings: number; cancelled: number }): boolean {
  return c.bookings - c.cancelled >= 2;
}

const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
};

/** A pickup's Costa Rica calendar day with the year: "Nov 23, 2026" / "23 nov 2026"; "—" without one. */
export function tripDay(iso: string | null | undefined, lang: "es" | "en"): string {
  const ms = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ms)) return "—";
  const d = new Date(ms - 6 * 3_600_000); // Costa Rica: UTC−6, no daylight saving
  const m = MONTHS[lang][d.getUTCMonth()];
  return lang === "es" ? `${d.getUTCDate()} ${m} ${d.getUTCFullYear()}` : `${m} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
