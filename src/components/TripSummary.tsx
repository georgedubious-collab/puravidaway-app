"use client";

import { MessageCircle, Trash2 } from "lucide-react";
import {
  amountDueNowCents,
  cartTotalCents,
  cartWhatsAppMessage,
  whatsAppLink,
  type CartItem,
  type PaymentMode,
} from "@/lib/cart";
import { formatUSD } from "@/lib/pricing";

/**
 * The trip: its legs in date order, payment choice and the booking button.
 * Used in the desktop sidebar and inside the mobile drawer.
 */
export function TripSummary({
  items,
  onRemove,
  mode,
  onMode,
  name,
  onName,
}: {
  items: CartItem[];
  onRemove: (id: string) => void;
  mode: PaymentMode;
  onMode: (m: PaymentMode) => void;
  name: string;
  onName: (n: string) => void;
}) {
  const total = cartTotalCents(items);
  const dueNow = amountDueNowCents(total, mode);
  const legs = [...items].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));

  return (
    <div className="space-y-4">
      {legs.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
          Your trip is empty. Add a ride, a day tour or an expedition and it will show up here.
        </p>
      ) : (
        <ol className="space-y-2">
          {legs.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500">
                  {formatLegDate(item.date)} · {KIND_LABEL[item.kind]}
                </p>
                <p className="text-sm font-extrabold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.detail}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-extrabold text-emerald-700">
                  {formatUSD(item.totalCents)}
                </p>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Remove ${item.title}`}
                  className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="space-y-3">
        <div role="group" aria-label="Payment" className="grid grid-cols-2 gap-2">
          {(
            [
              ["deposit_20", "Pay 20% now"],
              ["full_100", "Pay in full"],
            ] as [PaymentMode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => onMode(m)}
              aria-pressed={mode === m}
              className={`min-h-11 rounded-xl text-sm font-bold transition ${
                mode === m
                  ? "bg-amber-50 border-2 border-amber-400 text-slate-900"
                  : "bg-white border border-slate-300 text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="block text-xs font-bold text-slate-600">
          Your name
          <input
            type="text"
            value={name}
            onChange={(e) => onName(e.target.value)}
            autoComplete="name"
            className="mt-1 w-full min-h-11 border border-slate-300 rounded-xl px-3 text-sm font-semibold text-slate-900"
          />
        </label>
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Trip total</span>
          <span className="font-bold text-slate-900">{formatUSD(total)}</span>
        </div>
        <div className="flex items-center justify-between font-extrabold text-slate-900">
          <span>Due now</span>
          <span className="text-2xl text-emerald-700">{formatUSD(dueNow)}</span>
        </div>
        <a
          href={items.length ? whatsAppLink(cartWhatsAppMessage(items, mode, name)) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={items.length === 0}
          className={`min-h-12 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold rounded-xl flex items-center justify-center gap-2 ${
            items.length === 0 ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <MessageCircle className="w-5 h-5" /> Book this trip on WhatsApp
        </a>
        <p className="text-xs text-slate-500 text-center">Online card payment is coming soon.</p>
      </div>
    </div>
  );
}

const KIND_LABEL: Record<CartItem["kind"], string> = {
  transfer: "Ride",
  day_tour: "Day tour",
  expedition: "Expedition",
};

function formatLegDate(iso: string): string {
  if (!iso) return "Date to confirm";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}
