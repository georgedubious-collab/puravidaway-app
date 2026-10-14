"use client";

import { MessageCircle, Route, Sun, Tent } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { HUBS, type HubId } from "@/lib/catalog";
import {
  cartTotalCents,
  type CartItem,
  parseStoredCart,
  type PaymentMode,
  whatsAppLink,
} from "@/lib/cart";
import { formatUSD } from "@/lib/pricing";
import { CartDrawer } from "./CartDrawer";
import { DayToursView } from "./DayToursView";
import { ExpeditionsView } from "./ExpeditionsView";
import { Header } from "./Header";
import { Toast, useToast } from "./Toast";
import { TransfersView } from "./TransfersView";
import { TripSummary } from "./TripSummary";
import { TrustPanel } from "./trust/TrustPanel";

const STORAGE_KEY = "pvw-cart-v1";

type Builder = "transfers" | "daytours" | "multiday";

const BUILDERS: { id: Builder; label: string; Icon: typeof Route }[] = [
  { id: "transfers", label: "Ride", Icon: Route },
  { id: "daytours", label: "Day tour", Icon: Sun },
  { id: "multiday", label: "Expedition", Icon: Tent },
];

function hubParam(value: string | null): HubId | undefined {
  return HUBS.some((h) => h.id === value) ? (value as HubId) : undefined;
}

/**
 * The booking app. Desktop (xl+): the trip sits in a sidebar next to the builder,
 * always visible. Smaller screens: a bottom bar opens the same trip in a drawer.
 * Route pages link here with ?from=SJO&to=ManuelAntonio to pre-fill a ride.
 */
export function Storefront({ today }: { today: string }) {
  const params = useSearchParams();
  const initialOrigin = hubParam(params.get("from"));
  const initialDestination = hubParam(params.get("to"));

  const [builder, setBuilder] = useState<Builder>("transfers");
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<PaymentMode>("deposit_20");
  const [name, setName] = useState("");
  const toast = useToast();

  // Per-visitor convenience only: restore the trip on reload.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // Reading browser storage after mount is the one place a hydrating
      // setState is intentional: the server never knows this visitor's trip.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(parseStoredCart(raw));
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
    toast.show("Added to your trip");
  }
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const total = cartTotalCents(items);

  return (
    <>
      <Header cartCount={items.length} totalCents={total} onOpenCart={() => setCartOpen(true)} />

      <div className="max-w-[1440px] mx-auto w-full px-4 py-5 flex-1 xl:grid xl:grid-cols-[340px_minmax(0,1fr)] xl:gap-6 xl:items-start">
        <aside
          aria-labelledby="trip-heading"
          className="hidden xl:block xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto space-y-5 pb-4"
        >
          <h2 id="trip-heading" className="text-xl font-extrabold text-slate-900">
            Your trip
          </h2>
          <TripSummary
            items={items}
            onRemove={removeItem}
            mode={mode}
            onMode={setMode}
            name={name}
            onName={setName}
          />
          <div className="border-t border-slate-200 pt-5">
            <TrustPanel />
          </div>
        </aside>

        <main className={`min-w-0 space-y-5 ${items.length ? "pb-24 xl:pb-0" : ""}`}>
          <div
            role="tablist"
            aria-label="What do you want to add?"
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-sm font-bold text-slate-600 mr-1">Add to your trip:</span>
            {BUILDERS.map(({ id, label, Icon }) => {
              const active = builder === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setBuilder(id)}
                  className={`min-h-11 px-4 rounded-full text-sm font-bold flex items-center gap-2 transition ${
                    active
                      ? "bg-emerald-950 text-white"
                      : "bg-white border border-slate-300 text-slate-700 hover:border-emerald-500"
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>

          {builder === "transfers" && (
            <TransfersView
              today={today}
              onAdd={addItem}
              initialOrigin={initialOrigin}
              initialDestination={initialDestination}
            />
          )}
          {builder === "daytours" && <DayToursView today={today} onAdd={addItem} />}
          {builder === "multiday" && <ExpeditionsView today={today} onAdd={addItem} />}
        </main>
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-[1440px] mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <p>© {today.slice(0, 4)} PuraVidaWay · Costa Rica</p>
          <a
            href={whatsAppLink("Hi PuraVidaWay! I have a question about planning a trip to Costa Rica.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-bold text-emerald-700 hover:text-emerald-600"
          >
            <MessageCircle className="w-4 h-4" /> 24/7 WhatsApp concierge
          </a>
        </div>
      </footer>

      {items.length > 0 && (
        <div className="xl:hidden fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">
                Your trip · {items.length} item{items.length === 1 ? "" : "s"}
              </p>
              <p className="text-xl font-extrabold text-slate-900">{formatUSD(total)}</p>
            </div>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="min-h-12 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold"
            >
              Review &amp; book
            </button>
          </div>
        </div>
      )}

      <CartDrawer
        open={cartOpen}
        items={items}
        onClose={() => setCartOpen(false)}
        onRemove={removeItem}
        mode={mode}
        onMode={setMode}
        name={name}
        onName={setName}
      />
      <Toast message={toast.message} />
    </>
  );
}
