import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { cents, useBooking } from "../../booking";
import { longDate } from "../../DatePicker";
import { useDemo } from "../../demo";
import { plural } from "../../format";
import { success } from "../../haptics";
import { useT } from "../../i18n";
import { photoFor } from "../../images";
import { useNav } from "../../nav";
import { Photo } from "../../Photo";
import { useSession } from "../../session";
import { C, S, SP, T } from "../../theme";
import { Bar, BottomBar, Btn, Card, Choice, Divider, FieldLabel, IconLine, Input, LinkBtn, Page, Text, type IconName } from "../../ui";
import { CodeInput, sendCode, validEmail, verifyCode } from "../SignIn";
import { hasContactDetails } from "../../contact";
import { NoSuggestions } from "./parts";

/**
 * Sends the planned trip and, when it goes through, replaces the booking steps
 * with the "request sent" screen. Returns an error message, or null.
 */
export function useSendRequest(): () => Promise<string | null> {
  const nav = useNav();
  const { submit, reset } = useBooking();
  const { reload } = useSession();
  return async () => {
    const res = await submit();
    if (!res.ok) return res.error;
    success();
    nav.reset({ index: 1, routes: [{ name: "Tabs" }, { name: "Sent", params: res.sent }] });
    // Once the steps are off screen, start the next plan from scratch.
    setTimeout(() => reset(), 600);
    void reload();
    return null;
  };
}

/**
 * Review & send for a day tour: the tour at a glance (tap a row to change it), who is travelling, how they pay.
 * A ride is sent from its own last screen (src/screens/book/Confirm.tsx).
 */
