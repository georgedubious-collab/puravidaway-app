import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BookingProvider, type BookingState } from "./booking";
import { DemoContext, type Demo } from "./demo";
import { LangProvider } from "./i18n";
import { RootNavigator, navTheme } from "./Navigator";
import { hub } from "./prices";
import { SessionProvider } from "./session";
import type { AppBooking, AppTrip, ChatMessage, RideQuote, Tour } from "./types";

/**
 * Design previews: every screen and booking step with made-up data, no sign-in
 * and no network. Only used when the app is started with EXPO_PUBLIC_PREVIEW=1
 * in a browser. Pick the screen with ?s=<name> (the names are the keys of
 * SCREENS below) and add &lang=es for Spanish. Never part of a phone build's
 * flow.
 */
const H = 3600 * 1000;
const at = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * H).toISOString();

const driver = { firstName: "Carlos", bio: "Born in La Fortuna, driving visitors since 2014. Ask me about the best sodas on the way!", english: "fluent", ict: true, photo: null, rating: "4.9" };
const car = { name: "Toyota Hiace", color: "White", plate: "BRT-482", seats: 10, photos: [] };
const booking = (o: Partial<AppBooking>): AppBooking => ({
  id: "b",
  ref: "CRPT-0000",
  kind: "transfer",
  title: "SJO Airport → Hotel Arenal Springs",
  scheduledAt: at(2),
  status: "confirmed",
  driverOnTheWay: false,
  passengers: 4,
  dueUsd: 0,
  paymentMode: "full_100",
  cashFeeUsd: 0,
  driver: null,
  car: null,
  myRating: null,
  driverLocation: null,
  ...o,
});
const trips: AppTrip[] = [
  {
    token: "demo",
    createdAt: at(-100),
    bookings: [
      booking({ id: "b1", ref: "CRPT-1042", driverOnTheWay: true, driver, car, unreadChat: 2, driverLocation: { lat: 10.0, lng: -84.2, recordedAt: at(0), etaAt: at(0.4), lateMin: null } }),
      booking({ id: "b2", ref: "CRPT-1047", title: "Hotel Arenal Springs → Monteverde Lodge", scheduledAt: at(74), dueUsd: 168, paymentMode: "cash_driver", cashFeeUsd: 8, driver, car }),
      booking({ id: "b3", ref: "CRPT-1051", kind: "day_tour", title: "Manuel Antonio National Park Wildlife Walk", scheduledAt: at(120), status: "pending_bids", dueUsd: 340 }),
      booking({ id: "b4", ref: "CRPT-0988", title: "Liberia Airport → Tamarindo", scheduledAt: at(-400), status: "completed", driver, car }),
    ],
  },
];
const chat: ChatMessage[] = [
  { id: "m1", party: "driver", name: "Carlos", text: "Hello! I'm on my way. I'll be at the arrivals exit with a sign with your name.", at: at(-0.3), mine: false },
  { id: "m2", party: "client", name: "You", text: "Great, we just landed. See you soon!", at: at(-0.2), mine: true },
  { id: "m3", party: "admin", name: "Our team", text: "Welcome to Costa Rica! Message us here if you need anything.", at: at(-0.1), mine: false },
];
const chatEs: ChatMessage[] = [
  { id: "m1", party: "driver", name: "Carlos", text: "¡Hola! Voy en camino. Le espero en la salida de llegadas con un rótulo con su nombre.", at: at(-0.3), mine: false },
  { id: "m2", party: "client", name: "Usted", text: "¡Perfecto, acabamos de aterrizar! Nos vemos.", at: at(-0.2), mine: true },
  { id: "m3", party: "admin", name: "Nuestro equipo", text: "¡Bienvenidos a Costa Rica! Escríbanos aquí si necesitan algo.", at: at(-0.1), mine: false },
];
const chatHidden: ChatMessage[] = [
  ...chat.slice(0, 2),
  { id: "m4", party: "client", name: "You", text: "Can you WhatsApp me at [hidden]?", at: at(-0.05), mine: true },
];
const chatHiddenEs: ChatMessage[] = [
  ...chatEs.slice(0, 2),
  { id: "m4", party: "client", name: "Usted", text: "¿Me escribe al WhatsApp [oculto]?", at: at(-0.05), mine: true },
];

