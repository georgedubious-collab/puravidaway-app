/**
 * Cases for the single rating reminder and for what counts as a rating
 * (src/lib/reviewReminder.ts, used by /api/cron/review-reminders and by the
 * rating form on the trip page and in the app).
 *
 *   npm run test:reviews        (Node 22.6+; Node runs the TypeScript directly)
 *
 * The rules (Jorge, 2026-11-11): the traveller is asked as soon as the trip ends. If they
 * haven't rated 24 hours later they get ONE reminder, never a second one, and never between
 * 9 PM and 7 AM Costa Rica time (it waits for the first check after 7 AM). A rating is
 * 1–5 stars; the words are optional.
 */
import { registerHooks } from "node:module";

// The app's files import each other without ".ts"; add it for Node.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const r = await import("../src/lib/reviewReminder.ts");
const { hasContactDetails } = await import("../src/lib/preferences.ts");
const msg = await import("../src/lib/travellerMessages.ts");

let passed = 0;
const failures = [];
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) passed++;
  else failures.push(`${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};

const H = 3600 * 1000;
/** Midday in Costa Rica (18:00 UTC): not a quiet hour. */
const NOON = new Date("2026-11-20T18:00:00Z");
const ago = (now, hours) => new Date(now.getTime() - hours * H).toISOString();
const booking = (id, now, hours, o = {}) => ({ id, status: "completed", review_requested_at: ago(now, hours), review_reminded_at: null, ...o });

check("the reminder waits 24 hours", r.REMINDER_AFTER_HOURS, 24);

// --- 1. Who is due.
check("completed 23 h ago: not reminded", r.planReviewReminders(NOON, [booking("a", NOON, 23)], []), { quiet: false, markOnly: [], remind: [] });
check("completed 23 h 59 min ago: not reminded", r.planReviewReminders(NOON, [booking("a", NOON, 23 + 59 / 60)], []).remind, []);
check("completed exactly 24 h ago: reminded", r.planReviewReminders(NOON, [booking("a", NOON, 24)], []).remind, ["a"]);
check("completed 25 h ago: reminded", r.planReviewReminders(NOON, [booking("a", NOON, 25)], []), { quiet: false, markOnly: [], remind: ["a"] });
check("completed 5 days ago and never reminded: reminded", r.planReviewReminders(NOON, [booking("a", NOON, 120)], []).remind, ["a"]);
check("already rated: skipped and marked", r.planReviewReminders(NOON, [booking("a", NOON, 25)], ["a"]), { quiet: false, markOnly: ["a"], remind: [] });
check("rated less than 24 h after the trip: nothing to do yet", r.planReviewReminders(NOON, [booking("a", NOON, 3)], ["a"]), { quiet: false, markOnly: [], remind: [] });
check("already reminded: never again", r.planReviewReminders(NOON, [booking("a", NOON, 25, { review_reminded_at: ago(NOON, 1) })], []), { quiet: false, markOnly: [], remind: [] });
check("already reminded weeks ago: never again", r.planReviewReminders(NOON, [booking("a", NOON, 700, { review_reminded_at: ago(NOON, 676) })], []).remind, []);
check("never asked (no email on the trip): not reminded", r.planReviewReminders(NOON, [booking("a", NOON, 25, { review_requested_at: null })], []).remind, []);
check("not completed: not reminded", r.planReviewReminders(NOON, [booking("a", NOON, 25, { status: "cancelled" })], []).remind, []);
check(
  "a mixed batch",
  r.planReviewReminders(NOON, [booking("early", NOON, 23), booking("due", NOON, 25), booking("rated", NOON, 30), booking("done", NOON, 40, { review_reminded_at: ago(NOON, 10) })], ["rated"]),
  { quiet: false, markOnly: ["rated"], remind: ["due"] },
);

// --- 2. Exactly once: what the job does with the plan, run again and again.
{
  const rows = [booking("a", NOON, 25), booking("b", NOON, 26), booking("c", NOON, 30)];
  const sentTo = [];
  const run = (now, ratedIds) => {
    const plan = r.planReviewReminders(now, rows, ratedIds);
    for (const id of [...plan.markOnly, ...plan.remind]) {
      const row = rows.find((x) => x.id === id);
      if (row.review_reminded_at) continue; // the job only sends when its own update marked the row
      row.review_reminded_at = now.toISOString();
      if (plan.remind.includes(id)) sentTo.push(id);
    }
  };
  run(NOON, ["c"]);
  check("first check: one reminder each, none for the rated trip", sentTo, ["a", "b"]);
  run(new Date(NOON.getTime() + H), ["c"]);
  run(new Date(NOON.getTime() + 24 * H), ["c"]);
  run(new Date(NOON.getTime() + 21 * 24 * H), ["c"]);
  check("an hour, a day and three weeks later: still one reminder each", sentTo, ["a", "b"]);
  check("the rated trip is marked so it never comes up again", Boolean(rows[2].review_reminded_at), true);
}

// --- 3. Quiet hours: 9 PM up to, not including, 7 AM Costa Rica time (UTC−6).
for (const [utc, crHour, quiet] of [
  ["2026-11-21T02:59:00Z", 20, false], // 8:59 PM
  ["2026-11-21T03:00:00Z", 21, true], // 9:00 PM
  ["2026-11-21T05:30:00Z", 23, true],
  ["2026-11-21T06:00:00Z", 0, true], // midnight
  ["2026-11-21T09:00:00Z", 3, true],
  ["2026-11-21T12:59:00Z", 6, true], // 6:59 AM
  ["2026-11-21T13:00:00Z", 7, false], // 7:00 AM
  ["2026-11-21T15:00:00Z", 9, false], // the daily Vercel backstop
  ["2026-11-21T18:00:00Z", 12, false],
]) {
  const now = new Date(utc);
  check(`Costa Rica hour at ${utc}`, r.costaRicaHour(now), crHour);
  check(`quiet at ${utc}`, r.isQuietHour(now), quiet);
}
{
  const night = new Date("2026-11-21T05:30:00Z"); // 11:30 PM in Costa Rica
  const rows = [booking("due", night, 25), booking("rated", night, 25)];
  check("due at night: nothing is sent, the rated one is still marked", r.planReviewReminders(night, rows, ["rated"]), { quiet: true, markOnly: ["rated"], remind: [] });
  const morning = new Date("2026-11-21T13:07:00Z"); // 7:07 AM, the first hourly check of the day
  check("the first check after 7 AM sends it", r.planReviewReminders(morning, rows, ["rated"]).remind, ["due"]);
  const lateEvening = new Date("2026-11-21T02:07:00Z"); // 8:07 PM
  check("8 PM is still fine", r.planReviewReminders(lateEvening, [booking("due", lateEvening, 24.5)], []).remind, ["due"]);
}

// --- 4. A rating: stars are required, words are optional.
check("stars only", r.parseRating("5", "", hasContactDetails), { ok: true, stars: 5, comment: null });
check("stars only, no comment field at all", r.parseRating("4", null, hasContactDetails), { ok: true, stars: 4, comment: null });
check("stars only, blank spaces in the box", r.parseRating(3, "   \n ", hasContactDetails), { ok: true, stars: 3, comment: null });
check("one star, no words", r.parseRating("1", undefined, hasContactDetails), { ok: true, stars: 1, comment: null });
check("stars with a comment", r.parseRating("5", "  Punctual and careful on the mountain roads ", hasContactDetails), { ok: true, stars: 5, comment: "Punctual and careful on the mountain roads" });
check("comment in Spanish", r.parseRating("4", "Muy puntual y amable", hasContactDetails), { ok: true, stars: 4, comment: "Muy puntual y amable" });
check("no stars", r.parseRating("0", "Great driver", hasContactDetails), { ok: false, error: "Pick 1 to 5 stars." });
check("no stars, nothing sent", r.parseRating(null, null, hasContactDetails), { ok: false, error: "Pick 1 to 5 stars." });
check("six stars", r.parseRating("6", "", hasContactDetails).ok, false);
check("half stars", r.parseRating("4.5", "", hasContactDetails).ok, false);
check("a phone number in the words", r.parseRating("5", "call me 8888-1234", hasContactDetails), { ok: false, error: "Please keep phone numbers, emails and links out of the review." });
check("long comments are cut at 1000 characters", r.parseRating("5", "a".repeat(1500), hasContactDetails).comment?.length, 1000);

// --- 5. The reminder push exists in both languages and says it is the only one.
for (const lang of ["en", "es"]) {
  const p = msg.reviewReminderPush(lang, { driver: "Carlos", ride: true });
  check(`${lang} push names the driver`, p.title.includes("Carlos"), true);
  check(`${lang} push is not the first request's text`, p.title === msg.reviewRequestPush(lang, { driver: "Carlos", ride: true }).title, false);
  // The double weight of a written comment is internal: never told to the traveller.
  const email = msg.reviewReminderEmail(lang, { guestName: "Ana", driver: "Carlos", ref: "CRPT-1", ride: true, origin: "A", destination: "B", tripUrl: "https://example.test/trip/x" });
  check(`${lang} messages never mention the double weight`, /double|doble|twice|dos veces|x2/i.test([p.title, p.body, email.subject, ...email.lines].join(" ")), false);
}
check("es push is in Spanish", /recordatorio/i.test(msg.reviewReminderPush("es", { driver: "Carlos", ride: false }).title), true);

console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
