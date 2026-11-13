import { PAYMENT_TONE, paymentLabel, paymentState, statusView, type PaidFields } from "@/lib/adminBookings";
import type { PostingState } from "@/lib/postingWindow";
import type { TeamLang } from "@/lib/teamLang";
import { Chip } from "./ui";

/**
 * Coloured booking status ("Confirmada", "Buscando conductor", …). Pass `posting` ("closed") for a
 * job-board booking whose 1-hour posting is over: it shows "Publicación cerrada" (still needs a driver).
 * Pass `booking` (its money fields) so a paid new request shows "Solicitud nueva · pagada" (green).
 * `offers` / `minutesLeft` add "· 2 ofertas" / "· 38 min" on the phone cards.
 */
export function StatusChip({
  status,
  lang,
  posting,
  booking,
  offers,
  minutesLeft,
}: {
  status: string;
  lang: TeamLang;
  posting?: PostingState | null;
  booking?: PaidFields | null;
  offers?: number;
  minutesLeft?: number;
}) {
  const en = lang === "en";
  const o = offers === undefined ? "" : ` · ${offers} ${en ? (offers === 1 ? "offer" : "offers") : offers === 1 ? "oferta" : "ofertas"}`;
  if (status === "pending_bids" && posting === "closed")
    return <Chip tone="orange">{`${en ? "Posting closed" : "Publicación cerrada"}${o}`}</Chip>;
  const v = statusView(status, lang, booking);
  const extra = status === "pending_bids" && posting === "open" ? (offers ? o : minutesLeft ? ` · ${minutesLeft} min` : "") : "";
  return <Chip tone={v.tone}>{`${v.label}${extra}`}</Chip>;
}

/** Where the money stands ("Pagado", "Pendiente", "Efectivo al conductor", …); "PRUEBA" for test checkouts. */
export function PaymentChip({
  booking,
  lang,
  test = false,
}: {
  booking: Parameters<typeof paymentState>[0];
  lang: TeamLang;
  test?: boolean;
}) {
  const s = paymentState(booking);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Chip tone={PAYMENT_TONE[s]}>{paymentLabel(s, lang)}</Chip>
      {test && (
        <Chip tone="grey" title={lang === "en" ? "Test checkout: no money was charged" : "Pago de prueba: no se cobró dinero"}>
          {lang === "en" ? "TEST" : "PRUEBA"}
        </Chip>
      )}
    </span>
  );
}
