import "server-only";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { CODE_LIMITS, handleCodeRequest, verifyTurnstileToken, type CodeChannel, type CodeDeps, type LimitResult } from "@/lib/authCode";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient, createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The one place that emails sign-in codes (rules: src/lib/authCode.ts).
 * Website: POST /api/auth/send-code. Apps: POST /api/v1/auth/send-code.
 * Uses the service role key on the server only (rate limits, account lookup, creating accounts).
 */

let warned = false;
function warnOnce(msg: string) {
  if (warned) return;
  warned = true;
  console.warn(msg);
}

/** The Turnstile check, or null when the secret key isn't set (check skipped, rate limits still apply). */
function turnstileFor(channel: CodeChannel): CodeDeps["verifyTurnstile"] {
  if (channel !== "web") return null;
  const secret = process.env.TURNSTILE_SECRET_KEY ?? "";
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  if (!secret) {
    warnOnce(
      siteKey
        ? "[send-code] NEXT_PUBLIC_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is not: the website's bot check is NOT enforced."
        : "[send-code] Turnstile keys not set: the website's bot check is off (rate limits still apply).",
    );
    return null;
  }
  if (!siteKey) warnOnce("[send-code] TURNSTILE_SECRET_KEY is set but NEXT_PUBLIC_TURNSTILE_SITE_KEY is not: website sign-in will be refused.");
  return (token, ip) => verifyTurnstileToken(secret, token, ip);
}

export async function sendCodeRoute(req: Request, channel: CodeChannel): Promise<NextResponse> {
  const reply = (data: unknown, status: number) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  const body = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";

  const admin = createSupabaseAdminClient();
  // Website: the cookie client, so the sign-in link's PKCE check is stored in this browser.
  // Apps: a plain client; they only use the 6-digit code.
  const sender = channel === "web" ? await createSupabaseServerClient() : createSupabasePublicClient();
  if (!admin || !sender) {
    console.error("[send-code] Supabase keys missing (NEXT_PUBLIC_SUPABASE_URL / ANON / SUPABASE_SERVICE_ROLE_KEY).");
    return reply({ ok: false, error: "Sign-in isn't available right now. Please try again later." }, 503);
  }

  const next = typeof body.next === "string" && body.next.startsWith("/") && !body.next.startsWith("//") ? body.next : "/";
  const deps: CodeDeps = {
    verifyTurnstile: turnstileFor(channel),
    allow: async (ipAddr, email) => {
      const { data, error } = await admin.rpc("allow_auth_code", {
        p_ip: ipAddr,
        p_email: email,
        p_email_per_hour: CODE_LIMITS.EMAIL_PER_HOUR,
        p_email_per_day: CODE_LIMITS.EMAIL_PER_DAY,
        p_ip_per_hour: CODE_LIMITS.IP_PER_HOUR,
      });
      if (error) {
        console.error("[send-code] rate limit check failed", error.message);
        return "ip_hour"; // fail closed
      }
      return data as LimitResult;
    },
    status: async (email) => {
      const { data, error } = await admin.rpc("auth_email_status", { p_email: email });
      if (error) throw new Error(error.message);
      const row = (Array.isArray(data) ? data[0] : data) as { user_id: string | null; confirmed: boolean | null; has_trip: boolean } | undefined;
      return { userId: row?.user_id ?? null, confirmed: Boolean(row?.confirmed), hasTrip: Boolean(row?.has_trip) };
    },
    createUser: async (email) => {
      // Confirmed now so Supabase will email it a code with public sign-ups off; the code
      // itself still proves the person owns the inbox before they're signed in.
      const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
      if (error && !/already|registered|exists/i.test(error.message)) {
        console.error("[send-code] create user failed", error.message);
        return false;
      }
      return true;
    },
    confirmUser: async (userId) => {
      const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
      if (error) console.error("[send-code] confirm user failed", error.message);
      return !error;
    },
    sendOtp: async (email) => {
      const { error } = await sender.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          ...(channel === "web" ? { emailRedirectTo: `${new URL(req.url).origin}/auth/callback?next=${encodeURIComponent(next)}` } : {}),
        },
      });
      if (error) console.error("[send-code] Supabase refused to send", error.message);
      return !error;
    },
  };

  try {
    const out = await handleCodeRequest({ email: body.email, purpose: body.purpose, lang: body.lang, turnstileToken: body.turnstileToken, ip, channel }, deps);
    if (!out.ok) {
      if (out.status === 429 || out.reason === "turnstile") console.warn(`[send-code] refused (${out.reason}) channel=${channel}`);
      return reply({ ok: false, error: out.error }, out.status);
    }
    return reply({ ok: true, neutral: out.neutral, message: out.message }, 200);
  } catch (e) {
    console.error("[send-code] failed", e instanceof Error ? e.message : e);
    return reply({ ok: false, error: "We couldn't send a code right now. Please try again in a minute." }, 500);
  }
}
