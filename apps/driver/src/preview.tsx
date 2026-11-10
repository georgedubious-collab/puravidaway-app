import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { TabBar, TopBar, type Tab } from "../App";
import { Calendar } from "./screens/Calendar";
import { Documents } from "./screens/Documents";
import { Earnings } from "./screens/Earnings";
import { Help } from "./screens/Help";
import { Jobs } from "./screens/Jobs";
import { LocationCard } from "./screens/LocationCard";
import { Profile } from "./screens/Profile";
import { SignIn } from "./screens/SignIn";
import { TripDetail } from "./screens/TripDetail";
import { Trips } from "./screens/Trips";
import { C } from "./theme";
import type { ChatMessage, DriverInfo, Job, Names, Trip, Vehicle } from "./types";

/**
 * Design previews: every screen with made-up data, no sign-in and no network.
 * Only used when the app is started with EXPO_PUBLIC_PREVIEW=1 in a browser
 * (`?s=jobs`, `trips`, `trip`, `trip2`, `calendar`, `earnings`, `profile`,
 * `documents`, `apply`, `help`, `signin`). Never part of a phone build's flow.
 */
const H = 3600 * 1000;
const at = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * H).toISOString();
const noop = () => {};
const done = async () => {};

const names: Names = { tours: { arenal: "Arenal Volcano & Hot Springs day tour" }, stops: { crocs: "Tárcoles crocodile bridge", lapaz: "La Paz Waterfall Gardens" } };
const driver: DriverInfo = { kyc_status: "approved", home_hub: "SJO", rating_avg: 4.9, rating_count: 37, location_consent_at: at(-500) };
const vehicles: Vehicle[] = [
  { id: "v1", make_model: "Toyota Hiace", plate: "BRT-482", passenger_capacity: 10, status: "approved" },
  { id: "v2", make_model: "Hyundai Staria", plate: "CLV-119", passenger_capacity: 6, status: "approved" },
];

const trip = (o: Partial<Trip>): Trip => ({
  id: "t",
  booking_ref: "CRPT-0000",
  service_type: "transfer",
  catalog_item_id: null,
  origin: "SJO Airport, Alajuela",
  destination: "Hotel Arenal Springs, La Fortuna",
  origin_coords: { lat: 9.99, lng: -84.2, town: "SJO" },
  destination_coords: { lat: 10.47, lng: -84.64, town: "Arenal" },
  sightseeing_stops: null,
  vehicle_class: null,
  scheduled_at: at(5),
  passenger_count: 4,
  flight_or_hotel_notes: null,
  preferences: null,
  driver_notes: null,
  status: "confirmed",
  driver_payout: 118,
  payment_mode: "online",
  cash_to_collect: null,
  driver_settled_at: null,
  completed_at: null,
  en_route_at: null,
  ...o,
});

const trips: Trip[] = [
  trip({ id: "t1", booking_ref: "CRPT-1042", status: "in_progress", scheduled_at: at(-1), en_route_at: at(-2), flight_or_hotel_notes: "Flight UA1090, lands 1:35 PM", driver_notes: "Two child seats please", cash_to_collect: 160 }),
  trip({ id: "t2", booking_ref: "CRPT-1047", scheduled_at: at(26), origin: "Hotel Arenal Springs, La Fortuna", destination: "Monteverde Lodge", driver_payout: 96, sightseeing_stops: [{ id: "lapaz" }] }),
  trip({ id: "t3", booking_ref: "CRPT-1051", scheduled_at: at(75), service_type: "tour", catalog_item_id: "arenal", driver_payout: 140 }),
  trip({ id: "t4", booking_ref: "CRPT-1019", status: "completed", scheduled_at: at(-50), driver_payout: 132, origin: "Manuel Antonio", destination: "SJO Airport" }),
  trip({ id: "t5", booking_ref: "CRPT-1003", status: "completed", scheduled_at: at(-200), driver_payout: 104, cash_to_collect: 130, origin: "Liberia Airport (LIR)", destination: "Tamarindo" }),
  trip({ id: "t6", booking_ref: "CRPT-0988", status: "completed", scheduled_at: at(-400), driver_payout: 118, driver_settled_at: at(-300) }),
];

