import { NextResponse } from "next/server";
import { getCurrentProfile, type Profile } from "@/lib/auth";
import type { FormState } from "@/lib/forms/formState";

/**
 * /api/v1: what the mobile apps call for things the server must do (emails,
 * push, rating requests, chat). The apps sign in with Supabase and send that
 * session as "Authorization: Bearer <token>"; each route then runs the same
 * server action as the website, so the rules can't drift apart.
 * Reading data (jobs, trips, earnings) goes straight to Supabase from the app.
 */
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** The signed-in user, or a 401 response. */
export async function signedIn(): Promise<Profile | NextResponse> {
  const me = await getCurrentProfile();
  return me ?? json({ ok: false, error: "Please sign in again." }, 401);
}

/** A JSON body as form fields, the shape the website's actions expect. */
export async function formFrom(req: Request, fields: string[]): Promise<FormData> {
  const body = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const fd = new FormData();
  for (const f of fields) if (body[f] !== undefined && body[f] !== null) fd.set(f, String(body[f]));
  return fd;
}

export function fromState(state: FormState) {
  return state.ok ? json({ ok: true }) : json({ ok: false, error: state.error ?? "Something went wrong." }, 400);
}

/** Vehicle fields the apps may send (same as the website's vehicle form, without the feature ticks). */
export const VEHICLE_FIELDS = [
  "plate",
  "make_model",
  "year",
  "color",
  "passenger_capacity",
  "ins_policy_number",
  "ins_insurance_expiry",
  "dekra_inspection_expiry",
  "marchamo_year",
];
