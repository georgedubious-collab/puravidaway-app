/**
 * Cases for team alerts on the team's phones (Web Push, 2026-11-12):
 *   - VAPID (src/lib/webPush.ts): the RFC 8292 example token verifies with its key; our own tokens
 *     have the right header, audience, expiry and subject, and verify; a tampered token doesn't;
 *   - message encryption: our output equals the RFC 8291 §5 example byte for byte, and a random
 *     message decrypts back with the browser's private key;
 *   - 404 / 410 from a push service removes the subscription; other errors count a failure;
 *   - the alert rules (src/lib/teamAlertRules.ts): per-type toggles, quiet hours across midnight,
 *     "tonight" (pickup within 12 h), the trips without a driver, and the notification text
 *     (never the traveller's phone or email);
 *   - the sender (src/lib/teamAlertCore.ts): once only per alert, email + push, toggles and quiet
 *     hours respected per admin, test pushes, gone subscriptions removed.
 *
 *   npm run test:alerts      (Node 22.15+; Node runs the TypeScript directly)
 */
import { registerHooks } from "node:module";
import { createECDH, createDecipheriv, createHmac } from "node:crypto";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});

const warn = console.warn;
console.warn = () => {};
const wp = await import("../src/lib/webPush.ts");
const rules = await import("../src/lib/teamAlertRules.ts");
const core = await import("../src/lib/teamAlertCore.ts");
console.warn = warn;

