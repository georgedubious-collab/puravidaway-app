"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { TURNSTILE_SITE_KEY, Turnstile, type TurnstileHandle } from "@/components/Turnstile";
import { safeNext } from "@/lib/safeNext";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Email login, no passwords. Supabase's default email contains a sign-in link
 * (handled by /auth/callback); a custom email server can also add a 6-digit
 * code, which this form accepts as an alternative.
 *
 * The code is sent by our server (/api/auth/send-code, rules in src/lib/authCode.ts), never by
 * the browser: existing accounts only, except on the way to /driver, where a new driver may
 * start an application. A quiet Turnstile check runs when its keys are set.
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const denied = params.get("denied") === "1";
  const linkFailed = params.get("error") === "link";

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set when the reply mustn't say whether the email has an account. */
  const [neutral, setNeutral] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const turnstile = useRef<TurnstileHandle>(null);
  const needsCheck = Boolean(TURNSTILE_SITE_KEY);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          // On the way to the driver portal a new driver may create an account; anywhere else, existing accounts only.
          purpose: next === "/driver" || next.startsWith("/driver/") ? "driver" : "login",
          lang: "en",
          next,
          turnstileToken: token ?? undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; neutral?: boolean; message?: string; error?: string } | null;
      if (!json?.ok) setError(json?.error ?? "We couldn't send a code right now. Please try again in a minute.");
      else {
        setNeutral(json.neutral ? (json.message ?? null) : null);
        setStep("code");
      }
    } catch {
      setError("We couldn't reach the server. Check your connection.");
    }
    setBusy(false);
    turnstile.current?.reset();
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      setError(friendly(error.message));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-4">
      {linkFailed && (
        <p role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          That sign-in link didn&apos;t work. It may have expired, or been opened in a different
          browser from the one you requested it in. Request a new one below.
        </p>
      )}
      {denied && (
        <p role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          This account doesn&apos;t have access to that page. Sign in with a different email, or ask
          an admin to change your role.
        </p>
      )}
      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-3">
          <label className="block text-sm font-bold text-slate-700">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 px-3 text-base"
            />
          </label>
          <Turnstile
            ref={turnstile}
            onToken={(t, failed) => {
              setToken(t);
              setCheckFailed(Boolean(failed));
            }}
          />
          {checkFailed && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              We couldn&apos;t check that you&apos;re a person. Reload the page and try again.
            </p>
          )}
          <button
            type="submit"
            disabled={busy || (needsCheck && !token)}
            className="w-full min-h-12 rounded-xl bg-emerald-950 text-white font-bold disabled:opacity-50"
          >
            {busy ? "Sending…" : needsCheck && !token && !checkFailed ? "Just a moment…" : "Email me a sign-in link"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
            {neutral ? (
              <>
                {neutral} Check <strong>{email}</strong> and open the link in this same browser.
              </>
            ) : (
              <>
                Check <strong>{email}</strong> and click the sign-in link. Open it in this same
                browser. You can close this page.
              </>
            )}
          </p>
          <p className="text-sm text-slate-600">If your email shows a code instead, enter it here:</p>
          <label className="block text-sm font-bold text-slate-700">
            Code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 px-3 text-lg tracking-widest"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-12 rounded-xl bg-emerald-950 text-white font-bold disabled:opacity-50"
          >
            {busy ? "Checking…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
            }}
            className="w-full min-h-11 text-sm font-semibold text-slate-600"
          >
            Use a different email
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/** Only allow redirects back into this site. */

function friendly(message: string): string {
  if (/expired|invalid/i.test(message)) return "That code is wrong or has expired. Request a new one.";
  if (/rate|too many/i.test(message)) return "Too many attempts. Wait a minute and try again.";
  return message;
}
