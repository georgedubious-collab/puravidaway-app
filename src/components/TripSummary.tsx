"use client";

import { CheckCircle2, MessageCircle, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { submitTripRequest } from "@/app/trip/actions";
import { trackBeginCheckout, trackLead } from "@/lib/analytics";
import {
  cartTotals,
  cartWhatsAppMessage,
  cashAllowed,
  whatsAppLink,
  type CartItem,
  type PaymentMode,
} from "@/lib/cart";
import { DEFAULT_PICKUP_TIME, formatShortDate, formatTime12h } from "@/lib/dates";
import { formatBpsPercent, formatUSD } from "@/lib/pricing";
import { localizedHref, type PublicLang } from "@/lib/publicLang";
import { localizeServerMessage } from "@/lib/serverMessagesEs";
import { useCatalog } from "./CatalogContext";
import { usePublicLang, useT } from "./PublicLangContext";

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
  sentTripToken: string | null;
  onSent: (refs: string[], tripToken: string | null) => void;
  onNewTrip: () => void;
}

const field = "mt-1 w-full min-h-11 border border-slate-300 rounded-xl px-3 text-base font-semibold text-slate-900";

type FieldErrors = Partial<Record<"name" | "email" | "phone", string>>;

/**
 * The trip: its legs in date order, payment choice and sending the request.
 * Used in the desktop sidebar and inside the mobile drawer.
 */
