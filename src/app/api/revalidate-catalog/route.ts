import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { CATALOG_TAG } from "@/lib/catalogSource";

/**
 * POST /api/revalidate-catalog — clears the cached price list so the next visitor
 * reads the database, like pressing Save in /admin/pricing. Called by the
 * "Database migrations" GitHub Action after it runs new migrations.
 *
 * Protected by CATALOG_REVALIDATE_SECRET (Vercel env + GitHub secret), sent as
 * "Authorization: Bearer <secret>". It can only refresh the cache: no data is read or changed.
 */
export async function POST(req: Request) {
  const secret = process.env.CATALOG_REVALIDATE_SECRET ?? "";
  if (secret.length < 32) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  revalidateTag(CATALOG_TAG, { expire: 0 });
  return NextResponse.json({ ok: true, refreshedAt: new Date().toISOString() });
}
