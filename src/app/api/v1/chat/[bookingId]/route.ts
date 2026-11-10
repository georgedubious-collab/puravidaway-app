import { getChat, sendChat, type ChatViewer } from "@/app/chat/actions";
import { TRIP_TOKEN } from "@/lib/bookings";
import { json, signedIn } from "../../shared";

/**
 * Drivers and the team are recognised by their sign-in. A traveller in the customer
 * app also sends their private trip code (?trip=… or { trip }), which the chat checks
 * against the booking exactly as on the trip page.
 */
function viewerFor(trip: unknown): ChatViewer {
  return typeof trip === "string" && TRIP_TOKEN.test(trip) ? { kind: "traveller", token: trip } : { kind: "staff" };
}

/** GET → the trip chat for a booking the signed-in person may see. */
export async function GET(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  const res = await getChat((await params).bookingId, viewerFor(new URL(req.url).searchParams.get("trip")));
  return json(res, res.ok ? 200 : 400);
}

/** POST { text } → send a message. */
export async function POST(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  const body = ((await req.json().catch(() => ({}))) ?? {}) as { text?: unknown; trip?: unknown };
  const res = await sendChat((await params).bookingId, viewerFor(body.trip), String(body.text ?? ""));
  return json(res, res.ok ? 200 : 400);
}
