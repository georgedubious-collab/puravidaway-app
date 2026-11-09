import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { crDateTime, STATUS_LABEL, usd } from "../format";
import { C, S } from "../theme";
import type { Names, Trip } from "../types";
import { Empty } from "../ui";

export function tripTitle(t: Trip, names: Names): string {
  return t.service_type === "transfer" ? (t.origin ?? "—") + " → " + (t.destination ?? "—") : (names.tours[t.catalog_item_id ?? ""] ?? "Tour");
}

/** The driver's assigned trips, upcoming first. */
export function Trips({
  trips,
  names,
  loading,
  onRefresh,
  onOpen,
}: {
  trips: Trip[];
  names: Names;
  loading: boolean;
  onRefresh: () => void;
  onOpen: (id: string) => void;
}) {
  const active = trips.filter((t) => t.status === "confirmed" || t.status === "in_progress");
  const past = trips.filter((t) => t.status === "completed").reverse();
  return (
    <FlatList
      style={S.screen}
      contentContainerStyle={S.pad}
      data={[...active, ...past]}
      keyExtractor={(t) => t.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.emerald} />}
      ListHeaderComponent={<Text style={S.h1}>Your trips</Text>}
      ListEmptyComponent={<Empty text="No trips yet. Send offers on open jobs; when the team picks you, the trip appears here." />}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="button" onPress={() => onOpen(item.id)} style={[S.card, item.status === "in_progress" ? { borderColor: C.emerald, borderWidth: 2 } : null]}>
          <Text style={S.label}>
            {crDateTime(item.scheduled_at)} · {item.booking_ref}
          </Text>
          <Text style={S.h2}>{tripTitle(item, names)}</Text>
          <View style={S.row}>
            <Text style={S.muted}>{STATUS_LABEL[item.status] ?? item.status}</Text>
            {item.driver_payout != null ? <Text style={{ fontWeight: "800", color: C.emerald }}>{usd(item.driver_payout)}</Text> : null}
          </View>
        </Pressable>
      )}
    />
  );
}
