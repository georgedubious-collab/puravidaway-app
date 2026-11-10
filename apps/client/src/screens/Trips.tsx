import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { crDateTime, usd } from "../format";
import { C, S } from "../theme";
import { TRAVELLER_STATUS, type AppBooking, type AppTrip } from "../types";
import { Badge, Btn, Empty } from "../ui";

export interface Row {
  trip: AppTrip;
  booking: AppBooking;
}

/** Every ride, tour and expedition booked with this email, upcoming first. */
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
  const rank = (s: string) => (s === "in_progress" ? 0 : s === "completed" || s === "cancelled" ? 2 : 1);
  rows.sort((a, b) => rank(a.booking.status) - rank(b.booking.status) || (a.booking.scheduledAt ?? "").localeCompare(b.booking.scheduledAt ?? ""));
  return (
    <FlatList
      style={S.screen}
      contentContainerStyle={S.pad}
      data={rows}
      keyExtractor={(r) => r.booking.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.emerald} />}
      ListHeaderComponent={<Text style={S.h1}>Your trips</Text>}
      ListEmptyComponent={
        loading ? undefined : (
          <View style={{ gap: 12 }}>
            <Empty text="No trips yet for this email. If you booked with another address, sign in with that one." />
            <Btn label="Plan a trip" onPress={onBook} />
          </View>
        )
      }
      renderItem={({ item: { booking: b } }) => (
        <Pressable accessibilityRole="button" onPress={() => onOpen(b.id)} style={[S.card, b.status === "in_progress" ? { borderColor: C.emerald, borderWidth: 2 } : null]}>
          <Text style={S.label}>
            {crDateTime(b.scheduledAt)} · {b.ref}
          </Text>
          <Text style={S.h2}>{b.title}</Text>
          {b.driverOnTheWay ? <Badge text={(b.driver?.firstName ?? "Your driver") + " is on the way"} /> : null}
          <View style={S.row}>
            <Text style={[S.muted, { flex: 1 }]}>{TRAVELLER_STATUS[b.status] ?? b.status}</Text>
            <Text style={{ fontWeight: "800", color: C.emerald }}>{usd(b.dueUsd)}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}
