import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { checkAllEtas } from "@/lib/eta";

/**
 * Every 5 minutes (GitHub Action "Driver ETA check"): check every upcoming pickup,
 * whether or not the driver's phone is reporting, so a driver who hasn't set off,
 * has no signal or closed the app still triggers the late alert.
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
  return NextResponse.json(await checkAllEtas());
}
