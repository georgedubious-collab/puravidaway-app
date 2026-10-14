import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Sign in | PuraVidaWay" };

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-slate-50">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold text-slate-900">Sign in</h1>
        {isSupabaseConfigured ? (
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            Logins aren&apos;t connected yet. Follow <code>docs/SETUP-SUPABASE.md</code> to connect
            Supabase, then come back here.
          </p>
        )}
      </div>
    </main>
  );
}
