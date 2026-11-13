import { PAYMENT_TONE, STATUS_TONE, paymentLabel, paymentState, statusShort } from "@/lib/adminBookings";
import type { PostingState } from "@/lib/postingWindow";
import type { TeamLang } from "@/lib/teamLang";
import { Chip } from "./ui";

/**
 * Coloured booking status ("Confirmada", "Buscando conductor", …). Pass `posting` ("closed") for a
 * job-board booking whose 1-hour posting is over: it shows "Publicación cerrada" (still needs a driver).
 */
export function StatusChip({ status, lang, posting }: { status: string; lang: TeamLang; posting?: PostingState | null }) {
  if (status === "pending_bids" && posting === "closed")
    return <Chip tone="orange">{lang === "en" ? "Posting closed" : "Publicación cerrada"}</Chip>;
  return <Chip tone={STATUS_TONE[status] ?? "grey"}>{statusShort(status, lang)}</Chip>;
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
