import Link from "next/link";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { Card, EmptyState, Notice, PageHeader, link } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { usd } from "@/lib/bookings";
import { formatScheduledAt } from "@/lib/dates";
import { balanceText, settlementUsd } from "@/lib/settlement";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
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
  const lang = await getTeamLang();
  const t = makeT(lang);
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
      <Notice>
        {t("Los pagos a conductores necesitan la migración", "Payouts need migration")} <code>20261109000025_driver_settlements.sql</code>.{" "}
        {t(
          "Se aplica sola después de la fusión; recargue en un minuto.",
          "It runs by itself after the merge; reload in a minute.",
        )}
      </Notice>
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
      <PageHeader
        title={t("Pagos a conductores", "Driver payouts")}
        subtitle={t(
            "Viajes completados que aún no se han liquidado. Viajes pagados en línea: usted le paga al conductor su pago. Viajes en efectivo: el conductor cobró el pago del cliente y le debe a usted la diferencia. Liquide cada semana, luego marque la casilla y guarde.",
            "Completed trips that haven't been settled. Online trips: you pay the driver their payout. Cash trips: the driver collected the traveller's payment and owes you the difference. Settle weekly, then tick and save.",
        )}
      />
      {ids.length === 0 && (
        <Card>
          <EmptyState title={t("No hay nada que liquidar por ahora.", "Nothing to settle right now.")} />
        </Card>
      )}
      {ids.map((id) => {
        const mine = rows.filter((r) => r.assigned_driver_id === id);
        const total = mine.reduce((n, r) => n + net(r), 0);
        const who = names?.find((p) => p.id === id);
        return (
          <section key={id} className="rounded-2xl border border-[#E3E8E5] bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-extrabold text-[#14231C]">
                <Link href={`/admin/drivers/${id}`} className={link}>{who?.full_name ?? t("Conductor", "Driver")}</Link>
                <span className="ml-2 text-sm font-semibold text-[#5F6F67]">{who?.phone}</span>
              </h2>
              <p className={`text-lg font-extrabold ${total < 0 ? "text-amber-700" : "text-[#047857]"}`}>
                {balanceText(
                  total,
                  t("Pagar al conductor", "Pay the driver"),
                  t("El conductor le debe", "Driver owes you"),
                  lang,
                )}
              </p>
            </div>
            <ul className="mt-3 divide-y divide-[#EDF1EE] text-sm">
              {mine.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/admin/bookings/${r.id}`} className="hover:underline">
                    <span className="font-mono font-bold">{r.booking_ref}</span> · {formatScheduledAt(r.scheduled_at, lang)} ·{" "}
                    {r.service_type === "transfer" ? `${r.origin} → ${r.destination}` : "Tour"}
                  </Link>
                  <span className="text-right">
                    <span className="font-bold">
                      {t("pago", "payout")} {usd(r.driver_payout ?? 0)}
                    </span>
                    <span className="block text-xs text-[#5F6F67]">
                      {cash(r) != null
                        ? t(`viaje en efectivo, el conductor cobró ${usd(cash(r)!)} · `, `cash trip, driver collected ${usd(cash(r)!)} · `)
                        : t("pagado en línea · ", "paid online · ")}
                      {balanceText(net(r), t("pagar", "pay"), t("debe", "owes"), lang)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <AdminActionForm
              action={settleDriver}
              lang={lang}
              confirm={[
                {
                  kind: "always",
                  message: t(
                    `Se marcan ${mine.length} ${mine.length === 1 ? "viaje" : "viajes"} de ${who?.full_name ?? "este conductor"} como liquidados (${balanceText(total, "usted le pagó al conductor", "el conductor le pagó a usted", lang)}). Salen de esta lista y quedan en el historial de cada reserva.`,
                    `${mine.length} trip${mine.length === 1 ? "" : "s"} of ${who?.full_name ?? "this driver"} will be marked settled (${balanceText(total, "you paid the driver", "the driver paid you", lang)}). They leave this list and stay in each booking's history.`,
                  ),
                },
              ]}
              submitLabel={
                mine.length === 1
                  ? t("Marcar 1 viaje como liquidado", "Mark 1 trip settled")
                  : t(`Marcar ${mine.length} viajes como liquidados`, `Mark ${mine.length} trips settled`)
              }
              savedLabel={t("Liquidado", "Settled")}
              className="mt-4 space-y-3"
            >
              <input type="hidden" name="driver_id" value={id} />
              <input type="hidden" name="booking_ids" value={mine.map((r) => r.id).join(",")} />
              <label className="flex items-center gap-2 text-sm text-[#33443C]">
                <input type="checkbox" name="confirm" className="h-5 w-5" /> {t("El dinero ya se entregó", "The money has changed hands")} (
                {balanceText(
                  total,
                  t("le pagué al conductor", "I paid the driver"),
                  t("el conductor me pagó", "the driver paid me"),
                  lang,
                )}
                )
              </label>
            </AdminActionForm>
          </section>
        );
      })}
    </div>
  );
}
