import * as Linking from "expo-linking";
import { useState } from "react";
import { Text, View } from "react-native";
import { supabase } from "../supabase";
import { C, S } from "../theme";
import { requestLocationPermission, stopTracking, type TrackingState } from "../tracking";
import { Btn, Card, IconLine, LinkBtn } from "../ui";

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
        <Text style={S.text}>To coordinate pickups and keep travellers informed, the app shares this phone&apos;s location around your trips.</Text>
        <IconLine
          icon="time-outline"
          text={'From 3 hours before each pickup (or from the moment you tap "I\'m on my way") until you end the trip, also when the app is closed.'}
        />
        <IconLine icon="people-outline" text="Shared with our team and with the travellers you're driving, only for their own trip." />
        <IconLine icon="lock-closed-outline" text="Nothing is shared at any other time. We keep only your latest position, not a history. You can stop sharing here whenever you like." />
        <Btn label="Agree and allow location" icon="location-outline" onPress={agree} busy={busy} color={C.emerald} />
        {note ? <Text style={S.error}>{note}</Text> : null}
      </Card>
    );
  }

  return (
    <Card>
      <Text style={S.h2}>Location sharing</Text>
      {state?.kind === "on" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.emeraldBright }} />
          <Text style={{ color: C.emerald, fontWeight: "700", flex: 1 }}>On now for trip {state.bookingRef}. It stops when you end the trip.</Text>
        </View>
      ) : state?.reason === "no-permission" ? (
        <>
          <IconLine icon="warning-outline" color={C.amber} text={'The phone is blocking location. Set it to "Allow all the time" so our team can follow your trips.'} />
          <Btn label="Open phone settings" icon="settings-outline" alt onPress={() => void Linking.openSettings()} />
        </>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.faint, marginTop: 5 }} />
          <Text style={[S.muted, { flex: 1 }]}>Off right now. It turns on by itself 3 hours before your next pickup, or when you tap &quot;I&apos;m on my way&quot;.</Text>
        </View>
      )}
      <Text style={S.muted}>Our team and your travellers follow the trip with it, so drivers who stop sharing may not be assigned rides.</Text>
      <LinkBtn label="Stop sharing my location" onPress={() => void withdraw()} color={C.muted} disabled={busy} />
    </Card>
  );
}
