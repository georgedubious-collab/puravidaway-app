import { getChat, sendChat } from "@/app/chat/actions";
import { json, signedIn } from "../../shared";

/** GET → the trip chat for a booking the signed-in driver (or admin) may see. */
export async function GET(_req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  const res = await getChat((await params).bookingId, { kind: "staff" });
  return json(res, res.ok ? 200 : 400);
}

/** POST { text } → send a message. */
export async function POST(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  const body = ((await req.json().catch(() => ({}))) ?? {}) as { text?: unknown };
  const res = await sendChat((await params).bookingId, { kind: "staff" }, String(body.text ?? ""));
  return json(res, res.ok ? 200 : 400);
}
