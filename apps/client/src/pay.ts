import * as WebBrowser from "expo-web-browser";
import { api } from "./api";

/**
 * Pay by card (Stripe, 2026-11-22): opens Stripe's secure page in an in-app browser. The card is
 * held, then charged once the driver is confirmed. Card numbers never touch the app or our server.
 * `url`: the page the server already opened when the request was sent; otherwise a new one is
 * asked for (POST /client/pay-start). Resolves when the traveller closes the browser; the caller
 * then reloads the trips to see "Card held". Returns an error message, or "" when it opened.
 */
export async function payByCard(trip: string, url?: string | null): Promise<string> {
  let page = url ?? "";
  if (!page) {
    const res = await api<{ url: string }>("/client/pay-start", { trip });
    if (!res.ok || !res.data?.url) return res.error ?? "We couldn't open the payment page.";
    page = res.data.url;
  }
  try {
    await WebBrowser.openBrowserAsync(page, { dismissButtonStyle: "done" });
    return "";
  } catch {
    return "We couldn't open the payment page.";
  }
}
