import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { requireRole } from "@/lib/auth";
import { usd } from "@/lib/bookings";
import { formatScheduledAt } from "@/lib/dates";
import { balanceText, settlementUsd } from "@/lib/settlement";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { settleDriver } from "./actions";

interface Row {
  id: string;
  booking_ref: string;
  assigned_driver_id: string;
  scheduled_at: string | null;
  origin: string | null;
  destination: string | null;
  service_type: string;
  total_price: number | string;
  cash_fee: number | string | null;
  amount_paid: number | string | null;
  payment_mode: string | null;
  driver_payout: number | string | null;
  platform_fee: number | string | null;
  company_costs: number | string | null;
}

/**
 * Completed trips not yet settled, per driver: what we owe them (online trips) minus
 * what they owe us (cash trips, where they collected the traveller's payment).
 */
export default async function PayoutsPage() {
  await requireRole("admin", "/admin/payouts");
  const supabase = (await createSupabaseServerClient())!;
  const { data, error } = await supabase
    .from("bookings")
    .select("id, booking_ref, assigned_driver_id, scheduled_at, origin, destination, service_type, total_price, cash_fee, amount_paid, payment_mode, driver_payout, platform_fee, company_costs")
    .eq("status", "completed")
    .is("driver_settled_at", null)
    .not("assigned_driver_id", "is", null)
    .not("driver_payout", "is", null)
    .order("scheduled_at")
    .returns<Row[]>();
  if (error) {
    return (
      <p className="text-sm text-amber-800">
        Payouts need migration <code>20261109000025_driver_settlements.sql</code>. It runs by itself after the merge; reload in a minute.
      </p>
    );
  }
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.assigned_driver_id))];
  const { data: names } = ids.length ? await supabase.from("profiles").select("id, full_name, phone").in("id", ids) : { data: [] };
  const cash = (r: Row) =>
    r.payment_mode === "cash_driver" ? Number(r.total_price) + Number(r.cash_fee ?? 0) - Number(r.amount_paid ?? 0) : null;
  const net = (r: Row) => settlementUsd({ driver_payout: r.driver_payout, cash_to_collect: cash(r) });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Driver payouts</h1>
        <p className="mt-1 text-sm text-slate-600">
          Completed trips that haven&apos;t been settled. Online trips: you pay the driver their payout. Cash trips: the
          driver collected the traveller&apos;s payment and owes you the difference. Settle weekly, then tick and save.
        </p>
      </div>
      {ids.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Nothing to settle right now.</p>}
      {ids.map((id) => {
        const mine = rows.filter((r) => r.assigned_driver_id === id);
        const total = mine.reduce((n, r) => n + net(r), 0);
        const who = names?.find((p) => p.id === id);
        return (
          <section key={id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-extrabold text-slate-900">
                <Link href={`/admin/drivers/${id}`} className="underline">{who?.full_name ?? "Driver"}</Link>
                <span className="ml-2 text-sm font-semibold text-slate-500">{who?.phone}</span>
              </h2>
              <p className={`text-lg font-extrabold ${total < 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {balanceText(total, "Pay the driver", "Driver owes you")}
              </p>
            </div>
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {mine.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/admin/bookings/${r.id}`} className="hover:underline">
                    <span className="font-mono font-bold">{r.booking_ref}</span> · {formatScheduledAt(r.scheduled_at)} ·{" "}
                    {r.service_type === "transfer" ? `${r.origin} → ${r.destination}` : "Tour"}
                  </Link>
                  <span className="text-right">
                    <span className="font-bold">payout {usd(r.driver_payout ?? 0)}</span>
                    <span className="block text-xs text-slate-500">
                      {cash(r) != null ? `cash trip, driver collected ${usd(cash(r)!)} · ` : "paid online · "}
                      {balanceText(net(r), "pay", "owes")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <ActionForm action={settleDriver} submitLabel={`Mark ${mine.length} trip${mine.length === 1 ? "" : "s"} settled`} savedLabel="Settled" className="mt-4 space-y-3">
              <input type="hidden" name="driver_id" value={id} />
              <input type="hidden" name="booking_ids" value={mine.map((r) => r.id).join(",")} />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="confirm" className="h-5 w-5" /> The money has changed hands ({balanceText(total, "I paid the driver", "the driver paid me")})
              </label>
            </ActionForm>
          </section>
        );
      })}
    </div>
  );
}
