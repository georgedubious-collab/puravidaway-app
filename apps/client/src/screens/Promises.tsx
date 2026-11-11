import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { useT } from "../i18n";
import { C, T } from "../theme";
import { Text, type IconName } from "../ui";

/**
 * What every ride comes with, in one place: the Rides home shows it as a short
 * list ("Every ride includes") and the ☰ menu repeats it. Change a promise here
 * and both follow. Keep these factual; never add claims the team can't keep.
 */
export function RidePromises({ compact }: { compact?: boolean }) {
  const { t } = useT();
  const items: { icon: IconName; title: string; text: string }[] = [
    { icon: "pricetag-outline", title: t("Fixed price before you pay", "Precio fijo antes de pagar"), text: t("For the whole car, taxes included.", "Por todo el vehículo, impuestos incluidos.") },
    { icon: "calendar-clear-outline", title: t("Free cancellation", "Cancelación gratis"), text: t("Up to 24 hours before pickup.", "Hasta 24 horas antes de la recogida.") },
    { icon: "shield-checkmark-outline", title: t("Drivers with documents checked", "Conductores con documentos verificados"), text: t("ID, licence and insurance reviewed by our team.", "Identificación, licencia y seguro revisados por nuestro equipo.") },
    { icon: "logo-whatsapp", title: t("WhatsApp support", "Soporte por WhatsApp"), text: t("Our team answers before and during your trip.", "Nuestro equipo le responde antes y durante su viaje.") },
  ];
  const size = compact ? 36 : 44;
  return (
    <View style={{ gap: compact ? 12 : 16 }}>
      {items.map((p) => (
        <View key={p.icon} style={{ flexDirection: "row", gap: compact ? 12 : 14, alignItems: "flex-start" }}>
          <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: compact ? C.emeraldTint : C.card, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={p.icon} size={compact ? 18 : 22} color={C.emerald} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={compact ? T.smallStrong : T.bodyStrong}>{p.title}</Text>
            <Text style={compact ? T.caption : T.small}>{p.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
