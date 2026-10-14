"use server";

import { after } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { TRIP_TOKEN } from "@/lib/bookings";
import { ADMIN_EMAIL, SITE_URL, sendEmail } from "@/lib/email";
import { hasContactDetails } from "@/lib/preferences";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Trip chat: one thread per booking between the traveller, the assigned driver
 * and the PuraVidaWay team. Travellers prove who they are with their private
 * trip link; drivers and admins with their sign-in. Everything is read and
 * written by the server after that check.
 */

/** Travellers prove who they are with the code in their private trip link. */
export type ChatViewer = { kind: "traveller"; token: string } | { kind: "staff" };
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
    status: string;
    assigned_driver_id: string | null;
  };
  /** Server-only traveller details (never from the booking row, which the driver can read). */
  trip: { access_token: string; guest_name: string | null; guest_email: string | null } | null;
}

async function authorize(bookingId: string, viewer: ChatViewer): Promise<Ctx | string> {
  if (!UUID.test(bookingId)) return "Chat not found.";
  const db = createSupabaseAdminClient();
  if (!db) return "Chat isn't switched on yet.";
  const { data: booking } = await db
    .from("bookings")
    .select("id, trip_id, booking_ref, status, assigned_driver_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return "Chat not found.";
  const { data: trip } = booking.trip_id
    ? await db.from("trips").select("access_token, guest_name, guest_email").eq("id", booking.trip_id).maybeSingle()
    : { data: null };

  if (viewer.kind === "traveller") {
    if (!TRIP_TOKEN.test(viewer.token) || !trip || trip.access_token !== viewer.token) return "Chat not found.";
    return { db, party: "client", userId: null, booking, trip };
  }
  const me = await getCurrentProfile();
  if (!me) return "Please sign in again.";
  if (me.role === "admin") return { db, party: "admin", userId: me.id, booking, trip };
  if (me.role === "driver" && booking.assigned_driver_id === me.id) {
    const { data: d } = await db.from("drivers").select("kyc_status").eq("id", me.id).maybeSingle();
    if (d?.kyc_status !== "approved") return "Your driver account is paused. Please contact our team.";
    return { db, party: "driver", userId: me.id, booking, trip };
  }
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
  const clientName = (ctx.trip?.guest_name ?? "Traveller").split(" ")[0] || "Traveller";
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

    if (ctx.booking.status === "cancelled" && ctx.party !== "admin") {
      return { ok: false, error: "This booking was cancelled. Contact our team if you need help." };
    }

    // Flood guard (8 a minute per side) and insert happen in one database step.
    const { error } = await ctx.db.rpc("post_chat_message", {
      p_booking: ctx.booking.id,
      p_sender: ctx.userId,
      p_role: ctx.party,
      p_message: text,
    });
    if (error) {
      if (/Too many messages/.test(error.message)) return { ok: false, error: "You're sending messages very fast. Please wait a moment." };
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
 * Email the other parties. Each email "slot" is claimed in one database step
 * (claim_chat_email), so at most one email goes out until the person reads the
 * chat again (or after 30 minutes), and none while they're reading it.
 */
async function notifyOthers(ctx: Ctx, text: string) {
  const b = ctx.booking;
  const recipients: { party: Party; email: string; url: string; greeting: string }[] = [];
  if (ctx.party !== "client" && ctx.trip?.guest_email) {
    recipients.push({
      party: "client",
      email: ctx.trip.guest_email,
      url: `${SITE_URL}/trip/${ctx.trip.access_token}#chat-${b.id}`,
      greeting: `Hi ${(ctx.trip.guest_name ?? "").split(" ")[0] || "there"},`,
    });
  }
  if (ctx.party !== "driver" && b.assigned_driver_id) {
    const { data: p } = await ctx.db.from("profiles").select("email, full_name").eq("id", b.assigned_driver_id).maybeSingle();
    if (p?.email) {
      const first = (p.full_name ?? "").split(" ")[0];
      recipients.push({ party: "driver", email: p.email, url: `${SITE_URL}/driver/trips/${b.id}`, greeting: first ? `Hola ${first},` : "Hola," });
    }
  }
  if (ctx.party !== "admin" && ADMIN_EMAIL) {
    recipients.push({ party: "admin", email: ADMIN_EMAIL, url: `${SITE_URL}/admin/bookings/${b.id}`, greeting: "New chat message." });
  }

  const fromFor = (to: Party) =>
    ctx.party === "admin" ? "the PuraVidaWay team" : ctx.party === "client" ? "the traveller" : to === "client" ? "your driver" : "the driver";
  const snippet = text.length > 300 ? `${text.slice(0, 300)}…` : text;

  for (const r of recipients) {
    const claim = await ctx.db.rpc("claim_chat_email", { p_booking: b.id, p_party: r.party });
    if (claim.error || claim.data !== true) continue;
    await sendEmail({
      to: r.email,
      subject: `New message about your trip ${b.booking_ref}`,
      lines: [r.greeting, `You have a new message from ${fromFor(r.party)}:`, `“${snippet}”`, "Reply in the trip chat (please don't reply to this email)."],
      button: { label: "Open the chat", url: r.url },
    });
  }
}