export function TripSummary({ trip }: { trip: TripState }) {
  const { items, onRemove, mode, onMode, contact, onContact } = trip;
  const { cashFeeBps } = useCatalog();
  const lang = usePublicLang();
  const t = useT();
  const feeLabel = formatBpsPercent(cashFeeBps);
  const totals = cartTotals(items, mode, cashFeeBps);
  const anyCashable = items.some((i) => cashAllowed(i.kind));
  const legs = [...items].sort((a, b) => legKey(a).localeCompare(legKey(b)));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [website, setWebsite] = useState(""); // spam trap, hidden from people
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  if (trip.sentRefs) return <Sent refs={trip.sentRefs} tripToken={trip.sentTripToken} contact={contact} onNewTrip={trip.onNewTrip} />;

  const set = (k: keyof TripContact) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onContact({ ...contact, [k]: e.target.value });
    if (k !== "notes" && fieldErrors[k]) setFieldErrors({ ...fieldErrors, [k]: undefined });
  };
  const fieldProps = (k: "name" | "email" | "phone") => ({
    name: k,
    value: contact[k],
    onChange: set(k),
    "aria-invalid": Boolean(fieldErrors[k]),
    "aria-describedby": fieldErrors[k] ? `trip-${k}-error` : undefined,
    className: `${field} ${fieldErrors[k] ? "border-red-600 bg-red-50" : ""}`,
  });
  const fieldError = (k: "name" | "email" | "phone") =>
    fieldErrors[k] ? (
      <span id={`trip-${k}-error`} role="alert" className="mt-1 block text-sm font-semibold text-red-700">
        {fieldErrors[k]}
      </span>
    ) : null;

  // Inline messages under each field instead of the browser's own bubbles (the form is noValidate).
  function validate(): FieldErrors {
    const errs: FieldErrors = {};
    if (contact.name.trim().length < 2) errs.name = t("Please enter your full name.", "Por favor, escriba su nombre completo.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email.trim()))
      errs.email = t("Please enter a valid email, like name@example.com.", "Por favor, escriba un correo válido, como nombre@ejemplo.com.");
    if (contact.phone.replace(/\D/g, "").length < 7)
      errs.phone = t(
        "Please enter your mobile number with the country code, like +1 555 123 4567.",
        "Por favor, escriba su número de celular con el código de país, como +506 8888 8888.",
      );
    return errs;
  }

  function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const errs = validate();
    setFieldErrors(errs);
    const first = (["name", "email", "phone"] as const).find((k) => errs[k]);
    if (first) {
      e.currentTarget.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    startTransition(async () => {
      const res = await submitTripRequest({
        items: items.map((i) => ({ id: i.id, date: i.date, totalCents: i.totalCents, spec: i.spec })),
        mode,
        cashFeeBps,
        ...contact,
        website,
        lang,
      });
      if (res.ok) {
        // Totals and codes only: never the contact details, the references or the trip link.
        trackLead(items, totals.totalCents, mode);
        trip.onSent(res.refs, res.tripToken);
      } else {
        if ("repriced" in res) trip.onReprice(res.repriced);
        setError(localizeServerMessage(res.error, lang));
      }
    });
  }

  return (
    <div className="space-y-4">
      {legs.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
          {t(
            "Your trip is empty. Add a transfer or a day tour and it will show up here.",
            "Su viaje está vacío. Agregue un traslado o un tour de un día y aparecerá aquí.",
          )}
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
                  {formatLegDate(item.date, lang)}
                  {item.kind === "transfer" && ` · ${formatTime12h(item.spec?.kind === "transfer" ? item.spec.pickupTime : DEFAULT_PICKUP_TIME, lang)}`}
                  {" · "}
                  {t(KIND_LABEL, KIND_LABEL_ES)[item.kind]}
                </p>
                <p className="text-sm font-extrabold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.detail}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-extrabold text-emerald-700">{formatUSD(item.totalCents)}</p>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  aria-label={t(`Remove ${item.title}`, `Quitar ${item.title}`)}
                  className="mt-1 inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Desktop (the trip is always in view): the first field or button used here counts as starting checkout. */}
      <form onSubmit={send} noValidate onFocus={() => trackBeginCheckout(items, totals.totalCents, mode)} className="space-y-3">
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            {t("How would you like to pay?", "¿Cómo desea pagar?")}
          </legend>
          {(
            [
              [
                "full_100",
                t("Pay online in full", "Pagar en línea el total"),
                t(
                  "We send you a secure payment link once your trip is confirmed.",
                  "Le enviamos un enlace de pago seguro cuando su viaje esté confirmado.",
                ),
              ],
              [
                "cash_driver",
                t("Pay the driver in cash", "Pagar al conductor en efectivo"),
                t(
                  `Rides and day tours, paid on the day. Adds a ${feeLabel} cash booking fee.`,
                  `Traslados y tours de un día, se paga el día del servicio. Agrega un cargo por reserva en efectivo del ${feeLabel}.`,
                ),
              ],
            ] as [PaymentMode, string, string][]
          ).map(([m, label, hint]) => {
            const disabled = m === "cash_driver" && items.length > 0 && !anyCashable;
            const on = (m === "full_100" && mode === "cash_driver" && items.length > 0 && !anyCashable) || (mode === m && !disabled);
            return (
              <button
                key={m}
                type="button"
                onClick={() => onMode(m)}
                aria-pressed={on}
                disabled={disabled}
                className={`w-full min-h-11 rounded-xl px-3 py-2 text-left transition disabled:opacity-50 ${
                  on ? "bg-amber-50 border-2 border-amber-400" : "bg-white border border-slate-300"
                }`}
              >
                <span className="block text-sm font-bold text-slate-900">{label}</span>
                <span className="block text-xs text-slate-600">{hint}</span>
              </button>
            );
          })}
        </fieldset>
        <div className="space-y-1 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>{t("Trip price", "Precio del viaje")}</span>
            <span className="font-bold text-slate-900">{formatUSD(totals.itemsCents)}</span>
          </div>
          {totals.cashFeeCents > 0 && (
            <div className="flex items-center justify-between">
              <span>
                {t("Cash booking fee", "Cargo por reserva en efectivo")} ({feeLabel})
              </span>
              <span className="font-bold text-slate-900">+{formatUSD(totals.cashFeeCents)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between font-extrabold text-slate-900">
          <span>Total</span>
          <span className="text-2xl text-emerald-700">{formatUSD(totals.totalCents)}</span>
        </div>
        {totals.cashCents > 0 && (
          <div className="space-y-1 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>{t("Cash to your driver on the day", "En efectivo a su conductor el día del servicio")}</span>
              <span className="font-bold">{formatUSD(totals.cashCents)}</span>
            </div>
            {totals.onlineCents > 0 && (
              <div className="flex items-center justify-between">
                <span>{t("Online, link sent once confirmed", "En línea, enlace enviado al confirmar")}</span>
                <span className="font-bold">{formatUSD(totals.onlineCents)}</span>
              </div>
            )}
          </div>
        )}

        {items.length > 0 && (
          <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
            <legend className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">{t("Your details", "Sus datos")}</legend>
            <label className="block text-xs font-bold text-slate-600">
              {t("Full name", "Nombre completo")}
              <input required autoComplete="name" {...fieldProps("name")} />
              {fieldError("name")}
            </label>
            <label className="block text-xs font-bold text-slate-600">
              {t("Email", "Correo electrónico")}
              <input required type="email" inputMode="email" autoComplete="email" {...fieldProps("email")} />
              {fieldError("email")}
            </label>
            <label className="block text-xs font-bold text-slate-600">
              {t("Mobile number (with country code)", "Número de celular (con código de país)")}
              <input
                required
                type="tel"
                autoComplete="tel"
                placeholder="+1 555 123 4567"
                {...fieldProps("phone")}
              />
              {fieldError("phone")}
            </label>
            <label className="block text-xs font-bold text-slate-600">
              {t("Anything we should know? (optional)", "¿Algo que debamos saber? (opcional)")}
              <textarea
                value={contact.notes}
                onChange={set("notes")}
                rows={2}
                maxLength={1000}
                placeholder={t("Flight number, hotel, child seats, luggage…", "Número de vuelo, hotel, sillas para niños, equipaje…")}
                className="mt-1 w-full border border-slate-300 rounded-xl p-3 text-base text-slate-900"
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
          <Send className="w-5 h-5" /> {pending ? t("Sending…", "Enviando…") : t("Send trip request", "Enviar solicitud de viaje")}
        </button>
        <p className="text-xs text-slate-500 text-center">
          {t("By sending this request you agree to our", "Al enviar esta solicitud usted acepta nuestros")}{" "}
          <Link href={localizedHref("/terms", lang)} target="_blank" className="inline-flex min-h-11 items-center font-semibold text-emerald-700 underline">{t("Terms", "Términos")}</Link>,{" "}
          <Link href={localizedHref("/privacy", lang)} target="_blank" className="inline-flex min-h-11 items-center font-semibold text-emerald-700 underline">{t("Privacy Policy", "la Política de privacidad")}</Link> {t("and", "y")}{" "}
          <Link href={localizedHref("/cancellation", lang)} target="_blank" className="inline-flex min-h-11 items-center font-semibold text-emerald-700 underline">{t("Cancellation policy", "la Política de cancelación")}</Link>.
        </p>
        <p className="text-xs text-slate-500 text-center">
          {t(
            "Nothing is charged now. Our team confirms availability and your pickup times by email and in your trip chat",
            "No se cobra nada ahora. Nuestro equipo confirma la disponibilidad y sus horas de recogida por correo y en el chat de su viaje",
          )}
          {totals.onlineCents > 0 || items.length === 0
            ? t(", then sends your secure payment link.", ", y luego le envía su enlace de pago seguro.")
            : t(". You pay your driver in cash on the day.", ". Usted paga a su conductor en efectivo el día del servicio.")}
        </p>
        {items.length > 0 && (
          <a
            href={whatsAppLink(cartWhatsAppMessage(items, mode, cashFeeBps, contact.name, lang))}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-600"
          >
            <MessageCircle className="w-4 h-4" /> {t("Or chat with us on WhatsApp first", "O escríbanos primero por WhatsApp")}
          </a>
        )}
      </form>
    </div>
  );
}

function Sent({
  refs,
  tripToken,
  contact,
  onNewTrip,
}: {
  refs: string[];
  tripToken: string | null;
  contact: TripContact;
  onNewTrip: () => void;
}) {
  const t = useT();
  const refsText = refs.length ? ` (${refs.join(", ")})` : "";
  const message = t(
    `Hi! I just sent my trip request${refsText}. My name is ${contact.name}.`,
    `¡Hola! Acabo de enviar mi solicitud de viaje${refsText}. Mi nombre es ${contact.name}.`,
  );
  return (
    <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5" role="status">
      <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      <div>
        <p className="text-lg font-extrabold text-emerald-950">{t("Request sent. Thank you!", "Solicitud enviada. ¡Gracias!")}</p>
        <p className="mt-1 text-sm text-emerald-900">
          {t("We've emailed a copy to", "Enviamos una copia a")} <strong>{contact.email}</strong>.{" "}
          {t(
            "Our team will check availability and reply in your trip chat; we'll email you when we do. Nothing has been charged.",
            "Nuestro equipo revisará la disponibilidad y le responderá en el chat de su viaje; le avisaremos por correo cuando lo haga. No se ha cobrado nada.",
          )}
        </p>
      </div>
      {refs.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
            {t(
              `Your booking reference${refs.length > 1 ? "s" : ""}`,
              refs.length > 1 ? "Sus referencias de reserva" : "Su referencia de reserva",
            )}
          </p>
          <p className="mt-1 font-mono text-base font-bold text-emerald-950">{refs.join(" · ")}</p>
        </div>
      )}
      {tripToken && (
        <a
          href={`/trip/${tripToken}`}
          className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 font-extrabold text-white hover:bg-emerald-600"
        >
          {t("Open your trip page & chat", "Abrir la página de su viaje y el chat")}
        </a>
      )}
      {tripToken && (
        <p className="text-xs text-emerald-900">
          {t(
            "Bookmark it: your driver's profile and car photos appear there once your trip is confirmed.",
            "Guárdela en sus favoritos: el perfil de su conductor y las fotos del vehículo aparecen allí cuando su viaje esté confirmado.",
          )}
        </p>
      )}
      <a
        href={whatsAppLink(message)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-11 items-center justify-center gap-2 text-sm font-bold text-emerald-800 hover:text-emerald-700"
      >
        <MessageCircle className="h-4 w-4" /> {t("Prefer WhatsApp? Message us there", "¿Prefiere WhatsApp? Escríbanos por ahí")}
      </a>
      <button type="button" onClick={onNewTrip} className="w-full min-h-11 text-sm font-bold text-emerald-800 underline">
        {t("Plan another trip", "Planear otro viaje")}
      </button>
    </div>
  );
}

const KIND_LABEL: Record<CartItem["kind"], string> = {
  transfer: "Transfer",
  day_tour: "Day tour",
};

const KIND_LABEL_ES: Record<CartItem["kind"], string> = {
  transfer: "Traslado",
  day_tour: "Tour de un día",
};

/** Date order, then pickup time for rides on the same day. */
function legKey(i: CartItem): string {
  return `${i.date || "9999"} ${i.spec?.kind === "transfer" ? i.spec.pickupTime : ""}`;
}

function formatLegDate(iso: string, lang: PublicLang): string {
  if (!iso) return lang === "es" ? "Fecha por confirmar" : "Date to confirm";
  return formatShortDate(iso, lang);
}
