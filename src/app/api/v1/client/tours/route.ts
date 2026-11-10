import { QuoteError, tourQuotes } from "@/lib/appQuote";
import { json } from "../../shared";

/** GET ?date=YYYY-MM-DD&pax=2 → day tours with the total for this group and date. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  try {
    return json({ ok: true, ...(await tourQuotes(url.searchParams.get("date") ?? "", Number(url.searchParams.get("pax")))) });
  } catch (e) {
    if (e instanceof QuoteError) return json({ ok: false, error: e.message }, 400);
    console.error("[app tours]", e);
    return json({ ok: false, error: "We couldn't load the tours. Please try again." }, 500);
  }
}
