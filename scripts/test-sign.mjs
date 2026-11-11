/**
 * Cases for the name sign at the pickup (src/lib/sign.ts and the traveller app's copy in
 * apps/client/src/contact.ts): what the driver's sign says, and which texts are refused.
 *
 *   npm run test:sign        (Node 22.6+; Node runs the TypeScript directly)
 *
 * The rule (Jorge, 2026-11-11): the traveller's own text if they wrote one; else "Costa Rica
 * Private Transfers" if they chose "Don't show my name"; else first name + last initial. The
 * database's pickup_sign() is checked against the same cases by `npm run test:db`.
 */
import * as sign from "../src/lib/sign.ts";
import { hasContactDetails } from "../src/lib/preferences.ts";
import * as app from "../apps/client/src/contact.ts";

let passed = 0;
const failures = [];
const check = (name, got, want) => {
  if (got === want) passed++;
  else failures.push(`${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};

const BRAND = "Costa Rica Private Transfers";
check("brand name", sign.SIGN_BRAND, BRAND);
check("max length", sign.SIGN_MAX, 40);
check("app max length", app.SIGN_MAX, 40);

// What the sign says: [sign_text, sign_hide_name, guest name, expected]
for (const [text, hide, guest, want] of [
  [null, false, "Emily Rose Smith", "Emily S."],
  ["", false, "  emily rose   Smith ", "Emily S."],
  [null, false, "Ana", "Ana"],
  ["The Smith Family", false, "Emily Rose Smith", "The Smith Family"],
  ["  VIP   Tours ", false, "Emily Rose Smith", "VIP Tours"],
  [null, true, "Emily Rose Smith", BRAND],
  [null, false, "8888 1234", BRAND],
  [null, false, "", BRAND],
  [null, false, null, BRAND],
  [null, null, "José Ángel Núñez", "José N."],
]) {
  check(`sign for ${JSON.stringify([text, hide, guest])}`, sign.signShown({ sign_text: text, sign_hide_name: hide }, guest), want);
}

// Which texts are accepted: [text, accepted]
for (const [text, ok] of [
  ["The Smith Family", true],
  ["Familia Rodríguez", true],
  ["ACME Corp · Group 2", true],
  ["Wedding 2026", true],
  ["", true],
  ["a".repeat(40), true],
  ["a".repeat(41), false],
  ["Call 8888 1234", false],
  ["+506 8888-1234", false],
  ["ana@example.com", false],
  ["www.mytours.com", false],
  ["wa.me/50688881234", false],
  ["@anasmith", false],
]) {
  const clean = sign.cleanSignText(text);
  check(`website accepts ${JSON.stringify(text)}`, sign.signTextProblem(clean, hasContactDetails) === null, ok);
  check(`app accepts ${JSON.stringify(text)}`, !app.signBlocked(text), ok);
}
check("line breaks become spaces", sign.cleanSignText("The\nSmith\tFamily "), "The Smith Family");
check("app cleans the same way", app.cleanSignText("  The   Smith Family "), "The Smith Family");
check("not text", sign.cleanSignText(42), "");

// Until when the traveller can change it.
check("editable before a driver is assigned", sign.signEditable({ status: "pending_payment", service_type: "transfer" }), true);
check("editable once confirmed", sign.signEditable({ status: "confirmed", en_route_at: null, service_type: "transfer" }), true);
check("read-only once the driver is on the way", sign.signEditable({ status: "confirmed", en_route_at: "2026-11-22T15:00:00Z", service_type: "transfer" }), false);
check("read-only on the road", sign.signEditable({ status: "in_progress", service_type: "transfer" }), false);
check("read-only when cancelled", sign.signEditable({ status: "cancelled", service_type: "transfer" }), false);
check("tours have no sign field", sign.signEditable({ status: "confirmed", service_type: "day_tour" }), false);

console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
