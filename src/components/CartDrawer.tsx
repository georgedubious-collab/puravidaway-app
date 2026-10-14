"use client";

import { MessageCircle, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  amountDueNowCents,
  cartTotalCents,
  cartWhatsAppMessage,
  whatsAppLink,
  type CartItem,
  type PaymentMode,
} from "@/lib/cart";
import { formatUSD } from "@/lib/pricing";

export function CartDrawer({
  open,
  items,
  onClose,
  onRemove,
}: {
  open: boolean;
  items: CartItem[];
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  const [mode, setMode] = useState<PaymentMode>("deposit_20");
  const [name, setName] = useState("");
  const total = cartTotalCents(items);
  const dueNow = amountDueNowCents(total, mode);

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-950/60 z-50 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        aria-hidden={!open}
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-4 bg-emerald-950 text-white flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base">Your Costa Rica Trip Cart</h3>
            <p className="text-[11px] text-emerald-300">
              Combine transfers, sightseeing stops & tours
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="text-emerald-200 hover:text-white p-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          {items.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-10">
              Your cart is empty. Add a transfer, tour or expedition to get started.
            </p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className="border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-slate-900">{item.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{item.detail}</p>
                <p className="text-[11px] text-slate-500">Date: {item.date || "TBD"}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-extrabold text-emerald-700">
                  {formatUSD(item.totalCents)}
                </p>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  aria-label="Remove item"
                  className="text-slate-400 hover:text-red-600 mt-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
          <div className="grid grid-cols-2 bg-white p-1 rounded-lg border border-slate-200">
            {(
              [
                ["full_100", "Pay 100% now"],
                ["deposit_20", "20% deposit now"],
              ] as [PaymentMode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`py-1.5 text-xs font-bold rounded-md transition ${
                  mode === m ? "bg-emerald-600 text-white" : "text-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">
            {mode === "deposit_20"
              ? "A 20% deposit locks in your drivers and SINAC park permits. Balance due before travel."
              : "Pay in full and you're all set."}
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold"
          />
          <div className="flex items-center justify-between text-sm font-bold text-slate-700">
            <span>Trip total</span>
            <span>{formatUSD(total)}</span>
          </div>
          <div className="flex items-center justify-between text-base font-extrabold text-slate-900">
            <span>Due now</span>
            <span className="text-emerald-700 text-xl">{formatUSD(dueNow)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={items.length ? whatsAppLink(cartWhatsAppMessage(items, mode, name)) : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={items.length === 0}
              className={`bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 ${
                items.length === 0 ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <MessageCircle className="w-4 h-4" /> Book via WhatsApp
            </a>
            <button
              type="button"
              disabled
              title="Online card payment arrives in Phase 2d"
              className="bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 opacity-50 cursor-not-allowed"
            >
              Pay online (soon)
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
