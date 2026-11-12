import Link from "next/link";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { Card, Chip, EmptyState, Notice, PageHeader, link } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { formatScheduledAt } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { reviewFlag } from "./actions";

interface Flag {
  id: string;
  booking_id: string;
  source: "chat" | "booking_notes";
  field: string | null;
  sender_role: "client" | "driver" | "admin" | null;
  sender_id: string | null;
  original: string;
  shown: string | null;
  kinds: string[];
  created_at: string;
  reviewed_at: string | null;
  bookings: { booking_ref: string } | null;
}

/**
 * "Mensajes marcados": every message or booking note where the filter hid a phone
 * number, email, link or handle, with the original text (contact_flags, admins only).
 * A driver who keeps trying to pass their number is a sign of off-platform trips.
 */
export default async function FlaggedPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await requireRole("admin", "/admin/flagged");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const showAll = (await searchParams).all === "1";
  const supabase = (await createSupabaseServerClient())!;
  let q = supabase
    .from("contact_flags")
    .select("id, booking_id, source, field, sender_role, sender_id, original, shown, kinds, created_at, reviewed_at, bookings(booking_ref)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!showAll) q = q.is("reviewed_at", null);
  const { data, error } = await q.returns<Flag[]>();
  if (error) {
    return (
      <Notice>
        {t("Esta lista necesita la migración", "This list needs migration")} <code>20261110000034_trip_chat_privacy.sql</code>.{" "}
        {t("Se aplica sola después de la fusión; recargue en un minuto.", "It runs by itself after the merge; reload in a minute.")}
      </Notice>
    );
  }
  const rows = data ?? [];
  const senderIds = [...new Set(rows.map((r) => r.sender_id).filter((x): x is string => Boolean(x)))];
  const { data: people } = senderIds.length ? await supabase.from("profiles").select("id, full_name").in("id", senderIds) : { data: [] };
  // Repeat senders first catch the eye: count flags per driver in this list.
  const perSender = new Map<string, number>();
  for (const r of rows) if (r.sender_id) perSender.set(r.sender_id, (perSender.get(r.sender_id) ?? 0) + 1);

  const who = (r: Flag) => {
    if (r.sender_role === "client") return t("Cliente", "Traveller");
    if (r.sender_role === "admin") return t("Nuestro equipo", "Our team");
    const name = people?.find((p) => p.id === r.sender_id)?.full_name ?? t("Conductor", "Driver");
    return `${t("Conductor", "Driver")}: ${name}`;
  };
  const where = (r: Flag) =>
    r.source === "chat"
      ? t("Chat del viaje", "Trip chat")
      : r.field === "flight_or_hotel_notes"
        ? t("Notas de vuelo / hotel", "Flight / hotel notes")
        : r.field === "driver_notes"
          ? t("Mensaje para el conductor", "Message for the driver")
          : t("Notas del cliente", "Traveller's notes");
  const KIND: Record<string, [string, string]> = {
    phone: ["teléfono", "phone"],
    email: ["correo", "email"],
    link: ["enlace", "link"],
    handle: ["usuario de red social", "social handle"],
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Mensajes marcados", "Flagged messages")}
        subtitle={t(
            "Mensajes y notas donde se ocultaron datos de contacto (teléfono, correo, enlace o red social). Solo los administradores ven el texto original. Un conductor que insiste en pasar su número puede estar buscando viajes por fuera.",
            "Messages and notes where contact details (phone, email, link or social handle) were hidden. Only admins see the original text. A driver who keeps trying to pass their number may be looking for off-platform trips.",
        )}
      />
      <div>
        <p className="text-sm">
          {showAll ? (
            <Link href="/admin/flagged" className={link}>
              {t("Ver solo los pendientes", "Show only open ones")}
            </Link>
          ) : (
            <Link href="/admin/flagged?all=1" className={link}>
              {t("Ver también los revisados", "Show reviewed ones too")}
            </Link>
          )}
        </p>
      </div>

      {rows.length === 0 && (
        <Card>
          <EmptyState title={t("No hay mensajes marcados por revisar.", "No flagged messages to review.")} />
        </Card>
      )}

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-2xl border border-[#E3E8E5] bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <p className="font-bold text-[#14231C]">
                {who(r)}
                {r.sender_id && (perSender.get(r.sender_id) ?? 0) > 1 && (
                  <span className="ml-2">
                    <Chip tone="red">{t(`${perSender.get(r.sender_id)} veces`, `${perSender.get(r.sender_id)} times`)}</Chip>
                  </span>
                )}
              </p>
              <p className="text-[#5F6F67]">
                <Link href={`/admin/bookings/${r.booking_id}`} className={`font-mono ${link}`}>
                  {r.bookings?.booking_ref ?? t("Reserva", "Booking")}
                </Link>{" "}
                · {where(r)} · {formatScheduledAt(r.created_at, lang)}
              </p>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-red-50 p-3">
                <dt className="text-xs font-bold uppercase tracking-wide text-red-800">{t("Original (solo administradores)", "Original (admins only)")}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-[#14231C]">{r.original}</dd>
              </div>
              <div className="rounded-lg bg-[#FAFBFA] p-3">
                <dt className="text-xs font-bold uppercase tracking-wide text-[#5F6F67]">{t("Lo que se mostró", "What was shown")}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-[#33443C]">{r.shown ?? "—"}</dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[#5F6F67]">
                {r.kinds.length > 0 && `${t("Ocultado", "Hidden")}: ${r.kinds.map((k) => (KIND[k] ? t(KIND[k][0], KIND[k][1]) : k)).join(", ")}`}
              </p>
              {r.reviewed_at ? (
                <Chip tone="green">{t("Revisado", "Reviewed")}</Chip>
              ) : (
                <AdminActionForm action={reviewFlag} lang={lang} submitLabel={t("Marcar como revisado", "Mark reviewed")} savedLabel={t("Revisado", "Reviewed")}>
                  <input type="hidden" name="flag_id" value={r.id} />
                </AdminActionForm>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
