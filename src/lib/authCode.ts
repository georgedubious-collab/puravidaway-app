/**
 * Who may be emailed a sign-in code, and when an account may be created (2026-11-12).
 *
 * Bots used to ask Supabase directly for codes "creating the account if needed", which made
 * junk accounts and emailed strangers. Now only our server sends codes (POST /api/auth/send-code
 * for the website, /api/v1/auth/send-code for the apps) and it follows these rules:
 *
 * - The email must look like an email. It is trimmed and lower-cased.
 * - Website requests must pass Cloudflare Turnstile (a quiet "are you a person" check) when
 *   TURNSTILE_SECRET_KEY is set. Without it the check is skipped, so nothing breaks before the
 *   keys exist; the rate limits still apply.
 * - Rate limits (constants below): per email per hour and per day, per network per hour.
 * - Someone who already has an account always gets a code.
 * - A new account is created only for a real reason (`purpose`):
 *     booking  the traveller app is sending a trip request          → create
 *     driver   driver app sign-in / a new driver applying           → create
 *     trips    "Already booked?": only if a trip was booked with that email
 *     login    website /login: existing accounts only (except next=/driver, which sends `driver`)
 * - For `trips` and `login` the reply never says whether the email has an account or trips:
 *   "If this email …, we've sent a code".
 *
 * This file has no imports, so `npm run test:auth-code` runs it directly in Node.
 * The database side (rate-limit table and functions) is migration 0049.
 */

export const CODE_LIMITS = {
  /** Codes one email address can be sent in an hour. */
  EMAIL_PER_HOUR: 3,
  /** …and in 24 hours. */
  EMAIL_PER_DAY: 6,
  /** Code requests one network address (IP) can make in an hour, across all emails. */
  IP_PER_HOUR: 10,
} as const;

export type CodePurpose = "booking" | "driver" | "trips" | "login";
/** Website (Turnstile applies) or the mobile apps. */
export type CodeChannel = "web" | "app";
export type CodeLang = "en" | "es";

