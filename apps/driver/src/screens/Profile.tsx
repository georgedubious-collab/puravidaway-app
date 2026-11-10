import type { ReactNode } from "react";
import { ScrollView, Text } from "react-native";
import { townName } from "../format";
import { C, S } from "../theme";
import type { DriverInfo, Vehicle } from "../types";
import { Btn, Card, Field } from "../ui";

const KYC: Record<string, string> = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Not approved",
  suspended: "Suspended",
};

/** The driver's status, rating and vehicles, with the way in to documents and location sharing. */
export function Profile({
  email,
  driver,
  vehicles,
  onSignOut,
  onDocuments,
  location,
}: {
  email: string;
  driver: DriverInfo | null;
  vehicles: Vehicle[];
  onSignOut: () => void;
  /** Open the documents and vehicles screen. */
  onDocuments: () => void;
  /** The location-sharing card. */
  location?: ReactNode;
}) {
  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <Text style={S.h1}>Profile</Text>
      <Card>
        <Field label="Signed in as" value={email} />
        <Field label="Driver account" value={driver ? (KYC[driver.kyc_status] ?? driver.kyc_status) : "No driver application yet"} />
        <Field label="Based in" value={driver?.home_hub ? townName(driver.home_hub) : "Not set (set it on the website to get nearby jobs first)"} />
        <Field
          label="Your rating"
          value={driver?.rating_count ? "★ " + Number(driver.rating_avg).toFixed(1) + " from " + driver.rating_count + " ratings" : "No ratings yet"}
        />
        <Text style={S.muted}>Better-rated drivers are offered more trips. A rating with a written comment counts double.</Text>
      </Card>
      {location}
      <Card>
        <Text style={S.h2}>Vehicles</Text>
        {vehicles.length === 0 ? <Text style={S.muted}>No vehicles yet.</Text> : null}
        {vehicles.map((v) => (
          <Text key={v.id} style={S.text}>
            {(v.make_model ?? "Vehicle") + " " + (v.plate ?? "")} · {v.passenger_capacity ?? "?"} seats ·{" "}
            <Text style={{ color: v.status === "approved" ? C.emerald : C.amber, fontWeight: "700" }}>{KYC[v.status] ?? v.status}</Text>
          </Text>
        ))}
      </Card>
      <Btn label={driver ? "Documents and vehicles" : "Apply to drive"} alt={Boolean(driver)} onPress={onDocuments} />
      <Btn label="Sign out" onPress={onSignOut} color={C.red} />
    </ScrollView>
  );
}
