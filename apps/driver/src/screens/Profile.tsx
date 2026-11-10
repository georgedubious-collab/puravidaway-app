import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { townShort } from "../format";
import { useT } from "../i18n";
import { C, S } from "../theme";
import type { DriverInfo, Vehicle } from "../types";
import { Badge, Card, Chip, Divider, ListRow, ScreenTitle } from "../ui";

/** Approval status as [Spanish, English]. */
const KYC: Record<string, [string, string]> = {
  pending: ["En revisión", "Waiting for review"],
  approved: ["Aprobado", "Approved"],
  rejected: ["No aprobado", "Not approved"],
  suspended: ["Suspendido", "Suspended"],
};

/** Who the driver is at a glance (status, rating, base, vehicles) and the way in to everything else. */
export function Profile({
  email,
  driver,
  vehicles,
  onSignOut,
  onDocuments,
  onHelp,
  location,
}: {
  email: string;
  driver: DriverInfo | null;
  vehicles: Vehicle[];
  onSignOut: () => void;
  /** Open the documents and vehicles screen. */
  onDocuments: () => void;
  /** Open the help screen (FAQs and support). */
  onHelp: () => void;
  /** The location-sharing card. */
  location?: ReactNode;
}) {
  const { t, lang, setLang } = useT();
  const approved = driver?.kyc_status === "approved";
  const initial = (email[0] ?? "?").toUpperCase();
  const kyc = driver ? KYC[driver.kyc_status] : undefined;
  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <ScreenTitle title={t("Perfil", "Profile")} />
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.emeraldDark, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>{initial}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[S.text, { color: C.text, fontWeight: "700" }]} numberOfLines={1}>
              {email}
            </Text>
            <Badge
              text={driver ? (kyc ? t(...kyc) : driver.kyc_status) : t("Aún sin solicitud", "No application yet")}
              tone={approved ? undefined : "amber"}
              icon={approved ? "shield-checkmark" : "time-outline"}
            />
          </View>
        </View>
        {driver ? (
          <View style={{ flexDirection: "row", marginTop: 6 }}>
            <Stat
              value={driver.rating_count ? "★ " + Number(driver.rating_avg).toFixed(1) : "—"}
              label={
                driver.rating_count
                  ? driver.rating_count + t(driver.rating_count === 1 ? " calificación" : " calificaciones", driver.rating_count === 1 ? " rating" : " ratings")
                  : t("Aún sin calificaciones", "No ratings yet")
              }
            />
            <View style={{ width: 1, backgroundColor: C.border }} />
            <Stat
              value={driver.home_hub ? townShort(driver.home_hub, lang) : "—"}
              label={driver.home_hub ? t("Su base", "Your base") : t("Base sin definir", "Base not set")}
            />
            <View style={{ width: 1, backgroundColor: C.border }} />
            <Stat value={String(vehicles.filter((v) => v.status === "approved").length)} label={t("Vehículos aprobados", "Approved vehicles")} />
          </View>
        ) : null}
      </Card>

      {location}

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.emeraldTint, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="language-outline" size={18} color={C.emerald} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.text, flex: 1 }}>Idioma / Language</Text>
        </View>
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 8 }}>
          <Chip label="Español" on={lang === "es"} onPress={() => setLang("es")} />
          <Chip label="English" on={lang === "en"} onPress={() => setLang("en")} />
        </View>
      </Card>

      <Card>
        <ListRow
          icon="document-text-outline"
          title={driver ? t("Documentos y vehículos", "Documents and vehicles") : t("Postularse como conductor", "Apply to drive")}
          detail={
            driver
              ? vehicles.map((v) => (v.make_model ?? t("Vehículo", "Vehicle")) + " " + (v.plate ?? "")).join(" · ") || t("Agregue su primer vehículo", "Add your first vehicle")
              : t("Empiece su solicitud aquí", "Start your application here")
          }
          onPress={onDocuments}
        />
        <Divider />
        <ListRow
          icon="help-buoy-outline"
          title={t("Ayuda y soporte", "Help and support")}
          detail={t("Preguntas frecuentes, WhatsApp y correo", "FAQs, WhatsApp and email")}
          onPress={onHelp}
        />
        <Divider />
        <ListRow icon="log-out-outline" title={t("Cerrar sesión", "Sign out")} onPress={onSignOut} tone="red" />
      </Card>

      <View style={{ flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="star" size={13} color={C.faint} />
        <Text style={[S.muted, { fontSize: 12, flexShrink: 1 }]}>
          {t(
            "Los conductores mejor calificados reciben más viajes. Una calificación con comentario cuenta doble.",
            "Better-rated drivers get more trips. A rating with a comment counts double.",
          )}
        </Text>
      </View>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 4 }}>
      <Text style={{ fontSize: 17, fontWeight: "800", color: C.text }} numberOfLines={1}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, color: C.muted, textAlign: "center" }}>{label}</Text>
    </View>
  );
}
