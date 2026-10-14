"use server";

import { after } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { ADMIN_EMAIL, SITE_URL, sendEmail } from "@/lib/email";
import { hasContactDetails } from "@/lib/preferences";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Trip chat: one thread per booking between the traveller, the assigned driver
 * and the PuraVidaWay team. Travellers prove who they are with their private
 * trip link; drivers and admins with their sign-in. Everything is read and
 * written by the server after that check.
 */

export type ChatViewer = { kind: "traveller"; tripId: string } | { kind: "staff" };
export type Party = "client" | "driver" | "admin";

export interface ChatMessage {
  id: string;
  party: Party;
  name: string;
  text: string;
  at: string;
  mine: boolean;
}

export type ChatResult = { ok: true; messages: ChatMessage[] } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LEN = 2000;

interface Ctx {
  db: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  party: Party;
  userId: string | null;
  booking: {
    id: string;
    trip_id: string | null;
    booking_ref: string;
    guest_name: string | null;
    guest_email: string | null;
    assigned_driver_id: string | null;
  };
}

async function authorize(bookingId: string, viewer: ChatViewer): Promise<Ctx | string> {
  if (!UUID.test(bookingId)) return "Chat not found.";
  const db = createSupabaseAdminClient();
  if (!db) return "Chat isn't switched on yet.";
  const { data: booking } = await db
    .from("bookings")
    .select("id, trip_id, booking_ref, guest_name, guest_email, assigned_driver_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return "Chat not found.";

  if (viewer.kind === "traveller") {
    if (!UUID.test(viewer.tripId) || booking.trip_id !== viewer.tripId) return "Chat not found.";
    return { db, party: "client", userId: null, booking };
  }
  const me = await getCurrentProfile();
  if (!me) return "Please sign in again.";
  if (me.role === "admin") return { db, party: "admin", userId: me.id, booking };
  if (me.role === "driver" && booking.assigned_driver_id === me.id) return { db, party: "driver", userId: me.id, booking };
  return "You don't have access to this chat.";
}

async function load(ctx: Ctx): Promise<ChatMessage[]> {
  const { data: rows } = await ctx.db
    .from("trip_chats")
    .select("id, sender_id, sender_role, message, sent_at")
    .eq("booking_id", ctx.booking.id)
    .order("sent_at")
    .limit(500);
  const senderIds = [...new Set((rows ?? []).map((r) => r.sender_id).filter((x): x is string => Boolean(x)))];
  const names: Record<string, string> = {};
  if (senderIds.length) {
    const { data: profiles } = await ctx.db.from("profiles").select("id, full_name").in("id", senderIds);
    for (const p of profiles ?? []) names[p.id] = (p.full_name ?? "").split(" ")[0] || "Driver";
  }
  const clientName = (ctx.booking.guest_name ?? "Traveller").split(" ")[0];
  return (rows ?? []).map((r) => ({
    id: r.id,
    party: r.sender_role as Party,
    name: r.sender_role === "admin" ? "PuraVidaWay team" : r.sender_role === "client" ? clientName : (names[r.sender_id] ?? "Driver"),
    text: r.message,
    at: r.sent_at,
    mine: r.sender_role === ctx.party && (ctx.party === "client" || r.sender_id === ctx.userId),
  }));
}

async function markRead(ctx: Ctx) {
  await ctx.db
    .from("chat_reads")
    .upsert({ booking_id: ctx.booking.id, party: ctx.party, last_read_at: new Date().toISOString() }, { onConflict: "booking_id,party" });
}

export async function getChat(bookingId: string, viewer: ChatViewer): Promise<ChatResult> {
  try {
    const ctx = await authorize(bookingId, viewer);
    if (typeof ctx === "string") return { ok: false, error: ctx };
    const messages = await load(ctx);
    await markRead(ctx);
    return { ok: true, messages };
  } catch (e) {
    console.error("[chat] load", e);
    return { ok: false, error: "Couldn't load the chat. Please reload the page." };
  }
}

export async function sendChat(bookingId: string, viewer: ChatViewer, raw: string): Promise<ChatResult> {
  try {
    const ctx = await authorize(bookingId, viewer);
    if (typeof ctx === "string") return { ok: false, error: ctx };
    const text = String(raw ?? "").trim();
    if (!text) return { ok: false, error: "Write a message first." };
    if (text.length > MAX_LEN) return { ok: false, error: `Messages can be up to ${MAX_LEN} characters.` };
    if (ctx.party !== "admin" && hasContactDetails(text)) {
      return { ok: false, error: "Please keep phone numbers, emails and links out of the chat. Our team shares contact details when needed." };
    }

    // Simple flood guard: at most 8 messages a minute from one side of a chat.
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await ctx.db
      .from("trip_chats")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", ctx.booking.id)
      .eq("sender_role", ctx.party)
      .gte("sent_at", since);
    if ((count ?? 0) >= 8) return { ok: false, error: "You're sending messages very fast. Please wait a moment." };

    const { error } = await ctx.db
      .from("trip_chats")
      .insert({ booking_id: ctx.booking.id, sender_id: ctx.userId, sender_role: ctx.party, message: text });
    if (error) {
      if (/keep phone numbers/.test(error.message)) return { ok: false, error: "Please keep phone numbers, emails and links out of the chat." };
      throw error;
    }
    await markRead(ctx);
    // Email the others after the response is sent, so sending feels instant.
    after(() => notifyOthers(ctx, text));
    return { ok: true, messages: await load(ctx) };
  } catch (e) {
    console.error("[chat] send", e);
    return { ok: false, error: "Couldn't send. Please try again." };
  }
}

/**
 * One email per party until they come back and read: send if they were never
 * emailed, have read since the last email, or the last email is over 30 minutes old.
 */
async function notifyOthers(ctx: Ctx, text: string) {
  const b = ctx.booking;
  const recipients: { party: Party; email: string; url: string; greeting: string }[] = [];
  if (ctx.party !== "client" && b.guest_email && b.trip_id) {
    recipients.push({
      party: "client",
      email: b.guest_email,
      url: `${SITE_URL}/trip/${b.trip_id}#chat-${b.id}`,
      greeting: `Hi ${(b.guest_name ?? "").split(" ")[0] || "there"},`,
    });
  }
  if (ctx.party !== "driver" && b.assigned_driver_id) {
    const { data: p } = await ctx.db.from("profiles").select("email, full_name").eq("id", b.assigned_driver_id).maybeSingle();
    if (p?.email) {
      recipients.push({
        party: "driver",
        email: p.email,
        url: `${SITE_URL}/driver/trips/${b.id}`,
        greeting: `Hola ${(p.full_name ?? "").split(" ")[0] || ""},`.replace(" ,", ","),
      });
    }
  }
  if (ctx.party !== "admin" && ADMIN_EMAIL) {
    recipients.push({ party: "admin", email: ADMIN_EMAIL, url: `${SITE_URL}/admin/bookings/${b.id}`, greeting: "New chat message." });
  }
  if (!recipients.length) return;

  const { data: reads } = await ctx.db
    .from("chat_reads")
    .select("party, last_read_at, last_emailed_at")
    .eq("booking_id", b.id);
  const fromFor = (to: Party) =>
    ctx.party === "admin" ? "the PuraVidaWay team" : ctx.party === "client" ? "the traveller" : to === "client" ? "your driver" : "the driver";
  const snippet = text.length > 300 ? `${text.slice(0, 300)}…` : text;

  for (const r of recipients) {
    const read = reads?.find((x) => x.party === r.party);
    const last = read?.last_emailed_at ? Date.parse(read.last_emailed_at) : 0;
    const seen = read?.last_read_at ? Date.parse(read.last_read_at) : 0;
    if (last && seen < last && Date.now() - last < 30 * 60_000) continue;
    const sent = await sendEmail({
      to: r.email,
      subject: `New message about your trip ${b.booking_ref}`,
      lines: [r.greeting, `You have a new message from ${fromFor(r.party)}:`, `“${snippet}”`, "Reply in the trip chat (please don't reply to this email)."],
      button: { label: "Open the chat", url: r.url },
    });
    if (sent) {
      await ctx.db
        .from("chat_reads")
        .upsert({ booking_id: b.id, party: r.party, last_emailed_at: new Date().toISOString() }, { onConflict: "booking_id,party" });
    }
  }
}