export function BookReview() {
  const { lang, t } = useT();
  const nav = useNav();
  const { email } = useSession();
  const { state, set, chosen, tour } = useBooking();
  const send = useSendRequest();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guest = email === null;

  if (!chosen || state.kind !== "tour") {
    return (
      <Page>
        <Bar style="dark" />
        <Text style={T.body}>{t("Choose your trip first.", "Primero elija su viaje.")}</Text>
        <Btn label={t("Back", "Volver")} alt onPress={() => nav.goBack()} />
      </Page>
    );
  }

  const fee = Math.round((chosen.totalCents * chosen.cashFeeBps) / 10000);
  const total = state.payMode === "cash_driver" ? chosen.totalCents + fee : chosen.totalCents;
  // Where to pick them up: required, one line, no phone numbers, emails or links (the server checks again).
  const pickupBlocked = hasContactDetails(state.tourPickup);
  const pickupOk = state.tourPickup.trim().length >= 3 && !pickupBlocked;
  const detailsOk = pickupOk && Boolean(state.name.trim()) && state.phone.replace(/\D/g, "").length >= 7 && (!guest || validEmail(state.guestEmail));

  /** Signed in: send now. Not signed in: email them a code first, then the code panel sends it. */
  async function start() {
    setBusy(true);
    setError("");
    if (guest) {
      const err = await sendCode(state.guestEmail, t);
      setBusy(false);
      if (err) return setError(err);
      return nav.navigate("Code");
    }
    const err = await send();
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <Page
      footer={
        <BottomBar>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <Text style={T.bodyStrong}>Total</Text>
              <Text style={T.money}>{cents(total)}</Text>
            </View>
            <Btn
              label={state.payMode === "full_100" ? t("Send request and pay", "Enviar solicitud y pagar") : t("Send request", "Enviar solicitud")}
              icon="paper-plane-outline"
              onPress={() => void start()}
              busy={busy}
              disabled={!detailsOk}
            />
          </View>
        </BottomBar>
      }
    >
      <Bar style="dark" />
      <Text accessibilityRole="header" style={T.display}>
        {t("Review and send", "Revise y envíe")}
      </Text>

      <View style={[S.card, { padding: 0, gap: 0, overflow: "hidden" }]}>
        <Photo name={tour ? "tour:" + tour.id : photoFor(chosen.title)} fallback={tour ? photoFor((tour.regionName ?? "") + " " + tour.name) : undefined} style={{ height: 120 }} />
        <View style={{ paddingHorizontal: SP.lg, paddingVertical: SP.sm }}>
          <Row icon="trail-sign-outline" label={t("Day tour", "Tour de un día")} value={chosen.title} detail={state.upgrade && tour?.totalWithUpgradeCents != null ? "+ Smart En-Route Transfer" : undefined} onEdit={() => nav.goBack()} />
          <Divider />
          <Row icon="calendar-outline" label={t("Date", "Fecha")} value={longDate(chosen.date, lang)} onEdit={() => nav.navigate("TourWhen")} />
          <Divider />
          <Row icon="people-outline" label={t("Travellers", "Viajeros")} value={plural(state.pax, "traveller", lang)} onEdit={() => nav.navigate("TourWhen")} />
        </View>
      </View>

      <Card>
        <Text style={T.h2}>{t("Where should we pick you up?", "¿Dónde lo recogemos?")}</Text>
        <Input
          accessibilityLabel={t("Where should we pick you up?", "¿Dónde lo recogemos?")}
          value={state.tourPickup}
          onChangeText={(tourPickup) => set({ tourPickup })}
          maxLength={120}
          placeholder={t("Hotel name or address", "Nombre del hotel o dirección")}
          autoCorrect={false}
        />
        <IconLine
          small
          icon="location-outline"
          text={
            tour?.regionName
              ? t("Your hotel or address in " + tour.regionName + ". Our team confirms the pickup time.", "Su hotel o dirección en " + tour.regionName + ". Nuestro equipo confirma la hora de recogida.")
              : t("Your hotel or address. Our team confirms the pickup time.", "Su hotel o dirección. Nuestro equipo confirma la hora de recogida.")
          }
        />
        {pickupBlocked ? (
          <Text accessibilityRole="alert" style={S.error}>
            {t("Please keep phone numbers, emails and links out of the pickup place.", "Por favor, no incluya teléfonos, correos ni enlaces en el lugar de recogida.")}
          </Text>
        ) : null}
      </Card>

      <Card>
        <Text style={T.h2}>{t("Your details", "Sus datos")}</Text>
        <FieldLabel>{t("Full name", "Nombre completo")}</FieldLabel>
        <Input accessibilityLabel={t("Full name", "Nombre completo")} value={state.name} onChangeText={(name) => set({ name })} autoComplete="name" textContentType="name" />
        <FieldLabel>{t("Mobile / WhatsApp, with country code", "Celular / WhatsApp, con código de país")}</FieldLabel>
        <Input accessibilityLabel={t("Mobile number", "Número de celular")} value={state.phone} onChangeText={(phone) => set({ phone })} keyboardType="phone-pad" placeholder="+1 555 123 4567" autoComplete="tel" textContentType="telephoneNumber" />
        {guest ? (
          <>
            <FieldLabel>{t("Email", "Correo electrónico")}</FieldLabel>
            <Input
              accessibilityLabel={t("Email", "Correo electrónico")}
              value={state.guestEmail}
              onChangeText={(guestEmail) => set({ guestEmail })}
              placeholder={t("you@example.com", "usted@ejemplo.com")}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
            />
            <IconLine small icon="mail-outline" text={t("Your confirmation and driver details go here. No account or password needed.", "Aquí le enviamos la confirmación y los datos de su conductor. No necesita cuenta ni contraseña.")} />
          </>
        ) : (
          <IconLine small icon="mail-outline" text={t("Confirmations go to " + email + ".", "Las confirmaciones se envían a " + email + ".")} />
        )}
        <NoSuggestions />
      </Card>

      <Card>
        <Text style={T.h2}>{t("How would you like to pay?", "¿Cómo desea pagar?")}</Text>
        <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
          <Choice icon="card-outline" title={t("Online in full", "En línea, pago total")} detail={t("Pay securely by card", "Pague de forma segura con tarjeta")} right={cents(chosen.totalCents)} on={state.payMode === "full_100"} onPress={() => set({ payMode: "full_100" })} />
          <Choice
            icon="cash-outline"
            title={t("Cash to the driver", "Efectivo al conductor")}
            detail={t("Includes the " + chosen.cashFeeBps / 100 + "% cash booking fee", "Incluye el cargo del " + chosen.cashFeeBps / 100 + "% por reserva en efectivo")}
            right={cents(chosen.totalCents + fee)}
            on={state.payMode === "cash_driver"}
            onPress={() => set({ payMode: "cash_driver" })}
          />
        </View>
      </Card>
      {error ? (
        <Text accessibilityRole="alert" style={S.error}>
          {error}
        </Text>
      ) : null}
      <IconLine
        small
        icon="shield-checkmark-outline"
        text={t("Free cancellation up to 24 hours before pickup. Our team confirms your driver and pickup time.", "Cancelación gratis hasta 24 horas antes de la recogida. Nuestro equipo confirma su conductor y la hora de recogida.")}
      />
    </Page>
  );
}

