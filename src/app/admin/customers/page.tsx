import Link from "next/link";
import { Card, Chip, DataTable, EmptyState, Icon, Notice, PageHeader, Td, Th, btn, link } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { usd } from "@/lib/bookings";
import { CUSTOMERS_PAGE_SIZE, customerHref, customersHref, isRepeat, parseCustomerFilters, tripDay } from "@/lib/customers";
import { customersPage } from "@/lib/customersServer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";

/** Customers (team only): travellers grouped by email (or phone), with what they booked and spent. */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("admin", "/admin/customers");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const f = parseCustomerFilters(await searchParams);
  const db = (await createSupabaseServerClient())!;
  const { data: rows, error, total } = await customersPage(db, f);
  const pages = Math.max(1, Math.ceil(total / CUSTOMERS_PAGE_SIZE));
  const first = total ? (f.page - 1) * CUSTOMERS_PAGE_SIZE + 1 : 0;
  const last = Math.min(total, f.page * CUSTOMERS_PAGE_SIZE);
  const day = (iso: string | null) => tripDay(iso, lang);
  const sortLink = (s: "last" | "spent", label: string) => (
    <Link href={customersHref(f, { sort: s, page: 1 })} aria-current={f.sort === s ? "true" : undefined} className="inline-flex items-center gap-1 hover:text-[#14231C]">
      {label} {f.sort === s && <span aria-hidden>↓</span>}
    </Link>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("Clientes", "Customers")}
        subtitle={t(
          "Viajeros agrupados por correo (o por teléfono si no dejaron correo). «Gastado» = monto recibido, sin reservas canceladas ni pagos de prueba.",
          "Travellers grouped by email (or by phone when they left no email). \"Spent\" = amount received, leaving out cancelled bookings and test payments.",
        )}
        actions={
          <a href={customersHref(f, { page: 1 }, "/admin/customers/export")} className={btn.secondary} download>
            <Icon name="download" />
            {t("Exportar CSV", "Export CSV")}
          </a>
        }
      />
      <Card>
        <form method="get" action="/admin/customers" className="flex flex-wrap items-end gap-2.5">
          {f.sort !== "last" && <input type="hidden" name="sort" value={f.sort} />}
          <label className="min-w-0 flex-[1_1_300px]">
            <span className="sr-only">{t("Buscar clientes", "Search customers")}</span>
            <span className="flex min-h-11 items-center gap-2 rounded-xl border border-[#DCE3DF] bg-white px-3 focus-within:border-[#047857] focus-within:ring-2 focus-within:ring-[#047857]/20">
              <Icon name="search" className="h-[18px] w-[18px] shrink-0 text-[#5F6F67]" />
              <input name="q" type="search" defaultValue={f.q} placeholder={t("Nombre, correo, teléfono o etiqueta", "Name, email, phone or tag")} className="min-w-0 grow bg-transparent text-sm outline-none" />
            </span>
          </label>
          <button type="submit" className={btn.primary}>
            {t("Buscar", "Search")}
          </button>
          {f.q && (
            <Link href={customersHref({ ...f, q: "" }, { page: 1 })} className={btn.secondary}>
              {t("Quitar búsqueda", "Clear search")}
            </Link>
          )}
        </form>
        <p className="mt-3 flex flex-wrap gap-3 text-sm text-[#5F6F67]">
          {t("Ordenar:", "Sort:")} {sortLink("last", t("último viaje", "last trip"))} · {sortLink("spent", t("total gastado", "total spent"))}
        </p>
      </Card>

      {error ? (
        <Notice tone="red" role="alert">
          <p className="font-bold">{t("No se pudieron cargar los clientes.", "Couldn't load the customers.")}</p>
          <p className="mt-1 text-xs opacity-80">
            {/function .*admin_customers|does not exist|schema cache/i.test(error.message)
              ? t("La actualización de la base de datos aún no se aplicó (se aplica sola después de publicar).", "The database update hasn't run yet (it runs by itself after publishing).")
              : error.message}
          </p>
        </Notice>
      ) : (
        <Card padded={false}>
          {rows.length === 0 ? (
            <EmptyState
              title={f.q ? t("Ningún cliente coincide", "No customers match") : t("Aún no hay clientes", "No customers yet")}
              text={f.q ? t("Pruebe con otra búsqueda.", "Try another search.") : t("Cada solicitud del sitio, de la app o ingresada por ustedes crea uno.", "Every request from the website, the app or entered by you creates one.")}
            />
          ) : (
            <>
              <ul className="divide-y divide-[#EDF1EE] md:hidden">
                {rows.map((c) => (
                  <li key={c.customer_key}>
                    <Link href={customerHref(c.customer_key)} className="block px-4 py-3.5 hover:bg-[#FAFBFA]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-extrabold">{c.name ?? "—"}</p>
                          <p className="truncate text-xs text-[#5F6F67]">{c.email ?? c.phone ?? "—"}</p>
                          <p className="text-xs text-[#5F6F67]">
                            {c.bookings} {c.bookings === 1 ? t("reserva", "booking") : t("reservas", "bookings")} · {t("último viaje", "last trip")} {day(c.last_trip)}
                          </p>
                        </div>
                        <p className="shrink-0 text-right font-extrabold">{usd(c.total_spent)}</p>
                      </div>
                      <Chips c={c} lang={lang} />
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <DataTable minWidth={1040} caption={t("Clientes", "Customers")}>
                  <thead>
                    <tr>
                      <Th>{t("Nombre", "Name")}</Th>
                      <Th>{t("Correo", "Email")}</Th>
                      <Th>{t("Teléfono", "Phone")}</Th>
                      <Th align="right">{t("Reservas", "Bookings")}</Th>
                      <Th align="right">{t("Completados", "Completed")}</Th>
                      <Th align="right">{sortLink("spent", t("Gastado", "Spent"))}</Th>
                      <Th>{t("Primer viaje", "First trip")}</Th>
                      <Th>{sortLink("last", t("Último viaje", "Last trip"))}</Th>
                      <Th>{t("Etiquetas", "Tags")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr key={c.customer_key} className="hover:bg-[#FAFBFA]">
                        <Td>
                          <Link href={customerHref(c.customer_key)} className={link}>
                            {c.name ?? "—"}
                          </Link>
                        </Td>
                        <Td className="max-w-[16rem] break-all text-[#33443C]">{c.email ?? "—"}</Td>
                        <Td className="whitespace-nowrap text-[#33443C]">{c.phone ?? "—"}</Td>
                        <Td align="right">{c.bookings}</Td>
                        <Td align="right">{c.completed}</Td>
                        <Td align="right" className="whitespace-nowrap font-extrabold">
                          {usd(c.total_spent)}
                        </Td>
                        <Td className="whitespace-nowrap">{day(c.first_trip)}</Td>
                        <Td className="whitespace-nowrap">{day(c.last_trip)}</Td>
                        <Td>
                          <Chips c={c} lang={lang} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </div>
              <nav aria-label={t("Páginas", "Pages")} className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#EDF1EE] px-4 py-3 text-sm text-[#5F6F67] sm:px-5">
                <span>
                  {first}–{last} {t("de", "of")} {total} · {t("página", "page")} {Math.min(f.page, pages)} {t("de", "of")} {pages}
                </span>
                <div className="flex gap-1.5">
                  {f.page > 1 ? (
                    <Link href={customersHref(f, { page: f.page - 1 })} rel="prev" className={btn.secondary}>
                      {t("Anterior", "Previous")}
                    </Link>
                  ) : null}
                  {f.page < pages ? (
                    <Link href={customersHref(f, { page: f.page + 1 })} rel="next" className={btn.secondary}>
                      {t("Siguiente", "Next")}
                    </Link>
                  ) : null}
                </div>
              </nav>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function Chips({ c, lang }: { c: { vip: boolean; tags: string[]; bookings: number; cancelled: number }; lang: "es" | "en" }) {
  const t = makeT(lang);
  const other = c.tags.filter((x) => x.toLowerCase() !== "vip");
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {c.vip && <Chip tone="amber">VIP</Chip>}
      {isRepeat(c) && <Chip tone="green">{t("Repite", "Repeat")}</Chip>}
      {other.map((x) => (
        <Chip key={x}>{x}</Chip>
      ))}
    </span>
  );
}
