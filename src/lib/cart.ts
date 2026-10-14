/**
 * Trip Cart model, kept in React state (persisted to localStorage for
 * convenience). Sending the trip goes through the server, which re-prices
 * every item (src/app/trip/actions.ts).
 */
import { WHATSAPP_NUMBER } from "./catalog";
import { depositCents, formatUSD } from "./pricing";
import { parseSpec, type ItemSpec } from "./tripRequest";

export interface CartItem {
  kind: "transfer" | "day_tour" | "expedition";
  id: string;
  title: string;
  detail: string;
  date: string;
  totalCents: number;
  /**
   * What exactly was chosen, so the server can re-price it before saving a
   * booking. Missing on items saved by older versions of the site.
   */
  spec?: ItemSpec;
}

export type PaymentMode = "full_100" | "deposit_20";

const KINDS = new Set(["transfer", "day_tour", "expedition"]);

/**
 * Validate data read back from browser storage. Anything malformed is dropped
 * so a stale or tampered value can never crash the page.
 */
export function parseStoredCart(raw: string): CartItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: CartItem[] = [];
  for (const x of parsed) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (
      typeof o.kind === "string" &&
      KINDS.has(o.kind) &&
      typeof o.id === "string" &&
      typeof o.title === "string" &&
      typeof o.detail === "string" &&
      typeof o.date === "string" &&
      Number.isInteger(o.totalCents) &&
      (o.totalCents as number) >= 0
    ) {
      const spec = parseSpec(o.spec);
      out.push({
        kind: o.kind as CartItem["kind"],
        id: o.id,
        title: o.title,
        detail: o.detail,
        date: o.date,
        totalCents: o.totalCents as number,
        ...(spec && spec.kind === o.kind ? { spec } : {}),
      });
    }
  }
  return out;
}

export function cartTotalCents(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.totalCents, 0);
}

export function amountDueNowCents(totalCents: number, mode: PaymentMode): number {
  return mode === "deposit_20" ? depositCents(totalCents) : totalCents;
}

export function newItemId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Build a WhatsApp deep link with a pre-filled message. */
export function whatsAppLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function cartWhatsAppMessage(
  items: CartItem[],
  mode: PaymentMode,
  clientName?: string,
): string {
  const lines = [
    `Hi PuraVidaWay! I'd like to book this trip${clientName ? ` (${clientName})` : ""}:`,
    "",
    ...items.map(
      (i, n) =>
        `${n + 1}. ${i.title}\n   ${i.detail}\n   Date: ${i.date || "TBD"} — ${formatUSD(i.totalCents)}`,
    ),
    "",
    `Total: ${formatUSD(cartTotalCents(items))}`,
    mode === "deposit_20"
      ? `I'd like to pay the 20% deposit now (${formatUSD(amountDueNowCents(cartTotalCents(items), mode))}).`
      : "I'd like to pay in full.",
  ];
  return lines.join("\n");
}
