import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_ENTITY_PLACEHOLDER, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { whatsAppLink } from "@/lib/cart";
import { bilingualAlternates } from "@/lib/publicLang";
import { CARRIER_NOTE } from "@/lib/trust";

export const metadata: Metadata = {
  title: "Terms of Service | Costa Rica Private Transfers",
  description:
    "The terms for booking private transfers, sightseeing stops and day tours in Costa Rica through Costa Rica Private Transfers.",
  alternates: bilingualAlternates("/terms", "en"),
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <p>
          These terms apply when you plan, request or book a trip through Costa Rica Private Transfers. Please read
          them together with our <Link href="/cancellation">Cancellation policy</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>. By sending a trip request you accept them.
        </p>
      }
    >
      <LegalSection id="who" title="1. Who we are">
        <p>
          Costa Rica Private Transfers is an online booking platform for private transfers with sightseeing stops
          and 1-day private tours in Costa Rica. The platform is operated by{" "}
          <strong>{LEGAL_ENTITY_PLACEHOLDER}</strong> (“Costa Rica Private Transfers”, “we”, “our team”).
        </p>
        <p>
          {CARRIER_NOTE} We select and check our partner drivers (interview, criminal and driving
          record checks, vehicle information and proof of insurance), arrange your trip with them and
          stay in touch with you before and during it. Where a driver holds a Costa Rica Tourism
          Institute (ICT) tourist-transport permit, we show it on that driver’s profile; it is a
          per-driver badge, not a promise about every ride.
        </p>
        <p>
          Some parts of a trip, such as park entry, boats, lodges, guides and activities, are provided
          by other independent operators (see section 7).
        </p>
      </LegalSection>

      <LegalSection id="requests" title="2. Trip requests and confirmation">
        <ul>
          <li>
            Sending a trip request on our site, by WhatsApp or by email <strong>is not a booking</strong>.
            It asks our team to check availability for your dates, route and group.
          </li>
          <li>
            A service is booked only when our team <strong>confirms it to you in writing</strong> (by
            email or in your trip chat) and, where payment is due in advance, once that payment is
            received. Until then we may decline a request or propose a change.
          </li>
          <li>
            Your confirmation shows the services, dates, pickup times, places and price. Please check
            it and tell us straight away if anything is wrong.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="prices" title="3. Prices and payment">
        <ul>
          <li>
            All prices are in <strong>US dollars (USD)</strong>. Amounts in other currencies are an
            estimate only.
          </li>
          <li>
            Prices can vary by season (for example high season and holiday weeks). The price in your
            written confirmation is the price you pay for the services listed in it; we don’t add
            surge or fuel surcharges afterwards.
          </li>
          <li>
            A price covers only what your confirmation lists. Park entrance fees, meals, tips and
            optional activities are extra unless the confirmation says they are included.
          </li>
          <li>
            How and when to pay is shown before you book and in your confirmation. Card payments are
            handled by our payment provider; we never see or store your full card details.
          </li>
          <li>
            Extra waiting time, extra stops or route changes you ask for on the day may cost extra; the
            driver or our team will tell you the price before.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="you" title="4. Your responsibilities">
        <ul>
          <li>
            Give us accurate details: names, number of passengers (including children and their
            ages), flight number and arrival time, hotel or exact pickup and drop-off addresses, and a
            mobile number where we can reach you during the trip.
          </li>
          <li>Tell us promptly about changes, such as a new flight time or hotel.</li>
          <li>Be ready at the agreed pickup place and time.</li>
          <li>
            Stay within the luggage allowance of the vehicle you booked. Tell us in advance about
            surfboards, bikes, extra or oversized bags. If luggage does not fit safely, the driver may
            refuse it or a larger vehicle may be needed at extra cost.
          </li>
          <li>
            Request child seats and booster seats when you book, with each child’s age. Costa Rican law
            requires suitable child restraints, so a driver may not be able to carry a child without one.
          </li>
          <li>
            Carry a valid passport or ID, follow the driver’s safety instructions and wear a seat belt.
            Drivers may refuse to carry anyone who is aggressive, seriously intoxicated or carrying
            illegal or dangerous items, without a refund.
          </li>
          <li>Pay for any damage or extra cleaning you or your group cause to a vehicle.</li>
        </ul>
      </LegalSection>

      <LegalSection id="waiting" title="5. Pickups and waiting time">
        <ul>
          <li>
            <strong>Airport pickups:</strong> we follow your flight, so the driver adjusts to delays.
            The driver waits up to 60 minutes after the actual landing time at no extra cost.
          </li>
          <li>
            <strong>Other pickups</strong> (hotels, docks, addresses): the driver waits up to 15
            minutes after the agreed time at no extra cost.
          </li>
          <li>
            If you can’t be found and we can’t reach you by phone, WhatsApp or the trip chat within the
            waiting time, the ride counts as a no-show (see the{" "}
            <Link href="/cancellation">Cancellation policy</Link>). If you know you’ll be late, message
            us: we’ll try to help, and extra waiting may cost extra.
          </li>
          <li>
            Drive times we show are realistic estimates for Costa Rican mountain roads, not
            guarantees. Traffic, weather, roadworks and stops you choose can make a trip longer.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="parks" title="6. National parks, permits and timed entry">
        <ul>
          <li>
            <strong>Corcovado National Park</strong> requires SINAC permits and certified guides booked
            in advance, and overnight places at Sirena Station are limited. Our rides take you to Sierpe
            or Drake Bay; the guide and the permit are booked separately, and availability is decided
            by SINAC, not by us.
          </li>
          <li>
            <strong>Poás Volcano</strong> uses timed-entry tickets that sell out. Your visit time
            depends on the tickets available.
          </li>
          <li>
            Parks and authorities can close trails or whole parks at short notice (for example for
            weather, volcanic activity or capacity). Park rules, fees and opening hours are set by the
            park, not by us.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="operators" title="7. Third-party operators">
        <p>
          Boats, lodges, guides, parks, tours and activities included in a trip are provided by
          independent operators under their own terms and safety rules. We choose operators carefully
          and pass on your booking details, but we don’t control how they run their services. Please
          follow their instructions, especially for boats, water activities, hikes and ziplines.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="8. Our responsibility and its limits">
        <ul>
          <li>
            We are responsible for arranging the services in your confirmation with reasonable care and
            skill, and for the information we give you about them.
          </li>
          <li>
            The partner driver or operator who performs a service is responsible for performing it,
            including their vehicle, licences, permits and insurance.
          </li>
          <li>
            As far as the law allows, our total liability to you for a booking is limited to the amount
            you paid us for the affected service. We are not liable for indirect losses such as missed
            flights, connections, hotel nights or activities booked separately; please allow generous
            time before flights.
          </li>
          <li>
            Nothing in these terms limits rights you have under Costa Rican consumer protection law
            (Ley 7472) or liability that cannot legally be limited, such as for death or personal
            injury caused by negligence.
          </li>
          <li>
            We recommend travel insurance that covers cancellation, medical costs and luggage.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="force-majeure" title="9. Events outside our control">
        <p>
          We are not responsible for delays or cancellations caused by events outside our or our
          partners’ reasonable control, including heavy rain, storms, flooding, landslides, road
          closures, volcanic activity, earthquakes, park closures, strikes, government orders or public
          health measures. In those cases we offer a new date or a refund of the affected service as
          explained in the <Link href="/cancellation">Cancellation policy</Link>.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="10. Changes and cancellations">
        <p>
          Changes and cancellations, by you or by us, follow our{" "}
          <Link href="/cancellation">Cancellation policy</Link>.
        </p>
      </LegalSection>

      <LegalSection id="chat" title="11. Trip chat and reviews">
        <p>
          Your trip page includes a chat with our team and, once assigned, your driver. Please keep it
          polite and about your trip. For your safety, phone numbers, emails and links can’t be shared
          between travellers and drivers in the chat; our team can share contact details when needed.
          If you post a review, it must be about your own trip and honest.
        </p>
      </LegalSection>

      <LegalSection id="law" title="12. Governing law">
        <p>
          These terms are governed by the laws of the Republic of Costa Rica. Disputes go to the
          competent courts of Costa Rica, without affecting any mandatory consumer rights you have in
          your country of residence. If you have a complaint, please contact us first; we will try to
          solve it quickly and in good faith.
        </p>
        <p>
          We may update these terms. The version in force when we confirm your booking applies to that
          booking.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="13. Contact">
        <p>
          Message our team on{" "}
          <a href={whatsAppLink("Hi! I have a question about your terms.")} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          , in your trip chat, or through this website. Operator: {LEGAL_ENTITY_PLACEHOLDER}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
