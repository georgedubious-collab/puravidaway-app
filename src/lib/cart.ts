/**
 * Trip Cart model. Phase 2a keeps it in React state (persisted to
 * localStorage for convenience). Phase 2b moves checkout to the server.
 */
import { WHATSAPP_NUMBER } from "./catalog";
import { depositCents, formatUSD } from "./pricing";

export type CartItem =
  | {
      kind: "transfer";
      id: string;
      title: string;
      detail: string;
      date: string;
      totalCents: number;
    }
  | {
      kind: "day_tour";
      id: string;
      title: string;
      detail: string;
      date: string;
      totalCents: number;
    }
  | {
      kind: "expedition";
      id: string;
      title: string;
      detail: string;
      date: string;
      totalCents: number;
    };

export type PaymentMode = "full_100" | "deposit_20";

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
