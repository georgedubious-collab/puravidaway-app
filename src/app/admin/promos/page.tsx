import Link from "next/link";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { Card, Chip, DataTable, EmptyState, Notice, PageHeader, Td, Th, field, link } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { usd } from "@/lib/bookings";
import { todayInCostaRica } from "@/lib/dates";
import { promoStatus, promoValueText, type PromoCodeRow, type PromoStatus } from "@/lib/promo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT, type TeamLang } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { savePromo, setPromoActive } from "./actions";

interface CodeRow extends PromoCodeRow {
  created_at: string;
}

interface Redemption {
  promo_code_id: string;
  trip_id: string;
  discount: number | string;
  platform_part: number | string;
  driver_part: number | string;
  bookings: { status: string } | null;
}

/**
 * Promo codes (/admin/promos): create, change, switch off; how often each was used and what it
 * cost. The discount is split 50/50: half off our share, half off the driver's payout (driver's
 * half rounded down to the cent). Rules: src/lib/promo.ts; docs/PRICING.md §9.
 */
export default async function PromosPage() {
  await requireRole("admin", "/admin/promos");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const db = (await createSupabaseServerClient())!;
  const [codes, reds] = await Promise.all([
    db
      .from("promo_codes")
      .select("id, code, description, discount_type, value, applies_to, min_order, valid_from, valid_to, max_uses, max_uses_per_email, active, created_at")
      .order("created_at", { ascending: false })
      .returns<CodeRow[]>(),
    db.from("promo_redemptions").select("promo_code_id, trip_id, discount, platform_part, driver_part, bookings(status)").returns<Redemption[]>(),
  ]);
  if (codes.error || reds.error) {
    return (
      <Notice>
        {t("Los códigos promocionales necesitan la migración", "Promo codes need migration")} <code>20261112000052_promo_codes.sql</code>.{" "}
        {t("Se aplica sola después de la fusión; recargue en un minuto.", "It runs by itself after the merge; reload in a minute.")}
      </Notice>
    );
  }
  const today = todayInCostaRica();
  // Cancelled bookings don't count as uses (same as the check at checkout) nor as money given away.
  const live = (reds.data ?? []).filter((r) => r.bookings?.status !== "cancelled");
  const usage = (id: string) => {
    const mine = live.filter((r) => r.promo_code_id === id);
    const sum = (k: "discount" | "platform_part" | "driver_part") => mine.reduce((n, r) => n + Math.round(Number(r[k]) * 100), 0) / 100;
    return { trips: new Set(mine.map((r) => r.trip_id)).size, discount: sum("discount"), platform: sum("platform_part"), driver: sum("driver_part") };
  };
  const all = live.reduce(
    (n, r) => ({
      discount: n.discount + Math.round(Number(r.discount) * 100),
      platform: n.platform + Math.round(Number(r.platform_part) * 100),
      driver: n.driver + Math.round(Number(r.driver_part) * 100),
    }),
    { discount: 0, platform: 0, driver: 0 },
  );
  const rows = codes.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Códigos promocionales", "Promo codes")}
        subtitle={t(
          "Descuentos que el cliente escribe al reservar (sitio web y app). Cada descuento se reparte 50/50: la mitad sale de nuestra parte y la mitad del pago al conductor (la mitad del conductor se redondea hacia abajo al centavo). Nunca se descuentan ferris, entradas a parques ni lo que paga la empresa, y nuestra mitad nunca pasa de nuestra comisión. El conductor solo ve su pago, nunca el código.",
          "Discounts the traveller types when booking (website and app). Each discount is split 50/50: half comes off our share and half off the driver's payout (the driver's half is rounded down to the cent). Ferries, park entrances and what the company pays are never discounted, and our half never exceeds our commission. The driver only sees their payout, never the code.",
        )}
        actions={
          <Link href="/admin/reports" className={link}>
            {t("Ver el informe de dinero", "See the money report")}
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3" aria-label={t("Totales", "Totals")}>
        <Stat label={t("Descuentos dados (todo el tiempo)", "Discounts given (all time)")} value={usd(all.discount / 100)} />
        <Stat label={t("De nuestra parte", "From our share")} value={usd(all.platform / 100)} />
        <Stat label={t("De los pagos a conductores", "From driver payouts")} value={usd(all.driver / 100)} />
      </section>

      <Card title={t("Nuevo código", "New code")} id="new-code">
        <AdminActionForm
          action={savePromo}
          lang={lang}
          submitLabel={t("Crear código", "Create code")}
          savedLabel={t("Creado", "Created")}
          confirm={[
            {
              kind: "always",
              message: t(
                "Los clientes podrán usar este código en cuanto lo cree (dentro de las fechas que puso). ¿Crearlo?",
                "Travellers can use this code as soon as you create it (within the dates you set). Create it?",
              ),
            },
          ]}
          className="space-y-4"
        >
          <PromoFields lang={lang} />
        </AdminActionForm>
      </Card>

      <Card title={t("Códigos", "Codes")} padded={false}>
        {rows.length === 0 ? (
          <EmptyState title={t("Aún no hay códigos.", "No codes yet.")} text={t("Cree el primero arriba.", "Create the first one above.")} />
        ) : (
          <DataTable minWidth={880} caption={t("Códigos promocionales", "Promo codes")}>
            <thead>
              <tr>
                <Th>{t("Código", "Code")}</Th>
                <Th>{t("Descuento", "Discount")}</Th>
                <Th>{t("Validez", "Valid")}</Th>
                <Th align="right">{t("Usos", "Uses")}</Th>
                <Th align="right">{t("Descontado", "Discounted")}</Th>
                <Th>{t("Estado", "Status")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const u = usage(c.id);
                const status = promoStatus(c, today, u.trips);
                return (
                  <tr key={c.id}>
                    <Td>
                      <span className="font-mono font-extrabold">{c.code}</span>
                      {c.description && <span className="block text-xs text-[#5F6F67]">{c.description}</span>}
                      <details className="mt-2">
                        <summary className={`cursor-pointer text-xs ${link}`}>{t("Editar o desactivar", "Edit or switch off")}</summary>
                        <div className="mt-3 space-y-4 rounded-xl border border-[#E3E8E5] p-3">
                          <AdminActionForm
                            action={savePromo}
                            lang={lang}
                            submitLabel={t("Guardar cambios", "Save changes")}
                            savedLabel={t("Guardado", "Saved")}
                            confirm={[
                              {
                                kind: "changed",
                                fields: ["value", "discount_type", "applies_to", "min_order"],
                                message: t(
                                  "El descuento cambia para las próximas reservas ({from} → {to}). Las reservas ya hechas mantienen el suyo.",
                                  "The discount changes for new bookings ({from} → {to}). Bookings already made keep theirs.",
                                ),
                              },
                            ]}
                            className="space-y-4"
                          >
                            <input type="hidden" name="id" value={c.id} />
                            <PromoFields lang={lang} code={c} />
                          </AdminActionForm>
                          <AdminActionForm
                            action={setPromoActive}
                            lang={lang}
                            danger={c.active}
                            submitLabel={c.active ? t("Desactivar el código", "Switch the code off") : t("Activar el código", "Switch the code on")}
                            savedLabel={t("Listo", "Done")}
                            confirm={[
                              {
                                kind: "always",
                                message: c.active
                                  ? t(
                                      `Nadie podrá usar ${c.code} desde ahora. Las reservas que ya lo usaron mantienen su descuento.`,
                                      `Nobody can use ${c.code} from now on. Bookings that already used it keep their discount.`,
                                    )
                                  : t(`Los clientes podrán volver a usar ${c.code}.`, `Travellers can use ${c.code} again.`),
                              },
                            ]}
                          >
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="active" value={c.active ? "false" : "true"} />
                          </AdminActionForm>
                        </div>
                      </details>
                    </Td>
                    <Td>
                      <span className="font-bold">{promoValueText(c)}</span>
                      <span className="block text-xs text-[#5F6F67]">
                        {appliesText(c.applies_to, lang)}
                        {Number(c.min_order) > 0 ? t(` · mínimo ${usd(c.min_order)}`, ` · min ${usd(c.min_order)}`) : ""}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-sm">
                        <span className="whitespace-nowrap">{c.valid_from ?? t("siempre", "any time")}</span> →{" "}
                        <span className="whitespace-nowrap">{c.valid_to ?? t("sin fin", "no end")}</span>
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-bold">
                        {u.trips}
                        {c.max_uses != null ? ` / ${c.max_uses}` : ""}
                      </span>
                      <span className="block text-xs text-[#5F6F67]">
                        {c.max_uses_per_email != null ? t(`${c.max_uses_per_email} por correo`, `${c.max_uses_per_email} per email`) : t("sin límite por correo", "no per-email limit")}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-bold">{usd(u.discount)}</span>
                      <span className="block text-xs text-[#5F6F67]">
                        {t(`nosotros ${usd(u.platform)} · conductores ${usd(u.driver)}`, `us ${usd(u.platform)} · drivers ${usd(u.driver)}`)}
                      </span>
                    </Td>
                    <Td>
                      <StatusChip status={status} lang={lang} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </Card>
      <p className="text-xs text-[#5F6F67]">
        {t(
          "Usos = viajes (no reservas) que usaron el código; las reservas canceladas no cuentan. Un código por viaje. Si el cliente no ve el descuento, el mensaje es siempre «Este código no es válido» (sin decir por qué), y después de 10 intentos fallidos en una hora desde la misma red se bloquea por una hora.",
          "Uses = trips (not bookings) that used the code; cancelled bookings don't count. One code per trip. When a code can't be used the traveller always sees \"This code isn't valid\" (never why), and after 10 wrong tries in an hour from one network, checks are blocked for an hour.",
        )}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E3E8E5] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#5F6F67]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-[#14231C]">{value}</p>
    </div>
  );
}

function appliesText(a: string, lang: TeamLang): string {
  const t = makeT(lang);
  return a === "rides" ? t("solo traslados", "rides only") : a === "tours" ? t("solo tours", "tours only") : t("traslados y tours", "rides and tours");
}

function StatusChip({ status, lang }: { status: PromoStatus; lang: TeamLang }) {
  const t = makeT(lang);
  const map: Record<PromoStatus, [string, "green" | "grey" | "amber" | "red" | "blue"]> = {
    active: [t("Activo", "Active"), "green"],
    inactive: [t("Desactivado", "Off"), "grey"],
    scheduled: [t("Programado", "Scheduled"), "blue"],
    expired: [t("Vencido", "Expired"), "amber"],
    used_up: [t("Agotado", "Used up"), "red"],
  };
  const [label, tone] = map[status];
  return <Chip tone={tone}>{label}</Chip>;
}

/** The fields of one code (new or existing). */
function PromoFields({ lang, code }: { lang: TeamLang; code?: CodeRow }) {
  const t = makeT(lang);
  const n = (v: number | string | null | undefined) => (v == null ? "" : String(Number(v)));
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className={field.label}>
        {t("Código", "Code")}
        <input name="code" required defaultValue={code?.code ?? ""} maxLength={30} autoComplete="off" className={`${field.input} font-mono uppercase`} />
        <span className={field.hint}>{t("3–30 letras o números, p. ej. VERANO10", "3–30 letters or digits, e.g. SUMMER10")}</span>
      </label>
      <label className={`${field.label} sm:col-span-2`}>
        {t("Descripción (solo para el equipo)", "Description (team only)")}
        <input name="description" defaultValue={code?.description ?? ""} maxLength={200} className={field.input} />
      </label>
      <label className={field.label}>
        {t("Tipo", "Type")}
        <select name="discount_type" defaultValue={code?.discount_type ?? "percent"} className={field.input}>
          <option value="percent">{t("Porcentaje (%)", "Percent (%)")}</option>
          <option value="fixed">{t("Monto fijo (USD por viaje)", "Fixed amount (USD per trip)")}</option>
        </select>
      </label>
      <label className={field.label}>
        {t("Descuento", "Discount")}
        <input name="value" required inputMode="decimal" defaultValue={n(code?.value)} className={field.input} />
        <span className={field.hint}>{t("10 = 10 % o $10", "10 = 10% or $10")}</span>
      </label>
      <label className={field.label}>
        {t("Se aplica a", "Applies to")}
        <select name="applies_to" defaultValue={code?.applies_to ?? "both"} className={field.input}>
          <option value="both">{t("Traslados y tours", "Rides and tours")}</option>
          <option value="rides">{t("Solo traslados", "Rides only")}</option>
          <option value="tours">{t("Solo tours", "Tours only")}</option>
        </select>
      </label>
      <label className={field.label}>
        {t("Pedido mínimo (USD)", "Minimum order (USD)")}
        <input name="min_order" inputMode="decimal" defaultValue={code && Number(code.min_order) > 0 ? n(code.min_order) : ""} className={field.input} />
        <span className={field.hint}>{t("Vacío = sin mínimo", "Empty = no minimum")}</span>
      </label>
      <label className={field.label}>
        {t("Válido desde", "Valid from")}
        <input name="valid_from" type="date" defaultValue={code?.valid_from ?? ""} className={field.input} />
      </label>
      <label className={field.label}>
        {t("Válido hasta (incluido)", "Valid until (included)")}
        <input name="valid_to" type="date" defaultValue={code?.valid_to ?? ""} className={field.input} />
      </label>
      <label className={field.label}>
        {t("Usos máximos en total", "Most uses in total")}
        <input name="max_uses" inputMode="numeric" defaultValue={n(code?.max_uses)} className={field.input} />
        <span className={field.hint}>{t("Vacío = sin límite", "Empty = no limit")}</span>
      </label>
      <label className={field.label}>
        {t("Usos máximos por correo", "Most uses per email")}
        <input name="max_uses_per_email" inputMode="numeric" defaultValue={n(code?.max_uses_per_email)} className={field.input} />
        <span className={field.hint}>{t("Vacío = sin límite", "Empty = no limit")}</span>
      </label>
    </div>
  );
}
