import { createNavigationContainerRef, useNavigation, type NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackNavigationOptions, NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Sent } from "./types";
import { C, F } from "./theme";

/**
 * The app's map (React Navigation, native stacks):
 *
 *   Tabs
 *     Explore  → Home
 *     Trips    → TripsList, TripDetail
 *     Account  → AccountHome
 *   pushed over the tabs (slide in from the right, swipe back):
 *     BookWhere → BookWhen → BookRide → BookExtras → BookReview → Sent
 *     Tours → TourDetail (→ BookReview), Chat
 *   slide-up panels:
 *     PlaceSearch, TimePicker, TourWhen, Code, Rate
 */
export type ExploreParams = { Home: undefined };
export type TripsParams = { TripsList: undefined; TripDetail: { id: string } };
export type AccountParams = { AccountHome: undefined };
export type TabParams = {
  Explore: NavigatorScreenParams<ExploreParams> | undefined;
  Trips: NavigatorScreenParams<TripsParams> | undefined;
  Account: NavigatorScreenParams<AccountParams> | undefined;
};
export type RootParams = {
  Tabs: NavigatorScreenParams<TabParams> | undefined;
  BookWhere: undefined;
  BookWhen: undefined;
  BookRide: undefined;
  BookExtras: undefined;
  BookReview: undefined;
  Tours: undefined;
  TourDetail: { id: string };
  Sent: Sent;
  Chat: { id: string };
  PlaceSearch: { field: "from" | "to" };
  TimePicker: undefined;
  TourWhen: undefined;
  Code: undefined;
  Rate: { id: string };
};

/** Every screen name, for navigating from anywhere (a nested screen's navigate() bubbles up to the stack that owns the name). */
export type AllParams = RootParams & ExploreParams & TripsParams & AccountParams;
export type Nav = NativeStackNavigationProp<AllParams>;
export const useNav = () => useNavigation<Nav>();

export const navigationRef = createNavigationContainerRef<RootParams>();

/** Open one booking in My trips (from the home card, or a tapped notification), with the list underneath it. */
export function openTrip(id: string): void {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate("Tabs", { screen: "Trips", params: { screen: "TripDetail", params: { id }, initial: false } });
}

export function goToTab(tab: keyof TabParams): void {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate("Tabs", { screen: tab });
}

/** The look shared by every native header: flat, warm white, brand font, back arrow without a label. */
export const HEADER: NativeStackNavigationOptions = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: C.bg },
  headerTintColor: C.text,
  headerTitleAlign: "center",
  headerTitleStyle: { fontFamily: F.bold, fontSize: 17, color: C.text },
  headerBackButtonDisplayMode: "minimal",
  contentStyle: { backgroundColor: C.bg },
};
