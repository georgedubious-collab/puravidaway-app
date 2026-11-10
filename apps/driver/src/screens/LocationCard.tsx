import * as Linking from "expo-linking";
import { useState } from "react";
import { Text, View } from "react-native";
import { useT } from "../i18n";
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
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(false);

  async function agree() {
    setBusy(true);
    setNote(false);
    const ok = await requestLocationPermission();
    if (ok) await supabase.rpc("set_location_consent", { p_agree: true });
    else setNote(true);
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
        <Text style={S.h2}>{t("Comparta su ubicación durante los viajes", "Share your location during trips")}</Text>
        <Text style={S.text}>
          {t(
            "Para coordinar las recogidas y mantener informados a los clientes, la app comparte la ubicación de este teléfono alrededor de sus viajes.",
            "To coordinate pickups and keep travellers informed, the app shares this phone's location around your trips.",
          )}
        </Text>
        <IconLine
          icon="time-outline"
          text={t(
            'Desde 3 horas antes de cada recogida (o desde que toca "Voy en camino") hasta que termina el viaje, también con la app cerrada.',
            'From 3 hours before each pickup (or from the moment you tap "I\'m on my way") until you end the trip, also when the app is closed.',
          )}
        />
        <IconLine
          icon="people-outline"
          text={t(
            "Se comparte con nuestro equipo y con los clientes que usted lleva, solo para su propio viaje.",
            "Shared with our team and with the travellers you're driving, only for their own trip.",
          )}
        />
        <IconLine
          icon="lock-closed-outline"
          text={t(
            "No se comparte nada en ningún otro momento. Solo guardamos su última posición, no un historial. Puede dejar de compartir aquí cuando quiera.",
            "Nothing is shared at any other time. We keep only your latest position, not a history. You can stop sharing here whenever you like.",
          )}
        />
        <Btn label={t("Aceptar y permitir ubicación", "Agree and allow location")} icon="location-outline" onPress={agree} busy={busy} color={C.emerald} />
        {note ? (
          <Text style={S.error}>
            {t(
              'No se permitió la ubicación. Elija "Permitir todo el tiempo" en los ajustes del teléfono para que siga funcionando mientras maneja.',
              'Location wasn\'t allowed. Choose "Allow all the time" in the phone\'s settings so it keeps working while you drive.',
            )}
          </Text>
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <Text style={S.h2}>{t("Compartir ubicación", "Location sharing")}</Text>
      {state?.kind === "on" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.emeraldBright }} />
          <Text style={{ color: C.emerald, fontWeight: "700", flex: 1 }}>
            {t(
              "Activa ahora para el viaje " + state.bookingRef + ". Se apaga cuando termine el viaje.",
              "On now for trip " + state.bookingRef + ". It stops when you end the trip.",
            )}
          </Text>
        </View>
      ) : state?.reason === "no-permission" ? (
        <>
          <IconLine
            icon="warning-outline"
            color={C.amber}
            text={t(
              'El teléfono está bloqueando la ubicación. Póngala en "Permitir todo el tiempo" para que nuestro equipo pueda seguir sus viajes.',
              'The phone is blocking location. Set it to "Allow all the time" so our team can follow your trips.',
            )}
          />
          <Btn label={t("Abrir ajustes del teléfono", "Open phone settings")} icon="settings-outline" alt onPress={() => void Linking.openSettings()} />
        </>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.faint, marginTop: 5 }} />
          <Text style={[S.muted, { flex: 1 }]}>
            {t(
              'Apagada por ahora. Se enciende sola 3 horas antes de su próxima recogida, o cuando toca "Voy en camino".',
              'Off right now. It turns on by itself 3 hours before your next pickup, or when you tap "I\'m on my way".',
            )}
          </Text>
        </View>
      )}
      <Text style={S.muted}>
        {t(
          "Nuestro equipo y sus clientes siguen el viaje con ella, así que a los conductores que dejan de compartir quizá no se les asignen viajes.",
          "Our team and your travellers follow the trip with it, so drivers who stop sharing may not be assigned rides.",
        )}
      </Text>
      <LinkBtn label={t("Dejar de compartir mi ubicación", "Stop sharing my location")} onPress={() => void withdraw()} color={C.muted} disabled={busy} />
    </Card>
  );
}
