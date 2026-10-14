"use client";

import { CheckCircle2, MessageCircle, Send, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { submitTripRequest } from "@/app/trip/actions";
import {
  amountDueNowCents,
  cartTotalCents,
  cartWhatsAppMessage,
  whatsAppLink,
  type CartItem,
  type PaymentMode,
} from "@/lib/cart";
import { formatUSD } from "@/lib/pricing";

export interface TripContact {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

/** Everything the trip panel needs; owned by Storefront so sidebar and drawer stay in sync. */
export interface TripState {
  items: CartItem[];
  onRemove: (id: string) => void;
  mode: PaymentMode;
  onMode: (m: PaymentMode) => void;
  contact: TripContact;
  onContact: (c: TripContact) => void;
  onReprice: (prices: Record<string, number>) => void;
  /** Booking references once the trip was sent (the cart is then emptied). */
  sentRefs: string[] | null;
  /** Private trip page (driver, car photos) once the trip was sent. */
  sentTripId: string | null;
  onSent: (refs: string[], tripId: string | null) => void;
  onNewTrip: () => void;
}

const field = "mt-1 w-full min-h-11 border border-slate-300 rounded-xl px-3 text-base sm:text-sm font-semibold text-slate-900";

/**
 * The trip: its legs in date order, payment choice and sending the request.
 * Used in the desktop sidebar and inside the mobile drawer.
 */
export function TripSummary({ trip }: { trip: TripState }) {
  const { items, onRemove, mode, onMode, contact, onContact } = trip;
  const total = cartTotalCents(items);
  const dueNow = amountDueNowCents(total, mode);
  const legs = [...items].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [website, setWebsite] = useState(""); // spam trap, hidden from people

  if (trip.sentRefs) return <Sent refs={trip.sentRefs} tripId={trip.sentTripId} contact={contact} onNewTrip={trip.onNewTrip} />;

  const set = (k: keyof TripContact) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onContact({ ...contact, [k]: e.target.value });

  function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await submitTripRequest({
        items: items.map((i) => ({ id: i.id, date: i.date, totalCents: i.totalCents, spec: i.spec })),
        mode,
        ...contact,
        website,
      });
      if (res.ok) {
        trip.onSent(res.refs, res.tripId);
      } else {
        if ("repriced" in res) trip.onReprice(res.repriced);
        setError(res.error);
      }
    });
  }

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
                <p className="text-sm font-extrabold text-emerald-700">{formatUSD(item.totalCents)}</p>
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

      <form onSubmit={send} className="space-y-3">
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
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Trip total</span>
          <span className="font-bold text-slate-900">{formatUSD(total)}</span>
        </div>
        <div className="flex items-center justify-between font-extrabold text-slate-900">
          <span>Due when confirmed</span>
          <span className="text-2xl text-emerald-700">{formatUSD(dueNow)}</span>
        </div>

        {items.length > 0 && (
          <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
            <legend className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">Your details</legend>
            <label className="block text-xs font-bold text-slate-600">
              Full name
              <input required value={contact.name} onChange={set("name")} autoComplete="name" className={field} />
            </label>
            <label className="block text-xs font-bold text-slate-600">
              Email
              <input required type="email" value={contact.email} onChange={set("email")} autoComplete="email" className={field} />
            </label>
            <label className="block text-xs font-bold text-slate-600">
              Mobile number (with country code)
              <input
                required
                type="tel"
                value={contact.phone}
                onChange={set("phone")}
                autoComplete="tel"
                placeholder="+1 555 123 4567"
                className={field}
              />
            </label>
            <label className="block text-xs font-bold text-slate-600">
              Anything we should know? (optional)
              <textarea
                value={contact.notes}
                onChange={set("notes")}
                rows={2}
                maxLength={1000}
                placeholder="Flight number, hotel, child seats, luggage…"
                className="mt-1 w-full border border-slate-300 rounded-xl p-3 text-base sm:text-sm text-slate-900"
              />
            </label>
            <label aria-hidden className="hidden">
              Website
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </fieldset>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={items.length === 0 || pending}
          className="w-full min-h-12 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Send className="w-5 h-5" /> {pending ? "Sending…" : "Send trip request"}
        </button>
        <p className="text-xs text-slate-500 text-center">
          Nothing is charged now. Our team confirms availability and your pickup times by email and
          in your trip chat, then sends your payment link.
        </p>
        {items.length > 0 && (
          <a
            href={whatsAppLink(cartWhatsAppMessage(items, mode, contact.name))}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-600"
          >
            <MessageCircle className="w-4 h-4" /> Or chat with us on WhatsApp first
          </a>
        )}
      </form>
    </div>
  );
}

function Sent({
  refs,
  tripId,
  contact,
  onNewTrip,
}: {
  refs: string[];
  tripId: string | null;
  contact: TripContact;
  onNewTrip: () => void;
}) {
  const message = `Hi PuraVidaWay! I just sent my trip request${refs.length ? ` (${refs.join(", ")})` : ""}. My name is ${contact.name}.`;
  return (
    <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5" role="status">
      <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      <div>
        <p className="text-lg font-extrabold text-emerald-950">Request sent. Thank you!</p>
        <p className="mt-1 text-sm text-emerald-900">
          We&apos;ve emailed a copy to <strong>{contact.email}</strong>. Our team will check
          availability and reply in your trip chat; we&apos;ll email you when we do. Nothing has been charged.
        </p>
      </div>
      {refs.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
            Your booking reference{refs.length > 1 ? "s" : ""}
          </p>
          <p className="mt-1 font-mono text-base font-bold text-emerald-950">{refs.join(" · ")}</p>
        </div>
      )}
      {tripId && (
        <a
          href={`/trip/${tripId}`}
          className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 font-extrabold text-white hover:bg-emerald-600"
        >
          Open your trip page &amp; chat
        </a>
      )}
      {tripId && (
        <p className="text-xs text-emerald-900">
          Bookmark it: your driver&apos;s profile and car photos appear there once your trip is confirmed.
        </p>
      )}
      <a
        href={whatsAppLink(message)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-11 items-center justify-center gap-2 text-sm font-bold text-emerald-800 hover:text-emerald-700"
      >
        <MessageCircle className="h-4 w-4" /> Prefer WhatsApp? Message us there
      </a>
      <button type="button" onClick={onNewTrip} className="w-full min-h-11 text-sm font-bold text-emerald-800 underline">
        Plan another trip
      </button>
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
