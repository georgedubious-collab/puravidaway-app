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
/** Drawn stand-ins for the driver's car photos (no network in previews). */
const carPhoto = (label: string, sky: string, body: string) =>
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${sky}"/>` +
      `<rect y="210" width="400" height="90" fill="#9CA3AF"/><rect x="70" y="120" width="260" height="95" rx="22" fill="${body}"/>` +
      `<rect x="100" y="135" width="80" height="40" rx="6" fill="#E0F2FE"/><rect x="200" y="135" width="100" height="40" rx="6" fill="#E0F2FE"/>` +
      `<circle cx="125" cy="218" r="22" fill="#1F2937"/><circle cx="275" cy="218" r="22" fill="#1F2937"/>` +
      `<text x="200" y="60" font-family="sans-serif" font-size="30" font-weight="700" fill="#0B1F17" text-anchor="middle">${label}</text></svg>`,
  );
const carPhotos = [carPhoto("Outside", "#BAE6FD", "#F8FAFC"), carPhoto("Inside", "#FDE68A", "#475569"), carPhoto("Luggage space", "#A7F3D0", "#E2E8F0")];
const car = { name: "Toyota Hiace", color: "White", plate: "BRT-482", seats: 10, photos: carPhotos };
/** A vehicle our team marked as electric: the trip screen shows the badge (`trip-driver`). */
const electricCar = { name: "BYD Dolphin", color: "Grey", plate: "ELC-204", seats: 4, photos: carPhotos, electric: true };
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
      booking({ id: "b1", ref: "CRPT-1042", title: "SJO Airport / San José → La Fortuna / Arenal", driverOnTheWay: true, driver, car, unreadChat: 2, driverLocation: { lat: 10.1, lng: -84.33, recordedAt: at(0), etaAt: at(0.2), lateMin: null } }),
      booking({ id: "b2", ref: "CRPT-1047", title: "Hotel Arenal Springs → Monteverde Lodge", scheduledAt: at(74), dueUsd: 168, paymentMode: "cash_driver", cashFeeUsd: 8, driver, car: electricCar, sign: { text: null, hideName: false, shown: "Emily R.", editable: true } }),
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
  vehicles: [
    { id: "economy", name: "Economy Sedan", exampleModels: "Toyota Yaris", badge: "Spanish-speaking driver · direct ride", maxPax: 3, luggage: "3 suitcases", allowsStops: false, spanishSpeakingDriver: true, totalCents: 14600, perPersonCents: 4900, perPersonShare: 3 },
    { id: "sedan", name: "Standard Sedan", exampleModels: "Toyota Corolla", badge: "Best value", maxPax: 3, luggage: "3 suitcases", allowsStops: true, spanishSpeakingDriver: false, totalCents: 16200, perPersonCents: 5400, perPersonShare: 3 },
    { id: "suv", name: "Minivan (MPV)", exampleModels: "Mitsubishi Xpander", badge: "Roomy for 4 + bags", maxPax: 4, luggage: "4 suitcases", allowsStops: true, spanishSpeakingDriver: false, totalCents: 19400, perPersonCents: 4900, perPersonShare: 4 },
    { id: "4x4", name: "Executive 4x4", exampleModels: "Toyota Prado", badge: "Osa / Monteverde roads", maxPax: 4, luggage: "4 suitcases", allowsStops: true, spanishSpeakingDriver: false, totalCents: 21000, perPersonCents: 5300, perPersonShare: 4 },
    { id: "van", name: "Private Van", exampleModels: "Toyota HiAce", badge: "Families & groups", maxPax: 10, luggage: "10 suitcases", allowsStops: true, spanishSpeakingDriver: false, totalCents: 21900, perPersonCents: 3200, perPersonShare: 7 },
  ],
  stops: [
    { id: "poas", name: "Poás Volcano Crater & Doka Coffee Estate", description: "Peer into an active turquoise crater lake, then sample highland Arabica coffee. Timed-entry tickets required.", durationMin: 120, cents: 17800, tourPerPersonCents: 5500, entrance: "gate" },
    { id: "sloth", name: "La Fortuna Sloth & Wildlife Sanctuary Trail", description: "Spot two- and three-toed sloths on a guided boardwalk trail near La Fortuna.", durationMin: 75, cents: 8500, tourPerPersonCents: 3000, entrance: "gate" },
  ],
};
/** The same sample ride with a night pickup: the server's totals already include the premium. */
const nightQuote: RideQuote = {
  ...quote,
  night: { percent: 20, startHour: 22, endHour: 4, applies: true },
  vehicles: quote.vehicles.map((v) => {
    const nightCents = Math.round(v.totalCents * 0.2);
    const totalCents = v.totalCents + nightCents;
    return { ...v, totalCents, nightCents, perPersonCents: Math.ceil(totalCents / ((v.perPersonShare ?? v.maxPax) * 100)) * 100 };
  }),
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
const ride: Partial<BookingState> = { from: hub("SJO"), to: hub("Arenal"), date: "2026-12-15", time: "10:30", whenSet: true, vehicleId: "suv", bags: 3, carryOns: 2 };
const rideFull: Partial<BookingState> = { ...ride, stopIds: ["sloth"], prefs: { language: "english", wifi: true, stroller: false, childSeats: 1, pets: false }, notes: "AA 1234", name: "Sarah Miller", phone: "+1 555 123 4567" };
const tourPick: Partial<BookingState> = { kind: "tour", date: "2026-12-15", tourId: "dt1", upgrade: true, name: "Sarah Miller", phone: "+1 555 123 4567" };
const steps = (...names: string[]): Route[] => [tabs("Explore"), ...names.map((name) => ({ name }))];
const toursTab: Demo = { explore: "tours" };
const tourDay: Partial<BookingState> = { kind: "tour", date: "2026-12-15" };

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
  /** An accepted promo code (sample). */
  promo?: { code: string; discountCents: number; key: string };
}

