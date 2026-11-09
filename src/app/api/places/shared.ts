import { NextResponse } from "next/server";
import { MapsError } from "@/lib/googleMaps";

/** Session tokens are UUIDs made in the browser. */
export function sessionToken(v: string | null): string | undefined {
  return v && /^[A-Za-z0-9-]{8,64}$/.test(v) ? v : undefined;
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Readable message for the traveller; anything unexpected becomes a generic one. */
export function fail(e: unknown) {
  if (e instanceof MapsError) return json({ error: e.message }, 502);
  console.error("[places api]", e);
  return json({ error: "Something went wrong. Please try again." }, 500);
}
