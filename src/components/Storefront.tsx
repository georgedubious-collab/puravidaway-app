"use client";

import { Luggage } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { HubId } from "@/lib/catalog";
import type { CatalogData } from "@/lib/catalogModel";
import { localizeCatalog } from "@/lib/catalogEs";
import { t as pick, type PublicLang } from "@/lib/publicLang";
import type { Builder, BuilderTabs } from "./BuilderHero";
import { CatalogProvider } from "./CatalogContext";
import { PublicLangProvider } from "./PublicLangContext";
import {
  cartTotals,
  type CartItem,
  parsePaymentMode,
  parseStoredCart,
  type PaymentMode,
} from "@/lib/cart";
import { addDays } from "@/lib/dates";
import { formatUSD } from "@/lib/pricing";
import { parseRideLink } from "@/lib/shareLink";
import { CartDrawer } from "./CartDrawer";
import { DayToursView } from "./DayToursView";
import { ExpeditionsView } from "./ExpeditionsView";
import { SiteHeader } from "./site/SiteHeader";
import { Toast, useToast } from "./Toast";
import { TransfersView } from "./TransfersView";
import { TripSummary, type TripContact, type TripState } from "./TripSummary";
import { TrustPanel } from "./trust/TrustPanel";
import { UpsellSuggestion, type Suggestion } from "./UpsellSuggestion";

const STORAGE_KEY = "pvw-cart-v1";
const MODE_KEY = "pvw-pay-mode";

/** ?tab= values used by the site menu (src/lib/siteNav.ts). */
const TAB_PARAM: Record<string, Builder> = { transfers: "transfers", tours: "daytours", multiday: "multiday" };

/**
 * The booking app. Desktop (xl+): the trip sits in a sidebar next to the builder,
 * always visible. Smaller screens: a bottom bar opens the same trip in a drawer
 * (while the trip is empty, the ride builder pins its own "Add to trip" bar there).
 * The three builders (Transfers / Day tours / Multi-day trips) are switched from
 * the header menu on wide screens and from tabs in the hero form on phones.
 * Route pages link here with ?from=SJO&to=ManuelAntonio to pre-fill a ride; the
 * ride builder keeps the full ride in the address (src/lib/shareLink.ts) so it can be shared.
 * The same storefront serves / (English) and /es (Spanish): `lang` reaches every
 * part through PublicLangProvider, and the catalog's names are shown in that language.
 */
export function Storefront({
  today,
  catalog: rawCatalog,
  footer,
  below,
  lang = "en",
}: {
  today: string;
  catalog: CatalogData;
  /** "es" on /es. */
  lang?: PublicLang;
  /** Sections under the builder (photos, popular routes…), rendered on the server by the page. */
  below?: React.ReactNode;
  /** The site footer, rendered on the server by the page. */
  footer?: React.ReactNode;
}) {
  const t = <T,>(en: T, es: T): T => pick(lang, en, es);
  // Same prices and ids; vehicle, stop, tour… names in the page's language.
  const catalog = useMemo(() => localizeCatalog(rawCatalog, lang), [rawCatalog, lang]);
  const params = useSearchParams();
  // Read on every render: coming back to the Ride tab restores the ride from the address.
  const rideInit = parseRideLink(params, catalog, today);
  // "While you're there" suggestion after a ride is added (dismissible).
  const [upsell, setUpsell] = useState<{ destination: HubId; date: string } | null>(null);
  // The tour / expedition picked from a suggestion, highlighted in its tab.
  const [focus, setFocus] = useState<{ suggestion: Suggestion; date: string; n: number } | null>(null);

  const tabParam = params.get("tab");
  const [builder, setBuilder] = useState<Builder>(TAB_PARAM[tabParam ?? ""] ?? "transfers");
  // The site menu links to /?tab=…: follow it when the address changes (React's
  // "adjust state while rendering" pattern, no effect needed).
  const [seenTab, setSeenTab] = useState(tabParam);
  if (tabParam !== seenTab) {
    setSeenTab(tabParam);
    if (tabParam && TAB_PARAM[tabParam]) setBuilder(TAB_PARAM[tabParam]);
  }
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
    toast.show(t("Added to your trip", "Agregado a su viaje"));
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
  const tabs: BuilderTabs = { current: builder, onChange: setBuilder };
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
    <PublicLangProvider lang={lang}>
    <CatalogProvider catalog={catalog}>
      <SiteHeader
        lang={lang}
        current={builder === "daytours" ? "tours" : builder}
        extra={
          // The trip button only shows below xl, where the trip sidebar is hidden.
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={t(
              `Open your trip, ${items.length} item${items.length === 1 ? "" : "s"}`,
              `Abrir su viaje, ${items.length} elemento${items.length === 1 ? "" : "s"}`,
            )}
            className="xl:hidden shrink-0 min-h-11 min-w-11 justify-center bg-emerald-800 hover:bg-emerald-700 text-white px-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition"
          >
            {/* Narrow phones: once the trip has a price, the price alone is the button. */}
            <Luggage className={items.length ? "w-4 h-4 hidden min-[420px]:block" : "w-4 h-4"} aria-hidden />
            <span className="hidden sm:inline">{t("Your trip", "Su viaje")}</span>
            {items.length > 0 ? (
              <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-xs font-extrabold">
                {formatUSD(total)}
              </span>
            ) : null}
          </button>
        }
      />

      <div className="max-w-[1440px] mx-auto w-full px-3 sm:px-4 py-3 sm:py-5 flex-1 xl:grid xl:grid-cols-[340px_minmax(0,1fr)] xl:gap-6 xl:items-start">
        <aside
          aria-labelledby="trip-heading"
          className="hidden xl:block xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto space-y-5 pb-4"
        >
          {/* Not a heading: it comes before the page's H1 in the HTML. */}
          <p id="trip-heading" className="text-xl font-extrabold text-slate-900">
            {t("Your trip", "Su viaje")}
          </p>
          <TripSummary trip={trip} />
          <div className="border-t border-slate-200 pt-5">
            <TrustPanel cashFeeBps={catalog.cashFeeBps} />
          </div>
        </aside>

        <main className={`min-w-0 space-y-5 ${items.length ? "pb-6 xl:pb-0" : ""}`}>
          {builder === "transfers" && (
            <TransfersView
              today={today}
              onAdd={addItem}
              tabs={tabs}
              cartCount={items.length}
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
              tabs={tabs}
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
              tabs={tabs}
              {...(focus?.suggestion.kind === "expedition" ? { initialDate: focus.date, highlightId: focus.suggestion.id } : {})}
            />
          )}
        </main>
      </div>

      {below}

      <div className={items.length ? "pb-20 xl:pb-0" : builder === "transfers" ? "pb-20 lg:pb-0" : ""}>{footer}</div>

      {items.length > 0 && (
        <div className="xl:hidden fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-600">
                {t(
                  `Your trip · ${items.length} item${items.length === 1 ? "" : "s"}`,
                  `Su viaje · ${items.length} elemento${items.length === 1 ? "" : "s"}`,
                )}
              </p>
              <p className="text-xl font-extrabold text-slate-900">{formatUSD(total)}</p>
            </div>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="min-h-12 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold"
            >
              {t("Review & book", "Revisar y reservar")}
            </button>
          </div>
        </div>
      )}

      <CartDrawer open={cartOpen} trip={trip} onClose={() => setCartOpen(false)} />
      <Toast message={toast.message} />
    </CatalogProvider>
    </PublicLangProvider>
  );
}
