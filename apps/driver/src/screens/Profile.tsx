import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { townName } from "../format";
import { C, S } from "../theme";
import type { DriverInfo, Vehicle } from "../types";
import { Badge, Card, Divider, ListRow, ScreenTitle } from "../ui";

const KYC: Record<string, string> = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Not approved",
  suspended: "Suspended",
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
  const approved = driver?.kyc_status === "approved";
  const initial = (email[0] ?? "?").toUpperCase();
  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <ScreenTitle title="Profile" />
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
              text={driver ? (KYC[driver.kyc_status] ?? driver.kyc_status) : "No application yet"}
              tone={approved ? undefined : "amber"}
              icon={approved ? "shield-checkmark" : "time-outline"}
            />
          </View>
        </View>
        {driver ? (
          <View style={{ flexDirection: "row", marginTop: 6 }}>
            <Stat value={driver.rating_count ? "★ " + Number(driver.rating_avg).toFixed(1) : "—"} label={driver.rating_count ? driver.rating_count + " ratings" : "No ratings yet"} />
            <View style={{ width: 1, backgroundColor: C.border }} />
            <Stat value={driver.home_hub ? townName(driver.home_hub).split(" / ")[0] : "—"} label={driver.home_hub ? "Your base" : "Base not set"} />
            <View style={{ width: 1, backgroundColor: C.border }} />
            <Stat value={String(vehicles.filter((v) => v.status === "approved").length)} label="Approved vehicles" />
          </View>
        ) : null}
      </Card>

      {location}

      <Card>
        <ListRow
          icon="document-text-outline"
          title={driver ? "Documents and vehicles" : "Apply to drive"}
          detail={driver ? vehicles.map((v) => (v.make_model ?? "Vehicle") + " " + (v.plate ?? "")).join(" · ") || "Add your first vehicle" : "Start your application here"}
          onPress={onDocuments}
        />
        <Divider />
        <ListRow icon="help-buoy-outline" title="Help and support" detail="FAQs, WhatsApp and email" onPress={onHelp} />
        <Divider />
        <ListRow icon="log-out-outline" title="Sign out" onPress={onSignOut} tone="red" />
      </Card>

      <View style={{ flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="star" size={13} color={C.faint} />
        <Text style={[S.muted, { fontSize: 12 }]}>Better-rated drivers get more trips. A rating with a comment counts double.</Text>
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
