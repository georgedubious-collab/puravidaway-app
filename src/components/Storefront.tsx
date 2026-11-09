"use client";

import { MessageCircle, Route, Sun, Tent } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { HubId } from "@/lib/catalog";
import type { CatalogData } from "@/lib/catalogModel";
import { CatalogProvider } from "./CatalogContext";
import {
  cartTotals,
  type CartItem,
  parsePaymentMode,
  parseStoredCart,
  type PaymentMode,
  whatsAppLink,
} from "@/lib/cart";
import { addDays } from "@/lib/dates";
import { formatUSD } from "@/lib/pricing";
import { parseRideLink } from "@/lib/shareLink";
import { CartDrawer } from "./CartDrawer";
import { DayToursView } from "./DayToursView";
import { ExpeditionsView } from "./ExpeditionsView";
import { Header } from "./Header";
import { LegalLinks } from "./legal/LegalLinks";
import { Toast, useToast } from "./Toast";
import { TransfersView } from "./TransfersView";
import { TripSummary, type TripContact, type TripState } from "./TripSummary";
import { TrustPanel } from "./trust/TrustPanel";
import { UpsellSuggestion, type Suggestion } from "./UpsellSuggestion";

const STORAGE_KEY = "pvw-cart-v1";
const MODE_KEY = "pvw-pay-mode";

type Builder = "transfers" | "daytours" | "multiday";

const BUILDERS: { id: Builder; label: string; Icon: typeof Route }[] = [
  { id: "transfers", label: "Ride", Icon: Route },
  { id: "daytours", label: "Day tour", Icon: Sun },
  { id: "multiday", label: "Expedition", Icon: Tent },
];

/**
 * The booking app. Desktop (xl+): the trip sits in a sidebar next to the builder,
 * always visible. Smaller screens: a bottom bar opens the same trip in a drawer.
 * Route pages link here with ?from=SJO&to=ManuelAntonio to pre-fill a ride; the
 * ride builder keeps the full ride in the address (src/lib/shareLink.ts) so it can be shared.
 */
export function Storefront({ today, catalog }: { today: string; catalog: CatalogData }) {
  const params = useSearchParams();
  // Read on every render: coming back to the Ride tab restores the ride from the address.
  const rideInit = parseRideLink(params, catalog, today);
  // "While you're there" suggestion after a ride is added (dismissible).
  const [upsell, setUpsell] = useState<{ destination: HubId; date: string } | null>(null);
  // The tour / expedition picked from a suggestion, highlighted in its tab.
  const [focus, setFocus] = useState<{ suggestion: Suggestion; date: string; n: number } | null>(null);

  const [builder, setBuilder] = useState<Builder>("transfers");
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<PaymentMode>("full_100");
  const [contact, setContact] = useState<TripContact>({ name: "", email: "", phone: "", notes: "" });
  const [sentRefs, setSentRefs] = useState<string[] | null>(null);
  const [sentTripToken, setSentTripToken] = useState<string | null>(null);
  const toast = useToast();

  // Per-visitor convenience only: restore the trip on reload.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // Reading browser storage after mount is the one place a hydrating
      // setState is intentional: the server never knows this visitor's trip.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(parseStoredCart(raw));
      // Old values (the retired "deposit_20") load as paying online in full.
      const storedMode = window.localStorage.getItem(MODE_KEY);
      if (storedMode) setMode(parsePaymentMode(storedMode));
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
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode, hydrated]);

  function addItem(item: CartItem) {
    setItems((prev) => [...prev, item]);
    toast.show("Added to your trip");
    if (item.spec?.kind === "transfer") {
      setUpsell({ destination: item.spec.destination, date: item.date ? addDays(item.date, 1) : addDays(today, 15) });
    } else {
      setUpsell(null);
    }
  }
  function pickSuggestion(s: Suggestion) {
    if (!upsell) return;
    setFocus((prev) => ({ suggestion: s, date: upsell.date, n: (prev?.n ?? 0) + 1 }));
    setBuilder(s.kind === "day_tour" ? "daytours" : "multiday");
    setUpsell(null);
  }
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const total = cartTotals(items, mode, catalog.cashFeeBps).totalCents;
  const trip: TripState = {
    items,
    onRemove: removeItem,
    mode,
    onMode: setMode,
    contact,
    onContact: setContact,
    // The server re-priced some items (catalog changed since they were added).
    onReprice: (prices) =>
      setItems((prev) => prev.map((i) => (prices[i.id] !== undefined ? { ...i, totalCents: prices[i.id] } : i))),
    sentRefs,
    sentTripToken,
    onSent: (refs, tripToken) => {
      setSentRefs(refs);
      setSentTripToken(tripToken);
      setItems([]);
    },
    onNewTrip: () => setSentRefs(null),
  };

  return (
    <CatalogProvider catalog={catalog}>
      <Header cartCount={items.length} totalCents={total} onOpenCart={() => setCartOpen(true)} />

      <div className="max-w-[1440px] mx-auto w-full px-4 py-5 flex-1 xl:grid xl:grid-cols-[340px_minmax(0,1fr)] xl:gap-6 xl:items-start">
        <aside
          aria-labelledby="trip-heading"
          className="hidden xl:block xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto space-y-5 pb-4"
        >
          <h2 id="trip-heading" className="text-xl font-extrabold text-slate-900">
            Your trip
          </h2>
          <TripSummary trip={trip} />
          <div className="border-t border-slate-200 pt-5">
            <TrustPanel cashFeeBps={catalog.cashFeeBps} />
          </div>
        </aside>

        <main className={`min-w-0 space-y-5 ${items.length ? "pb-24 xl:pb-0" : ""}`}>
          <div
            role="group"
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
                  aria-pressed={active}
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
              initial={rideInit}
              // Shown right under the "Add this ride" button, where the traveller is looking.
              suggestion={
                upsell && (
                  <UpsellSuggestion
                    destination={upsell.destination}
                    date={upsell.date}
                    onPick={pickSuggestion}
                    onDismiss={() => setUpsell(null)}
                  />
                )
              }
            />
          )}
          {builder === "daytours" && (
            <DayToursView
              key={focus?.suggestion.kind === "day_tour" ? `focus-${focus.n}` : "tours"}
              today={today}
              onAdd={addItem}
              {...(focus?.suggestion.kind === "day_tour"
                ? {
                    initialRegion: catalog.dayTours.find((t) => t.id === focus.suggestion.id)?.region,
                    initialDate: focus.date,
                    highlightId: focus.suggestion.id,
                  }
                : {})}
            />
          )}
          {builder === "multiday" && (
            <ExpeditionsView
              key={focus?.suggestion.kind === "expedition" ? `focus-${focus.n}` : "expeditions"}
              today={today}
              onAdd={addItem}
              {...(focus?.suggestion.kind === "expedition" ? { initialDate: focus.date, highlightId: focus.suggestion.id } : {})}
            />
          )}
        </main>
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-[1440px] mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <p>
            © {today.slice(0, 4)} PuraVidaWay · Costa Rica ·{" "}
            <Link href="/driver" className="font-bold text-slate-600 hover:text-emerald-700">
              Drive with PuraVidaWay
            </Link>
          </p>
          <LegalLinks />
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

      <CartDrawer open={cartOpen} trip={trip} onClose={() => setCartOpen(false)} />
      <Toast message={toast.message} />
    </CatalogProvider>
  );
}
