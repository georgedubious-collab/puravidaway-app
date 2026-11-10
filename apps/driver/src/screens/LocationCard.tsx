import * as Linking from "expo-linking";
import { useState } from "react";
import { Text } from "react-native";
import { supabase } from "../supabase";
import { C, S } from "../theme";
import { requestLocationPermission, stopTracking, type TrackingState } from "../tracking";
import { Btn, Card } from "../ui";

/**
 * Explains location sharing and asks for the driver's agreement before the
 * phone's own permission prompt (both app stores require this order).
 */
export function LocationCard({
  consented,
  state,
  onChanged,
}: {
  consented: boolean;
  state: TrackingState | null;
  /** Reload the driver record and re-sync tracking. */
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function agree() {
    setBusy(true);
    setNote("");
    const ok = await requestLocationPermission();
    if (ok) await supabase.rpc("set_location_consent", { p_agree: true });
    else setNote('Location wasn\'t allowed. Choose "Allow all the time" in the phone\'s settings so it keeps working while you drive.');
    await onChanged();
    setBusy(false);
  }

  async function withdraw() {
    setBusy(true);
    await stopTracking();
    await supabase.rpc("set_location_consent", { p_agree: false });
    await onChanged();
    setBusy(false);
  }

  if (!consented) {
    return (
      <Card>
        <Text style={S.h2}>Share your location during trips</Text>
        <Text style={S.text}>
          To coordinate pickups and keep travellers informed, the app shares this phone&apos;s location with our team and with the travellers
          you&apos;re driving, from 3 hours before each
          pickup (or from the moment you tap &quot;I&apos;m on my way&quot;) until you end the trip, also when the app is closed.
        </Text>
        <Text style={S.muted}>
          Nothing is shared at any other time. We keep only your latest position, not a history; travellers see it only for their own trip. You can stop
          sharing here whenever you like.
        </Text>
        <Btn label="Agree and allow location" onPress={agree} busy={busy} color={C.emerald} />
        {note ? <Text style={S.error}>{note}</Text> : null}
      </Card>
    );
  }

  return (
    <Card>
      <Text style={S.h2}>Location sharing</Text>
      {state?.kind === "on" ? (
        <Text style={{ color: C.emerald, fontWeight: "700" }}>On now for trip {state.bookingRef}. It stops when you end the trip.</Text>
      ) : state?.reason === "no-permission" ? (
        <>
          <Text style={{ color: C.amber, fontWeight: "700" }}>
            The phone is blocking location. Set it to &quot;Allow all the time&quot; so our team can follow your trips.
          </Text>
          <Btn label="Open phone settings" alt onPress={() => void Linking.openSettings()} />
        </>
      ) : (
        <Text style={S.muted}>Off right now. It turns on by itself 3 hours before your next pickup, or when you tap &quot;I&apos;m on my way&quot;.</Text>
      )}
      <Btn label="Stop sharing my location" alt onPress={withdraw} busy={busy} />
      <Text style={S.muted}>Our team and your travellers follow the trip with it, so drivers who stop sharing may not be assigned rides.</Text>
    </Card>
  );
}
