import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * The check every scheduled job makes (same as /api/cron/review-reminders): the caller must
 * send "Authorization: Bearer <CRON_SECRET>" (the GitHub Action and Vercel Cron do).
 * Returns the error response to send back, or null when the caller is allowed.
 */
export function cronRefusal(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