const quote: RideQuote = {
  base: {},
  originLabel: "SJO Airport / San José",
  destinationLabel: "La Fortuna / Arenal",
  airportPickup: true,
  minutes: 165,
  km: 132,
  ferries: 0,
  season: { name: "High season", percent: 10 },
  cashFeeBps: 1000,
  minOfferCents: 5000,
  vehicles: [
    { id: "economy", name: "Economy Sedan", badge: "Spanish-speaking driver · direct ride", maxPax: 3, luggage: "3 suitcases", allowsStops: false, spanishSpeakingDriver: true, totalCents: 14600, perPersonCents: 4900, perPersonShare: 3 },
    { id: "sedan", name: "Standard Sedan", badge: "Best value", maxPax: 3, luggage: "3 suitcases", allowsStops: true, spanishSpeakingDriver: false, totalCents: 16200, perPersonCents: 5400, perPersonShare: 3 },
    { id: "suv", name: "Standard Comfort SUV", badge: "Most popular", maxPax: 4, luggage: "4 suitcases", allowsStops: true, spanishSpeakingDriver: false, totalCents: 19400, perPersonCents: 4900, perPersonShare: 4 },
    { id: "4x4", name: "Executive 4x4 (Prado / Fortuner)", badge: "Osa / Monteverde roads", maxPax: 4, luggage: "4 suitcases", allowsStops: true, spanishSpeakingDriver: false, totalCents: 21000, perPersonCents: 5300, perPersonShare: 4 },
    { id: "van", name: "Private Toyota HiAce / Hyundai Staria", badge: "Families & groups", maxPax: 10, luggage: "10 suitcases", allowsStops: true, spanishSpeakingDriver: false, totalCents: 21900, perPersonCents: 3200, perPersonShare: 7 },
  ],
  stops: [
    { id: "poas", name: "Poás Volcano Crater & Doka Coffee Estate", description: "Peer into an active turquoise crater lake, then sample highland Arabica coffee. Timed-entry tickets required.", durationMin: 120, cents: 17800, tourPerPersonCents: 5500, entrance: "gate" },
    { id: "sloth", name: "La Fortuna Sloth & Wildlife Sanctuary Trail", description: "Spot two- and three-toed sloths on a guided boardwalk trail near La Fortuna.", durationMin: 75, cents: 8500, tourPerPersonCents: 3000, entrance: "gate" },
  ],
};
const tours: Tour[] = [
  { id: "dt1", name: "Arenal Volcano 1968 Lava Trails, La Fortuna Waterfall & Hot Springs", region: "Arenal", regionName: "La Fortuna / Arenal", durationHours: 8, highlights: ["Lava-field trails", "La Fortuna Waterfall", "Hot springs soak"], perPersonCents: 29500, totalCents: 59000, totalWithUpgradeCents: 65500 },
  { id: "dt2", name: "Manuel Antonio National Park Wildlife Walk + Catamaran Snorkel", region: "ManuelAntonio", regionName: "Manuel Antonio / Central Pacific", durationHours: 7.5, highlights: ["Naturalist guide & scope", "Sloths, monkeys, toucans", "Afternoon catamaran"], perPersonCents: 28000, totalCents: 56000, totalWithUpgradeCents: 62500 },
  { id: "dt3", name: "Sierpe Mangrove Boat Safari & Caño Island Snorkeling", region: "Osa", regionName: "Osa Peninsula / Sierpe / Drake Bay", durationHours: 7, highlights: ["Mangrove wildlife", "Caño Island reef", "Dolphins in season"], perPersonCents: 30000, totalCents: 60000, totalWithUpgradeCents: 66500 },
  { id: "dt4", name: "Monteverde Hanging Bridges, Zipline & Night Walk", region: "Monteverde", regionName: "Monteverde & Río Celeste", durationHours: 7, highlights: ["Cloud-forest canopy", "Zipline", "Guided night walk"], perPersonCents: 23000, totalCents: 46000, totalWithUpgradeCents: 52500 },
];
const popular = {
  "SJO>Arenal": { fromCents: 14600, minutes: 165 },
  "SJO>ManuelAntonio": { fromCents: 15400, minutes: 180 },
  "LIR>Tamarindo": { fromCents: 9800, minutes: 75 },
  "SJO>Monteverde": { fromCents: 16900, minutes: 190 },
};

