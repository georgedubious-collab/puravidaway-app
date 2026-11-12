import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { PaymentChip, StatusChip } from "@/components/admin/chips";
import { Card, Chip, DataTable, Detail, DetailList, EmptyState, Notice, PageHeader, Td, Th, field, link } from "@/components/admin/ui";
import { bookingTitle } from "@/lib/adminDisplay";
import { requireRole } from "@/lib/auth";
import { bookingDue, usd, type BookingRow } from "@/lib/bookings";
import { localizeCatalog } from "@/lib/catalogEs";
import { getCatalog } from "@/lib/catalogSource";
import { NOTE_MAX, isRepeat, parseCustomerKey, tripDay } from "@/lib/customers";
import { customerByKey, customerTripIds } from "@/lib/customersServer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { saveCustomerNote } from "../actions";

/** One customer (team only): contact, bookings, spend, ratings they gave, tags and the team's private note. */
export default async function CustomerPage({ params }: { params: Promise<{ key: string }> }) {
  const { key: raw } = await params;
  await requireRole("admin", "/admin/customers");
  const key = parseCustomerKey(raw);
  if (!key) notFound();
  const lang = await getTeamLang();
  const t = makeT(lang);
  const db = (await createSupabaseServerClient())!;
  const { data: c, error } = await customerByKey(db, key);
  if (error)
    return (
      <Notice tone="red" role="alert">
        {t("No se pudo cargar el cliente:", "Couldn't load the customer:")} {error.message}
      </Notice>
    );
  if (!c) notFound();

  const tripIds = await customerTripIds(db, key);
  const [{ data: bookings }, { data: note }, { data: noteEvents }, rawCatalog] = await Promise.all([
    tripIds.length
      ? db.from("bookings").select("*").in("trip_id", tripIds).order("scheduled_at", { ascending: false, nullsFirst: false }).returns<BookingRow[]>()
      : Promise.resolve({ data: [] as BookingRow[] }),
    db.from("customer_notes").select("tags, note, updated_by, updated_at").eq("customer_key", key).maybeSingle(),
    db.from("customer_note_events").select("id, at, actor_id, after").eq("customer_key", key).order("at", { ascending: false }).limit(10),
    getCatalog(),
  ]);
  const catalog = localizeCatalog(rawCatalog, lang);
  const rows = bookings ?? [];
  const ids = rows.map((b) => b.id);
  const [{ data: reviews }, { data: tests }] = ids.length
    ? await Promise.all([
        db.from("driver_reviews").select("booking_id, stars, comment").in("booking_id", ids),
        db.from("payments").select("booking_id").in("booking_id", ids).eq("provider", "test"),
      ])
    : [{ data: [] as { booking_id: string; stars: number; comment: string | null }[] }, { data: [] as { booking_id: string }[] }];
  const people = [...new Set([note?.updated_by, ...(noteEvents ?? []).map((e) => e.actor_id)].filter((x): x is string => Boolean(x)))];
  const { data: names } = people.length ? await db.from("profiles").select("id, full_name, email").in("id", people) : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const who = (id: string | null | undefined) => {
    const p = names?.find((x) => x.id === id);
    return p ? p.full_name || p.email || "—" : t("el sistema", "the system");
  };
  const when = (iso: string) => iso.slice(0, 16).replace("T", " ");
  const tags = c.tags ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/admin/customers", label: t("Todos los clientes", "All customers") }}
        title={c.name ?? t("(sin nombre)", "(no name)")}
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5">
            {c.vip && <Chip tone="amber">VIP</Chip>}
            {isRepeat(c) && <Chip tone="green">{t("Cliente que repite", "Repeat customer")}</Chip>}
            {tags
              .filter((x) => x.toLowerCase() !== "vip")
              .map((x) => (
                <Chip key={x}>{x}</Chip>
              ))}
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("Contacto", "Contact")}>
          <DetailList>
            <Detail k={t("Correo", "Email")} v={c.email} />
            <Detail k="WhatsApp" v={c.phone} />
            <Detail k={t("Idioma", "Language")} v={c.language === "es" ? t("Español", "Spanish") : t("Inglés", "English")} />
          </DetailList>
          <p className="mt-3 text-xs text-[#5F6F67]">
            {t(
              "Solo para el equipo. Los conductores nunca ven el teléfono ni el correo del viajero.",
              "Team only. Drivers never see the traveller's phone or email.",
            )}
          </p>
        </Card>
        <Card title={t("Resumen", "Summary")}>
          <DetailList>
            <Detail k={t("Reservas", "Bookings")} v={`${c.bookings} (${c.completed} ${t("completadas", "completed")}, ${c.cancelled} ${t("canceladas", "cancelled")})`} />
            <Detail k={t("Total gastado", "Total spent")} v={usd(c.total_spent)} />
            <Detail k={t("Primer viaje", "First trip")} v={tripDay(c.first_trip, lang)} />
            <Detail k={t("Último viaje", "Last trip")} v={tripDay(c.last_trip, lang)} />
            <Detail
              k={t("Calificación que dio", "Rating they gave")}
              v={c.ratings ? `★ ${Number(c.avg_rating).toFixed(1)} (${c.ratings})` : t("aún no calificó", "no ratings yet")}
            />
          </DetailList>
          <p className="mt-3 text-xs text-[#5F6F67]">
            {t("Gastado = monto recibido, sin reservas canceladas ni pagos de prueba.", "Spent = amount received, leaving out cancelled bookings and test payments.")}
          </p>
        </Card>
      </div>

      <Card title={t("Sus reservas", "Their bookings")} padded={false}>
        {rows.length === 0 ? (
          <EmptyState title={t("Sin reservas.", "No bookings.")} />
        ) : (
          <DataTable minWidth={760} caption={t("Reservas del cliente", "Customer's bookings")}>
            <thead>
              <tr>
                <Th>{t("Recogida", "Pickup")}</Th>
                <Th>{t("Reserva", "Booking")}</Th>
                <Th>{t("Ruta / tour", "Route / tour")}</Th>
                <Th align="right">Total</Th>
                <Th>{t("Pago", "Payment")}</Th>
                <Th>{t("Estado", "Status")}</Th>
                <Th>{t("Calificación", "Rating")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const r = reviews?.find((x) => x.booking_id === b.id);
                return (
                  <tr key={b.id}>
                    <Td className="whitespace-nowrap">{tripDay(b.scheduled_at, lang)}</Td>
                    <Td>
                      <Link href={`/admin/bookings/${b.id}`} className={`whitespace-nowrap font-mono ${link}`}>
                        {b.booking_ref}
                      </Link>
                    </Td>
                    <Td className="max-w-[18rem]">{bookingTitle(b, catalog, lang)}</Td>
                    <Td align="right" className="whitespace-nowrap font-extrabold">
                      {usd(bookingDue(b))}
                    </Td>
                    <Td>
                      <PaymentChip booking={b} lang={lang} test={(tests ?? []).some((x) => x.booking_id === b.id)} />
                    </Td>
                    <Td>
                      <StatusChip status={b.status} lang={lang} />
                    </Td>
                    <Td className="whitespace-nowrap">{r ? `${"★".repeat(r.stars)}${r.comment ? " 💬" : ""}` : "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </Card>

      <Card title={t("Etiquetas y nota privada del equipo", "Tags and private team note")}>
        <AdminActionForm action={saveCustomerNote} lang={lang} className="space-y-4">
          <input type="hidden" name="key" value={key} />
          <label className="flex items-center gap-2 text-sm font-bold text-[#33443C]">
            <input type="checkbox" name="vip" defaultChecked={c.vip} className="h-5 w-5" /> VIP
          </label>
          <label className={field.label}>
            {t("Otras etiquetas (separadas por comas)", "Other tags (separated by commas)")}
            <input
              name="tags"
              defaultValue={tags.filter((x) => x.toLowerCase() !== "vip").join(", ")}
              maxLength={400}
              placeholder={t("luna de miel, vuelo temprano", "honeymoon, early flight")}
              className={field.input}
            />
          </label>
          <label className={field.label}>
            {t("Nota privada (nunca la ve el viajero ni el conductor)", "Private note (never seen by the traveller or driver)")}
            <textarea name="note" rows={4} maxLength={NOTE_MAX} defaultValue={note?.note ?? ""} className={field.textarea} />
          </label>
        </AdminActionForm>
        {note?.updated_at && (
          <p className="mt-3 text-xs text-[#5F6F67]">
            {t("Último cambio:", "Last changed:")} {who(note.updated_by)} · {when(note.updated_at)} UTC
          </p>
        )}
        {(noteEvents ?? []).length > 0 && (
          <details className="mt-2 text-xs text-[#5F6F67]">
            <summary className="cursor-pointer font-bold text-[#047857]">{t("Historial de la nota", "Note history")}</summary>
            <ul className="mt-2 space-y-1">
              {(noteEvents ?? []).map((e) => (
                <li key={e.id}>
                  {when(e.at)} UTC · {who(e.actor_id)} · {((e.after as { tags?: string[] })?.tags ?? []).join(", ") || "—"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>
    </div>
  );
}
