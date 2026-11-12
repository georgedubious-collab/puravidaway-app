/**
 * Cases for the admin's bookings list and CSV export (src/lib/adminBookings.ts): reading the
 * filters from the address, date windows in Costa Rica time, the search text, pagination,
 * links, payment chips, CSV cells and the panel's sums.
 *
 *   npm run test:admin        (Node 22.6+; Node runs the TypeScript directly)
 */
import * as a from "../src/lib/adminBookings.ts";

let passed = 0;
const failures = [];
const eq = (name, got, want) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) passed++;
  else failures.push(`${name}: expected ${w}, got ${g}`);
};

const TODAY = "2026-11-12"; // a Thursday
const f = (p) => a.parseBookingFilters(p);

// --- Filters from the address bar ---------------------------------------------------------------
eq("defaults", f({}), { q: "", status: "all", range: "upcoming", from: "", to: "", type: "all", driver: "all", sort: "asc", page: 1 });
eq("status tab", f({ status: "pending_bids" }).status, "pending_bids");
eq("unknown status falls back to all", f({ status: "deleted" }).status, "all");
eq("old 'open' links fall back to all", f({ status: "open" }).status, "all");
eq("range preset", f({ range: "7d" }).range, "7d");
eq("past sorts newest first", f({ range: "past" }).sort, "desc");
eq("all dates sorts newest first", f({ range: "all" }).sort, "desc");
eq("explicit sort wins", f({ range: "past", sort: "asc" }).sort, "asc");
eq("from/to make a custom range", f({ from: "2026-12-01", to: "2026-12-31", range: "today" }).range, "custom");
eq("swapped dates are put in order", [f({ from: "2026-12-31", to: "2026-12-01" }).from, f({ from: "2026-12-31", to: "2026-12-01" }).to], ["2026-12-01", "2026-12-31"]);
eq("impossible date ignored", f({ from: "2026-02-30" }).from, "");
eq("garbage date ignored", f({ from: "yesterday" }).range, "upcoming");
eq("type", f({ type: "day_tour" }).type, "day_tour");
eq("expeditions are not a list filter", f({ type: "expedition" }).type, "all");
eq("driver id kept (lower case)", f({ driver: "00000000-0000-0000-0000-00000000000D" }).driver, "00000000-0000-0000-0000-00000000000d");
eq("no driver yet", f({ driver: "none" }).driver, "none");
eq("bad driver ignored", f({ driver: "1 or 1=1" }).driver, "all");
eq("page", f({ page: "3" }).page, 3);
eq("page 0 → 1", f({ page: "0" }).page, 1);
eq("page -2 → 1", f({ page: "-2" }).page, 1);
eq("page text → 1", f({ page: "abc" }).page, 1);
eq("arrays take the first value", f({ status: ["confirmed", "cancelled"] }).status, "confirmed");

// --- Search text --------------------------------------------------------------------------------
eq("plain name kept", a.sanitizeSearch("  José   Pérez "), "José Pérez");
eq("email kept", a.sanitizeSearch("ana.o'neil+trip@example.com"), "ana.o'neil+trip@example.com");
eq("booking code kept", a.sanitizeSearch("CRPT-1061"), "CRPT-1061");
eq("filter syntax removed", a.sanitizeSearch('a,b)(c"*%\\:d'), "a b c d");
eq("search is capped at 80", a.sanitizeSearch("x".repeat(200)).length, 80);
eq("search read from the address", f({ q: " CRPT-10,61 " }).q, "CRPT-10 61");
eq("or filter: code only", a.searchOrFilter("CRPT-1061", [], []), 'booking_ref.ilike."*CRPT-1061*"');
const T1 = "40000000-0000-0000-0000-000000000001";
const D1 = "00000000-0000-0000-0000-00000000000d";
eq("or filter: code, trips, drivers", a.searchOrFilter("ana", [T1, T1, "nope"], [D1]),
  `booking_ref.ilike."*ana*",trip_id.in.(${T1}),assigned_driver_id.in.(${D1})`);
eq("or filter never lets a quote through", a.searchOrFilter('x"),status.eq.(cancelled', [], []).includes('"),'), false);

