/**
 * The admin's bookings list (/admin/bookings) and its CSV export, as plain functions with no
 * imports so `npm run test:admin` can check them: reading the filters from the address bar,
 * the date windows (Costa Rica time), the search text, pagination, the links between pages,
 * the status and payment chips, the CSV cells and the panel's small sums.
 *
 * Costa Rica is UTC−6 all year (no daylight saving), as in src/lib/dates.ts.
 */

export const PAGE_SIZE = 25;

export const LIST_STATUSES = ["pending_payment", "pending_bids", "confirmed", "in_progress", "completed", "cancelled"] as const;
export type ListStatus = (typeof LIST_STATUSES)[number];
/**
 * "Por atender" on the phone (2026-11-13): the same bookings the side menu's Reservas badge counts
 * (src/lib/adminCounts.ts, bookingsToAct): new requests and bookings open for drivers.
 */
export const TO_ACT_STATUSES = ["pending_payment", "pending_bids"] as const;
export type StatusFilter = ListStatus | "all" | "to_act";

export const RANGES = ["upcoming", "today", "tomorrow", "7d", "30d", "past", "all", "custom"] as const;
export type RangeId = (typeof RANGES)[number];

export interface BookingFilters {
  /** Search text, already cleaned (sanitizeSearch). Empty = no search. */
  q: string;
  status: StatusFilter;
  range: RangeId;
  /** Custom range (YYYY-MM-DD, inclusive); only used when range = "custom". */
  from: string;
  to: string;
  type: "all" | "transfer" | "day_tour";
  /** A driver's id, "none" (no driver yet) or "all". */
  driver: string;
  sort: "asc" | "desc";
  page: number;
}

type Params = Record<string, string | string[] | undefined>;

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function one(p: Params, k: string): string {
  const v = p[k];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function isYmd(s: string): boolean {
  if (!YMD.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Add whole days to YYYY-MM-DD (no time zones involved). */
export function plusDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Search text safe to put in a database filter: letters (any language), digits, spaces and
 * @ . - _ + ' only, at most 80 characters. Commas, brackets, quotes and wildcards are removed,
 * so a search can never change the shape of the query.
 */
export function sanitizeSearch(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}\s@.\-_+']/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
}

/** Default sort: upcoming windows oldest-first (next pickup on top); past and "all" newest-first. */
export function defaultSort(range: RangeId): "asc" | "desc" {
  return range === "past" || range === "all" ? "desc" : "asc";
}

/** Read the list's filters from the page address; anything unknown falls back to the default. */
export function parseBookingFilters(p: Params): BookingFilters {
  const q = sanitizeSearch(one(p, "q"));
  const s = one(p, "status");
  const status: StatusFilter = (LIST_STATUSES as readonly string[]).includes(s) ? (s as ListStatus) : s === "to_act" ? "to_act" : "all";
  let from = one(p, "from");
  let to = one(p, "to");
  from = isYmd(from) ? from : "";
  to = isYmd(to) ? to : "";
  if (from && to && from > to) [from, to] = [to, from];
  // A preset picked in the list ("Hoy", "Próximos 7 días") wins over dates left in the boxes;
  // dates alone (or "Fechas exactas") make a custom range.
  const r = one(p, "range");
  const preset = (RANGES as readonly string[]).includes(r) && r !== "custom" ? (r as RangeId) : null;
  let range: RangeId = preset ?? (from || to ? "custom" : "upcoming");
  // A search looks through every date unless a narrower window was picked.
  if (q && range === "upcoming") range = "all";
  if (range !== "custom") {
    from = "";
    to = "";
  }
  const ty = one(p, "type");
  const type = ty === "transfer" || ty === "day_tour" ? ty : "all";
  const d = one(p, "driver");
  const driver = d === "none" || UUID.test(d) ? d.toLowerCase() : "all";
  const so = one(p, "sort");
  const sort = so === "asc" || so === "desc" ? so : defaultSort(range);
  const pg = Number.parseInt(one(p, "page"), 10);
  const page = Number.isFinite(pg) && pg >= 1 && pg <= 100000 ? pg : 1;
  return { q, status, range, from, to, type, driver, sort, page };
}

/** The pickup-date window of a range, as Costa Rica calendar days (inclusive). Empty side = open. */
export function dateWindow(f: Pick<BookingFilters, "range" | "from" | "to">, today: string): { from: string; to: string } {
  switch (f.range) {
    case "today":
      return { from: today, to: today };
    case "tomorrow":
      return { from: plusDays(today, 1), to: plusDays(today, 1) };
    case "7d":
      return { from: today, to: plusDays(today, 6) };
    case "30d":
      return { from: today, to: plusDays(today, 29) };
    case "past":
      return { from: "", to: plusDays(today, -1) };
    case "all":
      return { from: "", to: "" };
    case "custom":
      return { from: f.from, to: f.to };
    default:
      return { from: today, to: "" };
  }
}

/** Midnight that starts a Costa Rica day, as a timestamp the database compares against. */
export function crDayStart(ymd: string): string {
  return `${ymd}T00:00:00-06:00`;
}

/** Window as timestamps: scheduled_at >= gte and < lt (lt = the day after "to"). */
export function windowBounds(w: { from: string; to: string }): { gte: string | null; lt: string | null } {
  return { gte: w.from ? crDayStart(w.from) : null, lt: w.to ? crDayStart(plusDays(w.to, 1)) : null };
}

/** Rows to ask for on a page (inclusive, as the database's range() takes them). */
export function pageRange(page: number, size = PAGE_SIZE): { from: number; to: number } {
  const p = Math.max(1, Math.floor(page));
  return { from: (p - 1) * size, to: p * size - 1 };
}

export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / size));
}