const SCREENS: Record<string, Setup> = {
  // Explore, rides side
  home: { routes: [tabs("Explore")], email: null, quote: null },
  "home-in": { routes: [tabs("Explore")], quote: null },
  "home-route": { routes: [tabs("Explore")], email: null, state: ride },
  "home-loading": { routes: [tabs("Explore")], email: null, quote: null, demo: { loading: true } },
  menu: { routes: [tabs("Explore"), { name: "Menu" }], email: null, quote: null },
  // Booking a ride: places → vehicle → confirm
  places: { routes: steps("BookWhere"), email: null, state: { from: hub("SJO") }, quote: null },
  "where-empty": { routes: steps("BookWhere"), email: null, state: { from: null }, quote: null },
  where: { routes: steps("BookWhere"), email: null, state: ride },
  search: { routes: [...steps("BookWhere"), { name: "PlaceSearch", params: { field: "to" } }], email: null, state: { from: hub("SJO") }, quote: null },
  "search-found": {
    routes: [...steps("BookWhere"), { name: "PlaceSearch", params: { field: "to" } }],
    email: null,
    state: { from: hub("SJO") },
    quote: null,
    demo: { found: [{ placeId: "p1", main: "Tabacón Thermal Resort & Spa", secondary: "La Fortuna, Alajuela Province" }, { placeId: "p2", main: "Tabacón Hot Springs", secondary: "Route 142, La Fortuna" }] },
  },
  // The "Set on map" picker is gone; the old name opens the place search instead.
  "map-pick": { routes: [...steps("BookWhere"), { name: "PlaceSearch", params: { field: "to" } }], email: null, state: { from: hub("SJO") }, quote: null },
  when: { routes: [...steps("BookWhere", "BookRide"), { name: "BookWhen" }], email: null, state: ride },
  time: { routes: [...steps("BookWhere", "BookRide"), { name: "BookWhen" }, { name: "TimePicker" }], email: null, state: ride },
  choose: { routes: steps("BookWhere", "BookRide"), email: null, state: ride },
  ride: { routes: steps("BookWhere", "BookRide"), email: null, state: ride },
  "ride-night": { routes: steps("BookWhere", "BookRide"), email: null, state: { ...ride, time: "23:30" }, quote: nightQuote },
  "time-night": { routes: [...steps("BookWhere", "BookRide"), { name: "BookWhen" }, { name: "TimePicker" }], email: null, state: { ...ride, time: "23:30" }, quote: nightQuote },
  "confirm-night": { routes: steps("BookWhere", "BookRide", "BookConfirm"), state: { ...ride, time: "23:30", name: "Sarah Miller", phone: "+1 555 123 4567" }, quote: nightQuote },
  "confirm-sign": { routes: steps("BookWhere", "BookRide", "BookConfirm"), state: { ...ride, name: "Sarah Miller", phone: "+1 555 123 4567", signText: "The Miller Family" } },
  "confirm-electric": { routes: steps("BookWhere", "BookRide", "BookConfirm"), state: { ...ride, name: "Sarah Miller", phone: "+1 555 123 4567", prefs: { language: "english", wifi: false, stroller: false, childSeats: 0, pets: false, electric: true } } },
  "ride-new": { routes: steps("BookWhere", "BookRide"), email: null, state: { ...ride, whenSet: false } },
  // "Driver offers" is gone (fixed prices only, 2026-11-11); the old name opens the vehicle screen.
  "ride-bid": { routes: steps("BookWhere", "BookRide"), email: null, state: ride },
  "ride-loading": { routes: steps("BookWhere", "BookRide"), email: null, state: ride, quote: null, quoteBusy: true },
  stops: { routes: [...steps("BookWhere", "BookRide", "BookConfirm"), { name: "BookStops" }], email: null, state: { ...ride, stopIds: ["sloth"] } },
  extras: { routes: [...steps("BookWhere", "BookRide", "BookConfirm"), { name: "BookExtras" }], email: null, state: { ...ride, stopIds: ["sloth"], prefs: { language: "english", wifi: true, stroller: false, childSeats: 1, pets: false } } },
  "extras-empty": { routes: [...steps("BookWhere", "BookRide", "BookConfirm"), { name: "BookExtras" }], email: null, state: { ...ride, vehicleId: "economy" } },
  confirm: { routes: steps("BookWhere", "BookRide", "BookConfirm"), state: { ...ride, name: "Sarah Miller", phone: "+1 555 123 4567" } },
  /** A promo code accepted on "Your ride" (sample discount). */
  "confirm-promo": { routes: steps("BookWhere", "BookRide", "BookConfirm"), state: { ...ride, name: "Sarah Miller", phone: "+1 555 123 4567" }, promo: { code: "SUMMER10", discountCents: 1940, key: "" } },
  review: { routes: steps("BookWhere", "BookRide", "BookConfirm"), state: rideFull },
  guest: { routes: steps("BookWhere", "BookRide", "BookConfirm"), email: null, state: { ...rideFull, guestEmail: sarah, payMode: "cash_driver" } },
  code: { routes: [...steps("BookWhere", "BookRide", "BookConfirm"), { name: "Code" }], email: null, state: { ...rideFull, guestEmail: sarah }, demo: { codeSentTo: sarah } },
  // Explore, day tours side
  tours: { routes: [tabs("Explore")], email: null, state: tourDay, demo: toursTab },
  "tours-loading": { routes: [tabs("Explore")], email: null, state: tourDay, tours: null, demo: toursTab },
  "tour-when": { routes: [tabs("Explore"), { name: "TourWhen" }], email: null, state: tourDay, demo: toursTab },
  tour: { routes: [tabs("Explore"), { name: "TourDetail", params: { id: "dt1" } }], email: null, state: tourPick, demo: toursTab },
  "tour-review": { routes: [tabs("Explore"), { name: "TourDetail", params: { id: "dt1" } }, { name: "BookReview" }], state: tourPick, demo: toursTab },
  /** The pickup place filled in and "no suggestions" ticked. */
  "tour-review-pickup": {
    routes: [tabs("Explore"), { name: "TourDetail", params: { id: "dt1" } }, { name: "BookReview" }],
    state: { ...tourPick, tourPickup: "Hotel Lomas del Volcán, La Fortuna", noSuggestions: true },
    demo: toursTab,
  },
  /** A promo code accepted on the tour review (sample discount). */
  "tour-review-promo": {
    routes: [tabs("Explore"), { name: "TourDetail", params: { id: "dt1" } }, { name: "BookReview" }],
    state: { ...tourPick, tourPickup: "Hotel Lomas del Volcán, La Fortuna" },
    demo: toursTab,
    promo: { code: "SUMMER10", discountCents: 4200, key: "" },
  },
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
  live: { routes: [tabs("Trips", "b1")] },
  "trip-driver": { routes: [tabs("Trips", "b2")] },
  // The car photo viewer, open on the second photo.
  "trip-photos": { routes: [tabs("Trips", "b2")], demo: { photoViewer: 1 } },
  trip2: { routes: [tabs("Trips", "b3")] },
  rate: { routes: [tabs("Trips", "b4")] },
  "rate-sheet": { routes: [tabs("Trips", "b4"), { name: "Rate", params: { id: "b4" } }] },
  "rate-stars": { routes: [tabs("Trips", "b4"), { name: "Rate", params: { id: "b4" } }], demo: { rateStars: 5 } },
  "rate-words": { routes: [tabs("Trips", "b4"), { name: "Rate", params: { id: "b4" } }], demo: { rateStars: 4, rateComment: "Punctual, and very careful on the mountain roads." } },
  "rate-words-es": { routes: [tabs("Trips", "b4"), { name: "Rate", params: { id: "b4" } }], demo: { rateStars: 4, rateComment: "Muy puntual y cuidadoso en las carreteras de montaña." } },
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
  const demo: Demo = { popular, homeTours: tours, vehicles: quote.vehicles, ...setup.demo };
  const initialState = { index: setup.routes.length - 1, routes: setup.routes } as Parameters<typeof NavigationContainer>[0]["initialState"];
  return (
    <LangProvider initial={params.get("lang") === "es" ? "es" : "en"}>
      <SafeAreaProvider>
        <DemoContext.Provider value={demo}>
          <SessionProvider session={null} demo={{ email, trips: email ? (setup.trips ?? trips) : [], whatsapp: "50665000000", loading: setup.tripsLoading }}>
            <BookingProvider demo={{ state: setup.state, quote: setup.quote === undefined ? quote : setup.quote, quoteBusy: setup.quoteBusy, tours: setup.tours === undefined ? tours : setup.tours, promo: setup.promo ?? null }}>
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
