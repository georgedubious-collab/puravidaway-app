import { submitTripRequest, type TripRequestInput } from "@/app/trip/actions";
import { parsePublicLang } from "@/lib/publicLang";
import { localizeServerMessage } from "@/lib/serverMessagesEs";
import { TEST_CHECKOUT_ENABLED } from "@/lib/testCheckout";
import { json, signedIn } from "../../shared";

/**
 * POST { items, mode, cashFeeBps, name, phone, notes, lang } → send a trip request from the
 * traveller app. Same server action as the website (it prices every item again); the
 * email is always the signed-in one, so the trip shows up in the app. `lang` ("en" | "es") is
 * the app's language when the request is sent: the traveller's emails, push notifications and
 * trip page follow it. App builds from before this field send nothing and get English.
 */
export async function POST(req: Request) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Partial<TripRequestInput>;
  const lang = parsePublicLang(b.lang);
  const res = await submitTripRequest({
    items: Array.isArray(b.items) ? b.items : [],
    mode: b.mode === "cash_driver" ? "cash_driver" : "full_100",
    cashFeeBps: typeof b.cashFeeBps === "number" ? b.cashFeeBps : undefined,
    name: String(b.name ?? ""),
    email: me.email ?? "",
    phone: String(b.phone ?? ""),
    notes: String(b.notes ?? ""),
    website: "",
    lang,
  });
  // The app shows the error as it comes: in the app's language when we have a translation.
  if (!res.ok) return json({ ...res, error: localizeServerMessage(res.error, lang), testCheckout: TEST_CHECKOUT_ENABLED }, 400);
  return json({ ...res, testCheckout: TEST_CHECKOUT_ENABLED }, 200);
}
