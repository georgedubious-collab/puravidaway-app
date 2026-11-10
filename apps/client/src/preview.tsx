import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Account, TabBar, TopBar, type Tab } from "../App";
import { Book, type Chosen, type RideQuote, type Tour } from "./screens/Book";
import { Checkout } from "./screens/Checkout";
import { SignIn } from "./screens/SignIn";
import { TripDetail } from "./screens/TripDetail";
import { Trips } from "./screens/Trips";
import { C } from "./theme";
import type { AppBooking, AppTrip, ChatMessage } from "./types";

/**
 * Design previews: every screen with made-up data, no sign-in and no network.
 * Only used when the app is started with EXPO_PUBLIC_PREVIEW=1 in a browser
 * (`?s=trips`, `empty`, `trip`, `trip2`, `rate`, `book`, `date`, `tours`,
 * `send`, `checkout`, `account`, `signin`). Never part of a phone build's flow.
 */
const H = 3600 * 1000;
const at = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * H).toISOString();
const noop = () => {};
const done = async () => {};

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
      booking({ id: "b1", ref: "CRPT-1042", driverOnTheWay: true, driver, car, driverLocation: { lat: 10.0, lng: -84.2, recordedAt: at(0), etaAt: at(0.4), lateMin: null } }),
      booking({ id: "b2", ref: "CRPT-1047", title: "Hotel Arenal Springs → Monteverde Lodge", scheduledAt: at(74), dueUsd: 168, paymentMode: "cash_driver", cashFeeUsd: 8, driver, car }),
      booking({ id: "b3", ref: "CRPT-1051", kind: "day_tour", title: "Arenal Volcano & Hot Springs day tour", scheduledAt: at(120), status: "pending_bids", dueUsd: 340 }),
      booking({ id: "b4", ref: "CRPT-0988", title: "Liberia Airport → Tamarindo", scheduledAt: at(-400), status: "completed", driver, car }),
    ],
  },
];
const chat: ChatMessage[] = [
  { id: "m1", party: "driver", name: "Carlos", text: "Hello! I'm on my way. I'll be at the arrivals exit with a sign with your name.", at: at(-0.3), mine: false },
  { id: "m2", party: "client", name: "You", text: "Great, we just landed. See you soon!", at: at(-0.2), mine: true },
];

const quote: RideQuote = {
  base: {},
  originLabel: "SJO Airport / San José",
  destinationLabel: "La Fortuna / Arenal",
  airportPickup: true,
  minutes: 175,
  km: 132,
  ferries: 0,
  season: { name: "High season", percent: 10 },
  cashFeeBps: 500,
  vehicles: [
    { id: "economy", name: "Economy sedan", badge: "Best price", maxPax: 3, luggage: "2 large bags", allowsStops: false, spanishSpeakingDriver: true, totalCents: 14600 },
    { id: "sedan", name: "Comfort SUV", badge: "Most popular", maxPax: 4, luggage: "4 large bags", allowsStops: true, spanishSpeakingDriver: false, totalCents: 16200 },
    { id: "van", name: "Minivan", badge: "For groups", maxPax: 8, luggage: "8 large bags", allowsStops: true, spanishSpeakingDriver: false, totalCents: 19800 },
  ],
  stops: [
    { id: "lapaz", name: "La Paz Waterfall Gardens", description: "Five waterfalls, a butterfly garden and rescued wildlife.", durationMin: 120, cents: 4000, entrance: "gate" },
    { id: "sarchi", name: "Sarchí oxcart town", description: "Hand-painted oxcarts and a coffee break.", durationMin: 45, cents: 1500, entrance: "free" },
  ],
};
const tours: Tour[] = [
  { id: "arenal", name: "Arenal Volcano & Hot Springs", durationHours: 10, highlights: ["Hanging bridges walk with a naturalist guide", "La Fortuna waterfall", "Evening in the hot springs"], perPersonCents: 17000, totalCents: 34000 },
  { id: "poas", name: "Poás Volcano & Coffee", durationHours: 7, highlights: ["Timed-entry tickets to the crater", "Coffee plantation tour and tasting"], perPersonCents: 12500, totalCents: 25000 },
];
const chosen: Chosen = { title: "SJO Airport / San José → La Fortuna / Arenal", detail: "Comfort SUV, 2 travellers + 1 stop · pickup 9:00 AM", date: "2026-12-15", totalCents: 20200, cashFeeBps: 500, spec: {} };

export function Preview() {
  const s = new URLSearchParams(globalThis.location?.search ?? "").get("s") ?? "trips";
  if (s === "signin") {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <SignIn />
      </SafeAreaProvider>
    );
  }
  const tab: Tab = s === "account" ? "account" : ["book", "date", "tours", "send", "checkout"].includes(s) ? "book" : "trips";
  const b = trips[0].bookings;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
        <TopBar />
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          {s === "trip" ? (
            <TripDetail booking={b[0]} token="demo" onBack={noop} onChanged={done} demo={{ chat }} />
          ) : s === "trip2" ? (
            <TripDetail booking={b[2]} token="demo" onBack={noop} onChanged={done} demo={{ chat: [] }} />
          ) : s === "rate" ? (
            <TripDetail booking={b[3]} token="demo" onBack={noop} onChanged={done} demo={{ chat: [] }} />
          ) : s === "empty" ? (
            <Trips trips={[]} loading={false} onRefresh={noop} onOpen={noop} onBook={noop} />
          ) : s === "book" ? (
            <Book email="sarah@example.com" onBooked={noop} demo={{ to: { id: "hub:Arenal", label: "La Fortuna / Arenal" }, quote }} />
          ) : s === "date" ? (
            <Book email="sarah@example.com" onBooked={noop} demo={{ pickDate: true }} />
          ) : s === "tours" ? (
            <Book email="sarah@example.com" onBooked={noop} demo={{ kind: "tour", tours }} />
          ) : s === "send" ? (
            <Book email="sarah@example.com" onBooked={noop} demo={{ chosen }} />
          ) : s === "checkout" ? (
            <Checkout tripToken="demo" payOnline totalCents={20200} testCheckout onDone={noop} />
          ) : s === "account" ? (
            <Account email="sarah@example.com" whatsapp="50665000000" onSignOut={noop} />
          ) : (
            <Trips trips={trips} loading={false} onRefresh={noop} onOpen={noop} onBook={noop} />
          )}
        </View>
        <TabBar tab={tab} onChange={noop} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
