import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DefaultTheme, type Theme } from "@react-navigation/native";
import { createNativeStackNavigator, type NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { pick } from "./haptics";
import { LangToggle, useT } from "./i18n";
import { HEADER, type AccountParams, type ExploreParams, type RootParams, type TabParams, type TripsParams } from "./nav";
import { Account } from "./screens/Account";
import { BookConfirm } from "./screens/book/Confirm";
import { BookExtras, BookStops } from "./screens/book/Extras";
import { CloseBtn } from "./screens/book/parts";
import { PlaceSearch } from "./screens/book/PlaceSearch";
import { BookReview, CodeSheet } from "./screens/book/Review";
import { BookRide } from "./screens/book/Ride";
import { BookWhen, TimePicker, TourWhen } from "./screens/book/When";
import { BookWhere } from "./screens/book/Where";
import { Checkout } from "./screens/Checkout";
import { Explore } from "./screens/Explore";
import { Menu } from "./screens/Menu";
import { TourDetail } from "./screens/Tours";
import { Chat, RateSheet, TripDetail } from "./screens/TripDetail";
import { Trips } from "./screens/Trips";
import { C, F } from "./theme";

/** React Navigation's colours and fonts, set to ours. */
export const navTheme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: C.emerald, background: C.bg, card: C.bg, text: C.text, border: C.border, notification: C.emerald },
  fonts: {
    regular: { fontFamily: F.regular, fontWeight: "normal" },
    medium: { fontFamily: F.semibold, fontWeight: "normal" },
    bold: { fontFamily: F.bold, fontWeight: "normal" },
    heavy: { fontFamily: F.extrabold, fontWeight: "normal" },
  },
};

const Root = createNativeStackNavigator<RootParams>();
const Tab = createBottomTabNavigator<TabParams>();
const ExploreStack = createNativeStackNavigator<ExploreParams>();
const TripsStack = createNativeStackNavigator<TripsParams>();
const AccountStack = createNativeStackNavigator<AccountParams>();

const BARE: NativeStackNavigationOptions = { headerShown: false, contentStyle: { backgroundColor: C.bg } };
/** A pushed screen: back arrow on the left, language switch on the right, no title (the screen has its own big one). */
const PUSHED: NativeStackNavigationOptions = {
  ...HEADER,
  title: "",
  // The browser preview's header has no side margin of its own; phones add theirs.
  headerRight: () => (
    <View style={Platform.OS === "web" ? { marginRight: 16 } : null}>
      <LangToggle />
    </View>
  ),
};
/** A panel that slides up from the bottom and is closed with ✕ (or, on iPhone, by pulling it down). */
const PANEL: NativeStackNavigationOptions = {
  ...HEADER,
  presentation: "modal",
  headerBackVisible: false,
  headerLeft: () => (
    <View style={Platform.OS === "web" ? { marginLeft: 16 } : null}>
      <CloseBtn />
    </View>
  ),
};

function ExploreTab() {
  return (
    <ExploreStack.Navigator screenOptions={BARE}>
      <ExploreStack.Screen name="Home" component={Explore} />
    </ExploreStack.Navigator>
  );
}
function TripsTab() {
  return (
    <TripsStack.Navigator screenOptions={BARE}>
      <TripsStack.Screen name="TripsList" component={Trips} />
      <TripsStack.Screen name="TripDetail" component={TripDetail} />
    </TripsStack.Navigator>
  );
}
function AccountTab() {
  return (
    <AccountStack.Navigator screenOptions={BARE}>
      <AccountStack.Screen name="AccountHome" component={Account} />
    </AccountStack.Navigator>
  );
}

const TAB_ICONS: Record<keyof TabParams, [React.ComponentProps<typeof Ionicons>["name"], React.ComponentProps<typeof Ionicons>["name"]]> = {
  Explore: ["search", "search-outline"],
  Trips: ["map", "map-outline"],
  Account: ["person-circle", "person-circle-outline"],
};

function Tabs() {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.emerald,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontFamily: F.semibold, fontSize: 11, lineHeight: 14 },
        tabBarStyle: { backgroundColor: "#fff", borderTopColor: C.border, height: 60 + insets.bottom, paddingTop: 6 },
        tabBarAllowFontScaling: false,
        tabBarIcon: ({ focused, color }) => <Ionicons name={TAB_ICONS[route.name][focused ? 0 : 1]} size={25} color={color} />,
      })}
      screenListeners={{ tabPress: () => pick() }}
    >
      <Tab.Screen name="Explore" component={ExploreTab} options={{ title: t("Explore", "Explorar") }} />
      <Tab.Screen name="Trips" component={TripsTab} options={{ title: t("My trips", "Mis viajes") }} />
      <Tab.Screen name="Account" component={AccountTab} options={{ title: t("Account", "Cuenta") }} />
    </Tab.Navigator>
  );
}

/**
 * Every screen in the app (see src/nav.ts for the map). Native stacks, so
 * screens slide in from the right, the iPhone back-swipe works, and panels
 * slide up from the bottom.
 */
export function RootNavigator() {
  const { t } = useT();
  return (
    <Root.Navigator screenOptions={PUSHED}>
      <Root.Screen name="Tabs" component={Tabs} options={BARE} />
      <Root.Screen name="BookWhere" component={BookWhere} options={{ title: t("Plan your ride", "Planee su traslado") }} />
      <Root.Screen name="BookRide" component={BookRide} options={BARE} />
      <Root.Screen name="BookConfirm" component={BookConfirm} options={{ title: t("Your ride", "Su traslado") }} />
      <Root.Screen name="BookReview" component={BookReview} />
      <Root.Screen name="TourDetail" component={TourDetail} options={BARE} />
      <Root.Screen name="Sent" component={Checkout} options={{ ...BARE, gestureEnabled: false }} />
      <Root.Screen name="Chat" component={Chat} options={{ title: "Chat" }} />
      <Root.Screen name="PlaceSearch" component={PlaceSearch} options={({ route }) => ({ ...PANEL, title: route.params.field === "from" ? t("Pickup", "Recogida") : t("Drop-off", "Destino") })} />
      <Root.Screen name="Menu" component={Menu} options={{ ...PANEL, title: "" }} />
      <Root.Screen name="BookWhen" component={BookWhen} options={{ ...PANEL, title: t("Date, time and travellers", "Fecha, hora y viajeros") }} />
      <Root.Screen name="BookStops" component={BookStops} options={{ ...PANEL, title: t("Stops along the way", "Paradas en el camino") }} />
      <Root.Screen name="BookExtras" component={BookExtras} options={{ ...PANEL, title: t("Driver and extras", "Conductor y extras") }} />
      <Root.Screen name="TimePicker" component={TimePicker} options={{ ...PANEL, title: t("Pickup time", "Hora de recogida") }} />
      <Root.Screen name="TourWhen" component={TourWhen} options={{ ...PANEL, title: t("Date and travellers", "Fecha y viajeros") }} />
      <Root.Screen name="Code" component={CodeSheet} options={{ ...PANEL, title: "" }} />
      <Root.Screen name="Rate" component={RateSheet} options={{ ...PANEL, title: "" }} />
    </Root.Navigator>
  );
}
