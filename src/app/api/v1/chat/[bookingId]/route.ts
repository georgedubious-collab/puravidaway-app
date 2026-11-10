import { getChat, sendChat, type ChatResult, type ChatViewer } from "@/app/chat/actions";
import { TRIP_TOKEN } from "@/lib/bookings";
import { localizeServerMessage } from "@/lib/serverMessagesEs";
import { getTeamLang } from "@/lib/teamLangServer";
import { json, signedIn } from "../../shared";

/**
 * Drivers and the team are recognised by their sign-in. A traveller in the customer
 * app also sends their private trip code (?trip=… or { trip }), which the chat checks
 * against the booking exactly as on the trip page.
 */
function viewerFor(trip: unknown): ChatViewer {
  return typeof trip === "string" && TRIP_TOKEN.test(trip) ? { kind: "traveller", token: trip } : { kind: "staff" };
}

/** Errors in the app's language: the customer app sends lang, the driver app x-team-lang. */
async function answer(res: ChatResult, lang: unknown) {
  if (res.ok) return json(res);
  const l = lang === "es" || lang === "en" ? lang : await getTeamLang();
  return json({ ...res, error: localizeServerMessage(res.error, l) }, 400);
}

/**
 * GET (?trip=…&lang=en|es) → the trip chat for a booking the signed-in person may see:
 * { messages, open, closedNote?, support }. Messages never carry contact details from
 * travellers or drivers (hidden as "[hidden]" / "[oculto]").
 */
export async function GET(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  const q = new URL(req.url).searchParams;
  const res = await getChat((await params).bookingId, viewerFor(q.get("trip")), q.get("lang") ?? undefined);
  return answer(res, q.get("lang"));
}

/**
 * POST { text, trip?, lang? } → send a message. The server hides contact details before
 * storing; `notice` in the answer tells the sender when it did. This is the only way a
 * message gets in: the database refuses direct inserts from the apps.
 */
export async function POST(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  const body = ((await req.json().catch(() => ({}))) ?? {}) as { text?: unknown; trip?: unknown; lang?: unknown };
  const lang = typeof body.lang === "string" ? body.lang : undefined;
  const res = await sendChat((await params).bookingId, viewerFor(body.trip), String(body.text ?? ""), lang);
  return answer(res, lang);
}
