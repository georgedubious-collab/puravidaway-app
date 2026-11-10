import { submitTripRequest, type TripRequestInput } from "@/app/trip/actions";
import { TEST_CHECKOUT_ENABLED } from "@/lib/testCheckout";
import { json, signedIn } from "../../shared";

/**
 * POST { items, mode, cashFeeBps, name, phone, notes } → send a trip request from the
 * traveller app. Same server action as the website (it prices every item again); the
 * email is always the signed-in one, so the trip shows up in the app.
 */
export async function POST(req: Request) {
  const me = await signedIn();
  if (me instanceof Response) return me;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Partial<TripRequestInput>;
  const res = await submitTripRequest({
    items: Array.isArray(b.items) ? b.items : [],
    mode: b.mode === "cash_driver" ? "cash_driver" : "full_100",
    cashFeeBps: typeof b.cashFeeBps === "number" ? b.cashFeeBps : undefined,
    name: String(b.name ?? ""),
    email: me.email ?? "",
    phone: String(b.phone ?? ""),
    notes: String(b.notes ?? ""),
    website: "",
  });
  return json({ ...res, testCheckout: TEST_CHECKOUT_ENABLED }, res.ok ? 200 : 400);
}
