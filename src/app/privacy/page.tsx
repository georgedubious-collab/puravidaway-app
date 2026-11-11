import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_ENTITY_PLACEHOLDER, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { CookieSentence, MeasurementCollected, MeasurementPurpose, MeasurementRecipients, MeasurementRetention } from "@/components/legal/MeasurementText";
import { whatsAppLink } from "@/lib/cart";
import { bilingualAlternates } from "@/lib/publicLang";

export const metadata: Metadata = {
  title: "Privacy Policy | Costa Rica Private Transfers",
  description:
    "What personal data Costa Rica Private Transfers collects when you request a Costa Rica trip or drive with us, why, who it is shared with, and how to access or delete it.",
  alternates: bilingualAlternates("/privacy", "en"),
};

/*
 * Keep this page in line with what the code actually stores (src/app/trip/actions.ts,
 * src/app/chat/actions.ts, src/app/driver/, src/lib/email.ts, supabase/migrations/).
 * If a new tool (analytics, CRM, payments) starts receiving personal data, update it here.
 * The paragraphs about cookies and measurement tools (Google Analytics and the optional ones)
 * live in src/components/legal/MeasurementText.tsx and show only when that tool is switched on.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      updated="2026-11-11"
      title="Privacy Policy"
      intro={
        <p>
          This policy explains what personal data Costa Rica Private Transfers collects, why, who receives it and the
          rights you have. It covers travellers who request trips and partner drivers who apply to
          drive with us.
        </p>
      }
    >
      <LegalSection id="controller" title="1. Who is responsible for your data">
        <p>
          The party responsible for your data (“responsable” under Costa Rica’s Ley 8968, “controller”
          under the EU GDPR) is <strong>{LEGAL_ENTITY_PLACEHOLDER}</strong>, operating as Costa Rica Private Transfers.
          You can reach our team as described in section 10.
        </p>
      </LegalSection>

      <LegalSection id="travellers" title="2. What we collect from travellers">
        <ul>
          <li>
            <strong>Contact details:</strong> your full name, email address and mobile / WhatsApp
            number, from the trip request form.
          </li>
          <li>
            <strong>Trip details:</strong> the rides, tours and expeditions you choose, dates, pickup
            and drop-off places, number of passengers, vehicle, sightseeing stops, lodging level, ride
            preferences (driver language, child seats, stroller, Wi-Fi, pets), prices and the payment
            option you pick.
          </li>
          <li>
            <strong>Notes you add,</strong> such as flight numbers, hotels, luggage or anything else you
            tell us. Please don’t include health or other sensitive information unless it is needed for
            your trip.
          </li>
          <li>
            <strong>Trip chat messages</strong> between you, our team and your driver, and when each
            message was read.
          </li>
          <li>
            <strong>Messages you send us on WhatsApp or by email.</strong> WhatsApp is run by Meta under
            its own privacy policy.
          </li>
          <li>
            <strong>Technical data:</strong> when you send a trip request we briefly record your IP
            address (network address) and email to stop spam and abuse (at most 5 requests an hour per
            network and 3 per email). These records are deleted automatically after about a day. Our
            hosting provider also keeps standard server logs (IP address, browser, pages requested) for
            security and troubleshooting.
          </li>
          <li>
            <strong>Place search:</strong> when you type a pickup or drop-off, what you type and the
            place you pick are sent from our server to Google Maps to find the place and the road
            distance. We don’t send your name or contact details with it. The places you book are
            saved with your booking so your driver knows where to go.
          </li>
          <li>
            <strong>Visit statistics without cookies:</strong> we use Vercel Web Analytics to count page views, which
            pages are popular, and the visitor’s country and device type. It doesn’t use cookies and
            doesn’t identify you or follow you to other websites.
          </li>
          <MeasurementCollected lang="en" />
          <li>
            <strong>On your device:</strong> the site saves your trip-in-progress in your browser’s
            local storage so it isn’t lost if you reload the page. It stays on your device and you can
            clear it at any time. <CookieSentence lang="en" />
          </li>
        </ul>
        <p>
          We do <strong>not</strong> collect or store card numbers. When online payment is available, it
          will be handled by a payment provider on its own secure systems; we receive only the payment
          result (amount, status, reference).
        </p>
      </LegalSection>

      <LegalSection id="drivers" title="3. What we collect from partner drivers">
        <ul>
          <li>Sign-in email, full name and WhatsApp number.</li>
          <li>
            <strong>Verification (KYC) documents and data:</strong> your photo, Cédula or passport
            (number and images), driver’s licence (number, expiry, image), criminal record certificate
            and its date, and optionally your ICT tourist-transport permit.
          </li>
          <li>
            <strong>Vehicle data:</strong> plate, make, model, year, colour, capacity, equipment, vehicle
            photos, INS insurance policy, Dekra / RTV inspection, Marchamo and registration, with
            their numbers and expiry dates.
          </li>
          <li>Your profile text, English level, bids, assigned trips and chat messages.</li>
          <li>
            <strong>Location during trips (driver app):</strong> if you agree in the app, your phone
            shares its location with our team from 3 hours before a pickup (or from when you tap
            “I’m on my way”) until you end the trip, including when the app is in the background.
            Before the pickup we use it, with live traffic data from Google Maps, to estimate your
            arrival time. Nothing is shared outside that
            window. We keep only your latest position, not a history. It is seen by our team and, during
            that window, by the travellers you are driving (on their trip page and in their app),
            and you can stop sharing in the app at any time.
          </li>
        </ul>
        <p>
          KYC documents and numbers are stored in a private storage area that only you and our admin
          team can open. Travellers never see your Cédula, licence or insurance numbers; they see your
          first name, photo, profile text, languages, compliance badges and vehicle photos once you are
          assigned to their trip.
        </p>
      </LegalSection>

      <LegalSection id="why" title="4. Why we use it (purposes and legal bases)">
        <ul>
          <li>
            <strong>To handle your request and perform your booking</strong> (contract): check
            availability, confirm, arrange drivers and operators, send confirmations and trip-chat
            notifications, and support you during the trip.
          </li>
          <li>
            <strong>To verify drivers and keep travellers safe</strong> (legal obligations and our
            legitimate interest): check identity, licences, permits, insurance and vehicle documents.
          </li>
          <li>
            <strong>To prevent spam, fraud and abuse</strong> (legitimate interest): rate limits and
            filtering contact details out of traveller–driver chat.
          </li>
          <li>
            <strong>Accounting, tax and legal records</strong> (legal obligation).
          </li>
          <MeasurementPurpose lang="en" />
        </ul>
        <p>
          By sending a trip request or a driver application you give your informed consent, as required
          by Ley 8968, to this use of your data. We don’t sell your data, and we don’t send marketing
          messages unless you ask for them.
        </p>
      </LegalSection>

      <LegalSection id="sharing" title="5. Who receives your data">
        <ul>
          <li>
            <strong>Your partner driver</strong> sees what they need to do the job: your trip details,
            first name and pickup notes, and your phone number only from the day before the trip. Drivers
            browsing open requests see towns, date, vehicle and passenger count, never your name or
            contact details.
          </li>
          <li>
            <strong>Third-party operators</strong> (boats, lodges, guides, parks, SINAC for park permits)
            receive the names and details needed to book your services.
          </li>
          <li>
            <strong>Service providers that process data for us:</strong> Supabase (database, sign-in and
            file storage, hosted in the United States), Vercel (website hosting and server logs, United
            States and global network), Resend (sending our emails, United States), Google Maps (place search and road distances,
            United States) and, when online
            payment launches, our payment provider. They may use the data only to provide their service
            to us.
          </li>
          <MeasurementRecipients lang="en" />
          <li>Authorities, when the law requires it.</li>
        </ul>
      </LegalSection>

      <LegalSection id="transfers" title="6. International transfers">
        <p>
          Our service providers store data outside Costa Rica and the European Union, mainly in the
          United States. We use providers that offer contractual safeguards (such as the European
          Commission’s Standard Contractual Clauses) for these transfers.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="7. How long we keep it">
        <ul>
          <li>
            <strong>Bookings, payments and related messages</strong> are kept as accounting records for
            as long as Costa Rican tax and commercial law requires.
          </li>
          <li>
            <strong>Trip requests that never became bookings</strong> are deleted or anonymised when they
            are no longer needed to answer you.
          </li>
          <li>
            <strong>Anti-spam records</strong> (IP address and email) are deleted after about a day.
          </li>
          <li>
            <strong>Driver KYC documents</strong> are kept while you drive with us and for as long as we
            need them afterwards to handle claims, insurance or legal requests; then they are deleted.
          </li>
          <MeasurementRetention lang="en" />
        </ul>
      </LegalSection>

      <LegalSection id="rights" title="8. Your rights">
        <p>
          Under Costa Rica’s Ley 8968 (Protección de la Persona frente al Tratamiento de sus Datos
          Personales) you have the right to access, correct and delete your personal data (rights of
          access, rectification and cancellation). If you are in the European Union or the UK, the GDPR
          also gives you the right to:
        </p>
        <ul>
          <li>get a copy of your data (access and portability);</li>
          <li>have it corrected;</li>
          <li>have it deleted, unless we must keep it, for example as accounting records;</li>
          <li>object to or restrict how we use it;</li>
          <li>withdraw consent at any time, without affecting earlier use.</li>
        </ul>
        <p>
          To use any of these rights, message us (section 10) from the email or phone number you used,
          or include your booking reference, so we can check it’s you. We answer within 5 business days
          as Ley 8968 requires, and at the latest within one month.
        </p>
        <p>
          If you’re not satisfied, you can complain to Costa Rica’s data protection agency, PRODHAB
          (Agencia de Protección de Datos de los Habitantes), or to the data protection authority in your
          EU country.
        </p>
      </LegalSection>

      <LegalSection id="security" title="9. Security and children">
        <p>
          Access to personal data is limited by role (traveller, driver, our team), traveller contact
          details are kept in a separate area drivers can’t read, and data travels encrypted (HTTPS). No
          system is perfectly secure; if a breach affects you, we’ll tell you and the authorities as the
          law requires.
        </p>
        <p>
          Trip requests must be sent by an adult. We collect data about children only as part of a
          booking made by their parent or guardian (for example a child’s age for a child seat).
        </p>
      </LegalSection>

      <LegalSection id="contact" title="10. Contact and changes">
        <p>
          For privacy questions or requests, message our team on{" "}
          <a href={whatsAppLink("Hi! I have a privacy request.")} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>{" "}
          or in your trip chat. Operator: {LEGAL_ENTITY_PLACEHOLDER}.
        </p>
        <p>
          We’ll update this page when what we collect changes and show the new date at the top. See also
          our <Link href="/terms">Terms of Service</Link> and{" "}
          <Link href="/cancellation">Cancellation policy</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
