"use server";

import { after } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { TRIP_TOKEN } from "@/lib/bookings";
import { RETIRED_EXPEDITIONS, WHATSAPP_NUMBER } from "@/lib/catalog";
import { chatClosesAt, type ChatParty } from "@/lib/chatRules";
import { displayHidden, hiddenNotice, hideContactDetails } from "@/lib/contactFilter";
import { ADMIN_EMAIL, SITE_URL, sendEmail } from "@/lib/email";
import { parsePublicLang, type PublicLang } from "@/lib/publicLang";
import { sendPush, sendPushToEmail } from "@/lib/push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTeamLang } from "@/lib/teamLangServer";
import { chatMessagePush } from "@/lib/travellerMessages";

/**
 * Trip chat: one thread per booking between the traveller and the assigned driver,
 * with our team able to read and step in (docs/PROJECT.md §4.2, §7.7).
 *
 * - Travellers prove who they are with their private trip link; drivers and admins
 *   with their sign-in. Everything is read and written by the server after that
 *   check: nobody can insert into trip_chats directly (migration 0034).
 * - "Hide and flag": phone numbers, emails, links and social handles from travellers
 *   and drivers are replaced with "[hidden]" before storing (src/lib/contactFilter.ts);
 *   the original goes to contact_flags (admins only) and the sender gets a notice.
 * - Open from the request (traveller ↔ team) and from the driver's assignment
 *   (traveller ↔ driver) until 48 hours after the trip ends; read-only after that.
 *   The team can always write.
 * - Each new message pushes the other side in their language. Travellers without
 *   the app get one email once messages stay unread for 10 minutes (src/lib/chatEmails.ts).
 */

/** Travellers prove who they are with the code in their private trip link. */
export type ChatViewer = { kind: "traveller"; token: string } | { kind: "staff" };
export type Party = ChatParty;

export interface ChatMessage {
  id: string;
  party: Party;
  name: string;
  text: string;
  at: string;
  mine: boolean;
}

export type ChatResult =
  | {
      ok: true;
      messages: ChatMessage[];
      /** False once the chat is read-only for this viewer (48 h after the trip, or cancelled). */
      open: boolean;
      /** Why it's read-only, in the viewer's language. */
      closedNote?: string;
      /** Set when contact details were hidden from the message just sent. */
      notice?: string;
      /** The team's WhatsApp / phone number (digits), for "Call our team". */
      support: string;
    }
  | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LEN = 2000;

interface Ctx {
  db: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  party: Party;
  userId: string | null;
  /** The language this viewer reads in. */
  lang: PublicLang;
  booking: {
    id: string;
    trip_id: string | null;
    booking_ref: string;
    status: string;
    assigned_driver_id: string | null;
    service_type: string;
    catalog_item_id: string | null;
    scheduled_at: string | null;
    completed_at: string | null;
  };
  /** Server-only traveller details (never from the booking row, which the driver can read). */
  trip: { access_token: string; guest_name: string | null; guest_email: string | null; language?: string | null } | null;
}

const tr = (lang: PublicLang, en: string, es: string) => (lang === "es" ? es : en);

async function authorize(bookingId: string, viewer: ChatViewer, asked?: unknown): Promise<Ctx | string> {
  if (!UUID.test(bookingId)) return "Chat not found.";
  const db = createSupabaseAdminClient();
  if (!db) return "Chat isn't switched on yet.";
  const { data: booking } = await db
    .from("bookings")
    .select("id, trip_id, booking_ref, status, assigned_driver_id, service_type, catalog_item_id, scheduled_at, completed_at")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return "Chat not found.";
  const { data: trip } = booking.trip_id
    ? await db.from("trips").select("access_token, guest_name, guest_email, language").eq("id", booking.trip_id).maybeSingle()
    : { data: null };

  if (viewer.kind === "traveller") {
    if (!TRIP_TOKEN.test(viewer.token) || !trip || trip.access_token !== viewer.token) return "Chat not found.";
    // The page or app says which language it is showing; otherwise the trip's.
    const lang = asked === "en" || asked === "es" ? asked : parsePublicLang(trip.language);
    return { db, party: "client", userId: null, lang, booking, trip };
  }
  const me = await getCurrentProfile();
  if (!me) return "Please sign in again.";
  const lang = await getTeamLang();
  if (me.role === "admin") return { db, party: "admin", userId: me.id, lang, booking, trip };
  if (me.role === "driver" && booking.assigned_driver_id === me.id) {
    const { data: d } = await db.from("drivers").select("kyc_status").eq("id", me.id).maybeSingle();
    if (d?.kyc_status !== "approved") return "Your driver account is paused. Please contact our team.";
    // Remember the driver's language so chat pushes to them follow it.
    await db.from("profiles").update({ app_lang: lang }).eq("id", me.id).or(`app_lang.is.null,app_lang.neq.${lang}`);
    return { db, party: "driver", userId: me.id, lang, booking, trip };
  }
  return "You don't have access to this chat.";
}