const job = (o: Partial<Job>): Job => ({
  id: "j",
  booking_ref: "CRPT-2000",
  service_type: "transfer",
  catalog_item_id: null,
  origin_town: "SJO",
  destination_town: "ManuelAntonio",
  sightseeing_stops: null,
  vehicle_class: null,
  scheduled_at: at(49),
  passenger_count: 3,
  preferences: null,
  driver_notes: null,
  driver_payout: 124,
  my_offer: null,
  my_offer_status: null,
  my_offer_id: null,
  ...o,
});
const jobs: Job[] = [
  job({ id: "j1", sightseeing_stops: [{ id: "crocs" }], driver_notes: "Surfboards, 2 large bags" }),
  job({ id: "j2", origin_town: "Arenal", destination_town: "Monteverde", scheduled_at: at(29), passenger_count: 2, driver_payout: 96, my_offer: 100, my_offer_status: "submitted", my_offer_id: "b1" }),
  job({ id: "j3", service_type: "tour", catalog_item_id: "arenal", scheduled_at: at(120), passenger_count: 6, driver_payout: 150 }),
];

const chat: ChatMessage[] = [
  { id: "m1", party: "client", name: "Sarah", text: "Hi! We just landed, heading to baggage claim now.", at: at(-1.2), mine: false },
  { id: "m2", party: "driver", name: "You", text: "Welcome to Costa Rica! I'm at the exit with a sign with your name.", at: at(-1.1), mine: true },
  { id: "m3", party: "admin", name: "Our team", text: "Child seats are installed. Have a great trip!", at: at(-1), mine: false },
];

const CR_OFFSET_MS = 6 * H;
const crDay = (h: number) => new Date(Date.now() + h * H - CR_OFFSET_MS).toISOString().slice(0, 10);

export function Preview() {
  const s = new URLSearchParams(globalThis.location?.search ?? "").get("s") ?? "jobs";
  if (s === "signin") {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <SignIn />
      </SafeAreaProvider>
    );
  }
  const tab: Tab = s === "jobs" || s === "calendar" || s === "earnings" ? s : s.startsWith("trip") ? "trips" : "profile";
  const docs = {
    driver: { kyc_status: "approved", kyc_note: null, cedula_number: "1-1234-0567", license_number: "B1-889201", license_expiry: "2028-05-31", criminal_record_date: "2026-10-20", ict_permit_number: "", home_hub: "SJO", bio: "", english_level: "fluent", documents: { driver_photo: "x", id_front: "x", id_back: "x", license: "x" } },
    vehicles: [{ id: "v1", plate: "BRT-482", make_model: "Toyota Hiace", year: 2022, color: "White", passenger_capacity: 10, ins_policy_number: "INS-77120", ins_insurance_expiry: "2027-03-01", dekra_inspection_expiry: "2027-06-30", marchamo_year: 2026, documents: { insurance: "x", dekra: "x" }, photos: ["a", "b"], status: "approved", note: null }],
    me: { full_name: "Carlos Rojas", phone: "+506 8888 8888", cedula_number: "1-1234-0567", license_number: "B1-889201", license_expiry: "2028-05-31", criminal_record_date: "2026-10-20", ict_permit_number: "", home_hub: "SJO", bio: "", english_level: "fluent" },
  };
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
        <TopBar />
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          {s === "jobs" ? (
            <Jobs driver={driver} vehicles={vehicles} names={names} trips={trips} demo={jobs} />
          ) : s === "trips" ? (
            <Trips trips={trips} names={names} loading={false} onRefresh={noop} onOpen={noop} />
          ) : s === "trip" ? (
            <TripDetail trip={trips[0]} names={names} onBack={noop} onChanged={done} demoChat={chat} />
          ) : s === "trip2" ? (
            <TripDetail trip={trips[1]} names={names} onBack={noop} onChanged={done} demoChat={[]} />
          ) : s === "calendar" ? (
            <Calendar trips={trips} demoBlocked={[crDay(96), crDay(120), crDay(240)]} />
          ) : s === "earnings" ? (
            <Earnings trips={trips} names={names} loading={false} onRefresh={noop} />
          ) : s === "help" ? (
            <Help onBack={noop} demoSupport={{ whatsapp: "50665000000", email: "drivers@costaricaprivatetransfers.com" }} />
          ) : s === "documents" ? (
            <Documents userId="demo" onBack={noop} onChanged={noop} demo={docs} />
          ) : s === "apply" ? (
            <Documents userId="demo" onBack={noop} onChanged={noop} demo={{ driver: null, vehicles: [], me: {} }} />
          ) : (
            <Profile
              email="carlos.rojas@example.com"
              driver={driver}
              vehicles={vehicles}
              onSignOut={noop}
              onDocuments={noop}
              onHelp={noop}
              location={<LocationCard consented state={{ kind: "on", bookingRef: "CRPT-1042" }} onChanged={done} />}
            />
          )}
        </View>
        <TabBar tab={tab} onChange={noop} tripsBadge={3} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
