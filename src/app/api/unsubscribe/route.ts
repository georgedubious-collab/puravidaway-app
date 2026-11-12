import { NextResponse } from "next/server";
import { emailFromUnsubscribeToken, optOut } from "@/lib/promoEmail";

/**
 * One-click unsubscribe (RFC 8058) for the mail app's own "Unsubscribe" button: Gmail, Apple
 * Mail and others POST here (List-Unsubscribe / List-Unsubscribe-Post headers on promotional
 * emails, src/lib/promoEmail.ts). The signed token says which address; nothing else is read.
 * A plain visit (GET) goes to the unsubscribe page, which asks first.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  const email = emailFromUnsubscribeToken(token);
  if (!email) return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  const ok = await optOut(email, "one_click");
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = new URL("/unsubscribe", url.origin);
  const token = url.searchParams.get("t");
  if (token) page.searchParams.set("t", token);
  return NextResponse.redirect(page, 303);
}
