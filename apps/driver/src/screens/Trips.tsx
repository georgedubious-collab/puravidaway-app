import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, RefreshControl, SectionList, Text, View } from "react-native";
import { crDateTime, usd } from "../format";
import { useT, type Lang } from "../i18n";
import { C, S } from "../theme";
import type { Names, Trip } from "../types";
import { Badge, Empty, ScreenTitle } from "../ui";

/** "Tour" reads the same in Spanish and English. */
export function tripTitle(t: Trip, names: Names): string {
  return t.service_type === "transfer" ? (t.origin ?? "—") + " → " + (t.destination ?? "—") : (names.tours[t.catalog_item_id ?? ""] ?? "Tour");
}

/** Where the trip stands, in the driver's words. */
export function tripStage(t: Trip, lang: Lang = "es"): { text: string; tone?: "sky" | "amber" | "grey" } {
  const es = lang === "es";
  if (t.status === "in_progress") return { text: es ? "En ruta" : "On the road" };
  if (t.status === "completed") return { text: es ? "Completado" : "Completed", tone: "grey" };
  if (t.status === "cancelled") return { text: es ? "Cancelado" : "Cancelled", tone: "grey" };
  return t.en_route_at ? { text: es ? "Camino a la recogida" : "On the way to pickup", tone: "sky" } : { text: es ? "Confirmado" : "Confirmed", tone: "amber" };
}

/** The driver's assigned trips: what's coming up first, then what's done. */
export function Trips({
  trips,
  names,
  loading,
  onRefresh,
  onOpen,
  header,
}: {
  trips: Trip[];
  names: Names;
  loading: boolean;
  onRefresh: () => void;
  onOpen: (id: string) => void;
  /** Shown above the list, e.g. the request to share location. */
  header?: ReactNode;
}) {
  const { t, lang } = useT();
  const active = trips.filter((x) => x.status === "confirmed" || x.status === "in_progress");
  const past = trips.filter((x) => x.status === "completed").reverse();
  const sections = [
    { title: t("Próximos", "Upcoming"), data: active },
    { title: t("Completados", "Completed"), data: past },
  ].filter((s) => s.data.length > 0);
  return (
    <SectionList
      style={S.screen}
      contentContainerStyle={S.pad}
      sections={sections}
      keyExtractor={(x) => x.id}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={C.emerald} />}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <ScreenTitle title={t("Sus viajes", "Your trips")} />
          {header}
        </View>
      }
      ListEmptyComponent={
        <Empty
          icon="car-outline"
          text={t(
            "Aún no tiene viajes. Envíe ofertas en los trabajos disponibles; cuando nuestro equipo lo elija, el viaje aparece aquí.",
            "No trips yet. Send offers on open jobs; when our team picks you, the trip appears here.",
          )}
        />
      }
      renderSectionHeader={({ section }) => <Text style={[S.label, { marginTop: 6 }]}>{section.title}</Text>}
      renderItem={({ item }) => {
        const stage = tripStage(item, lang);
        return (
          <Pressable
            accessibilityRole="button"
            onPress={() => onOpen(item.id)}
            style={({ pressed }) => [S.card, item.status === "in_progress" ? { borderWidth: 2, borderColor: C.emerald } : null, pressed ? { opacity: 0.75 } : null]}
          >
            <View style={S.row}>
              <Badge text={stage.text} tone={stage.tone} />
              {item.driver_payout != null ? <Text style={{ fontWeight: "800", color: C.emerald, fontSize: 17 }}>{usd(item.driver_payout)}</Text> : null}
            </View>
            <Text style={S.h2}>{tripTitle(item, names)}</Text>
            <View style={S.row}>
              <Text style={S.muted}>
                {crDateTime(item.scheduled_at, lang)} · {item.booking_ref}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={C.faint} />
            </View>
          </Pressable>
        );
      }}
    />
  );
}
