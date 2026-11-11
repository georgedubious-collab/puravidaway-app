import { AIRPORT_GUIDES, AIRPORTS_PATH, DESTINATION_GUIDES, DESTINATIONS_PATH, airportPath, destinationPath } from "@/lib/guides";
import { getCatalog } from "@/lib/catalogSource";
import { nightSentence } from "@/lib/nightPremium";
import { localizedHref } from "@/lib/publicLang";
import { ROUTE_PAGES, TRANSFERS_PATH, routePath } from "@/lib/routePages";
import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * /llms.txt — a plain-text summary of the business for AI assistants
 * (https://llmstxt.org). Only true facts (docs/PROJECT.md §10); built at deploy time.
 */
export const dynamic = "force-static";

export async function GET() {
  // Pickup hours and the night premium come from the pricing settings, never typed here.
  const night = nightSentence((await getCatalog()).nightPremium, "en");
  const u = (p: string) => `${SITE_URL}${p}`;
  const text = `# ${SITE_NAME}

> Private door-to-door transfers, 1-day private tours and multi-day trips across Costa Rica, with vetted independent local drivers. Fixed price per vehicle before booking, or "driver bids" where the traveller names an offer. Support by WhatsApp and email (${CONTACT_EMAIL}). English and Spanish.

Key facts:
- Prices are per vehicle in USD, confirmed before payment; season and ferry fares are included in the shown price.
- Every ride: 60 minutes free waiting; flight tracking on airport pickups, where the driver waits at arrivals holding a sign with the traveller's name (or the text they choose); child seats free on request; free cancellation up to 24 hours before pickup on rides and 1-day tours.
- ${night}
- Payment: online in full (secure link sent after the team confirms), or cash to the driver on rides and 1-day tours plus a cash booking fee. Multi-day trips are paid online in full.
- Drivers are interviewed and checked (criminal and driving records, licence, INS commercial insurance, Dekra/RTV inspection, Marchamo). An ICT tourism permit is shown as a badge on the profile of drivers who hold one.
- Drive times are realistic for Costa Rica's mountain roads. Santa Teresa / Southern Nicoya rides use the Paquera ferry (fares included); Drake Bay is reached by river boat from Sierpe.

## Main pages
- [Book a ride, tour or multi-day trip](${u("/")}): trip builder with prices
- [About us](${u("/about")}): who we are and what we offer
- [How it works](${u("/how-it-works")}): booking steps, payment and what happens on the day
- [Our drivers & safety](${u("/our-drivers")}): how drivers are vetted, ratings and location sharing
- [Help & FAQ](${u("/faq")}): answers about booking, prices, waiting time, vehicles, cancellation, ferries and boats
- [Contact](${u("/contact")}): WhatsApp, email and contact form
- [Cancellation policy](${u("/cancellation")}): refund rules for rides, tours and multi-day trips

## Private transfer routes (each page: drive time, distance, price per vehicle class, other ways to travel, FAQs)
- [All routes with drive times and prices](${u(TRANSFERS_PATH)})
${ROUTE_PAGES.map((p) => `- [${p.title.en}](${u(routePath(p))}): ${p.metaDescription.en}`).join("\n")}

## Destination guides
- [All destination guides](${u(DESTINATIONS_PATH)}): drive times from both airports in one table
${DESTINATION_GUIDES.map((g) => `- [${g.title.en}](${u(destinationPath(g))}): ${g.metaDescription.en}`).join("\n")}

## Airport guides
- [SJO or LIR: both airports compared](${u(AIRPORTS_PATH)})
${AIRPORT_GUIDES.map((g) => `- [${g.title.en}](${u(airportPath(g))}): ${g.metaDescription.en}`).join("\n")}

## Spanish (every page above has a Spanish version under /es)
- [Reservar un traslado, tour o viaje de varios días](${u("/es")}): planificador de viajes con precios
- [Quiénes somos](${u("/es/nosotros")})
- [Cómo funciona](${u("/es/como-funciona")})
- [Nuestros conductores](${u("/es/nuestros-conductores")})
- [Preguntas frecuentes](${u("/es/preguntas-frecuentes")})
- [Contacto](${u("/es/contacto")})
- [Política de cancelación](${u("/es/cancelacion")})
- [Términos del servicio](${u("/es/terminos")})
- [Política de privacidad](${u("/es/privacidad")})

## Guías de destinos y aeropuertos (español)
- [Guías de destinos](${u(localizedHref(DESTINATIONS_PATH, "es"))})
${DESTINATION_GUIDES.map((g) => `- [${g.title.es}](${u(localizedHref(destinationPath(g), "es"))})`).join("\n")}
- [Guías de aeropuertos](${u(localizedHref(AIRPORTS_PATH, "es"))})
${AIRPORT_GUIDES.map((g) => `- [${g.title.es}](${u(localizedHref(airportPath(g), "es"))})`).join("\n")}

## Rutas de traslado privado (español)
- [Todas las rutas con tiempos de viaje y precios](${u(localizedHref(TRANSFERS_PATH, "es"))})
${ROUTE_PAGES.map((p) => `- [${p.title.es}](${u(localizedHref(routePath(p), "es"))})`).join("\n")}
`;
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
