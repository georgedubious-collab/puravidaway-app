"use client";

import { Compass, Luggage, MessageCircle } from "lucide-react";
import Link from "next/link";
import { whatsAppLink } from "@/lib/cart";
import { formatUSD } from "@/lib/pricing";

/** App bar. The trip button only shows below xl, where the trip sidebar is hidden. */
export function Header({
  cartCount,
  totalCents,
  onOpenCart,
}: {
  cartCount: number;
  totalCents: number;
  onOpenCart: () => void;
}) {
  return (
    <header className="bg-emerald-950 text-white sticky top-0 z-40 shadow-lg border-b border-emerald-800">
      <div className="max-w-[1440px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 shrink-0 rounded-xl bg-amber-400 flex items-center justify-center text-emerald-950">
              <Compass className="w-5 h-5" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="font-extrabold text-lg tracking-tight">PuraVidaWay</span>
          </Link>
          <nav aria-label="App" className="hidden sm:flex items-center gap-1 text-sm font-bold">
            <Link
              href="/"
              aria-current="page"
              className="px-4 py-2.5 rounded-lg bg-amber-400 text-slate-950"
            >
              Book
            </Link>
            <a
              href={whatsAppLink("Hi PuraVidaWay! I have a question about my Costa Rica trip.")}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-lg text-emerald-100 hover:bg-emerald-800/60 inline-flex items-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4" aria-hidden /> Chat
            </a>
          </nav>
        </div>

        <button
          type="button"
          onClick={onOpenCart}
          aria-label={`Open your trip, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
          className="xl:hidden shrink-0 min-h-11 bg-emerald-800 hover:bg-emerald-700 text-white px-3.5 rounded-xl text-sm font-bold flex items-center gap-2 transition"
        >
          <Luggage className="w-4 h-4" aria-hidden />
          <span>Your trip</span>
          {cartCount > 0 ? (
            <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-xs font-extrabold">
              {formatUSD(totalCents)}
            </span>
          ) : null}
        </button>
      </div>
    </header>
  );
}
