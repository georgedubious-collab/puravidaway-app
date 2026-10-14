"use client";

import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { type CartItem, whatsAppLink } from "@/lib/cart";
import { CartDrawer } from "./CartDrawer";
import { DayToursView } from "./DayToursView";
import { ExpeditionsView } from "./ExpeditionsView";
import { Header, type Tab } from "./Header";
import { Toast, useToast } from "./Toast";
import { TransfersView } from "./TransfersView";

const STORAGE_KEY = "pvw-cart-v1";

export function Storefront() {
  const [tab, setTab] = useState<Tab>("transfers");
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const toast = useToast();

  // Per-visitor convenience only: restore the cart on reload.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // Reading browser storage after mount is the one place a hydrating
      // setState is intentional: the server never knows this visitor's cart.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      /* storage unavailable — start empty */
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, hydrated]);

  function addItem(item: CartItem) {
    setItems((prev) => [...prev, item]);
    toast.show("Added to your trip cart");
  }

  return (
    <>
      <Header
        tab={tab}
        onTab={setTab}
        cartCount={items.length}
        onOpenCart={() => setCartOpen(true)}
      />

      <main className="max-w-7xl mx-auto w-full px-4 py-6 flex-1">
        {tab === "transfers" && <TransfersView onAdd={addItem} />}
        {tab === "daytours" && <DayToursView onAdd={addItem} />}
        {tab === "multiday" && <ExpeditionsView onAdd={addItem} />}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <p>
            © {new Date().getFullYear()} PuraVidaWay · Costa Rica Travel Planner · Flores, Heredia,
            Costa Rica
          </p>
          <a
            href={whatsAppLink("Hi Jorge! I have a question about planning a trip to Costa Rica.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-bold text-emerald-700 hover:text-emerald-600"
          >
            <MessageCircle className="w-4 h-4" /> 24/7 WhatsApp concierge
          </a>
        </div>
      </footer>

      <CartDrawer
        open={cartOpen}
        items={items}
        onClose={() => setCartOpen(false)}
        onRemove={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
      />
      <Toast message={toast.message} />
    </>
  );
}
