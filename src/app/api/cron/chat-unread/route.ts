import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { emailUnreadChats } from "@/lib/chatEmails";

/**
 * Every 5 minutes (GitHub Action "Driver ETA check", second step): email travellers
 * without the app about chat messages unread for 10+ minutes (src/lib/chatEmails.ts).
 * Protected by CRON_SECRET ("Authorization: Bearer <secret>").
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await emailUnreadChats());
}
