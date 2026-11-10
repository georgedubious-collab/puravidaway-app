import { Ionicons } from "@expo/vector-icons";
import { Pressable, RefreshControl, SectionList, Text, View } from "react-native";
import { crDateTime, usd } from "../format";
import { C, S } from "../theme";
import type { AppBooking, AppTrip } from "../types";
import { Badge, Btn, Empty, ScreenTitle, type IconName } from "../ui";

export interface Row {
  trip: AppTrip;
  booking: AppBooking;
}

/** Where a booking stands, in a couple of words, with a colour and an icon. */
export function bookingStage(b: AppBooking): { text: string; tone?: "sky" | "amber" | "red" | "grey"; icon: IconName } {
  if (b.status === "in_progress") return { text: "On the road", icon: "car" };
  if (b.status === "completed") return { text: "Completed", tone: "grey", icon: "checkmark-circle" };
  if (b.status === "cancelled") return { text: "Cancelled", tone: "red", icon: "close-circle" };
  if (b.status === "confirmed") return b.driverOnTheWay ? { text: "Driver on the way", tone: "sky", icon: "navigate" } : { text: "Confirmed", icon: "checkmark-circle" };
  if (b.status === "pending_bids") return { text: "Finding your driver", tone: "amber", icon: "search" };
  return { text: "Request received", tone: "amber", icon: "time-outline" };
}

/** Every ride, tour and expedition booked with this email: what's coming up, then what's done. */
export function Trips({
  trips,
  loading,
  onRefresh,
  onOpen,
  onBook,
}: {
  trips: AppTrip[];
  loading: boolean;
  onRefresh: () => void;
  onOpen: (bookingId: string) => void;
  onBook: () => void;
}) {
  const rows: Row[] = trips.flatMap((trip) => trip.bookings.map((booking) => ({ trip, booking })));
  const past = (s: string) => s === "completed" || s === "cancelled";
  const byDate = (a: Row, b: Row) => (a.booking.scheduledAt ?? "").localeCompare(b.booking.scheduledAt ?? "");
  const upcoming = rows.filter((r) => !past(r.booking.status)).sort((a, b) => Number(b.booking.status === "in_progress") - Number(a.booking.status === "in_progress") || byDate(a, b));
  const done = rows.filter((r) => past(r.booking.status)).sort((a, b) => byDate(b, a));
  const sections = [
    { title: "Upcoming", data: upcoming },
    { title: "Past trips", data: done },
  ].filter((s) => s.data.length > 0);
  return (
    <SectionList
      style={S.screen}
      contentContainerStyle={S.pad}
      sections={sections}
      keyExtractor={(r) => r.booking.id}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.emerald} />}
      ListHeaderComponent={<ScreenTitle title="Your trips" />}
      ListEmptyComponent={
        loading ? undefined : (
          <View style={{ gap: 4 }}>
            <Empty icon="map-outline" text="No trips yet for this email. If you booked with another address, sign in with that one." />
            <Btn label="Plan a trip" icon="add-circle-outline" onPress={onBook} color={C.emerald} />
          </View>
        )
      }
      renderSectionHeader={({ section }) => <Text style={[S.label, { marginTop: 6 }]}>{section.title}</Text>}
      renderItem={({ item: { booking: b } }) => {
        const stage = bookingStage(b);
        return (
          <Pressable
            accessibilityRole="button"
            onPress={() => onOpen(b.id)}
            style={({ pressed }) => [S.card, b.status === "in_progress" || b.driverOnTheWay ? { borderWidth: 2, borderColor: C.emerald } : null, pressed ? { opacity: 0.75 } : null]}
          >
            <View style={S.row}>
              <Badge text={stage.text} tone={stage.tone} icon={stage.icon} />
              {b.status === "cancelled" ? null : b.dueUsd > 0 ? (
                <Text style={{ fontWeight: "800", color: C.text, fontSize: 17 }}>{usd(b.dueUsd)}</Text>
              ) : (
                <Text style={{ fontWeight: "800", color: C.emerald, fontSize: 14 }}>Paid</Text>
              )}
            </View>
            <Text style={S.h2}>{b.title}</Text>
            <View style={S.row}>
              <Text style={[S.muted, { flex: 1 }]}>
                {crDateTime(b.scheduledAt)}
                {b.driver ? " · with " + b.driver.firstName : ""}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={C.faint} />
            </View>
          </Pressable>
        );
      }}
    />
  );
}