/** One line of the trip summary; tapping it goes back to the step where it was chosen. */
function Row({ icon, label, value, detail, onEdit }: { icon: IconName; label: string; value: string; detail?: string; onEdit: () => void }) {
  const { t } = useT();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label + ": " + value + ". " + t("Change", "Cambiar")} onPress={onEdit} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name={icon} size={22} color={C.emerald} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={T.caption}>{label}</Text>
        <Text style={T.bodyStrong}>{value}</Text>
        {detail ? <Text style={T.small}>{detail}</Text> : null}
      </View>
      <Text style={{ color: C.emerald, fontWeight: "700", fontSize: 15 }}>{t("Change", "Cambiar")}</Text>
    </Pressable>
  );
}

/**
 * Slide-up panel for someone who isn't signed in: the 6-digit code we just
 * emailed. A correct code signs this phone in as that email and the request
 * goes out straight away.
 */
export function CodeSheet() {
  const { t } = useT();
  const nav = useNav();
  const demo = useDemo();
  const { state } = useBooking();
  const send = useSendRequest();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // The email is confirmed but the request didn't go through: only the sending is retried.
  const [verified, setVerified] = useState(false);
  const email = (demo?.codeSentTo ?? state.guestEmail).trim().toLowerCase();

  async function confirmAndSend() {
    setBusy(true);
    setError("");
    if (!verified) {
      const err = await verifyCode(email, code, t);
      if (err) {
        setBusy(false);
        return setError(err);
      }
      setVerified(true);
    }
    const err = await send();
    setBusy(false);
    if (err) setError(err);
  }

  async function resend() {
    setBusy(true);
    setError("");
    const err = await sendCode(email, t);
    setBusy(false);
    setCode("");
    if (err) setError(err);
  }

  return (
    <Page>
      <Bar style="dark" />
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.emeraldTint, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={verified ? "checkmark-circle-outline" : "mail-open-outline"} size={30} color={C.emerald} />
      </View>
      <Text accessibilityRole="header" style={T.h1}>
        {verified ? t("Email confirmed", "Correo confirmado") : t("Confirm your email", "Confirme su correo")}
      </Text>
      {verified ? (
        <Text style={T.body}>{t("Your email is confirmed. Send your request again.", "Su correo está confirmado. Envíe su solicitud de nuevo.")}</Text>
      ) : (
        <>
          <Text style={T.body}>
            {t("We emailed a 6-digit code to ", "Enviamos un código de 6 dígitos a ")}
            <Text style={{ fontWeight: "700", color: C.text }}>{email}</Text>
            {t(". Enter it to send your request. It also lets you follow your trip and your driver in the app.", ". Escríbalo para enviar su solicitud. También le permite seguir su viaje y su conductor en la app.")}
          </Text>
          <CodeInput value={code} onChange={setCode} autoFocus={!demo} />
        </>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={S.error}>
          {error}
        </Text>
      ) : null}
      <Btn
        label={verified ? t("Send request", "Enviar solicitud") : state.payMode === "full_100" ? t("Confirm and pay", "Confirmar y pagar") : t("Confirm and send", "Confirmar y enviar")}
        icon="checkmark-circle-outline"
        onPress={() => void confirmAndSend()}
        busy={busy}
        disabled={!verified && code.length !== 6}
      />
      {verified ? null : (
        <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap" }}>
          <LinkBtn label={t("Send a new code", "Enviar otro código")} onPress={() => void resend()} disabled={busy} />
          <LinkBtn label={t("Change email", "Cambiar correo")} color={C.muted} onPress={() => nav.goBack()} />
        </View>
      )}
    </Page>
  );
}
