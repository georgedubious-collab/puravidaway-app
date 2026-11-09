import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { whatsAppLink } from "@/lib/cart";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy | Costa Rica Private Transfers",
  description:
    "Free cancellation up to 24 hours before pickup for Costa Rica transfers and day tours; clear refund rules for multi-day expeditions.",
};

/*
 * Rules decided by the owner on 2026-11-08 (docs/PROJECT.md §9 #7).
 * Change them only together with that section.
 */
export default function CancellationPage() {
  return (
    <LegalPage
      title="Cancellation & Refund Policy"
      intro={
        <p>
          Plans change. Here is exactly what you get back if you cancel or change your trip. “Amounts
          you’ve paid us” means what you paid Costa Rica Private Transfers for the service you cancel. Times are Costa
          Rica time and count from the confirmed pickup or start time.
        </p>
      }
    >
      <LegalSection id="rides-tours" title="1. Rides (transfers) and 1-day tours">
        <div className="grid gap-3 sm:grid-cols-2">
          <Rule tone="good" when="24 hours or more before pickup" what="Free cancellation, full refund." />
          <Rule tone="bad" when="Less than 24 hours before pickup, or no-show" what="No refund." />
        </div>
        <p className="mt-4">
          Sightseeing stops and the Smart En-Route Transfer follow the ride or tour they belong to.
        </p>
      </LegalSection>

      <LegalSection id="expeditions" title="2. Multi-day expeditions">
        <div className="grid gap-3 sm:grid-cols-3">
          <Rule
            tone="good"
            when="30 days or more before the start"
            what="Full refund, minus non-refundable costs already paid (see below)."
          />
          <Rule tone="mid" when="8 to 29 days before the start" what="50% refund." />
          <Rule tone="bad" when="7 days or less before the start, or no-show" what="No refund." />
        </div>
        <p className="mt-4">
          <strong>Non-refundable costs:</strong> SINAC park permits (for example Corcovado and Sirena
          Station) and boat or lodging deposits are paid to those operators in advance and can’t be
          recovered once paid. If you cancel 30 days or more ahead, we deduct only those amounts we have
          already paid, and we show you the receipts on request.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="3. Changing your date or time">
        <ul>
          <li>
            Changes to the date or time are <strong>free if you ask 24 hours or more</strong> before
            pickup (or before the start of an expedition), subject to availability of drivers, permits
            and lodging.
          </li>
          <li>
            If the new date has a different season price, or a change costs us extra with a park or
            operator, we tell you the difference before you accept the change.
          </li>
          <li>Changes asked for less than 24 hours ahead are treated as a cancellation and a new booking.</li>
        </ul>
      </LegalSection>

      <LegalSection id="cash" title="4. Pay-the-driver (cash) bookings">
        <p>
          If you chose to pay the driver in cash, the same time limits apply. The cash-booking fee is
          refunded if you cancel 24 hours or more before pickup, and is <strong>not refundable</strong>{" "}
          if you cancel within 24 hours or don’t show up.
        </p>
      </LegalSection>

      <LegalSection id="we-cancel" title="5. If we or the driver cancel">
        <p>
          If we or your driver cancel a confirmed service for any reason other than those in section 6,
          you get a <strong>full refund</strong> of the amounts you’ve paid us for it. We’ll always try
          first to find you another driver or vehicle of the same or a higher class at no extra cost.
        </p>
      </LegalSection>

      <LegalSection id="weather" title="6. Weather, road and park closures">
        <p>
          If heavy rain, flooding, landslides, road closures, volcanic activity, a park closure or an
          authority’s order stops a service from going ahead safely, we offer you the choice of
          <strong> rebooking</strong> on another date or a <strong>refund of the affected service</strong>.
          If only part of a trip is affected (for example one stop or one day of an expedition), the
          rebooking or refund applies to that part. Park permits that SINAC itself refunds or moves are
          passed on to you.
        </p>
      </LegalSection>

      <LegalSection id="how" title="7. How to cancel and how refunds are paid">
        <ul>
          <li>
            Cancel or change in your trip chat, or message our team on{" "}
            <a href={whatsAppLink("Hi! I'd like to cancel or change my booking.")} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>{" "}
            with your booking reference. The time we receive your message counts.
          </li>
          <li>
            We confirm the cancellation and the refund amount in writing, and send the refund back to the
            way you paid as soon as possible. Your bank or card issuer may take a few extra days to show it.
          </li>
          <li>Unused parts of a trip you leave early are not refunded.</li>
        </ul>
        <p>
          This policy is part of our <Link href="/terms">Terms of Service</Link> and doesn’t limit any
          rights you have under Costa Rican consumer law.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

const TONE = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-950",
  mid: "border-amber-200 bg-amber-50 text-amber-950",
  bad: "border-slate-200 bg-white text-slate-900",
} as const;

function Rule({ tone, when, what }: { tone: keyof typeof TONE; when: string; what: string }) {
  return (
    <div className={`rounded-xl border p-4 ${TONE[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-wider opacity-80">{when}</p>
      <p className="mt-1 text-base font-extrabold">{what}</p>
    </div>
  );
}