// --- Date windows (Costa Rica) -------------------------------------------------------------------
eq("upcoming = from today", a.dateWindow({ range: "upcoming", from: "", to: "" }, TODAY), { from: TODAY, to: "" });
eq("today", a.dateWindow({ range: "today", from: "", to: "" }, TODAY), { from: TODAY, to: TODAY });
eq("tomorrow", a.dateWindow({ range: "tomorrow", from: "", to: "" }, TODAY), { from: "2026-11-13", to: "2026-11-13" });
eq("7 days", a.dateWindow({ range: "7d", from: "", to: "" }, TODAY), { from: TODAY, to: "2026-11-18" });
eq("30 days crosses the month", a.dateWindow({ range: "30d", from: "", to: "" }, TODAY), { from: TODAY, to: "2026-12-11" });
eq("past = until yesterday", a.dateWindow({ range: "past", from: "", to: "" }, TODAY), { from: "", to: "2026-11-11" });
eq("all = no window", a.dateWindow({ range: "all", from: "", to: "" }, TODAY), { from: "", to: "" });
eq("bounds use Costa Rica midnight and the day after 'to'", a.windowBounds({ from: TODAY, to: TODAY }),
  { gte: "2026-11-12T00:00:00-06:00", lt: "2026-11-13T00:00:00-06:00" });
eq("year end", a.windowBounds({ from: "", to: "2026-12-31" }), { gte: null, lt: "2027-01-01T00:00:00-06:00" });

// --- Pagination ----------------------------------------------------------------------------------
eq("page 1 rows", a.pageRange(1), { from: 0, to: 24 });
eq("page 3 rows", a.pageRange(3), { from: 50, to: 74 });
eq("page count 186", a.pageCount(186), 8);
eq("page count 0", a.pageCount(0), 1);
eq("page count 25", a.pageCount(25), 1);
eq("span 1–25 of 186", a.pageSpan(1, 186), { first: 1, last: 25 });
eq("span last page", a.pageSpan(8, 186), { first: 176, last: 186 });
eq("span empty", a.pageSpan(1, 0), { first: 0, last: 0 });

// --- Links ---------------------------------------------------------------------------------------
const base = f({});
eq("plain list", a.bookingsHref(base), "/admin/bookings");
eq("next page keeps filters", a.bookingsHref(f({ q: "ana", status: "confirmed" }), { page: 2 }), "/admin/bookings?q=ana&status=confirmed&page=2");
eq("changing a filter goes back to page 1", a.bookingsHref(f({ page: "4" }), { status: "cancelled" }), "/admin/bookings?status=cancelled");
eq("preset drops custom dates", a.bookingsHref(f({ from: "2026-12-01", to: "2026-12-02" }), { range: "today" }), "/admin/bookings?range=today");
eq("custom dates in the link", a.bookingsHref(f({ from: "2026-12-01", to: "2026-12-02" })), "/admin/bookings?from=2026-12-01&to=2026-12-02");
eq("past uses its own default sort", a.bookingsHref(base, { range: "past" }), "/admin/bookings?range=past");
eq("non-default sort kept", a.bookingsHref(base, { sort: "desc" }), "/admin/bookings?sort=desc");
eq("search is encoded", a.bookingsHref(f({ q: "José Pérez" })), "/admin/bookings?q=Jos%C3%A9+P%C3%A9rez");
eq("export link takes the same filters", a.bookingsHref(f({ type: "transfer", driver: "none" }), {}, "/admin/bookings/export"),
  "/admin/bookings/export?type=transfer&driver=none");

