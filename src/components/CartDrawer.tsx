"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { type CartItem, type PaymentMode } from "@/lib/cart";
import { TripSummary } from "./TripSummary";
import { TrustPanel } from "./trust/TrustPanel";

/** Phone and tablet version of the trip sidebar. */
export function CartDrawer({
  open,
  items,
  onClose,
  onRemove,
  mode,
  onMode,
  name,
  onName,
}: {
  open: boolean;
  items: CartItem[];
  onClose: () => void;
  onRemove: (id: string) => void;
  mode: PaymentMode;
  onMode: (m: PaymentMode) => void;
  name: string;
  onName: (n: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
        aria-label="Your trip"
        inert={!open}
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-slate-50 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-4 bg-emerald-950 text-white flex items-center justify-between">
          <h2 className="font-extrabold text-lg">Your trip</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close your trip"
            className="h-11 w-11 inline-flex items-center justify-center rounded-lg text-emerald-200 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 flex-1 overflow-y-auto space-y-6">
          <TripSummary
            items={items}
            onRemove={onRemove}
            mode={mode}
            onMode={onMode}
            name={name}
            onName={onName}
          />
          <TrustPanel />
        </div>
      </aside>
    </>
  );
}
