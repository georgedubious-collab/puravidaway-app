import Link from "next/link";
import { Card, DataTable, Notice, PageHeader, Td, Th, btn, field, link } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { getCatalog } from "@/lib/catalogSource";
import { todayInCostaRica } from "@/lib/dates";
import { barPct, changePct, computeMoneyReport, parseReportPeriod, type Group } from "@/lib/moneyReport";
import { loadPeriod } from "@/lib/moneyReportServer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT, type TeamLang } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

/**
 * The money report (/admin/reports): for a month (or any range of pickup days), what was booked
 * and received, our share against the drivers' payouts, cash held by drivers, refunds and promo
 * discounts, with breakdowns and the month before for comparison. Definitions:
 * src/lib/moneyReport.ts (also written under each number). Admins only.
 */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("admin", "/admin/reports");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const today = todayInCostaRica();
  const period = parseReportPeriod(await searchParams, today);
  const db = (await createSupabaseServerClient())!;
  const [now, before, catalog] = await Promise.all([loadPeriod(db, period.from, period.to), loadPeriod(db, period.prevFrom, period.prevTo), getCatalog()]);
  if ("error" in now || "error" in before) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("Informes", "Reports")} />
        <Notice>
          {t("El informe necesita la migración", "The report needs migration")} <code>20261112000052_promo_codes.sql</code>.{" "}
          {t("Se aplica sola después de la fusión; recargue en un minuto.", "It runs by itself after the merge; reload in a minute.")}
        </Notice>
      </div>
    );
  }
  const r = computeMoneyReport(now.data.bookings, now.data.refunds, now.data.redemptions);
  const p = computeMoneyReport(before.data.bookings, before.data.refunds, before.data.redemptions);
  const names = now.data.driverNames;
  const vehicleName = (id: string) => catalog.vehicles.find((v) => v.id === id)?.name ?? id;
  const serviceName = (k: string) => (k === "transfer" ? t("Traslados", "Rides") : k === "day_tour" ? t("Tours de un día", "Day tours") : t("Otros (viajes de varios días)", "Other (multi-day trips)"));
  const periodLabel = period.month ? monthLabel(period.month, lang) : `${period.from} → ${period.to}`;
  const prevLabel = period.month ? monthLabel(period.prevFrom.slice(0, 7), lang) : `${period.prevFrom} → ${period.prevTo}`;
  const shiftMonth = (ym: string, n: number) => {
    const [y, m] = ym.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
  };
  const csvHref = `/admin/reports/export?from=${period.from}&to=${period.to}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Informe de dinero", "Money report")}
        subtitle={t(
          `${periodLabel}, por fecha de recogida (hora de Costa Rica). Comparado con ${prevLabel}. Sin reservas de prueba; las canceladas solo cuentan en reembolsos.`,
          `${periodLabel}, by pickup date (Costa Rica time). Compared with ${prevLabel}. Test bookings left out; cancelled ones only count under refunds.`,
        )}
        actions={
          <>
            <a href={csvHref} className={btn.secondary} download>
              {t("Descargar CSV", "Download CSV")}
            </a>
            <Link href="/admin/promos" className={link}>
              {t("Códigos promocionales", "Promo codes")}
            </Link>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          {period.month && (
            <nav className="flex items-center gap-2" aria-label={t("Cambiar de mes", "Change month")}>
              <Link href={`/admin/reports?month=${shiftMonth(period.month, -1)}`} className={btn.secondary} aria-label={t("Mes anterior", "Previous month")}>
                ←
              </Link>
              <span className="min-w-36 text-center font-extrabold capitalize">{monthLabel(period.month, lang)}</span>
              <Link href={`/admin/reports?month=${shiftMonth(period.month, 1)}`} className={btn.secondary} aria-label={t("Mes siguiente", "Next month")}>
                →
              </Link>
            </nav>
          )}
          <form method="get" className="flex flex-wrap items-end gap-2">
            <label className={field.label}>
              {t("Mes", "Month")}
              <input type="month" name="month" defaultValue={period.month ?? today.slice(0, 7)} className={field.input} />
            </label>
            <button type="submit" className={btn.primary}>
              {t("Ver mes", "Show month")}
            </button>
          </form>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <label className={field.label}>
              {t("Desde", "From")}
              <input type="date" name="from" required defaultValue={period.from} className={field.input} />
            </label>
            <label className={field.label}>
              {t("Hasta", "To")}
              <input type="date" name="to" required defaultValue={period.to} className={field.input} />
            </label>
            <button type="submit" className={btn.secondary}>
              {t("Ver rango", "Show range")}
            </button>
          </form>
        </div>
      </Card>

      <section aria-label={t("Cifras principales", "Headline numbers")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Headline
          lang={lang}
          label={t("Reservado", "Booked")}
          now={r.revenue.bookedCents}
          before={p.revenue.bookedCents}
          note={t("Precio de las reservas (ya con descuentos) + cargos por efectivo.", "Booking prices (after discounts) + cash booking fees.")}
        />
        <Headline
          lang={lang}
          label={t("Recibido", "Received")}
          now={r.revenue.receivedCents}
          before={p.revenue.receivedCents}
          note={t("En línea (monto pagado) + efectivo de viajes completados.", "Online (amount paid) + cash on completed trips.")}
        />
        <Headline
          lang={lang}
          label={t("Pendiente de cobro", "Outstanding")}
          now={r.revenue.outstandingCents}
          before={p.revenue.outstandingCents}
          note={t("Reservado − recibido (pagos en línea pendientes y viajes en efectivo aún no hechos).", "Booked − received (online payments due and cash trips not done yet).")}
        />
        <Headline
          lang={lang}
          label={t("Nuestra parte", "Our share")}
          now={r.split.platformCents + r.split.cashFeeCents}
          before={p.split.platformCents + p.split.cashFeeCents}
          note={t("Precio − pago al conductor, + cargos por efectivo. Incluye lo que pagamos por entradas y almuerzos.", "Price − driver payout, + cash booking fees. Includes what we pay for entrances and lunches.")}
        />
        <Headline
          lang={lang}
          label={t("Pagos a conductores", "Driver payouts")}
          now={r.split.payoutCents}
          before={p.split.payoutCents}
          note={t("Suma de los pagos guardados en cada reserva (incluye ferris).", "Sum of the payouts stored on each booking (ferries included).")}
        />
        <Headline
          lang={lang}
          label={t("Viajes", "Trips")}
          now={r.counted}
          before={p.counted}
          count
          note={t(`Reservas contadas. Fuera: ${r.cancelled} canceladas, ${r.excludedTest} de prueba.`, `Bookings counted. Left out: ${r.cancelled} cancelled, ${r.excludedTest} test.`)}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("Cómo se cobró", "How it was paid")}>
          <Bars
            rows={[
              [t("En línea (tarjeta o transferencia registrada)", "Online (card or recorded transfer)"), r.revenue.onlineCents, "bg-[#047857]"],
              [t("Efectivo cobrado por conductores", "Cash collected by drivers"), r.revenue.cashCents, "bg-[#F5B301]"],
              [t("Pendiente", "Outstanding"), r.revenue.outstandingCents, "bg-[#C9D3CE]"],
            ]}
          />
          <Defs>
            {t(
              "En línea = monto pagado registrado en la reserva. Efectivo = en viajes «efectivo al conductor» completados, lo que el conductor cobró (precio + cargo − lo pagado en línea).",
              "Online = amount paid recorded on the booking. Cash = on completed \"cash to the driver\" trips, what the driver collected (price + fee − anything paid online).",
            )}
          </Defs>
        </Card>

        <Card title={t("Nuestra parte y la de los conductores", "Our share and the drivers'")}>
          <Bars
            rows={[
              [t("Pagos a conductores", "Driver payouts"), r.split.payoutCents, "bg-[#0B2E22]"],
              [t("Nuestra comisión", "Our commission"), r.split.commissionCents, "bg-[#047857]"],
              [t("Costos que paga la empresa", "Costs the company pays"), r.split.companyCostCents, "bg-[#7FB89E]"],
              [t("Cargos por efectivo", "Cash booking fees"), r.split.cashFeeCents, "bg-[#F5B301]"],
            ]}
          />
          <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            <Line k={t("Ferris (pasan completos al conductor)", "Ferries (paid to the driver in full)")} v={money(r.split.passThroughCents)} />
            <Line k={t("Entradas, almuerzos, actividades (los paga la empresa)", "Entrances, lunches, activities (the company pays)")} v={money(r.split.companyCostCents)} />
            <Line k={t("Recargo nocturno (dentro de los precios)", "Night premium (inside the prices)")} v={money(r.split.nightCents)} />
            {r.split.unsplitCents > 0 && <Line k={t("Sin reparto automático (viajes de varios días)", "No automatic split (multi-day trips)")} v={money(r.split.unsplitCents)} />}
          </dl>
          <Defs>
            {t(
              `Comisión = nuestra parte − costos que paga la empresa. Los ferris se guardan desde el 12 nov 2026 (${r.split.passThroughKnown} de ${r.counted} reservas los tienen); antes no se registraban.`,
              `Commission = our share − costs the company pays. Ferries are recorded since 12 Nov 2026 (${r.split.passThroughKnown} of ${r.counted} bookings have them); earlier bookings didn't record them.`,
            )}
          </Defs>
        </Card>

        <Card title={t("Efectivo y liquidaciones con conductores", "Cash and settlements with drivers")}>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            <Line k={t("Efectivo que cobraron los conductores", "Cash the drivers collected")} v={money(r.drivers.cashCollectedCents)} strong />
            <Line k={t(`Por liquidar: les debemos (${r.drivers.toSettle.trips} viajes)`, `To settle: we owe drivers (${r.drivers.toSettle.trips} trips)`)} v={money(r.drivers.toSettle.weOweCents)} />
            <Line k={t("Por liquidar: los conductores nos deben", "To settle: drivers owe us")} v={money(r.drivers.toSettle.theyOweCents)} />
            <Line k={t(`Ya liquidado: les pagamos (${r.drivers.settled.trips} viajes)`, `Settled: we paid drivers (${r.drivers.settled.trips} trips)`)} v={money(r.drivers.settled.weOweCents)} />
            <Line k={t("Ya liquidado: nos pagaron", "Settled: drivers paid us")} v={money(r.drivers.settled.theyOweCents)} />
          </dl>
          <Defs>
            {t(
              "Igual que en Pagos a conductores: viaje en línea = le debemos su pago; viaje en efectivo = nos debe lo cobrado menos su pago. Solo viajes completados de este periodo.",
              "Same as Payouts: online trip = we owe their payout; cash trip = they owe what they collected minus their payout. Completed trips of this period only.",
            )}{" "}
            <Link href="/admin/payouts" className={link}>
              {t("Ir a Pagos a conductores", "Go to Payouts")}
            </Link>
          </Defs>
        </Card>

        <Card title={t("Reembolsos", "Refunds")}>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            <Line k={t(`Reservas canceladas con reembolso registrado`, `Cancelled bookings with a refund record`)} v={String(r.refunds.bookings)} />
            <Line k={t("Recibido de esas reservas", "Received on those bookings")} v={money(r.refunds.receivedCents)} />
            <Line k={t("Reembolsos que debemos", "Refunds owed")} v={money(r.refunds.owedCents)} strong />
            <Line k={t("Reembolsos ya pagados", "Refunds paid")} v={money(r.refunds.paidCents)} />
            <Line k={t("Falta por pagar", "Still to pay")} v={money(r.refunds.stillToPayCents)} />
            <Line k={t("Nos quedamos (cancelación tardía)", "We keep (late cancellations)")} v={money(r.refunds.keptCents)} />
          </dl>
          <Defs>{t("De la ficha de cancelación de cada reserva cancelada con recogida en este periodo.", "From the cancellation record of each cancelled booking with a pickup in this period.")}</Defs>
        </Card>

        <Card title={t("Descuentos promocionales", "Promo discounts")}>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            <Line k={t(`Descuento total (${r.promos.bookings} reservas)`, `Total discount (${r.promos.bookings} bookings)`)} v={money(r.promos.discountCents)} strong />
            <Line k={t("De nuestra parte", "From our share")} v={money(r.promos.platformCents)} />
            <Line k={t("De los pagos a conductores", "From driver payouts")} v={money(r.promos.driverCents)} />
          </dl>
          {r.promos.byCode.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {r.promos.byCode.map((x) => (
                <li key={x.code} className="flex justify-between gap-3">
                  <span className="font-mono font-bold">{x.code}</span>
                  <span>
                    {x.bookings} · {money(x.discountCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Defs>
            {t(
              "Mitad y mitad: la mitad del conductor se redondea hacia abajo al centavo y nosotros absorbemos el centavo impar. Los precios de arriba ya están con el descuento.",
              "Half and half: the driver's half is rounded down to the cent and we absorb the odd cent. The prices above are already after the discount.",
            )}
          </Defs>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Breakdown title={t("Por servicio", "By service")} groups={r.byService} label={serviceName} lang={lang} />
        <Breakdown title={t("Por tipo de vehículo (traslados)", "By vehicle class (rides)")} groups={r.byVehicle} label={vehicleName} lang={lang} />
        <Breakdown title={t("Rutas y tours principales (10)", "Top routes and tours (10)")} groups={r.byRoute} label={(k) => k} lang={lang} />
        <Breakdown title={t("Por conductor", "By driver")} groups={r.byDriver} label={(k) => names[k] ?? "—"} lang={lang} payouts />
      </div>
    </div>
  );
}

function monthLabel(ym: string, lang: TeamLang): string {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "es" ? "es-CR" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function Headline({ label, now, before, note, lang, count }: { label: string; now: number; before: number; note: string; lang: TeamLang; count?: boolean }) {
  const t = makeT(lang);
  const pct = changePct(now, before);
  const fmt = (n: number) => (count ? String(n) : money(n));
  return (
    <div className="rounded-2xl border border-[#E3E8E5] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#5F6F67]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-[#14231C]">{fmt(now)}</p>
      <p className="mt-0.5 text-xs font-semibold text-[#33443C]">
        {pct === null ? t(`Antes: ${fmt(before)}`, `Before: ${fmt(before)}`) : `${pct > 0 ? "▲" : pct < 0 ? "▼" : "■"} ${pct > 0 ? "+" : ""}${pct}% ${t(`vs ${fmt(before)}`, `vs ${fmt(before)}`)}`}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-[#5F6F67]">{note}</p>
    </div>
  );
}

function Bars({ rows }: { rows: [string, number, string][] }) {
  const max = Math.max(0, ...rows.map((r) => r[1]));
  return (
    <ul className="space-y-3">
      {rows.map(([label, cents, color]) => (
        <li key={label}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-[#33443C]">{label}</span>
            <span className="font-extrabold text-[#14231C]">{money(cents)}</span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-[#EEF2EF]" aria-hidden>
            <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${barPct(cents, max)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <>
      <dt className="text-[#33443C]">{k}</dt>
      <dd className={`text-right ${strong ? "font-extrabold" : "font-semibold"} text-[#14231C]`}>{v}</dd>
    </>
  );
}

function Defs({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 border-t border-[#EDF1EE] pt-3 text-xs leading-relaxed text-[#5F6F67]">{children}</p>;
}

function Breakdown({ title, groups, label, lang, payouts }: { title: string; groups: Group[]; label: (k: string) => string; lang: TeamLang; payouts?: boolean }) {
  const t = makeT(lang);
  const max = Math.max(0, ...groups.map((g) => g.bookedCents));
  return (
    <Card title={title} padded={false}>
      {groups.length === 0 ? (
        <p className="p-5 text-sm text-[#5F6F67]">{t("Nada en este periodo.", "Nothing in this period.")}</p>
      ) : (
        <DataTable minWidth={460} caption={title}>
          <thead>
            <tr>
              <Th>{payouts ? t("Conductor", "Driver") : t("Nombre", "Name")}</Th>
              <Th align="right">{t("Viajes", "Trips")}</Th>
              <Th align="right">{payouts ? t("Pagos", "Payouts") : t("Reservado", "Booked")}</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key}>
                <Td>
                  <span className="font-semibold">{label(g.key)}</span>
                  <div className="mt-1 h-1.5 rounded-full bg-[#EEF2EF]" aria-hidden>
                    <div className="h-1.5 rounded-full bg-[#047857]" style={{ width: `${barPct(g.bookedCents, max)}%` }} />
                  </div>
                </Td>
                <Td align="right">{g.trips}</Td>
                <Td align="right">
                  <span className="font-bold">{money(payouts ? g.payoutCents : g.bookedCents)}</span>
                  <span className="block text-xs text-[#5F6F67]">
                    {payouts ? t(`reservado ${money(g.bookedCents)}`, `booked ${money(g.bookedCents)}`) : t(`nuestra parte ${money(g.platformCents)}`, `our share ${money(g.platformCents)}`)}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Card>
  );
}