/** Which purposes each door accepts. The website only signs people in or starts a driver application. */
export const PURPOSES: Record<CodeChannel, readonly CodePurpose[]> = {
  web: ["login", "driver"],
  app: ["booking", "driver", "trips"],
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normaliseEmail = (v: unknown): string => (typeof v === "string" ? v.trim().toLowerCase() : "");
export const validEmail = (e: string): boolean => e.length <= 254 && EMAIL.test(e);

export type LimitResult = "ok" | "email_hour" | "email_day" | "ip_hour";

export interface EmailStatus {
  userId: string | null;
  confirmed: boolean;
  hasTrip: boolean;
}

/** Everything the flow needs from the outside world, so tests can fake it. */
export interface CodeDeps {
  /** Null when Turnstile isn't configured (no secret key). */
  verifyTurnstile: ((token: string, ip: string) => Promise<boolean>) | null;
  allow: (ip: string, email: string) => Promise<LimitResult>;
  status: (email: string) => Promise<EmailStatus>;
  /** Create the account (admin API). Resolves to false if it failed. */
  createUser: (email: string) => Promise<boolean>;
  /** Mark an existing, never-confirmed account as confirmed so Supabase will send it a code. */
  confirmUser: (userId: string) => Promise<boolean>;
  /** Email the code to an existing account. Resolves to false if Supabase refused. */
  sendOtp: (email: string) => Promise<boolean>;
}

export interface CodeRequest {
  email: unknown;
  purpose: unknown;
  lang: unknown;
  turnstileToken?: unknown;
  ip: string;
  channel: CodeChannel;
}

export type CodeOutcome =
  /** neutral: the reply must not reveal whether a code really went out. */
  | { ok: true; status: 200; neutral: boolean; message: string; sent: boolean }
  | { ok: false; status: 400 | 403 | 429 | 500; error: string; reason: string };

export const parseLang = (v: unknown): CodeLang => (v === "es" ? "es" : "en");

const tr = (lang: CodeLang, en: string, es: string) => (lang === "es" ? es : en);

export const CODE_MESSAGES = {
  badEmail: (l: CodeLang) => tr(l, "Enter your email address.", "Escriba su correo electrónico."),
  badPurpose: (l: CodeLang) => tr(l, "Something went wrong. Reload and try again.", "Algo salió mal. Vuelva a cargar e intente de nuevo."),
  human: (l: CodeLang) =>
    tr(l, "We couldn't check that you're a person. Reload the page and try again.", "No pudimos comprobar que usted es una persona. Vuelva a cargar la página e intente de nuevo."),
  limited: (l: CodeLang) =>
    tr(
      l,
      "We've already sent several codes. Please wait a while and try again, or use the last code we sent.",
      "Ya le enviamos varios códigos. Espere un rato e intente de nuevo, o use el último código que le enviamos.",
    ),
  failed: (l: CodeLang) =>
    tr(
      l,
      "We couldn't send a code to that email. Check the address and try again in a minute.",
      "No pudimos enviar un código a ese correo. Revise la dirección e intente de nuevo en un minuto.",
    ),
  sent: (l: CodeLang) => tr(l, "We've sent you a code.", "Le enviamos un código."),
  neutralTrips: (l: CodeLang) =>
    tr(
      l,
      "If this email has trips with us, we've sent it a 6-digit code.",
      "Si este correo tiene viajes con nosotros, le enviamos un código de 6 dígitos.",
    ),
  neutralLogin: (l: CodeLang) =>
    tr(
      l,
      "If this email has an account, we've sent it a sign-in link.",
      "Si este correo tiene una cuenta, le enviamos un enlace para iniciar sesión.",
    ),
} as const;

/** The whole decision, in order: email → purpose → Turnstile → rate limit → account → send. */
export async function handleCodeRequest(req: CodeRequest, deps: CodeDeps): Promise<CodeOutcome> {
  const lang = parseLang(req.lang);
  const email = normaliseEmail(req.email);
  if (!validEmail(email)) return { ok: false, status: 400, error: CODE_MESSAGES.badEmail(lang), reason: "email" };
  const purpose = req.purpose as CodePurpose;
  if (!PURPOSES[req.channel].includes(purpose)) return { ok: false, status: 400, error: CODE_MESSAGES.badPurpose(lang), reason: "purpose" };

  if (req.channel === "web" && deps.verifyTurnstile) {
    const token = typeof req.turnstileToken === "string" ? req.turnstileToken : "";
    if (!token || !(await deps.verifyTurnstile(token, req.ip))) return { ok: false, status: 403, error: CODE_MESSAGES.human(lang), reason: "turnstile" };
  }

  const limit = await deps.allow(req.ip, email);
  if (limit !== "ok") return { ok: false, status: 429, error: CODE_MESSAGES.limited(lang), reason: limit };

  const neutral = purpose === "trips" || purpose === "login";
  const neutralMessage = purpose === "trips" ? CODE_MESSAGES.neutralTrips(lang) : CODE_MESSAGES.neutralLogin(lang);
  const st = await deps.status(email);

  let exists = Boolean(st.userId);
  if (!exists) {
    const mayCreate = purpose === "booking" || purpose === "driver" || (purpose === "trips" && st.hasTrip);
    if (!mayCreate) return { ok: true, status: 200, neutral: true, message: neutralMessage, sent: false };
    exists = await deps.createUser(email);
    if (!exists) return { ok: false, status: 500, error: CODE_MESSAGES.failed(lang), reason: "create" };
  } else if (!st.confirmed && st.userId) {
    // Supabase only emails a code to a confirmed account once public sign-ups are off.
    if (!(await deps.confirmUser(st.userId))) return { ok: false, status: 500, error: CODE_MESSAGES.failed(lang), reason: "confirm" };
  }

  const sent = await deps.sendOtp(email);
  if (!sent) {
    // A neutral flow stays neutral even when sending failed, but the server logs it.
    if (neutral) return { ok: true, status: 200, neutral: true, message: neutralMessage, sent: false };
    return { ok: false, status: 500, error: CODE_MESSAGES.failed(lang), reason: "send" };
  }
  return neutral
    ? { ok: true, status: 200, neutral: true, message: neutralMessage, sent: true }
    : { ok: true, status: 200, neutral: false, message: CODE_MESSAGES.sent(lang), sent: true };
}

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Ask Cloudflare whether a Turnstile token is genuine (server side, with the secret key). */
export async function verifyTurnstileToken(
  secret: string,
  token: string,
  ip: string,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetchFn(TURNSTILE_VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8000) });
    const json = (await res.json().catch(() => null)) as { success?: boolean } | null;
    return json?.success === true;
  } catch {
    return false;
  }
}
