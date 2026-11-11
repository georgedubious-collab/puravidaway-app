/**
 * Trip Cart model, kept in React state (persisted to localStorage for
 * convenience). Sending the trip goes through the server, which re-prices
 * every item (src/app/trip/actions.ts).
 */
import { WHATSAPP_NUMBER } from "./catalog";
import { formatTime12h } from "./dates";
import { cashFeeCents, formatBpsPercent, formatUSD } from "./pricing";
import { parseSpec, type ItemSpec } from "./tripRequest";

export interface CartItem {
  kind: "transfer" | "day_tour";
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

/**
 * How the traveller pays (Jorge, 2026-11-08; PROJECT.md §6.4):
 * - full_100: pay online in full; we send a secure payment link once the trip is confirmed.
 * - cash_driver: pay the driver in cash, plus a cash booking fee (catalog.cashFeeBps).
 *   Rides and 1-day tours (multi-day trips, always paid online, were retired on 2026-11-11).
 */
export type PaymentMode = "full_100" | "cash_driver";

/** Read a stored / submitted payment choice. The retired 20% deposit maps to paying in full. */
export function parsePaymentMode(v: unknown): PaymentMode {
  return v === "cash_driver" ? "cash_driver" : "full_100";
}

/** Rides and 1-day tours can be paid to the driver in cash. */
export function cashAllowed(kind: CartItem["kind"]): boolean {
  return kind === "transfer" || kind === "day_tour";
}

/** The payment mode that actually applies to one item. */
export function itemPaymentMode(kind: CartItem["kind"], mode: PaymentMode): PaymentMode {
  return mode === "cash_driver" && cashAllowed(kind) ? "cash_driver" : "full_100";
}

/** Cash booking fee on one item (0 unless it's paid in cash). */
export function itemCashFeeCents(item: Pick<CartItem, "kind" | "totalCents">, mode: PaymentMode, feeBps: number): number {
  return itemPaymentMode(item.kind, mode) === "cash_driver" ? cashFeeCents(item.totalCents, feeBps) : 0;
}

export interface CartTotals {
  /** Sum of item prices, before any cash fee. */
  itemsCents: number;
  cashFeeCents: number;
  /** itemsCents + cashFeeCents */
  totalCents: number;
  /** Paid online (payment link after confirmation). */
  onlineCents: number;
  /** Paid to the driver in cash, fee included. */
  cashCents: number;
}

export function cartTotals(items: CartItem[], mode: PaymentMode, feeBps: number): CartTotals {
  let onlineCents = 0;
  let cashCents = 0;
  let fee = 0;
  for (const i of items) {
    const f = itemCashFeeCents(i, mode, feeBps);
    fee += f;
    if (itemPaymentMode(i.kind, mode) === "cash_driver") cashCents += i.totalCents + f;
    else onlineCents += i.totalCents;
  }
  const itemsCents = cartTotalCents(items);
  return { itemsCents, cashFeeCents: fee, totalCents: itemsCents + fee, onlineCents, cashCents };
}

// Multi-day trips ("expedition") were retired on 2026-11-11: one left in a browser's saved
// trip is dropped when the page loads.
const KINDS = new Set(["transfer", "day_tour"]);

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
  feeBps: number,
  clientName?: string,
  lang: "en" | "es" = "en",
): string {
  const t = cartTotals(items, mode, feeBps);
  if (lang === "es") {
    return [
      `¡Hola! Quisiera reservar este viaje${clientName ? ` (${clientName})` : ""}:`,
      "",
      ...items.map(
        (i, n) =>
          `${n + 1}. ${i.title}\n   ${i.detail}\n   Fecha: ${i.date || "por definir"}${
            i.spec?.kind === "transfer" ? `, recogida ${formatTime12h(i.spec.pickupTime, "es")} (hora de Costa Rica)` : ""
          } — ${formatUSD(i.totalCents)}${
            mode === "cash_driver" ? (cashAllowed(i.kind) ? " (efectivo al conductor)" : " (en línea, el total)") : ""
          }`,
      ),
      "",
      ...(t.cashFeeCents > 0 ? [`Cargo por reserva en efectivo (${formatBpsPercent(feeBps)}): +${formatUSD(t.cashFeeCents)}`] : []),
      `Total: ${formatUSD(t.totalCents)}`,
      t.cashCents > 0
        ? `Quisiera pagar al conductor en efectivo (${formatUSD(t.cashCents)})${
            t.onlineCents > 0 ? ` y pagar el resto en línea (${formatUSD(t.onlineCents)})` : ""
          }.`
        : "Quisiera pagar en línea el total cuando el viaje esté confirmado.",
    ].join("\n");
  }
  const lines = [
    `Hi! I'd like to book this trip${clientName ? ` (${clientName})` : ""}:`,
    "",
    ...items.map(
      (i, n) =>
        `${n + 1}. ${i.title}\n   ${i.detail}\n   Date: ${i.date || "TBD"}${
          i.spec?.kind === "transfer" ? `, pickup ${formatTime12h(i.spec.pickupTime)} (Costa Rica time)` : ""
        } — ${formatUSD(i.totalCents)}${
          mode === "cash_driver" ? (cashAllowed(i.kind) ? " (cash to driver)" : " (online in full)") : ""
        }`,
    ),
    "",
    ...(t.cashFeeCents > 0 ? [`Cash booking fee (${formatBpsPercent(feeBps)}): +${formatUSD(t.cashFeeCents)}`] : []),
    `Total: ${formatUSD(t.totalCents)}`,
    t.cashCents > 0
      ? `I'd like to pay the driver in cash (${formatUSD(t.cashCents)})${
          t.onlineCents > 0 ? ` and pay the rest online (${formatUSD(t.onlineCents)})` : ""
        }.`
      : "I'd like to pay online in full once the trip is confirmed.",
  ];
  return lines.join("\n");
}
