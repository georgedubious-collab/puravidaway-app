import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useT } from "./i18n";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { crDateTime } from "./format";
import { Bar, Drawer, drawerProfile, SECTION_TITLE, SEGMENT_TITLE, type Section, type Segment } from "./nav";
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
 * (`?s=trips` (home), `today`, `past`, `menu` (side menu open), `trip`, `trip2`, `trip3`,
 * `jobs`, `calendar`, `earnings`, `profile`, `documents`, `apply`, `help`, `signin`;
 * add `&lang=en` for English). Never part of a phone build's flow.
 */
const H = 3600 * 1000;
const at = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * H).toISOString();
const noop = () => {};
const done = async () => {};

const names: Names = {
  tours: { arenal: "Arenal Volcano & Hot Springs day tour" },
  stops: { crocs: "Tárcoles crocodile bridge", lapaz: "La Paz Waterfall Gardens", carara: "Carara National Park Scarlet Macaw Walk" },
  stopMinutes: { crocs: 45, lapaz: 120, carara: 90 },
};
const driver: DriverInfo = { kyc_status: "approved", home_hub: "SJO", rating_avg: 4.9, rating_count: 37, location_consent_at: at(-500) };
const vehicles: Vehicle[] = [
  { id: "v1", make_model: "Toyota Hiace", plate: "BRT-482", passenger_capacity: 10, vehicle_class: "van", status: "approved" },
  { id: "v2", make_model: "Hyundai Staria", plate: "CLV-119", passenger_capacity: 6, vehicle_class: "van", status: "approved" },
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
  trip({
    id: "t1",
    booking_ref: "CRPT-1042",
    scheduled_at: at(3.4),
    vehicle_class: "sedan",
    origin: "SJO Airport, Alajuela",
    destination: "Hotel Si Como No, Manuel Antonio",
    destination_coords: { lat: 9.39, lng: -84.14, town: "ManuelAntonio" },
    flight_or_hotel_notes: "Flight UA1090, lands 1:35 PM",
    driver_payout: 168,
    unread_chat: 2,
    passenger_name: "Emily R.",
    sign_text: "The Robinson Family",
    luggage_count: 4,
    carry_on_count: 4,
    // 2 h 55 min SJO → Manuel Antonio (ROUTE_MINUTES), no stops.
    arrive_at: at(3.4 + 175 / 60),
  }),
  trip({
    id: "t2",
    booking_ref: "CRPT-1047",
    scheduled_at: at(46),
    vehicle_class: "suv",
    origin: "Hotel Arenal Springs, La Fortuna",
    origin_coords: { lat: 10.47, lng: -84.64, town: "Arenal" },
    destination: "Hotel Parador, Quepos",
    destination_coords: { lat: 9.4, lng: -84.16, town: "ManuelAntonio" },
    passenger_count: 3,
    preferences: { language: "english", childSeats: 1, wifi: false, stroller: false, pets: false },
    driver_notes: "Our daughter is 4",
    driver_payout: 214,
    sightseeing_stops: [{ id: "lapaz" }, { id: "carara" }, { id: "crocs" }],
    passenger_name: "James W.",
    sign_text: "James W.",
    luggage_count: 3,
    carry_on_count: 2,
    // 4 h 50 min Arenal → Manuel Antonio + 4 h 15 min at the stops (+ their detours, made up here).
    arrive_at: at(46 + (290 + 255 + 25) / 60),
  }),
  trip({
    id: "t7",
    booking_ref: "CRPT-1055",
    scheduled_at: at(98),
    vehicle_class: "sedan",
    origin: "Manuel Antonio",
    origin_coords: { town: "ManuelAntonio" },
    destination: "Santa Teresa",
    destination_coords: { town: "SouthNicoya" },
    passenger_count: 2,
    driver_payout: 236,
    payment_mode: "cash_driver",
    cash_to_collect: 310,
  }),
  trip({
    id: "t3",
    booking_ref: "CRPT-1051",
    scheduled_at: at(130),
    service_type: "tour",
    catalog_item_id: "arenal",
    vehicle_class: "van",
    passenger_count: 6,
    driver_payout: 140,
  }),
  trip({
    id: "t8",
    booking_ref: "CRPT-1060",
    scheduled_at: at(360),
    vehicle_class: "sierpe_combo",
    origin: "Drake Bay",
    origin_coords: { town: "DrakeBay" },
    destination: "SJO Airport",
    destination_coords: { lat: 9.99, lng: -84.2, town: "SJO" },
    passenger_count: 2,
    driver_payout: 290,
  }),
  trip({
    id: "t4",
    booking_ref: "CRPT-1019",
    status: "completed",
    scheduled_at: at(-50),
    driver_payout: 132,
    origin: "Manuel Antonio",
    destination: "SJO Airport",
  }),
  trip({
    id: "t5",
    booking_ref: "CRPT-1003",
    status: "completed",
    scheduled_at: at(-200),
    driver_payout: 104,
    cash_to_collect: 130,
    origin: "Liberia Airport (LIR)",
    destination: "Tamarindo",
  }),
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
  job({
    id: "j2",
    origin_town: "Arenal",
    destination_town: "Monteverde",
    scheduled_at: at(29),
    passenger_count: 2,
    driver_payout: 96,
    my_offer: 100,
    my_offer_status: "submitted",
    my_offer_id: "b1",
  }),
  job({ id: "j3", service_type: "tour", catalog_item_id: "arenal", scheduled_at: at(120), passenger_count: 6, driver_payout: 150 }),
];