/** "1–25 of 186" numbers for a page; 0–0 when empty. */
export function pageSpan(page: number, total: number, size = PAGE_SIZE): { first: number; last: number } {
  if (total <= 0) return { first: 0, last: 0 };
  const { from } = pageRange(page, size);
  return { first: Math.min(from + 1, total), last: Math.min(from + size, total) };
}

/**
 * The search as one OR filter: the booking code, or a trip whose traveller's name/email matched,
 * or a driver whose name matched (those ids are looked up first). The text is quoted.
 */
export function searchOrFilter(q: string, tripIds: string[], driverIds: string[]): string {
  const clean = sanitizeSearch(q);
  const parts = [`booking_ref.ilike."*${clean}*"`];
  const ids = (xs: string[]) => [...new Set(xs.filter((x) => UUID.test(x)))].slice(0, 200);
  const t = ids(tripIds);
  const d = ids(driverIds);
  if (t.length) parts.push(`trip_id.in.(${t.join(",")})`);
  if (d.length) parts.push(`assigned_driver_id.in.(${d.join(",")})`);
  return parts.join(",");
}

/** Link to the list with some filters changed. Changing anything but the page goes back to page 1. */
export function bookingsHref(f: BookingFilters, change: Partial<BookingFilters> = {}, base = "/admin/bookings"): string {
  const n: BookingFilters = { ...f, ...change };
  if (!("page" in change)) n.page = 1;
  if ("range" in change && change.range !== "custom") {
    n.from = "";
    n.to = "";
  }
  if ("range" in change && !("sort" in change)) n.sort = defaultSort(n.range);
  const p = new URLSearchParams();
  if (n.q) p.set("q", n.q);
  if (n.status !== "all") p.set("status", n.status);
  if (n.range === "custom") {
    if (n.from) p.set("from", n.from);
    if (n.to) p.set("to", n.to);
  } else if (n.range !== "upcoming") p.set("range", n.range);
  if (n.type !== "all") p.set("type", n.type);
  if (n.driver !== "all") p.set("driver", n.driver);
  if (n.sort !== defaultSort(n.range)) p.set("sort", n.sort);
  if (n.page > 1) p.set("page", String(n.page));
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

/* ---------- Phone quick filters (2026-11-13) ---------- */

export const PHONE_FILTERS = ["to_act", "today", "upcoming", "all"] as const;
export type PhoneFilter = (typeof PHONE_FILTERS)[number];

/**
 * The four chips above the phone's booking cards, as links onto the list's own filters:
 *   Por atender = status to_act, every date, soonest first (the side menu's badge);
 *   Hoy = range today; Próximas = the default (from today); Todas = range all.
 * A quick filter starts clean: other filters and the search are dropped.
 */
export function phoneFilterHref(id: PhoneFilter, base = "/admin/bookings"): string {
  const clean = parseBookingFilters({});
  const change: Partial<BookingFilters> =
    id === "to_act" ? { status: "to_act", range: "all", sort: "asc" } : id === "today" ? { range: "today" } : id === "all" ? { range: "all" } : {};
  return bookingsHref(clean, change, base);
}

/** Which quick filter the current list is, or null (a search or other filters are in use). */
export function activePhoneFilter(f: BookingFilters): PhoneFilter | null {
  if (f.q || f.type !== "all" || f.driver !== "all") return null;
  if (f.status === "to_act") return f.range === "all" ? "to_act" : null;
  if (f.status !== "all") return null;
  return f.range === "today" ? "today" : f.range === "upcoming" ? "upcoming" : f.range === "all" ? "all" : null;
}

/* ---------- Chips ---------- */

export type Tone = "green" | "amber" | "orange" | "blue" | "grey" | "red";

export const STATUS_TONE: Record<string, Tone> = {
  pending_payment: "orange",
  pending_bids: "amber",
  confirmed: "green",
  in_progress: "blue",
  completed: "grey",
  cancelled: "red",
};

const STATUS_SHORT: Record<string, [string, string]> = {
  pending_payment: ["Esperando pago", "Awaiting payment"],
  pending_bids: ["Buscando conductor", "Finding a driver"],
  confirmed: ["Confirmada", "Confirmed"],
  in_progress: ["En ruta", "On the road"],
  completed: ["Completada", "Completed"],
  cancelled: ["Cancelada", "Cancelled"],
};

/** The money fields that tell a paid new request from one still waiting for payment. */
export interface PaidFields {
  total_price?: number | string | null;
  cash_fee?: number | string | null;
  amount_paid?: number | string | null;
  payment_mode?: string | null;
}

/**
 * A new request (pending_payment) whose money is all in: amount received ≥ price + cash fee, the
 * same rule as the "Pagado" payment chip (paymentState). Test checkouts count: they record the
 * amount like a real payment (src/lib/testCheckout.ts) and carry their own "PRUEBA" chip.
 */
export function isPaidRequest(status: string, b: PaidFields | null | undefined): boolean {
  if (status !== "pending_payment" || !b || b.total_price == null) return false;
  return (
    paymentState({ status, total_price: b.total_price, cash_fee: b.cash_fee, amount_paid: b.amount_paid ?? 0, payment_mode: b.payment_mode ?? null }) === "paid"
  );
}

/**
 * The admin's status chip words and colour. A paid new request says "Solicitud nueva · pagada"
 * (green) instead of "Esperando pago" (Jorge, 2026-11-13). Team only: travellers' texts unchanged.
 */
export function statusView(status: string, lang: "es" | "en", b?: PaidFields | null): { label: string; tone: Tone } {
  if (isPaidRequest(status, b)) return { label: lang === "en" ? "New request · paid" : "Solicitud nueva · pagada", tone: "green" };
  return { label: statusShort(status, lang), tone: STATUS_TONE[status] ?? "grey" };
}

/** Short status words for chips and tabs. */
export function statusShort(status: string, lang: "es" | "en"): string {
  const s = STATUS_SHORT[status];
  return s ? s[lang === "en" ? 1 : 0] : status;
}

export type PaymentState = "paid" | "partial" | "cash" | "due" | "refund" | "none";

/**
 * Where the money stands on one booking, from what is stored: amount received vs what the
 * traveller owes (price + cash fee). A cancelled booking with money received is "refund"
 * (check whether it was refunded); cash bookings with nothing received yet are "cash".
 */
export function paymentState(b: {
  status: string;
  total_price: number | string;
  cash_fee?: number | string | null;
  amount_paid: number | string | null;
  payment_mode: string | null;
}): PaymentState {
  const due = Math.round((Number(b.total_price) + Number(b.cash_fee ?? 0)) * 100);
  const paid = Math.round(Number(b.amount_paid ?? 0) * 100);
  if (b.status === "cancelled") return paid > 0 ? "refund" : "none";
  if (due > 0 && paid >= due) return "paid";
  if (paid > 0) return "partial";
  if (b.payment_mode === "cash_driver") return "cash";
  return "due";
}

export const PAYMENT_TONE: Record<PaymentState, Tone> = {
  paid: "green",
  partial: "amber",
  cash: "grey",
  due: "orange",
  refund: "red",
  none: "grey",
};

const PAYMENT_LABEL: Record<PaymentState, [string, string]> = {
  paid: ["Pagado", "Paid"],
  partial: ["Pago parcial", "Part paid"],
  cash: ["Efectivo al conductor", "Cash to driver"],
  due: ["Pendiente", "Due"],
  refund: ["Revisar reembolso", "Check refund"],
  none: ["Sin pago", "No payment"],
};

export function paymentLabel(s: PaymentState, lang: "es" | "en"): string {
  return PAYMENT_LABEL[s][lang === "en" ? 1 : 0];
}

/* ---------- CSV ---------- */

/**
 * One CSV cell: quoted when it holds a comma, quote or line break (quotes doubled). Text that a
 * spreadsheet would run as a formula (starts with = + - @, tab or return) gets a leading
 * apostrophe, except plain numbers and phone numbers like "+506 8888 0000" or "-12.50".
 */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?[\d\s().-]+$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows to CSV text, Windows line ends, with a UTF-8 byte order mark so Excel shows accents (á, ñ, ₡). */
export function toCsv(rows: unknown[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** File name for an export made on a Costa Rica date. */
export function csvFileName(today: string): string {
  return `reservas-${today}.csv`;
}

/* ---------- Panel (dashboard) sums ---------- */

/** First and last day of the Costa Rica calendar month of `today`, and of the month before. */
export function monthBounds(today: string): { start: string; next: string; prevStart: string } {
  const [y, m] = today.split("-").map(Number);
  const iso = (yy: number, mm: number) => new Date(Date.UTC(yy, mm - 1, 1)).toISOString().slice(0, 10);
  return { start: iso(y, m), next: iso(y, m + 1), prevStart: iso(y, m - 1) };
}

/** Percentage change, rounded; null when there is nothing to compare with. */
export function pctChange(now: number, before: number): number | null {
  if (!Number.isFinite(now) || !Number.isFinite(before) || before <= 0) return null;
  return Math.round(((now - before) / before) * 100);
}

/** Monday of the week that holds `ymd`. */
export function weekStart(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return plusDays(ymd, -((dow + 6) % 7));
}

/** Count Costa Rica dates into the last `weeks` weeks (Monday-start), oldest first; this week last. */
export function weeklyCounts(dates: string[], today: string, weeks = 8): { start: string; n: number }[] {
  const last = weekStart(today);
  const out = Array.from({ length: weeks }, (_, i) => ({ start: plusDays(last, -7 * (weeks - 1 - i)), n: 0 }));
  for (const d of dates) {
    if (!isYmd(d)) continue;
    const ws = weekStart(d);
    const slot = out.find((w) => w.start === ws);
    if (slot) slot.n++;
  }
  return out;
}

/** "Buenos días" / "Buenas tardes" / "Buenas noches" by the Costa Rica hour (0–23). */
export function greeting(hour: number, lang: "es" | "en"): string {
  if (hour >= 5 && hour < 12) return lang === "en" ? "Good morning" : "Buenos días";
  if (hour >= 12 && hour < 19) return lang === "en" ? "Good afternoon" : "Buenas tardes";
  return lang === "en" ? "Good evening" : "Buenas noches";
}
