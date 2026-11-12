/**
 * Cases for who may be emailed a sign-in code (src/lib/authCode.ts), with fake Supabase and
 * Cloudflare so nothing is sent:
 *
 *   npm run test:auth-code        (Node 22.6+; Node runs the TypeScript directly)
 *
 * Purpose rules (booking/driver create; trips only with a trip email; login existing only),
 * Turnstile required only when configured, which door accepts which purpose, neutral replies.
 * The rate-limit boundaries themselves are checked in the database by `npm run test:db`.
 */
import * as ac from "../src/lib/authCode.ts";

let passed = 0;
const failures = [];
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) passed++;
  else failures.push(`${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};

/** A fake world: `users` maps email → { id, confirmed }, `trips` is a set of booking emails. */
function world({ users = {}, trips = [], limit = "ok", turnstile = null, sendOk = true } = {}) {
  const log = { created: [], confirmed: [], sent: [], allowCalls: 0, turnstileCalls: 0 };
  const deps = {
    verifyTurnstile: turnstile === null ? null : async (token) => {
      log.turnstileCalls++;
      return token === turnstile;
    },
    allow: async () => {
      log.allowCalls++;
      return limit;
    },
    status: async (email) => ({
      userId: users[email]?.id ?? null,
      confirmed: users[email]?.confirmed ?? false,
      hasTrip: trips.includes(email),
    }),
    createUser: async (email) => {
      log.created.push(email);
      users[email] = { id: "new-" + email, confirmed: true };
      return true;
    },
    confirmUser: async (id) => {
      log.confirmed.push(id);
      return true;
    },
    sendOtp: async (email) => {
      if (sendOk) log.sent.push(email);
      return sendOk;
    },
  };
  return { deps, log };
}
const req = (over) => ({ email: "Ana@Example.com ", purpose: "booking", lang: "en", ip: "1.2.3.4", channel: "app", ...over });

// --- Limits are the agreed numbers ---------------------------------------------------------
check("limits", ac.CODE_LIMITS, { EMAIL_PER_HOUR: 3, EMAIL_PER_DAY: 6, IP_PER_HOUR: 10 });

// --- Email checks --------------------------------------------------------------------------
check("normalised", ac.normaliseEmail("  Ana@Example.COM "), "ana@example.com");
check("not a string", ac.normaliseEmail(42), "");
for (const bad of ["", "ana", "ana@", "ana@x", "a b@x.com", "x".repeat(250) + "@a.co"]) check(`invalid ${bad.slice(0, 12)}`, ac.validEmail(bad), false);
check("valid", ac.validEmail("ana.maria+cr@gmail.com"), true);
{
  const { deps, log } = world();
  const out = await ac.handleCodeRequest(req({ email: "nope" }), deps);
  check("bad email → 400", [out.ok, out.status, log.allowCalls], [false, 400, 0]);
  const es = await ac.handleCodeRequest(req({ email: "nope", lang: "es" }), deps);
  check("bad email in Spanish", es.error, "Escriba su correo electrónico.");
}

// --- Which door accepts which purpose -----------------------------------------------------
for (const [channel, purpose, ok] of [
  ["web", "login", true], ["web", "driver", true], ["web", "booking", false], ["web", "trips", false],
  ["app", "booking", true], ["app", "driver", true], ["app", "trips", true], ["app", "login", false],
  ["app", "admin", false], ["app", undefined, false],
]) {
  const { deps } = world();
  const out = await ac.handleCodeRequest(req({ channel, purpose }), deps);
  check(`${channel}/${purpose} accepted`, out.status !== 400, ok);
}

// --- booking and driver: new accounts are created -----------------------------------------
for (const purpose of ["booking", "driver"]) {
  const { deps, log } = world();
  const out = await ac.handleCodeRequest(req({ purpose }), deps);
  check(`${purpose}: creates + sends`, [out.ok, out.neutral, log.created, log.sent], [true, false, ["ana@example.com"], ["ana@example.com"]]);
}
{
  const { deps, log } = world();
  const out = await ac.handleCodeRequest(req({ channel: "web", purpose: "driver" }), deps);
  check("web driver (next=/driver): creates", [out.ok, log.created.length, log.sent.length], [true, 1, 1]);
}

// --- trips: only with a trip booked under that email --------------------------------------
{
  const { deps, log } = world({ trips: ["ana@example.com"] });
  const out = await ac.handleCodeRequest(req({ purpose: "trips" }), deps);
  check("trips + trip email: creates + sends, neutral wording", [out.ok, out.neutral, out.sent, log.created.length, log.sent.length], [true, true, true, 1, 1]);
}
{
  const { deps, log } = world();
  const out = await ac.handleCodeRequest(req({ purpose: "trips" }), deps);
  check("trips, no trip email: nothing created or sent", [out.ok, out.neutral, out.sent, log.created.length, log.sent.length], [true, true, false, 0, 0]);
  check("trips neutral message", out.message, "If this email has trips with us, we've sent it a 6-digit code.");
  const es = await ac.handleCodeRequest(req({ purpose: "trips", lang: "es" }), deps);
  check("trips neutral message (es)", es.message, "Si este correo tiene viajes con nosotros, le enviamos un código de 6 dígitos.");
}
{
  // Same reply whether or not the email has trips: nothing to tell them apart.
  const a = await ac.handleCodeRequest(req({ purpose: "trips" }), world({ trips: ["ana@example.com"] }).deps);
  const b = await ac.handleCodeRequest(req({ purpose: "trips" }), world().deps);
  check("trips replies look the same", [a.status, a.message, a.neutral], [b.status, b.message, b.neutral]);
}

// --- login: existing accounts only -------------------------------------------------------
{
  const { deps, log } = world();
  const out = await ac.handleCodeRequest(req({ channel: "web", purpose: "login" }), deps);
  check("login, unknown email: not created, not sent, neutral", [out.ok, out.neutral, log.created.length, log.sent.length], [true, true, 0, 0]);
  check("login neutral message", out.message, "If this email has an account, we've sent it a sign-in link.");
}
{
  const { deps, log } = world({ users: { "ana@example.com": { id: "u1", confirmed: true } } });
  const out = await ac.handleCodeRequest(req({ channel: "web", purpose: "login" }), deps);
  check("login, existing: sent, neutral wording", [out.ok, out.neutral, out.sent, log.created.length, log.sent], [true, true, true, 0, ["ana@example.com"]]);
}

// --- existing accounts always get a code, whatever the purpose ---------------------------
for (const purpose of ["booking", "driver", "trips"]) {
  const { deps, log } = world({ users: { "ana@example.com": { id: "u1", confirmed: true } } });
  const out = await ac.handleCodeRequest(req({ purpose }), deps);
  check(`existing (${purpose}): sent, not re-created`, [out.ok, log.created.length, log.sent.length, log.confirmed.length], [true, 0, 1, 0]);
}
{
  const { deps, log } = world({ users: { "ana@example.com": { id: "u1", confirmed: false } } });
  await ac.handleCodeRequest(req({ purpose: "trips" }), deps);
  check("existing unconfirmed: confirmed first, then sent", [log.confirmed, log.sent.length], [["u1"], 1]);
}

// --- rate limit ---------------------------------------------------------------------------
for (const limit of ["email_hour", "email_day", "ip_hour"]) {
  const { deps, log } = world({ limit });
  const out = await ac.handleCodeRequest(req(), deps);
  check(`limited (${limit}) → 429, nothing sent`, [out.ok, out.status, log.sent.length, log.created.length], [false, 429, 0, 0]);
}
check("limit message (es)", (await ac.handleCodeRequest(req({ lang: "es" }), world({ limit: "ip_hour" }).deps)).error,
  "Ya le enviamos varios códigos. Espere un rato e intente de nuevo, o use el último código que le enviamos.");
{
  // The limit counts before the account lookup, so probing unknown emails also uses it up.
  const { deps, log } = world();
  await ac.handleCodeRequest(req({ channel: "web", purpose: "login" }), deps);
  check("neutral login request still counted", log.allowCalls, 1);
}

// --- Turnstile: required only when configured, and only on the website ---------------------
{
  const { deps, log } = world({ turnstile: null });
  const out = await ac.handleCodeRequest(req({ channel: "web", purpose: "driver" }), deps);
  check("web, Turnstile not configured: works", [out.ok, log.sent.length], [true, 1]);
}
{
  const { deps, log } = world({ turnstile: "good" });
  const none = await ac.handleCodeRequest(req({ channel: "web", purpose: "driver" }), deps);
  check("web, configured, no token → 403", [none.ok, none.status, log.allowCalls, log.sent.length], [false, 403, 0, 0]);
  const bad = await ac.handleCodeRequest(req({ channel: "web", purpose: "driver", turnstileToken: "bad" }), deps);
  check("web, configured, bad token → 403", [bad.ok, bad.status], [false, 403]);
  const good = await ac.handleCodeRequest(req({ channel: "web", purpose: "driver", turnstileToken: "good" }), deps);
  check("web, configured, good token → sent", [good.ok, log.sent.length], [true, 1]);
}
{
  const { deps, log } = world({ turnstile: "good" });
  const out = await ac.handleCodeRequest(req({ channel: "app", purpose: "booking" }), deps);
  check("apps never need Turnstile", [out.ok, log.turnstileCalls], [true, 0]);
}

// --- sending fails -------------------------------------------------------------------------
{
  const out = await ac.handleCodeRequest(req({ purpose: "booking" }), world({ sendOk: false }).deps);
  check("booking, Supabase refuses → error", [out.ok, out.status], [false, 500]);
}

// --- Turnstile server check (fake Cloudflare) ------------------------------------------------
{
  let sentBody = null;
  const fake = (success) => async (url, init) => {
    sentBody = Object.fromEntries(init.body);
    check("siteverify url", url, ac.TURNSTILE_VERIFY_URL);
    return { json: async () => ({ success }) };
  };
  check("Cloudflare says yes", await ac.verifyTurnstileToken("sec", "tok", "9.9.9.9", fake(true)), true);
  check("form sent", sentBody, { secret: "sec", response: "tok", remoteip: "9.9.9.9" });
  check("Cloudflare says no", await ac.verifyTurnstileToken("sec", "tok", "unknown", fake(false)), false);
  check("no remoteip when unknown", sentBody, { secret: "sec", response: "tok" });
  check("network error → no", await ac.verifyTurnstileToken("sec", "tok", "", async () => { throw new Error("down"); }), false);
}

if (failures.length) {
  console.error(`${failures.length} failed, ${passed} passed:\n  ` + failures.join("\n  "));
  process.exit(1);
}
console.log(`auth code: all ${passed} checks passed`);
