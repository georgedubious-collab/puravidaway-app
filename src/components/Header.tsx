"use client";

import { Compass, Luggage, Route, Sun, Tent } from "lucide-react";

export type Tab = "transfers" | "daytours" | "multiday";

const TABS: { id: Tab; label: string; Icon: typeof Route }[] = [
  { id: "transfers", label: "Transfers & Sightseeing", Icon: Route },
  { id: "daytours", label: "1-Day Private Tours", Icon: Sun },
  { id: "multiday", label: "Multi-Day Expeditions", Icon: Tent },
];

export function Header({
  tab,
  onTab,
  cartCount,
  onOpenCart,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  cartCount: number;
  onOpenCart: () => void;
}) {
  return (
    <header className="bg-emerald-950 text-white sticky top-0 z-40 shadow-lg border-b border-emerald-800">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500 flex items-center justify-center text-emerald-950 shadow">
            <Compass className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-lg tracking-tight">PuraVidaWay</span>
            </div>
            <p className="text-xs text-emerald-300 hidden sm:block">
              Door-to-door sightseeing transfers, driver bidding & custom expeditions
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCart}
          aria-label={`Open trip cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
          className="relative shrink-0 bg-emerald-800 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition"
        >
          <Luggage className="w-4 h-4" />
          <span className="hidden sm:inline">Trip Cart</span>
          <span className="bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-full text-[11px] font-extrabold min-w-[20px] text-center">
            {cartCount}
          </span>
        </button>
      </div>

      <nav className="bg-emerald-900/70 border-t border-emerald-800/80">
        <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto no-scrollbar gap-1 py-1.5">
          {TABS.map(({ id, label, Icon }, i) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTab(id)}
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition ${
                  active
                    ? "font-bold bg-amber-400 text-slate-950 shadow-sm"
                    : "font-semibold text-emerald-100 hover:bg-emerald-800/60"
                }`}
              >
                <Icon className="w-4 h-4" />
                {i + 1}. {label}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