// --- Chips ---------------------------------------------------------------------------------------
const bk = (o) => ({ status: "confirmed", total_price: 100, cash_fee: 0, amount_paid: 0, payment_mode: "full_100", ...o });
eq("paid in full", a.paymentState(bk({ amount_paid: 100 })), "paid");
eq("cash fee counts toward what is owed", a.paymentState(bk({ payment_mode: "cash_driver", cash_fee: 5, amount_paid: 100 })), "partial");
eq("cash, nothing received yet", a.paymentState(bk({ payment_mode: "cash_driver", cash_fee: 5 })), "cash");
eq("online, nothing received", a.paymentState(bk({})), "due");
eq("cancelled with money received → check refund", a.paymentState(bk({ status: "cancelled", amount_paid: 40 })), "refund");
eq("cancelled, nothing received", a.paymentState(bk({ status: "cancelled" })), "none");
eq("numbers as text", a.paymentState(bk({ total_price: "194.00", amount_paid: "194" })), "paid");
eq("status words es", a.statusShort("pending_bids", "es"), "Buscando conductor");
eq("status words en", a.statusShort("cancelled", "en"), "Cancelled");
eq("every status has a tone", a.LIST_STATUSES.every((s) => a.STATUS_TONE[s]), true);

// --- CSV -----------------------------------------------------------------------------------------
eq("plain cell", a.csvCell("Ana"), "Ana");
eq("empty", [a.csvCell(null), a.csvCell(undefined)], ["", ""]);
eq("number", a.csvCell(194.5), "194.5");
eq("comma is quoted", a.csvCell("SJO → La Fortuna, Arenal"), '"SJO → La Fortuna, Arenal"');
eq("quotes doubled", a.csvCell('Hotel "Tabacón"'), '"Hotel ""Tabacón"""');
eq("line break quoted", a.csvCell("line 1\nline 2"), '"line 1\nline 2"');
eq("formula neutralised", a.csvCell("=HYPERLINK(\"http://x\")"), `"'=HYPERLINK(""http://x"")"`);
eq("@ neutralised", a.csvCell("@SUM(A1)"), "'@SUM(A1)");
eq("+ formula neutralised", a.csvCell("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
eq("phone number kept as is", a.csvCell("+506 8888-0000"), "+506 8888-0000");
eq("phone with brackets kept", a.csvCell("+1 (555) 123-4567"), "+1 (555) 123-4567");
eq("negative amount kept", a.csvCell("-12.50"), "-12.50");
eq("accents untouched", a.csvCell("Ñandú, Limón"), '"Ñandú, Limón"');
const csv = a.toCsv([["Ref", "Nombre"], ["CRPT-1", "José"]]);
eq("CSV starts with the UTF-8 BOM", csv.charCodeAt(0), 0xfeff);
eq("CSV rows with CRLF", csv.slice(1), "Ref,Nombre\r\nCRPT-1,José\r\n");
eq("BOM encodes as EF BB BF", [...Buffer.from(csv, "utf8").subarray(0, 3)], [0xef, 0xbb, 0xbf]);
eq("file name", a.csvFileName(TODAY), "reservas-2026-11-12.csv");

// --- Panel sums ----------------------------------------------------------------------------------
eq("month bounds", a.monthBounds(TODAY), { start: "2026-11-01", next: "2026-12-01", prevStart: "2026-10-01" });
eq("January bounds", a.monthBounds("2027-01-05"), { start: "2027-01-01", next: "2027-02-01", prevStart: "2026-12-01" });
eq("+22%", a.pctChange(4820, 3950), 22);
eq("no last month → no %", a.pctChange(100, 0), null);
eq("week starts Monday", a.weekStart(TODAY), "2026-11-09");
eq("Sunday belongs to the week before", a.weekStart("2026-11-15"), "2026-11-09");
const weeks = a.weeklyCounts(["2026-11-12", "2026-11-09", "2026-11-08", "2026-09-01", "bad"], TODAY, 8);
eq("8 weeks", weeks.length, 8);
eq("this week last", weeks[7], { start: "2026-11-09", n: 2 });
eq("last week", weeks[6], { start: "2026-11-02", n: 1 });
eq("older dates dropped", weeks.reduce((n, w) => n + w.n, 0), 3);
eq("greeting morning", a.greeting(7, "es"), "Buenos días");
eq("greeting afternoon", a.greeting(15, "es"), "Buenas tardes");
eq("greeting night", a.greeting(22, "en"), "Good evening");

console.log(`${passed} checks passed, ${failures.length} failed`);
for (const x of failures) console.log("  ✗ " + x);
process.exit(failures.length ? 1 : 0);