type Route = { name: string; params?: object; state?: object };
/** The tab bar with one tab showing; `tripId` opens that booking on top of My trips. */
const tabs = (tab: "Explore" | "Trips" | "Account", tripId?: string): Route => ({
  name: "Tabs",
  state: {
    index: ["Explore", "Trips", "Account"].indexOf(tab),
    routes: [
      { name: "Explore" },
      { name: "Trips", state: tripId ? { index: 1, routes: [{ name: "TripsList" }, { name: "TripDetail", params: { id: tripId } }] } : undefined },
      { name: "Account" },
    ],
  },
});
const sarah = "sarah@example.com";
const ride: Partial<BookingState> = { from: hub("SJO"), to: hub("Arenal"), date: "2026-12-15", vehicleId: "suv", bags: 3 };
const rideFull: Partial<BookingState> = { ...ride, stopIds: ["sloth"], prefs: { language: "english", wifi: true, stroller: false, childSeats: 1, pets: false }, notes: "AA 1234", name: "Sarah Miller", phone: "+1 555 123 4567" };
const tourPick: Partial<BookingState> = { kind: "tour", date: "2026-12-15", tourId: "dt1", upgrade: true, name: "Sarah Miller", phone: "+1 555 123 4567" };
const steps = (...names: string[]): Route[] => [tabs("Explore"), ...names.map((name) => ({ name }))];

interface Setup {
  routes: Route[];
  email?: string | null;
  trips?: AppTrip[];
  tripsLoading?: boolean;
  state?: Partial<BookingState>;
  quote?: RideQuote | null;
  quoteBusy?: boolean;
  tours?: Tour[] | null;
  demo?: Demo;
}

