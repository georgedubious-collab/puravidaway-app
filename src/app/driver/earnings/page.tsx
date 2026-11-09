import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { usd, type DriverTrip } from "@/lib/bookings";
import { formatScheduledAt } from "@/lib/dates";
import { balanceText, settlementUsd } from "@/lib/settlement";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DriverHeader } from "../DriverHeader";

export const metadata: Metadata = { title: "Earnings | Costa Rica Private Transfers Drivers", robots: { index: false, follow: false } };

export default function DriverEarningsPage() {
  return (
    <main className="flex-1 bg-slate-50">
      <DriverHeader />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Suspense fallback={<p className="text-sm font-semibold text-slate-500">Loading…</p>}>
          <Earnings />
        </Suspense>
      </div>
    </main>
  );
}

/** Completed trips, the driver's payout on each, and the balance still to settle with the team. */
async function Earnings() {
  await requireUser("/driver/earnings");
  const supabase = (await createSupabaseServerClient())!;
  const { data, error } = await supabase.rpc("my_trips").then((r) => r as { data: DriverTrip[] | null; error: { message: string } | null });
  if (error) return <p className="font-semibold text-red-700">Couldn&apos;t load your earnings. Please reload.</p>;
  const done = (data ?? []).filter((t) => t.status === "completed" && t.driver_payout != null).reverse();
  const open = done.filter((t) => !t.driver_settled_at);
  const balance = open.reduce((n, t) => n + settlementUsd(t), 0);
  const earned = done.reduce((n, t) => n + Number(t.driver_payout ?? 0), 0);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-slate-900">Earnings</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">To settle</p>
          <p className={`text-2xl font-extrabold ${balance < 0 ? "text-amber-700" : "text-emerald-700"}`}>{balanceText(balance)}</p>
          <p className="mt-1 text-xs text-slate-500">{open.length} completed trip{open.length === 1 ? "" : "s"} not settled yet. We settle weekly.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Earned so far</p>
          <p className="text-2xl font-extrabold text-slate-900">{usd(earned)}</p>
          <p className="mt-1 text-xs text-slate-500">{done.length} completed trip{done.length === 1 ? "" : "s"}.</p>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Trips paid online: we pay you your payout. Cash trips: you collect the traveller&apos;s payment, keep your payout
        and pass on the rest.
      </p>
      {done.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">No completed trips yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {done.map((t) => {
            const s = settlementUsd(t);
            return (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="block text-xs font-bold text-slate-500">
                    {formatScheduledAt(t.scheduled_at)} · <span className="font-mono">{t.booking_ref}</span>
                  </span>
                  <span className="font-bold text-slate-900">
                    {t.service_type === "transfer" ? `${t.origin} → ${t.destination}` : "Tour"}
                  </span>
                  {t.cash_to_collect != null && (
                    <span className="block text-xs text-slate-500">Cash trip: you collected {usd(t.cash_to_collect)}</span>
                  )}
                </span>
                <span className="text-right">
                  <span className="block font-extrabold text-emerald-700">{usd(t.driver_payout ?? 0)}</span>
                  <span className="text-xs font-semibold text-slate-500">
                    {t.driver_settled_at ? `Settled ${t.driver_settled_at.slice(0, 10)}` : balanceText(s)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
