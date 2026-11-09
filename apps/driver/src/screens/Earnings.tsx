import { FlatList, RefreshControl, Text, View } from "react-native";
import { crDateTime, plural, usd } from "../format";
import { C, S } from "../theme";
import type { Names, Trip } from "../types";
import { Card, Empty } from "../ui";
import { tripTitle } from "./Trips";

/** Positive: we owe the driver. Negative: the driver owes us (they collected cash). */
function settlement(t: Trip): number {
  return Math.round((Number(t.driver_payout ?? 0) - (t.cash_to_collect == null ? 0 : Number(t.cash_to_collect))) * 100) / 100;
}
function balanceText(n: number): string {
  if (Math.abs(n) < 0.005) return "Nothing owed either way";
  return n > 0 ? "We owe you " + usd(n) : "You owe us " + usd(-n);
}

/** Completed trips, the payout on each, and the balance still to settle (weekly). */
export function Earnings({ trips, names, loading, onRefresh }: { trips: Trip[]; names: Names; loading: boolean; onRefresh: () => void }) {
  const done = trips.filter((t) => t.status === "completed" && t.driver_payout != null).reverse();
  const open = done.filter((t) => !t.driver_settled_at);
  const balance = open.reduce((n, t) => n + settlement(t), 0);
  const earned = done.reduce((n, t) => n + Number(t.driver_payout ?? 0), 0);
  return (
    <FlatList
      style={S.screen}
      contentContainerStyle={S.pad}
      data={done}
      keyExtractor={(t) => t.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.emerald} />}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <Text style={S.h1}>Earnings</Text>
          <Card>
            <Text style={S.label}>To settle</Text>
            <Text style={[S.money, balance < 0 ? { color: C.amber } : null]}>{balanceText(balance)}</Text>
            <Text style={S.muted}>{plural(open.length, "completed trip")} not settled yet. We settle weekly.</Text>
          </Card>
          <Card>
            <Text style={S.label}>Earned so far</Text>
            <Text style={[S.money, { color: C.text }]}>{usd(earned)}</Text>
            <Text style={S.muted}>{plural(done.length, "completed trip")}.</Text>
          </Card>
          <Text style={S.muted}>Trips paid online: we pay you your payout. Cash trips: you collect the traveller&apos;s payment, keep your payout and pass on the rest.</Text>
        </View>
      }
      ListEmptyComponent={<Empty text="No completed trips yet." />}
      renderItem={({ item }) => (
        <Card>
          <Text style={S.label}>
            {crDateTime(item.scheduled_at)} · {item.booking_ref}
          </Text>
          <Text style={[S.text, { fontWeight: "700" }]}>{tripTitle(item, names)}</Text>
          <View style={S.row}>
            <Text style={S.muted}>{item.driver_settled_at ? "Settled " + item.driver_settled_at.slice(0, 10) : balanceText(settlement(item))}</Text>
            <Text style={{ fontWeight: "800", color: C.emerald }}>{usd(item.driver_payout)}</Text>
          </View>
        </Card>
      )}
    />
  );
}