const SCREENS: Record<string, Setup> = {
  // Home
  home: { routes: [tabs("Explore")], email: null },
  "home-in": { routes: [tabs("Explore")] },
  "home-loading": { routes: [tabs("Explore")], email: null, demo: { loading: true } },
  // Booking a ride, step by step
  "where-empty": { routes: steps("BookWhere"), email: null, state: {}, quote: null },
  where: { routes: steps("BookWhere"), email: null, state: ride },
  search: { routes: [...steps("BookWhere"), { name: "PlaceSearch", params: { field: "to" } }], email: null, state: { from: hub("SJO") }, quote: null },
  "search-found": {
    routes: [...steps("BookWhere"), { name: "PlaceSearch", params: { field: "to" } }],
    email: null,
    state: { from: hub("SJO") },
    quote: null,
    demo: { found: [{ placeId: "p1", main: "Tabacón Thermal Resort & Spa", secondary: "La Fortuna, Alajuela Province" }, { placeId: "p2", main: "Tabacón Hot Springs", secondary: "Route 142, La Fortuna" }] },
  },
  when: { routes: steps("BookWhere", "BookWhen"), email: null, state: ride },
  time: { routes: [...steps("BookWhere", "BookWhen"), { name: "TimePicker" }], email: null, state: ride },
  ride: { routes: steps("BookWhere", "BookWhen", "BookRide"), email: null, state: ride },
  "ride-bid": { routes: steps("BookWhere", "BookWhen", "BookRide"), email: null, state: { ...ride, mode: "bid", offer: "120" } },
  "ride-loading": { routes: steps("BookWhere", "BookWhen", "BookRide"), email: null, state: ride, quote: null, quoteBusy: true },
  extras: { routes: steps("BookWhere", "BookWhen", "BookRide", "BookExtras"), email: null, state: { ...ride, stopIds: ["sloth"], prefs: { language: "english", wifi: true, stroller: false, childSeats: 1, pets: false } } },
  "extras-empty": { routes: steps("BookWhere", "BookWhen", "BookRide", "BookExtras"), email: null, state: { ...ride, vehicleId: "economy" } },
  review: { routes: steps("BookWhere", "BookWhen", "BookRide", "BookExtras", "BookReview"), state: rideFull },
  guest: { routes: steps("BookWhere", "BookWhen", "BookRide", "BookExtras", "BookReview"), email: null, state: { ...rideFull, guestEmail: sarah, payMode: "cash_driver" } },
  code: { routes: [...steps("BookWhere", "BookWhen", "BookRide", "BookExtras", "BookReview"), { name: "Code" }], email: null, state: { ...rideFull, guestEmail: sarah }, demo: { codeSentTo: sarah } },
  // Day tours
  tours: { routes: steps("Tours"), email: null, state: { kind: "tour", date: "2026-12-15" } },
  "tours-loading": { routes: steps("Tours"), email: null, state: { kind: "tour", date: "2026-12-15" }, tours: null },
  "tour-when": { routes: [...steps("Tours"), { name: "TourWhen" }], email: null, state: { kind: "tour", date: "2026-12-15" } },
  tour: { routes: [...steps("Tours"), { name: "TourDetail", params: { id: "dt1" } }], email: null, state: tourPick },
  "tour-review": { routes: [...steps("Tours"), { name: "TourDetail", params: { id: "dt1" } }, { name: "BookReview" }], state: tourPick },
  // After sending
  sent: { routes: [tabs("Explore"), { name: "Sent", params: { tripToken: "demo", payOnline: true, totalCents: 27900, testCheckout: true } }] },
  "sent-paid": { routes: [tabs("Explore"), { name: "Sent", params: { tripToken: "demo", payOnline: true, totalCents: 27900, testCheckout: true } }], demo: { paid: true } },
  "sent-cash": { routes: [tabs("Explore"), { name: "Sent", params: { tripToken: "demo", payOnline: false, totalCents: 27900, testCheckout: false } }] },
  // My trips
  trips: { routes: [tabs("Trips")] },
  empty: { routes: [tabs("Trips")], trips: [] },
  "trips-loading": { routes: [tabs("Trips")], trips: [], tripsLoading: true },
  signin: { routes: [tabs("Trips")], email: null },
  "signin-code": { routes: [tabs("Trips")], email: null, demo: { codeSentTo: sarah } },
  trip: { routes: [tabs("Trips", "b1")] },
  trip2: { routes: [tabs("Trips", "b3")] },
  rate: { routes: [tabs("Trips", "b4")] },
  "rate-sheet": { routes: [tabs("Trips", "b4"), { name: "Rate", params: { id: "b4" } }] },
  chat: { routes: [tabs("Trips", "b1"), { name: "Chat", params: { id: "b1" } }], demo: { chat } },
  "chat-es": { routes: [tabs("Trips", "b1"), { name: "Chat", params: { id: "b1" } }], demo: { chat: chatEs } },
  "chat-hidden": { routes: [tabs("Trips", "b1"), { name: "Chat", params: { id: "b1" } }], demo: { chat: chatHidden, chatNotice: true } },
  "chat-hidden-es": { routes: [tabs("Trips", "b1"), { name: "Chat", params: { id: "b1" } }], demo: { chat: chatHiddenEs, chatNotice: true } },
  "chat-draft": { routes: [tabs("Trips", "b1"), { name: "Chat", params: { id: "b1" } }], demo: { chat, chatDraft: "My number is 8888 1234" } },
  "chat-closed-es": { routes: [tabs("Trips", "b4"), { name: "Chat", params: { id: "b4" } }], demo: { chat: chatEs, chatClosed: true } },
  "chat-closed": { routes: [tabs("Trips", "b4"), { name: "Chat", params: { id: "b4" } }], demo: { chat, chatClosed: true } },
  "chat-empty": { routes: [tabs("Trips", "b3"), { name: "Chat", params: { id: "b3" } }], demo: { chat: [] } },
  // Account
  account: { routes: [tabs("Account")] },
  "account-out": { routes: [tabs("Account")], email: null },
};

export function Preview() {
  const params = new URLSearchParams(globalThis.location?.search ?? "");
  const setup = SCREENS[params.get("s") ?? "home"] ?? SCREENS.home;
  const email = setup.email === undefined ? sarah : setup.email;
  const demo: Demo = { popular, homeTours: tours, ...setup.demo };
  const initialState = { index: setup.routes.length - 1, routes: setup.routes } as Parameters<typeof NavigationContainer>[0]["initialState"];
  return (
    <LangProvider initial={params.get("lang") === "es" ? "es" : "en"}>
      <SafeAreaProvider>
        <DemoContext.Provider value={demo}>
          <SessionProvider session={null} demo={{ email, trips: email ? (setup.trips ?? trips) : [], whatsapp: "50665000000", loading: setup.tripsLoading }}>
            <BookingProvider demo={{ state: setup.state, quote: setup.quote === undefined ? quote : setup.quote, quoteBusy: setup.quoteBusy, tours: setup.tours === undefined ? tours : setup.tours }}>
              <NavigationContainer theme={navTheme} initialState={initialState} documentTitle={{ enabled: false }}>
                <RootNavigator />
              </NavigationContainer>
            </BookingProvider>
          </SessionProvider>
        </DemoContext.Provider>
      </SafeAreaProvider>
    </LangProvider>
  );
}
