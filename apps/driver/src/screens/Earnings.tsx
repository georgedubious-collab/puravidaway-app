import { Ionicons } from "@expo/vector-icons";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { crDateTime, plural, usd } from "../format";
import { useT, type Lang } from "../i18n";
import { C, R, S, SHADOW } from "../theme";
import type { Names, Trip } from "../types";
import { Empty } from "../ui";
import { tripTitle } from "./Trips";

/** Positive: we owe the driver. Negative: the driver owes us (they collected cash). */
function settlement(t: Trip): number {
  return Math.round((Number(t.driver_payout ?? 0) - (t.cash_to_collect == null ? 0 : Number(t.cash_to_collect))) * 100) / 100;
}
function balanceText(n: number, lang: Lang): string {
  const es = lang === "es";
  if (Math.abs(n) < 0.005) return es ? "No hay saldo pendiente" : "Nothing owed either way";
  return n > 0 ? (es ? "Le debemos " : "We owe you ") + usd(n) : (es ? "Nos debe " : "You owe us ") + usd(-n);
}

/** Completed trips, the payout on each, and the balance still to settle (weekly). */
export function Earnings({ trips, names, loading, onRefresh }: { trips: Trip[]; names: Names; loading: boolean; onRefresh: () => void }) {
  const { t, lang } = useT();
  const done = trips.filter((x) => x.status === "completed" && x.driver_payout != null).reverse();
  const open = done.filter((x) => !x.driver_settled_at);
  const balance = open.reduce((n, x) => n + settlement(x), 0);
  const earned = done.reduce((n, x) => n + Number(x.driver_payout ?? 0), 0);
  const even = Math.abs(balance) < 0.005;
  const unsettled = plural(open.length, ["viaje completado", "viajes completados"], ["completed trip", "completed trips"], lang);
  return (
    <FlatList
      style={S.screen}
      contentContainerStyle={S.pad}
      data={done}
      keyExtractor={(x) => x.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.emerald} />}
      ListHeaderComponent={
        <View style={{ gap: 14 }}>
          <View style={[{ backgroundColor: C.emeraldDark, borderRadius: R.card, padding: 20, gap: 6 }, SHADOW]}>
            <Text style={[S.label, { color: "#6EE7B7" }]}>
              {even ? t("Por liquidar", "To settle") : balance > 0 ? t("Le debemos", "We owe you") : t("Nos debe", "You owe us")}
            </Text>
            <Text style={{ color: balance < 0 ? "#FCD34D" : "#fff", fontSize: even ? 22 : 40, fontWeight: "800", letterSpacing: -1 }}>
              {even ? t("No hay saldo pendiente", "Nothing owed either way") : usd(Math.abs(balance))}
            </Text>
            <Text style={{ color: "#A7F3D0", fontSize: 13 }}>
              {t(
                unsettled + " sin liquidar. Liquidamos cada semana.",
                unsettled + " not settled yet. We settle weekly.",
              )}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={[S.card, { flex: 1 }]}>
              <Text style={S.label}>{t("Ganado hasta ahora", "Earned so far")}</Text>
              <Text style={[S.money, { color: C.text }]}>{usd(earned)}</Text>
            </View>
            <View style={[S.card, { flex: 1 }]}>
              <Text style={S.label}>{t("Viajes hechos", "Trips done")}</Text>
              <Text style={[S.money, { color: C.text }]}>{done.length}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 4 }}>
            <Ionicons name="information-circle-outline" size={16} color={C.muted} style={{ marginTop: 1 }} />
            <Text style={[S.muted, { flex: 1 }]}>
              {t(
                "Viajes pagados en línea: nosotros le hacemos su pago. Viajes en efectivo: usted cobra al cliente, se queda con su pago y nos entrega el resto.",
                "Trips paid online: we pay you your payout. Cash trips: you collect the traveller's payment, keep your payout and pass on the rest.",
              )}
            </Text>
          </View>
          {done.length ? <Text style={[S.label, { marginTop: 4 }]}>{t("Viajes completados", "Completed trips")}</Text> : null}
        </View>
      }
      ListEmptyComponent={
        <Empty
          icon="wallet-outline"
          text={t("Aún no tiene viajes completados. Sus pagos aparecen aquí después de cada viaje.", "No completed trips yet. Your payouts show up here after each trip.")}
        />
      }
      renderItem={({ item }) => (
        <View style={[S.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: item.driver_settled_at ? C.emeraldTint : C.amberSoft,
            }}
          >
            <Ionicons name={item.driver_settled_at ? "checkmark" : "time-outline"} size={18} color={item.driver_settled_at ? C.emerald : C.amber} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }} numberOfLines={1}>
              {tripTitle(item, names)}
            </Text>
            <Text style={S.muted}>{crDateTime(item.scheduled_at, lang)}</Text>
            <Text style={S.muted}>
              {item.driver_settled_at ? t("Liquidado ", "Settled ") + item.driver_settled_at.slice(0, 10) : balanceText(settlement(item), lang)}
            </Text>
          </View>
          <Text style={{ fontWeight: "800", color: C.emerald, fontSize: 17 }}>{usd(item.driver_payout)}</Text>
        </View>
      )}
    />
  );
}