let passed = 0;
const failures = [];
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) passed++;
  else failures.push(`${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};
const ok = (name, cond) => (cond ? passed++ : failures.push(name));

// --- RFC 8291 §5 / Appendix A ---------------------------------------------------------------------
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml" +
    "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT" +
    "pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};
{
  const out = wp.encryptPayload({ p256dh: RFC.uaPublic, auth: RFC.auth }, RFC.plaintext, {
    salt: wp.b64u.decode(RFC.salt),
    senderPrivateKey: wp.b64u.decode(RFC.asPrivate),
  });
  eq("RFC 8291 example: encrypted body matches byte for byte", wp.b64u.encode(out), RFC.body);
  eq("RFC 8291 example: 144 bytes (the RFC's header says 145; its own body decodes to 144)", out.length, 144);
}

/** A browser's side of RFC 8291: decrypt with the receiver's private key. */
function decrypt(body, uaPrivate, authSecret) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const ct = body.subarray(21 + idlen);
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(uaPrivate);
  const uaPublic = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(asPublic);
  const h = (k, d) => createHmac("sha256", k).update(d).digest();
  const ikm = h(h(authSecret, secret), Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]));
  const prk = h(salt, ikm);
  const cek = h(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01", "binary")).subarray(0, 16);
  const nonce = h(prk, Buffer.from("Content-Encoding: nonce\0\x01", "binary")).subarray(0, 12);
  const d = createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  return plain.subarray(0, plain.lastIndexOf(2)).toString();
}
{
  const ua = createECDH("prime256v1");
  ua.generateKeys();
  const auth = Buffer.from("0123456789abcdef");
  const msg = JSON.stringify({ title: "Conductor atrasado · CRPT-10492", body: "ñ á é — 20 min", url: "/admin/bookings/x" });
  const out = wp.encryptPayload({ p256dh: wp.b64u.encode(ua.getPublicKey()), auth: wp.b64u.encode(auth) }, msg);
  eq("a random message decrypts back with the browser's key", decrypt(out, ua.getPrivateKey(), auth), msg);
  const out2 = wp.encryptPayload({ p256dh: wp.b64u.encode(ua.getPublicKey()), auth: wp.b64u.encode(auth) }, msg);
  ok("each message uses a fresh salt and key", !out.subarray(0, 86).equals(out2.subarray(0, 86)));
  let threw = false;
  try {
    wp.encryptPayload({ p256dh: wp.b64u.encode(ua.getPublicKey()), auth: wp.b64u.encode(auth) }, "x".repeat(5000));
  } catch {
    threw = true;
  }
  ok("a message too long for one record is refused", threw);
}

// --- RFC 8292 (VAPID) -----------------------------------------------------------------------------
{
  const rfcJwt =
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJhdWQiOiJodHRwczovL3B1c2guZXhhbXBsZS5uZXQiLCJleHAiOjE0NTM1MjM3NjgsInN1YiI6Im1haWx0bzpwdXNoQGV4YW1wbGUuY29tIn0.i3CYb7t4xfxCDquptFOepC9GAu_HLGkMlMuCGSK2rpiUfnK9ojFwDXb1JrErtmysazNjjvW2L9OkSSHzvoD1oA";
  const rfcKey = "BA1Hxzyi1RUM1b5wjxsn7nGxAszw2u61m164i3MrAIxHF6YK5h4SDYic-dRuU_RCPCfA5aq9ojSwk5Y2EmClBPs";
  ok("RFC 8292 example token verifies with the RFC's public key", wp.verifyVapidJwt(rfcJwt, rfcKey));
  ok("RFC 8292 example token does not verify with another key", !wp.verifyVapidJwt(rfcJwt, RFC.uaPublic));

  // Our own keys, generated exactly as the command given to Jorge does.
  const e = createECDH("prime256v1");
  e.generateKeys();
  const keys = { publicKey: e.getPublicKey("base64url"), privateKey: e.getPrivateKey("base64url"), subject: "mailto:team@example.com" };
  const jwt = wp.vapidJwt(keys, "https://fcm.googleapis.com", 1_700_000_000);
  const [h, c] = jwt.split(".");
  eq("VAPID header", JSON.parse(wp.b64u.decode(h).toString()), { typ: "JWT", alg: "ES256" });
  eq("VAPID claims", JSON.parse(wp.b64u.decode(c).toString()), { aud: "https://fcm.googleapis.com", exp: 1_700_000_000 + 12 * 3600, sub: "mailto:team@example.com" });
  ok("our token verifies with our public key", wp.verifyVapidJwt(jwt, keys.publicKey));
  eq("signature is 64 bytes (raw r||s, not DER)", wp.b64u.decode(jwt.split(".")[2]).length, 64);
  const tampered = `${h}.${wp.b64u.encode(Buffer.from(JSON.stringify({ aud: "https://evil.example", exp: 1, sub: "x" })))}.${jwt.split(".")[2]}`;
  ok("a tampered token does not verify", !wp.verifyVapidJwt(tampered, keys.publicKey));
  eq("audience is the push service's origin", wp.pushAudience("https://web.push.apple.com/QGx8abc?x=1"), "https://web.push.apple.com");
  const authz = wp.vapidAuthorization(keys, "https://updates.push.services.mozilla.com/wpush/v2/abc");
  ok("Authorization header is 'vapid t=…, k=…'", authz.startsWith("vapid t=") && authz.endsWith(`, k=${keys.publicKey}`));
  eq("expiry is capped at 24 h", JSON.parse(wp.b64u.decode(wp.vapidJwt(keys, "https://a.example", 0, 99 * 3600).split(".")[1]).toString()).exp, 24 * 3600);
  eq("no keys → no push (email only)", wp.vapidFromEnv({}), null);
  eq("subject must be mailto: or https:", wp.vapidFromEnv({ VAPID_PUBLIC_KEY: "a", VAPID_PRIVATE_KEY: "b", VAPID_SUBJECT: "team@example.com" }), null);
  ok("full settings are read", wp.vapidFromEnv({ VAPID_PUBLIC_KEY: "a", VAPID_PRIVATE_KEY: "b", VAPID_SUBJECT: "mailto:t@example.com" }) !== null);
}

// --- Push service answers -------------------------------------------------------------------------
eq("201 → sent", wp.pushOutcome(201), "sent");
eq("404 → gone", wp.pushOutcome(404), "gone");
eq("410 → gone", wp.pushOutcome(410), "gone");
eq("429 → failed (kept)", wp.pushOutcome(429), "failed");
eq("500 → failed (kept)", wp.pushOutcome(500), "failed");

// --- Rules ----------------------------------------------------------------------------------------
{
  const { wantsAlert, inQuietHours, isTonight, pickupsWithoutDriver, alertText, parsePrefsForm, ALERT_KINDS } = rules;
  eq("six kinds of alert plus new requests", ALERT_KINDS.length, 7);
  const prefs = { muted_kinds: ["new_request"], quiet_start: null, quiet_end: null };
  ok("default (no prefs row): everything on", wantsAlert(null, "late_driver", new Date()));
  ok("muted kind is skipped", !wantsAlert(prefs, "new_request", new Date()));
  ok("other kinds still come", wantsAlert(prefs, "low_rating", new Date()));
  // Costa Rica is UTC−6 all year. 23:30 CR = 05:30 UTC next day.
  const at = (crHour, crMin = 0) => new Date(Date.UTC(2026, 10, 12, crHour + 6, crMin));
  const night = { muted_kinds: [], quiet_start: 22, quiet_end: 6 };
  ok("quiet 22–06: 23:30 is quiet", inQuietHours(night, at(23, 30)));
  ok("quiet 22–06: 05:59 is quiet", inQuietHours(night, at(5, 59)));
  ok("quiet 22–06: 06:00 is not", !inQuietHours(night, at(6)));
  ok("quiet 22–06: 14:00 is not", !inQuietHours(night, at(14)));
  const day = { muted_kinds: [], quiet_start: 9, quiet_end: 17 };
  ok("quiet 09–17: 12:00 is quiet", inQuietHours(day, at(12)));
  ok("quiet 09–17: 20:00 is not", !inQuietHours(day, at(20)));
  ok("no quiet hours set: never quiet", !inQuietHours({ muted_kinds: [], quiet_start: null, quiet_end: null }, at(3)));
  ok("same start and end: never quiet", !inQuietHours({ muted_kinds: [], quiet_start: 4, quiet_end: 4 }, at(4)));
  ok("in quiet hours the admin gets no push", !wantsAlert(night, "late_driver", at(23)));

  const now = new Date("2026-11-12T20:00:00Z");
  ok("pickup in 11 h is tonight", isTonight("2026-11-13T07:00:00Z", now));
  ok("pickup in 12 h exactly is tonight", isTonight("2026-11-13T08:00:00Z", now));
  ok("pickup in 13 h is not", !isTonight("2026-11-13T09:00:00Z", now));
  ok("pickup in the past is not", !isTonight("2026-11-12T19:00:00Z", now));
  ok("no time is not", !isTonight(null, now));

  const rows = [
    { id: "a", status: "pending_bids", assigned_driver_id: null, scheduled_at: "2026-11-13T02:00:00Z", created_at: "2026-11-12T10:00:00Z", no_driver_alert_at: null },
    { id: "b", status: "confirmed", assigned_driver_id: "d1", scheduled_at: "2026-11-13T02:00:00Z", created_at: "2026-11-12T10:00:00Z", no_driver_alert_at: null },
    { id: "c", status: "pending_bids", assigned_driver_id: null, scheduled_at: "2026-11-13T02:00:00Z", created_at: "2026-11-12T10:00:00Z", no_driver_alert_at: "2026-11-12T19:00:00Z" },
    { id: "d", status: "cancelled", assigned_driver_id: null, scheduled_at: "2026-11-13T02:00:00Z", created_at: "2026-11-12T10:00:00Z", no_driver_alert_at: null },
    { id: "e", status: "pending_payment", assigned_driver_id: null, scheduled_at: "2026-11-14T02:00:00Z", created_at: "2026-11-12T10:00:00Z", no_driver_alert_at: null },
    { id: "f", status: "pending_payment", assigned_driver_id: null, scheduled_at: "2026-11-13T02:00:00Z", created_at: "2026-11-12T19:50:00Z", no_driver_alert_at: null },
    { id: "g", status: "completed", assigned_driver_id: null, scheduled_at: "2026-11-12T21:00:00Z", created_at: "2026-11-12T10:00:00Z", no_driver_alert_at: null },
  ];
  eq("no-driver check: only open, unassigned, within 12 h, not yet alerted, booked 30+ min ago", pickupsWithoutDriver(rows, now).map((r) => r.id), ["a"]);

  const t = alertText("late_driver", { ref: "CRPT-10492", route: "SJO Airport → Manuel Antonio", when: "jue 12 nov, 9:00 p. m.", guestName: "María López", lateMin: 25 });
  ok("late title in Spanish with the ref", t.title.includes("Conductor atrasado") && t.title.includes("CRPT-10492"));
  ok("guest shown by initial only", t.body.includes("M.") && !t.body.includes("María") && !t.body.includes("López"));
  const leak = alertText("tonight", { ref: "CRPT-1", route: "A → B", when: "x", guestName: "ana@example.com +506 8888 1234" });
  ok("no email or phone in the text, even if the name holds them", !/@|8888|\+506/.test(`${leak.title} ${leak.body}`));
  for (const k of ALERT_KINDS) {
    const x = alertText(k, { ref: "CRPT-2", route: "A → B", when: "hoy 8:00 p. m.", stars: 2, driver: "Juan Pérez", minutes: 40, lateMin: 30, count: 2 });
    ok(`${k}: has a title and a body`, x.title.length > 3 && x.body.length > 3 && x.title.length <= 80 && x.body.length <= 240);
  }
  eq("prefs form: unticked kinds become muted", parsePrefsForm(new Map([["kind_late_driver", "on"], ["kind_no_location", "on"], ["quiet_start", ""], ["quiet_end", ""]])), {
    muted_kinds: ALERT_KINDS.filter((k) => k !== "late_driver" && k !== "no_location"),
    quiet_start: null,
    quiet_end: null,
  });
  eq("prefs form: quiet hours kept when both set", parsePrefsForm(new Map([["quiet_start", "22"], ["quiet_end", "6"]])).quiet_start, 22);
  eq("prefs form: one side only → none", parsePrefsForm(new Map([["quiet_start", "22"], ["quiet_end", ""]])).quiet_start, null);
  eq("prefs form: nonsense hour → none", parsePrefsForm(new Map([["quiet_start", "25"], ["quiet_end", "6"]])).quiet_end, null);
}

// --- The sender -----------------------------------------------------------------------------------
{
  const ua = createECDH("prime256v1");
  ua.generateKeys();
  const sub = (admin, endpoint) => ({ admin_id: admin, endpoint, p256dh: wp.b64u.encode(ua.getPublicKey()), auth: wp.b64u.encode(Buffer.from("0123456789abcdef")) });
  const e = createECDH("prime256v1");
  e.generateKeys();
  const vapid = { publicKey: e.getPublicKey("base64url"), privateKey: e.getPrivateKey("base64url"), subject: "mailto:team@example.com" };

  function memoryStore(subs, prefs) {
    const claimed = new Set();
    const s = {
      subs: [...subs],
      removed: [],
      success: [],
      failed: [],
      async claim(kind, key) {
        const k = `${kind}:${key}`;
        if (claimed.has(k)) return false;
        claimed.add(k);
        return true;
      },
      async recipients() {
        return s.subs.map((x) => ({ ...x, prefs: prefs[x.admin_id] ?? null }));
      },
      async markSent(endpoint) {
        s.success.push(endpoint);
      },
      async markFailed(endpoint) {
        s.failed.push(endpoint);
      },
      async remove(endpoint) {
        s.removed.push(endpoint);
        s.subs = s.subs.filter((x) => x.endpoint !== endpoint);
      },
    };
    return s;
  }
  const status = { "https://push.example/a1": 201, "https://push.example/a2": 410, "https://push.example/b1": 201, "https://push.example/c1": 404, "https://push.example/c2": 500 };
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, headers: init.headers });
    return { status: status[url] ?? 201 };
  };
  const store = memoryStore(
    [sub("A", "https://push.example/a1"), sub("A", "https://push.example/a2"), sub("B", "https://push.example/b1"), sub("C", "https://push.example/c1"), sub("C", "https://push.example/c2")],
    { B: { muted_kinds: ["low_rating"], quiet_start: null, quiet_end: null } },
  );
  const emails = [];
  const deps = { store, vapid, fetchImpl, sendEmail: async (m) => (emails.push(m), true), now: () => new Date("2026-11-12T20:00:00Z") };
  const msg = { title: "Calificación baja · CRPT-1", body: "2★ · A → B", url: "/admin/bookings/1" };
  const r1 = await core.deliverTeamAlert(deps, "low_rating", { dedupeKey: "review-1", push: msg, email: { to: "team@example.com", subject: "Low rating", lines: ["x"] } });
  eq("first call: email sent", r1.emailed, true);
  eq("first call: one phone reached (A's live one); A's other is gone, C's are gone / failing, B muted low ratings", r1.pushed, 1);
  ok("410 subscription removed", store.removed.includes("https://push.example/a2"));
  ok("404 subscription removed", store.removed.includes("https://push.example/c1"));
  ok("500 subscription kept, failure counted", !store.removed.includes("https://push.example/c2") && store.failed.includes("https://push.example/c2"));
  ok("B's phone got nothing for a muted kind", !calls.some((c) => c.url === "https://push.example/b1"));
  ok("push sent with VAPID and aes128gcm", calls.every((c) => c.headers.Authorization.startsWith("vapid t=") && c.headers["Content-Encoding"] === "aes128gcm"));
  const n = calls.length;
  const r2 = await core.deliverTeamAlert(deps, "low_rating", { dedupeKey: "review-1", push: msg, email: { to: "team@example.com", subject: "Low rating", lines: ["x"] } });
  eq("second call with the same key: nothing sent", [r2.emailed, r2.pushed, r2.duplicate], [false, 0, true]);
  eq("second call: no push request at all", calls.length, n);
  eq("only one email in total", emails.length, 1);

  const r3 = await core.deliverTeamAlert(deps, "late_driver", { dedupeKey: "booking-9", push: msg });
  ok("B gets kinds it didn't mute", calls.slice(n).some((c) => c.url === "https://push.example/b1") && r3.pushed >= 2);
  const r4 = await core.deliverTeamAlert(deps, "late_driver", { dedupeKey: "booking-9", push: msg });
  eq("late driver: once per booking", r4.duplicate, true);

  // Quiet hours: B is quiet 13–15 CR time; 20:00 UTC = 14:00 CR.
  const store2 = memoryStore([sub("B", "https://push.example/b1"), sub("A", "https://push.example/a1")], { B: { muted_kinds: [], quiet_start: 13, quiet_end: 15 } });
  const calls2 = [];
  const r5 = await core.deliverTeamAlert({ ...deps, store: store2, fetchImpl: async (url) => (calls2.push(url), { status: 201 }) }, "no_driver", { dedupeKey: "k", push: msg });
  eq("quiet hours: only A's phone", [r5.pushed, calls2], [1, ["https://push.example/a1"]]);
  // The person who made the change isn't pushed about it.
  const calls3 = [];
  await core.deliverTeamAlert({ ...deps, store: memoryStore([sub("A", "https://push.example/a1"), sub("B", "https://push.example/b1")], {}), fetchImpl: async (url) => (calls3.push(url), { status: 201 }) }, "driver_removed", { dedupeKey: "k2", push: msg, exceptAdminId: "A" });
  eq("the admin who removed the driver isn't pushed", calls3, ["https://push.example/b1"]);
  // Test push: only the asking admin, even in quiet hours and with everything muted.
  const calls4 = [];
  const r6 = await core.deliverTeamAlert(
    { ...deps, store: memoryStore([sub("B", "https://push.example/b1"), sub("A", "https://push.example/a1")], { B: { muted_kinds: [...rules.ALERT_KINDS], quiet_start: 13, quiet_end: 15 } }), fetchImpl: async (url) => (calls4.push(url), { status: 201 }) },
    "test",
    { push: msg, onlyAdminId: "B" },
  );
  eq("test push reaches only the asking admin, ignoring toggles", [r6.pushed, calls4], [1, ["https://push.example/b1"]]);
  // Without VAPID keys: email still goes, push silently skipped.
  const r7 = await core.deliverTeamAlert({ ...deps, vapid: null, store: memoryStore([sub("A", "https://push.example/a1")], {}) }, "new_request", { dedupeKey: "n1", push: msg, email: { to: "t@example.com", subject: "s", lines: [] } });
  eq("no VAPID keys: email only", [r7.emailed, r7.pushed], [true, 0]);
  // No dedupe key: always sends (used for events that only happen once by nature).
  const r8 = await core.deliverTeamAlert({ ...deps, store: memoryStore([sub("A", "https://push.example/a1")], {}), fetchImpl: async () => ({ status: 201 }) }, "tonight", { push: msg });
  eq("no key: sent", r8.pushed, 1);
}

console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
