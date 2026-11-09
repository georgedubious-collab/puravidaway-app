import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";

/**
 * Where to go after signing in when no page was asked for: the team to /admin,
 * everyone else to the driver area (drivers and people applying to drive are the
 * only others who sign in; travellers use their private trip link).
 */
export async function GET(req: Request) {
  const me = await getCurrentProfile();
  const to = !me ? "/login" : me.role === "admin" ? "/admin" : "/driver";
  return NextResponse.redirect(new URL(to, req.url));
}
