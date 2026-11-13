import { checkTripPromo, type TripRequestInput } from "@/app/trip/actions";
import { getCurrentProfile } from "@/lib/auth";
import { parsePublicLang } from "@/lib/publicLang";
import { localizeServerMessage } from "@/lib/serverMessagesEs";
import { json } from "../../shared";

/**
 * POST { code, items, email?, lang? } → { ok, code, discountCents, perItem } or { ok: false, error }.
 * The "Apply" button next to the promo code in the traveller app ("Your ride" and the tour
 * review). Same check as the website (checkTripPromo): the items are priced again on the server
 * and the code is checked against them. Works before sign-in (the per-email limit is then
 * checked when the trip is sent); a signed-in traveller's own email always wins over `email`.
 * Wrong codes count towards a per-network limit. App builds from before promo codes never call it.
 */
export async function POST(req: Request) {
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Partial<{ code: unknown; items: TripRequestInput["items"]; email: unknown; lang: unknown }>;
  const lang = parsePublicLang(b.lang);
  const me = await getCurrentProfile().catch(() => null);
  const res = await checkTripPromo({
    code: typeof b.code === "string" ? b.code.slice(0, 60) : "",
    items: Array.isArray(b.items) ? b.items : [],
    email: me?.email ?? (typeof b.email === "string" ? b.email.slice(0, 120) : null),
  });
  if (!res.ok) return json({ ok: false, error: localizeServerMessage(res.error, lang) }, 400);
  return json(res, 200);
}
