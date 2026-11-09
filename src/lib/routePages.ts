/**
 * Route landing pages (/transfers/[slug]): the "website" layer that ranks on
 * Google and drops travelers into the trip builder with the ride pre-filled.
 * Prices, drive times and stops come from the catalog so they never drift.
 */
import type { HubId } from "./catalog";
import { formatBpsPercent } from "./pricing";

export interface RoutePage {
  slug: string;
  origin: HubId;
  destination: HubId;
  /** H1 and <title> */
  title: string;
  metaDescription: string;
  intro: string;
  /** Hotel-area hint for the CTA, e.g. "Manuel Antonio or Quepos" */
  areaLabel: string;
  driveTitle: string;
  drive: string;
  faqs: { q: string; a: string }[];
  related: { label: string; origin: HubId; destination: HubId }[];
}

export const ROUTE_PAGES: RoutePage[] = [
  {
    slug: "sjo-airport-to-manuel-antonio",
    origin: "SJO",
    destination: "ManuelAntonio",
    title: "Private transfer from SJO Airport to Manuel Antonio",
    metaDescription:
      "Private door-to-door ride from San José airport (SJO) to Manuel Antonio and Quepos. Fixed price per vehicle, optional crocodile bridge and macaw stops, local partner drivers.",
    intro:
      "Your driver meets you at arrivals and takes you straight to your hotel door. Turn the drive into part of the trip with a stop at the Tárcoles crocodile bridge or a macaw walk in Carara.",
    areaLabel: "Manuel Antonio or Quepos",
    driveTitle: "What the drive is like",
    drive:
      "From the airport you take Route 27 west and down to the Pacific at Orotina, then follow the Costanera Sur along the coast past Jacó and the oil-palm plantations around Parrita into Quepos. The last stretch climbs the hill road to Manuel Antonio's hotels. Weekend and holiday traffic on Route 27 can add an hour, so plan pickups with that in mind.",
    faqs: [
      {
        q: "Private transfer or shared shuttle?",
        a: "Shared shuttles run fixed times and stop at other hotels. A private ride leaves when you are ready, carries only your group and stops only where you want.",
      },
      {
        q: "Is the price per person?",
        a: "No. The price is for the whole vehicle, so it stays the same whether you are one traveler or four.",
      },
      {
        q: "What happens to our luggage at the stops?",
        a: "It stays locked in the vehicle and your driver waits with it while you visit the stop.",
      },
      {
        q: "How do we pay?",
        a: "Two ways. Pay online in full: once our team confirms your ride, we send you a secure payment link. Or pay your driver in cash on the day, plus a {cashFee} cash booking fee shown in your trip total. Multi-day expeditions are paid online in full, because park permits, boats and lodges are booked in advance.",
      },
    ],
    related: [
      { label: "SJO → La Fortuna / Arenal", origin: "SJO", destination: "Arenal" },
      { label: "SJO → Monteverde", origin: "SJO", destination: "Monteverde" },
      { label: "SJO → Puerto Viejo", origin: "SJO", destination: "PuertoViejo" },
      { label: "SJO → Sierpe (Drake Bay boat)", origin: "SJO", destination: "Sierpe" },
      { label: "Manuel Antonio → La Fortuna", origin: "ManuelAntonio", destination: "Arenal" },
    ],
  },
  {
    slug: "sjo-airport-to-la-fortuna-arenal",
    origin: "SJO",
    destination: "Arenal",
    title: "Private transfer from SJO Airport to La Fortuna (Arenal)",
    metaDescription:
      "Private door-to-door ride from San José airport (SJO) to La Fortuna and Arenal Volcano. Fixed price per vehicle, optional Poás Volcano and coffee stop, local partner drivers.",
    intro:
      "Your driver meets you at arrivals and takes you over the Central Valley mountains to your hotel in La Fortuna. Make a day of it with a stop at Poás Volcano's crater and a highland coffee farm on the way.",
    areaLabel: "La Fortuna or around Arenal Volcano",
    driveTitle: "What the drive is like",
    drive:
      "From the airport you head west on Route 1 past coffee towns like Grecia and Naranjo, then turn north and climb over the mountains, either through Ciudad Quesada or via San Ramón and La Tigra. The road drops into the green San Carlos plains, and on a clear day Arenal Volcano's cone appears ahead as you reach La Fortuna. The mountain stretch is winding and often misty, and afternoon rain is common, so drivers keep a steady, careful pace.",
    faqs: [
      {
        q: "Can we visit Poás Volcano on the way?",
        a: "Yes. Poás is a detour into the mountains above the airport. Entry is by timed ticket booked in advance, and clouds often hide the crater later in the day, so mornings are best.",
      },
      {
        q: "Is the price per person?",
        a: "No. The price is for the whole vehicle, so it stays the same whether you are one traveler or four.",
      },
      {
        q: "Will we see the volcano?",
        a: "Arenal is often wrapped in cloud, especially in the afternoon. Your best chance is early morning, so don't worry if it's hidden when you arrive.",
      },
      {
        q: "What happens to our luggage at the stops?",
        a: "It stays locked in the vehicle and your driver waits with it while you visit the stop.",
      },
    ],
    related: [
      { label: "La Fortuna → Monteverde", origin: "Arenal", destination: "Monteverde" },
      { label: "La Fortuna → Manuel Antonio", origin: "Arenal", destination: "ManuelAntonio" },
      { label: "SJO → Monteverde", origin: "SJO", destination: "Monteverde" },
      { label: "SJO → Manuel Antonio", origin: "SJO", destination: "ManuelAntonio" },
      { label: "Liberia (LIR) → La Fortuna", origin: "LIR", destination: "Arenal" },
    ],
  },
  {
    slug: "sjo-airport-to-monteverde",
    origin: "SJO",
    destination: "Monteverde",
    title: "Private transfer from SJO Airport to Monteverde",
    metaDescription:
      "Private door-to-door ride from San José airport (SJO) up to the Monteverde and Santa Elena cloud forest. Fixed price per vehicle, local partner drivers who know the mountain road.",
    intro:
      "Your driver meets you at arrivals and takes you from the Central Valley down to the Pacific lowlands and back up into the cloud forest, right to your hotel in Monteverde or Santa Elena.",
    areaLabel: "Monteverde or Santa Elena",
    driveTitle: "What the drive is like",
    drive:
      "From the airport you take Route 27 west toward the Pacific, then the Inter-American Highway (Route 1) north through dry lowland cattle country. After the turnoff you begin the last stretch: a steep, winding climb on Route 606 through Guacimal up to Santa Elena, about 1,400 m above sea level. It's paved now, but tight curves, fog and strong dry-season winds keep speeds low, which is why the full trip takes over three hours.",
    faqs: [
      {
        q: "Is the road to Monteverde still unpaved?",
        a: "The main climb on Route 606 is paved today, but it is narrow, steep and curvy. Our partner drivers do it regularly and drive it at a safe pace.",
      },
      {
        q: "Will it be cold in Monteverde?",
        a: "Cooler than the coast. Evenings are often misty, windy and around 15–18 °C, so keep a light jacket and rain layer handy rather than packed deep in a suitcase.",
      },
      {
        q: "Is the price per person?",
        a: "No. The price is for the whole vehicle, so it stays the same whether you are one traveler or four.",
      },
      {
        q: "Can we stop for a break on the way?",
        a: "Yes. Tell your driver when you want a restroom, coffee or snack stop; there are good places along the highway before the climb.",
      },
    ],
    related: [
      { label: "La Fortuna → Monteverde", origin: "Arenal", destination: "Monteverde" },
      { label: "SJO → La Fortuna / Arenal", origin: "SJO", destination: "Arenal" },
      { label: "Monteverde → Manuel Antonio", origin: "Monteverde", destination: "ManuelAntonio" },
      { label: "Monteverde → Tamarindo", origin: "Monteverde", destination: "Tamarindo" },
      { label: "Liberia (LIR) → Monteverde", origin: "LIR", destination: "Monteverde" },
    ],
  },
  {
    slug: "liberia-airport-to-tamarindo",
    origin: "LIR",
    destination: "Tamarindo",
    title: "Private transfer from Liberia Airport (LIR) to Tamarindo",
    metaDescription:
      "Private door-to-door ride from Liberia airport (LIR) to Tamarindo and nearby Guanacaste beaches. Fixed price per vehicle, local partner drivers.",
    intro:
      "Liberia is the closest international airport to Tamarindo. Your driver meets you at arrivals and takes you straight to your hotel or rental, with no shuttle stops at other hotels along the way.",
    areaLabel: "Tamarindo, Langosta or Playa Grande",
    driveTitle: "What the drive is like",
    drive:
      "From the airport you take Route 21 southwest through flat Guanacaste ranch land and dry forest toward Belén, then follow the road through Huacas and Villarreal down to Tamarindo. It's an easy, mostly straight drive of around an hour and a quarter. Expect slower traffic through the small towns and in Tamarindo itself in the afternoon.",
    faqs: [
      {
        q: "Should we fly into Liberia or San José for Tamarindo?",
        a: "Liberia (LIR) is much closer: about an hour and a quarter by road, versus around five hours from San José (SJO).",
      },
      {
        q: "Can you drop us at Playa Grande or Langosta instead?",
        a: "Yes. Enter your exact hotel or rental in the trip builder; nearby beaches are a short drive further.",
      },
      {
        q: "Is the price per person?",
        a: "No. The price is for the whole vehicle, so it stays the same whether you are one traveler or four.",
      },
      {
        q: "Can we stop for groceries on the way?",
        a: "Yes. Many travelers staying in rentals ask for a quick supermarket stop; just tell your driver.",
      },
    ],
    related: [
      { label: "SJO → Tamarindo", origin: "SJO", destination: "Tamarindo" },
      { label: "Liberia (LIR) → La Fortuna", origin: "LIR", destination: "Arenal" },
      { label: "Liberia (LIR) → Monteverde", origin: "LIR", destination: "Monteverde" },
      { label: "Tamarindo → La Fortuna", origin: "Tamarindo", destination: "Arenal" },
    ],
  },
  {
    slug: "sjo-airport-to-tamarindo",
    origin: "SJO",
    destination: "Tamarindo",
    title: "Private transfer from SJO Airport to Tamarindo",
    metaDescription:
      "Private door-to-door ride from San José airport (SJO) across to Tamarindo in Guanacaste. Fixed price per vehicle, comfort stops when you want them, local partner drivers.",
    intro:
      "Landed in San José but staying in Tamarindo? Your driver meets you at arrivals and takes you all the way across to the Guanacaste coast, stopping whenever you need a break.",
    areaLabel: "Tamarindo, Langosta or Playa Grande",
    driveTitle: "What the drive is like",
    drive:
      "From the airport you take Route 27 west to the Pacific, then the Inter-American Highway (Route 1) north through the lowlands. You turn onto Route 18 and cross the Tempisque River on the Friendship Bridge onto the Nicoya Peninsula, then continue north on Route 21 past Santa Cruz to Tamarindo. It's a long day of around five hours; Friday and holiday traffic leaving San José can add more.",
    faqs: [
      {
        q: "Is it better to fly into Liberia?",
        a: "If you can, yes: Liberia (LIR) is about an hour and a quarter from Tamarindo. From San José, a private ride is the simplest way across with all your luggage.",
      },
      {
        q: "Can we break up the drive?",
        a: "Yes. Tell your driver when you want a restroom, food or coffee stop. Most groups stop once around the halfway point.",
      },
      {
        q: "Is the price per person?",
        a: "No. The price is for the whole vehicle, so it stays the same whether you are one traveler or four.",
      },
      {
        q: "We land late. Is that a problem?",
        a: "Tell us your arrival time when you book. With a late landing, many travelers spend the first night near the airport and drive across the next morning in daylight.",
      },
    ],
    related: [
      { label: "Liberia (LIR) → Tamarindo", origin: "LIR", destination: "Tamarindo" },
      { label: "SJO → La Fortuna / Arenal", origin: "SJO", destination: "Arenal" },
      { label: "SJO → Monteverde", origin: "SJO", destination: "Monteverde" },
      { label: "Tamarindo → La Fortuna", origin: "Tamarindo", destination: "Arenal" },
    ],
  },
  {
    slug: "sjo-airport-to-puerto-viejo",
    origin: "SJO",
    destination: "PuertoViejo",
    title: "Private transfer from SJO Airport to Puerto Viejo",
    metaDescription:
      "Private door-to-door ride from San José airport (SJO) through Braulio Carrillo rainforest to Puerto Viejo on the Caribbean coast. Fixed price per vehicle, local partner drivers.",
    intro:
      "Your driver meets you at arrivals and takes you through the rainforest of Braulio Carrillo National Park and down to the Caribbean, right to your hotel in Puerto Viejo, Cocles or Playa Chiquita.",
    areaLabel: "Puerto Viejo, Cocles, Playa Chiquita or Manzanillo",
    driveTitle: "What the drive is like",
    drive:
      "From the airport you take Route 32 north-east straight through Braulio Carrillo National Park, a steep, curvy road through misty rainforest. You come down to the Caribbean lowlands past Guápiles and the banana plantations around Siquirres to Limón, then follow Route 36 south along the coast past Cahuita to Puerto Viejo. Heavy rain can close Route 32 for landslides; when it does, drivers take the longer road through Turrialba, which adds time.",
    faqs: [
      {
        q: "What if Route 32 is closed?",
        a: "It happens after very heavy rain. Your driver checks conditions before leaving and takes the alternative road through Turrialba if needed. We keep you posted on WhatsApp.",
      },
      {
        q: "Can you drop us south of Puerto Viejo?",
        a: "Yes. Cocles, Playa Chiquita, Punta Uva and Manzanillo are all along the same coastal road; enter your exact hotel in the trip builder.",
      },
      {
        q: "Is the price per person?",
        a: "No. The price is for the whole vehicle, so it stays the same whether you are one traveler or four.",
      },
      {
        q: "Can we stop in Cahuita?",
        a: "Yes. Cahuita is right on the way, so a short stop for lunch or a look at the village is easy. Just tell your driver.",
      },
    ],
    related: [
      { label: "SJO → La Fortuna / Arenal", origin: "SJO", destination: "Arenal" },
      { label: "SJO → Manuel Antonio", origin: "SJO", destination: "ManuelAntonio" },
      { label: "Puerto Viejo → La Fortuna", origin: "PuertoViejo", destination: "Arenal" },
      { label: "SJO → Monteverde", origin: "SJO", destination: "Monteverde" },
    ],
  },
  {
    slug: "la-fortuna-to-monteverde",
    origin: "Arenal",
    destination: "Monteverde",
    title: "Private transfer from La Fortuna (Arenal) to Monteverde",
    metaDescription:
      "Private door-to-door ride from La Fortuna and Arenal around Lake Arenal to Monteverde. Fixed price per vehicle, local partner drivers who know the mountain roads.",
    intro:
      "Your driver picks you up at your La Fortuna hotel and takes the scenic road around Lake Arenal and up into the cloud forest, door to door with your luggage the whole way.",
    areaLabel: "Monteverde or Santa Elena",
    driveTitle: "What the drive is like",
    drive:
      "The two towns look close on the map, but there's no direct road. You drive around the north shore of Lake Arenal on Route 142 past the dam, Nuevo Arenal and Tilarán, with lake and volcano views along the way. The last stretch climbs from Tilarán up to Santa Elena on a mountain road that is partly gravel and rough in places, which is why the trip takes about three and a half hours.",
    faqs: [
      {
        q: "Isn't the jeep-boat-jeep faster?",
        a: "It can be, but you change vehicles twice and carry your bags onto a boat across the lake. A private ride is door to door, with your luggage staying in one vehicle.",
      },
      {
        q: "Is the road rough?",
        a: "Parts of the final climb to Santa Elena are gravel. Our partner drivers do it regularly in vehicles suited to the road.",
      },
      {
        q: "Is the price per person?",
        a: "No. The price is for the whole vehicle, so it stays the same whether you are one traveler or four.",
      },
      {
        q: "Can we stop at the lake?",
        a: "Yes. There are lookout points and cafés along Lake Arenal; tell your driver where you'd like to pause.",
      },
    ],
    related: [
      { label: "SJO → Monteverde", origin: "SJO", destination: "Monteverde" },
      { label: "La Fortuna → Manuel Antonio", origin: "Arenal", destination: "ManuelAntonio" },
      { label: "SJO → La Fortuna / Arenal", origin: "SJO", destination: "Arenal" },
      { label: "Monteverde → Manuel Antonio", origin: "Monteverde", destination: "ManuelAntonio" },
      { label: "Monteverde → Tamarindo", origin: "Monteverde", destination: "Tamarindo" },
    ],
  },
  {
    slug: "la-fortuna-to-manuel-antonio",
    origin: "Arenal",
    destination: "ManuelAntonio",
    title: "Private transfer from La Fortuna (Arenal) to Manuel Antonio",
    metaDescription:
      "Private door-to-door ride from La Fortuna and Arenal to Manuel Antonio and Quepos. Fixed price per vehicle, optional crocodile bridge and macaw stops, local partner drivers.",
    intro:
      "Go from volcano to beach in one ride. Your driver picks you up at your La Fortuna hotel and takes you to the Pacific, with optional stops at the Tárcoles crocodile bridge or a macaw walk in Carara on the way.",
    areaLabel: "Manuel Antonio or Quepos",
    driveTitle: "What the drive is like",
    drive:
      "From La Fortuna you climb south over the mountains through La Tigra to San Ramón, then join Route 1 and Route 27 down to the Pacific at Orotina. From there the Costanera Sur follows the coast past Tárcoles, Jacó and the oil-palm plantations around Parrita into Quepos, then the hill road up to Manuel Antonio's hotels. Plan for about five hours plus any stops; the mountain section is winding and often rainy.",
    faqs: [
      {
        q: "Which stops fit on this route?",
        a: "The Tárcoles crocodile bridge and the Carara scarlet macaw walk are both right on the coastal road before Jacó, so they add very little driving.",
      },
      {
        q: "Is the price per person?",
        a: "No. The price is for the whole vehicle, so it stays the same whether you are one traveler or four.",
      },
      {
        q: "What happens to our luggage at the stops?",
        a: "It stays locked in the vehicle and your driver waits with it while you visit the stop.",
      },
      {
        q: "What time should we leave?",
        a: "A morning start gets you to the coast in daylight with time for a stop. Afternoon rain is common in the mountains, especially from May to November.",
      },
    ],
    related: [
      { label: "SJO → Manuel Antonio", origin: "SJO", destination: "ManuelAntonio" },
      { label: "SJO → La Fortuna / Arenal", origin: "SJO", destination: "Arenal" },
      { label: "La Fortuna → Monteverde", origin: "Arenal", destination: "Monteverde" },
      { label: "SJO → Sierpe (Drake Bay boat)", origin: "SJO", destination: "Sierpe" },
      { label: "Manuel Antonio → Sierpe (Drake Bay boat)", origin: "ManuelAntonio", destination: "Sierpe" },
    ],
  },
  {
    slug: "sjo-airport-to-sierpe-drake-bay",
    origin: "SJO",
    destination: "Sierpe",
    title: "Private transfer from SJO Airport to Sierpe (Drake Bay boat)",
    metaDescription:
      "Private ride from San José airport (SJO) to the Sierpe boat dock for the river boat to Drake Bay and Corcovado. Fixed price per vehicle, local partner drivers.",
    intro:
      "Most travelers reach Drake Bay by boat from Sierpe. Your driver takes you from the airport down the Pacific coast to the dock in Sierpe, timed around your boat.",
    areaLabel: "Sierpe, or right at the boat dock",
    driveTitle: "What the drive is like",
    drive:
      "From the airport you take Route 27 west to the Pacific, then the Costanera Sur south along the coast past Jacó, Quepos, Dominical and Uvita to Palmar Norte, where a short local road leads to the river town of Sierpe. The boat then winds down the Sierpe River through mangroves, crosses the river mouth and follows the coast to Drake Bay, roughly an hour on the water. The drive alone is about five hours, so plan an early start.",
    faqs: [
      {
        q: "Who arranges the boat to Drake Bay?",
        a: "Most Drake Bay lodges book their guests on a boat from Sierpe. Tell us your lodge and boat time and we'll plan the pickup so you reach the dock with time to spare.",
      },
      {
        q: "What time do the boats leave?",
        a: "Usually late morning and early afternoon, and the river-mouth crossing is only done in daylight. Arriving on an international flight often means a night near the airport or in Sierpe first.",
      },
      {
        q: "Do we need permits for Corcovado?",
        a: "Yes. Corcovado National Park requires SINAC permits and a certified guide, booked in advance, and overnight spaces at Sirena Station are limited. Book them before your trip.",
      },
      {
        q: "Can we stop on the way?",
        a: "Yes, if there's time before your boat. The Tárcoles crocodile bridge and the Carara macaw walk are right on the coastal road.",
      },
    ],
    related: [
      { label: "SJO → Manuel Antonio", origin: "SJO", destination: "ManuelAntonio" },
      { label: "Manuel Antonio → Sierpe (Drake Bay boat)", origin: "ManuelAntonio", destination: "Sierpe" },
      { label: "La Fortuna → Manuel Antonio", origin: "Arenal", destination: "ManuelAntonio" },
      { label: "SJO → Puerto Viejo", origin: "SJO", destination: "PuertoViejo" },
    ],
  },
];

/** FAQ answers can say {cashFee}; it is filled in from the live catalog so the number never drifts. */
export function fillFaq(text: string, cashFeeBps: number): string {
  return text.replaceAll("{cashFee}", formatBpsPercent(cashFeeBps));
}

export function routePage(slug: string): RoutePage | undefined {
  return ROUTE_PAGES.find((p) => p.slug === slug);
}

/** The landing page for exactly this origin → destination, if one exists. */
export function routePageFor(origin: HubId, destination: HubId): RoutePage | undefined {
  return ROUTE_PAGES.find((p) => p.origin === origin && p.destination === destination);
}

/** Link for a related ride: its landing page when there is one, otherwise the trip builder. */
export function relatedHref(origin: HubId, destination: HubId): string {
  const page = routePageFor(origin, destination);
  return page ? `/transfers/${page.slug}` : builderHref(origin, destination);
}

export function builderHref(origin: HubId, destination: HubId): string {
  return `/?from=${origin}&to=${destination}`;
}
