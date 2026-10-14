"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/** Email + 6-digit code login. No passwords to forget or leak. */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const denied = params.get("denied") === "1";

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setError(friendly(error.message));
    else setStep("code");
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
          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-12 rounded-xl bg-emerald-950 text-white font-bold disabled:opacity-50"
          >
            {busy ? "Sending…" : "Email me a sign-in code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm text-slate-600">
            We sent a 6-digit code to <strong>{email}</strong>.
          </p>
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
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/admin";
}

function friendly(message: string): string {
  if (/expired|invalid/i.test(message)) return "That code is wrong or has expired. Request a new one.";
  if (/rate|too many/i.test(message)) return "Too many attempts. Wait a minute and try again.";
  return message;
}