/** Whether this viewer may still write, and if not, why (in their language). */
async function writable(ctx: Ctx): Promise<{ open: boolean; note?: string }> {
  if (ctx.party === "admin") return { open: true };
  const b = ctx.booking;
  if (b.status === "cancelled") {
    return { open: false, note: tr(ctx.lang, "This booking was cancelled. Contact our team if you need help.", "Esta reserva fue cancelada. Contacte a nuestro equipo si necesita ayuda.") };
  }
  // Multi-day trips were retired on 2026-11-11; a booking made before then keeps its length.
  const days =
    b.service_type === "expedition" ? (RETIRED_EXPEDITIONS.find((x) => x.id === b.catalog_item_id)?.days ?? 1) : undefined;
  const closes = chatClosesAt({ scheduledAt: b.scheduled_at, completedAt: b.completed_at, serviceType: b.service_type, expeditionDays: days });
  if (closes && Date.now() > closes.getTime()) {
    return {
      open: false,
      note: tr(ctx.lang, "This chat closed 48 hours after the trip. Need anything? Contact our team.", "Este chat se cerró 48 horas después del viaje. ¿Necesita algo? Contacte a nuestro equipo."),
    };
  }
  return { open: true };
}

async function load(ctx: Ctx): Promise<ChatMessage[]> {
  const { data: rows } = await ctx.db
    .from("trip_chats")
    .select("id, sender_id, sender_role, message, sent_at")
    .eq("booking_id", ctx.booking.id)
    .order("sent_at")
    .limit(500);
  const senderIds = [...new Set((rows ?? []).map((r) => r.sender_id).filter((x): x is string => Boolean(x)))];
  const driverWord = tr(ctx.lang, "Driver", "Conductor");
  const names: Record<string, string> = {};
  if (senderIds.length) {
    const { data: profiles } = await ctx.db.from("profiles").select("id, full_name").in("id", senderIds);
    for (const p of profiles ?? []) names[p.id] = (p.full_name ?? "").split(" ")[0] || driverWord;
  }
  const clientName = (ctx.trip?.guest_name ?? "").split(" ")[0] || tr(ctx.lang, "Traveller", "Viajero");
  return (rows ?? []).map((r) => ({
    id: r.id,
    party: r.sender_role as Party,
    name:
      r.sender_role === "admin" ? tr(ctx.lang, "Our team", "Nuestro equipo") : r.sender_role === "client" ? clientName : (names[r.sender_id] ?? driverWord),
    text: displayHidden(r.message, ctx.lang),
    at: r.sent_at,
    mine: r.sender_role === ctx.party && (ctx.party === "client" || r.sender_id === ctx.userId),
  }));
}

async function markRead(ctx: Ctx) {
  await ctx.db
    .from("chat_reads")
    .upsert({ booking_id: ctx.booking.id, party: ctx.party, last_read_at: new Date().toISOString() }, { onConflict: "booking_id,party" });
}

/**
 * The chat for one booking. `lang` ("en" | "es") is the language the traveller's page
 * or app is showing; staff get their team language (cookie or x-team-lang header).
 */
export async function getChat(bookingId: string, viewer: ChatViewer, lang?: string): Promise<ChatResult> {
  try {
    const ctx = await authorize(bookingId, viewer, lang);
    if (typeof ctx === "string") return { ok: false, error: ctx };
    const [messages, w] = await Promise.all([load(ctx), writable(ctx)]);
    await markRead(ctx);
    return { ok: true, messages, open: w.open, closedNote: w.note, support: WHATSAPP_NUMBER };
  } catch (e) {
    console.error("[chat] load", e);
    return { ok: false, error: "Couldn't load the chat. Please reload the page." };
  }
}

export async function sendChat(bookingId: string, viewer: ChatViewer, raw: string, lang?: string): Promise<ChatResult> {
  try {
    const ctx = await authorize(bookingId, viewer, lang);
    if (typeof ctx === "string") return { ok: false, error: ctx };
    const text = String(raw ?? "").trim();
    if (!text) return { ok: false, error: "Write a message first." };
    if (text.length > MAX_LEN) return { ok: false, error: `Messages can be up to ${MAX_LEN} characters.` };
    const w = await writable(ctx);
    if (!w.open) return { ok: false, error: w.note ?? "This chat is closed." };

    // Hide and flag: the team may share contact details; travellers and drivers may not.
    const filtered = ctx.party === "admin" ? { text, kinds: [] } : hideContactDetails(text);
    const hidden = filtered.kinds.length > 0;

    // Flood guard (8 a minute per side), the database's own backstop filter, the message
    // and the admin-only original are one database step.
    let res = await ctx.db.rpc("post_chat_message", {
      p_booking: ctx.booking.id,
      p_sender: ctx.userId,
      p_role: ctx.party,
      p_message: filtered.text,
      p_original: hidden ? text : null,
      p_kinds: hidden ? filtered.kinds : null,
    });
    // Safety net for the minutes between a deploy and its database update (migration 0034).
    if (res.error?.code === "PGRST202") {
      res = await ctx.db.rpc("post_chat_message", { p_booking: ctx.booking.id, p_sender: ctx.userId, p_role: ctx.party, p_message: filtered.text });
    }
    if (res.error) {
      if (/Too many messages/.test(res.error.message)) return { ok: false, error: "You're sending messages very fast. Please wait a moment." };
      throw res.error;
    }
    await markRead(ctx);
    // Push / email the others after the response is sent, so sending feels instant.
    after(() => notifyOthers(ctx, filtered.text, hidden));
    return {
      ok: true,
      messages: await load(ctx),
      open: true,
      notice: hidden ? hiddenNotice(ctx.lang) : undefined,
      support: WHATSAPP_NUMBER,
    };
  } catch (e) {
    console.error("[chat] send", e);
    return { ok: false, error: "Couldn't send. Please try again." };
  }
}