const chat: ChatMessage[] = [
  { id: "m1", party: "client", name: "Sarah", text: "Hi! We just landed, heading to baggage claim now.", at: at(-1.2), mine: false },
  { id: "m2", party: "driver", name: "You", text: "Welcome to Costa Rica! I'm at the exit with a sign with your name.", at: at(-1.1), mine: true },
  { id: "m3", party: "admin", name: "Our team", text: "Child seats are installed. Have a great trip!", at: at(-1), mine: false },
];

const chatHidden: ChatMessage[] = [
  ...chat.slice(0, 2),
  { id: "m4", party: "driver", name: "You", text: "If you need anything, WhatsApp me at [hidden]", at: at(-0.5), mine: true },
];

const CR_OFFSET_MS = 6 * H;
const crDay = (h: number) => new Date(Date.now() + h * H - CR_OFFSET_MS).toISOString().slice(0, 10);

export function Preview() {
  const params = new URLSearchParams(globalThis.location?.search ?? "");
  const s = params.get("s") ?? "jobs";
  // `&lang=en` (or `es`) shows the screen in that language.
  const { lang, setLang, t } = useT();
  const [menu, setMenu] = useState(s === "menu");
  const [segOverride, setSeg] = useState<Segment | null>(null);
  const want = params.get("lang");
  useEffect(() => {
    if ((want === "en" || want === "es") && want !== lang) setLang(want);
  }, [want, lang, setLang]);
  if (s === "signin") {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <SignIn />
      </SafeAreaProvider>
    );
  }
  const docs = {
    driver: {
      kyc_status: "approved",
      kyc_note: null,
      cedula_number: "1-1234-0567",
      license_number: "B1-889201",
      license_expiry: "2028-05-31",
      criminal_record_date: "2026-10-20",
      ict_permit_number: "",
      home_hub: "SJO",
      bio: "",
      english_level: "fluent",
      documents: { driver_photo: "x", id_front: "x", id_back: "x", license: "x" },
    },
    vehicles: [
      {
        id: "v1",
        plate: "BRT-482",
        make_model: "Toyota Hiace",
        year: 2022,
        color: "White",
        passenger_capacity: 10,
        vehicle_class: "van",
        ins_policy_number: "INS-77120",
        ins_insurance_expiry: "2027-03-01",
        dekra_inspection_expiry: "2027-06-30",
        marchamo_year: 2026,
        documents: { insurance: "x", dekra: "x" },
        photos: ["a", "b"],
        status: "approved",
        note: null,
      },
      {
        // Not tagged by the team yet: shows "todavía sin asignar".
        id: "v2",
        plate: "CLV-119",
        make_model: "Toyota Rush",
        year: 2021,
        color: "Gris",
        passenger_capacity: 4,
        vehicle_class: null,
        ins_policy_number: "INS-80233",
        ins_insurance_expiry: "2027-02-01",
        dekra_inspection_expiry: "2027-04-30",
        marchamo_year: 2026,
        documents: { insurance: "x", dekra: "x" },
        photos: ["a"],
        status: "pending",
        note: null,
      },
    ],
    me: {
      full_name: "Carlos Rojas",
      phone: "+506 8888 8888",
      cedula_number: "1-1234-0567",
      license_number: "B1-889201",
      license_expiry: "2028-05-31",
      criminal_record_date: "2026-10-20",
      ict_permit_number: "",
      home_hub: "SJO",
      bio: "",
      english_level: "fluent",
    },
  };
  const section: Section =
    s === "jobs" || s === "calendar" || s === "earnings" || s === "documents" || s === "help" || s === "profile" ? s : s === "apply" ? "documents" : "trips";
  // Chat states: `chat` (trip scrolled to the chat), `chat-hidden` (notice after a number was hidden),
  // `chat-draft` (warning before sending), `chat-closed` (read-only 48 h after the trip).
  const chatShot = s === "chat" || s === "chat-hidden" || s === "chat-draft" || s === "chat-closed";
  const openTrip = s === "trip" || chatShot ? trips[0] : s === "trip2" ? trips[1] : s === "trip3" ? trips[2] : undefined;
  const segment: Segment = segOverride ?? (s === "today" ? "today" : s === "past" ? "past" : "upcoming");
  const title = openTrip ? crDateTime(openTrip.scheduled_at, lang) : section === "trips" ? t(...SEGMENT_TITLE[segment]) : t(...SECTION_TITLE[section]);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1, backgroundColor: C.card }} edges={["top"]}>
        <Bar title={title} onMenu={() => setMenu(true)} onBack={openTrip ? noop : undefined} onBell={openTrip ? undefined : noop} bellCount={jobs.length} />
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          {openTrip ? (
            <TripDetail
              trip={openTrip}
              names={names}
              onChanged={done}
              demoChat={s === "chat-hidden" ? chatHidden : s === "trip" || chatShot ? chat : []}
              demoChatState={{ closed: s === "chat-closed", notice: s === "chat-hidden", draft: s === "chat-draft" ? "Mi número es 8888 1234" : undefined }}
              demoSupport="50665000000"
            />
          ) : section === "trips" ? (
            <Trips trips={trips} names={names} loading={false} onRefresh={noop} onOpen={noop} segment={segment} onSegment={setSeg} />
          ) : section === "jobs" ? (
            <Jobs driver={driver} vehicles={vehicles} names={names} trips={trips} demo={jobs} />
          ) : section === "calendar" ? (
            <Calendar trips={trips} demoBlocked={[crDay(96), crDay(120), crDay(240)]} />
          ) : section === "earnings" ? (
            <Earnings trips={trips} names={names} loading={false} onRefresh={noop} />
          ) : section === "help" ? (
            <Help demoSupport={{ whatsapp: "50665000000", email: "drivers@costaricaprivatetransfers.com" }} />
          ) : s === "apply" ? (
            <Documents userId="demo" onChanged={noop} demo={{ driver: null, vehicles: [], me: {} }} />
          ) : section === "documents" ? (
            <Documents userId="demo" onChanged={noop} demo={docs} />
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
        <Drawer
          open={menu}
          onClose={() => setMenu(false)}
          current={section}
          onGo={noop}
          offers={jobs.length}
          onSignOut={noop}
          profile={drawerProfile(driver, "Carlos Rojas", t)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