/**
 * Tell the other side. Travellers: a push to the customer app in the trip's language
 * (the batched email for those without the app is sent by /api/cron/chat-unread).
 * Driver: a push in their language, and an email only if no push reached a phone.
 * Team: an email, at most one until someone reads the chat (claim_chat_email).
 */
async function notifyOthers(ctx: Ctx, text: string, hidden: boolean) {
  const b = ctx.booking;
  const snippet = (s: string, lang: PublicLang) => displayHidden(s.length > 140 ? `${s.slice(0, 140)}…` : s, lang);
  const senderName = async (lang: PublicLang) => {
    if (ctx.party === "admin") return tr(lang, "Our team", "Nuestro equipo");
    if (ctx.party === "client") return (ctx.trip?.guest_name ?? "").split(" ")[0] || tr(lang, "Your traveller", "Su cliente");
    const { data } = await ctx.db.from("profiles").select("full_name").eq("id", ctx.userId ?? "").maybeSingle();
    return (data?.full_name ?? "").split(" ")[0] || tr(lang, "Your driver", "Su conductor");
  };

  if (ctx.party !== "client" && ctx.trip?.guest_email) {
    const lang = parsePublicLang(ctx.trip.language);
    await sendPushToEmail(ctx.trip.guest_email, {
      ...chatMessagePush(lang, { from: await senderName(lang), snippet: snippet(text, lang) }),
      data: { screen: "chat", id: b.id },
    });
  }

  if (ctx.party !== "driver" && b.assigned_driver_id) {
    const { data: p } = await ctx.db.from("profiles").select("email, full_name, app_lang").eq("id", b.assigned_driver_id).maybeSingle();
    // Drivers read Spanish unless they chose English in the app or the driver portal.
    const lang: PublicLang = p?.app_lang === "en" ? "en" : "es";
    const from = await senderName(lang);
    const pushed = await sendPush(
      [b.assigned_driver_id],
      { title: `${from} · ${b.booking_ref}`, body: snippet(text, lang), data: { screen: "trip", id: b.id, chat: "1" } },
      "driver",
    );
    if (pushed === 0 && p?.email) {
      const claim = await ctx.db.rpc("claim_chat_email", { p_booking: b.id, p_party: "driver" });
      if (!claim.error && claim.data === true) {
        const first = (p.full_name ?? "").split(" ")[0];
        await sendEmail({
          to: p.email,
          subject: tr(lang, `New message about trip ${b.booking_ref}`, `Nuevo mensaje sobre el viaje ${b.booking_ref}`),
          lines: [
            first ? `Hola ${first},` : "Hola,",
            tr(lang, `You have a new message from ${from}:`, `Tiene un nuevo mensaje de ${from}:`),
            `“${snippet(text, lang)}”`,
            tr(lang, "Reply in the trip chat (please don't reply to this email).", "Responda en el chat del viaje (por favor no responda a este correo)."),
          ],
          button: { label: tr(lang, "Open the chat", "Abrir el chat"), url: `${SITE_URL}/driver/trips/${b.id}#chat-${b.id}` },
        });
      }
    }
  }

  if (ctx.party !== "admin" && ADMIN_EMAIL) {
    const claim = await ctx.db.rpc("claim_chat_email", { p_booking: b.id, p_party: "admin" });
    if (!claim.error && claim.data === true) {
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `New message about trip ${b.booking_ref}`,
        lines: [
          "New chat message.",
          `From ${ctx.party === "client" ? "the traveller" : "the driver"}:`,
          `“${snippet(text, "en")}”`,
          hidden ? "Contact details were hidden from this message. The original is under Flagged messages in the CRM." : "",
          "Reply in the trip chat (please don't reply to this email).",
        ].filter(Boolean),
        button: { label: "Open the chat", url: `${SITE_URL}/admin/bookings/${b.id}` },
      });
    }
  }
}
