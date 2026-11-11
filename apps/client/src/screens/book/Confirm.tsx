import { useState } from "react";
import { Pressable, View } from "react-native";
import { bagsFor, cents, useBooking } from "../../booking";
import { shortDate } from "../../DatePicker";
import { useT } from "../../i18n";
import { useNav } from "../../nav";
import { driveTime, time12 } from "../../prices";
import { useSession } from "../../session";
import { C, S, SP, T } from "../../theme";
import { Bar, BottomBar, Btn, Card, Choice, FieldLabel, IconLine, Input, Page, Skeleton, Stepper, Text, Toggle } from "../../ui";
import { validEmail, sendCode } from "../SignIn";
import { ActionRow, BagNote, QuoteProblem, RouteDots } from "./parts";
import { useSendRequest } from "./Review";

const BOX = { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, paddingHorizontal: SP.lg } as const;

/**
 * "Your ride": the last screen before a ride request is sent. The route and
 * price, who travels and their bags, the flight number, stops, driver
 * preferences and payment, then the traveller's contact details. Someone who
 * isn't signed in confirms their email with a code before it goes out.
 */
export function BookConfirm() {
  const { lang, t } = useT();
  const nav = useNav();
  const { email } = useSession();
  const { state, set, chosen, quote, quoteBusy, vehicle, stopsOn, effectivePrefs, itemCents, offerValid, notesBlocked } = useBooking();
  const send = useSendRequest();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flightOpen, setFlightOpen] = useState(Boolean(state.notes));
  const [payOpen, setPayOpen] = useState(false);
  const guest = email === null;
  const bid = state.mode === "bid";

  // The price is known as soon as a vehicle is priced; `chosen` (what would be sent) also needs the date to be confirmed.
  const priced = Boolean(vehicle) && (!bid || offerValid);
  const feeBps = quote?.cashFeeBps ?? 0;
  const fee = Math.round((itemCents * feeBps) / 10000);
  const total = state.payMode === "cash_driver" ? itemCents + fee : itemCents;
  const detailsOk = Boolean(state.name.trim()) && state.phone.replace(/\D/g, "").length >= 7 && (!guest || validEmail(state.guestEmail));
  const bags = bagsFor(state);

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

  const pickedStops = quote && stopsOn ? quote.stops.filter((s) => state.stopIds.includes(s.id)) : [];
  const p = effectivePrefs;
  const { prefs } = state;
  const extras: string[] = [p.language === "spanish_ok" ? t("Spanish or basic English is fine", "Español o inglés básico está bien") : t("English-speaking driver", "Conductor que habla inglés")];
  if (state.driverNotes.trim()) extras.push(t("Message for your driver", "Mensaje para su conductor"));

  return (
    <Page
      footer={
        <BottomBar>
          <View style={{ gap: 10 }}>
            <Text style={[T.caption, { textAlign: "center" }]}>
              {detailsOk || !priced ? t("Our team confirms your driver and sends you a message.", "Nuestro equipo confirma su conductor y le envía un mensaje.") : t("Add your name and WhatsApp number above to send the request.", "Agregue arriba su nombre y su WhatsApp para enviar la solicitud.")}
            </Text>
            <Btn label={t("Request ride", "Solicitar traslado") + (priced ? " · " + cents(total) : "")} onPress={() => void start()} busy={busy || (Boolean(quote) && quoteBusy)} disabled={!detailsOk || !chosen} />
          </View>
        </BottomBar>
      }
    >
      <Bar style="dark" />

      <View style={[BOX, { paddingVertical: SP.lg, gap: 12 }]}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <RouteDots inset={6} />
          <View style={{ flex: 1, gap: 12, minWidth: 0 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Pickup: ", "Recogida: ") + (state.from?.label ?? "") + ", " + shortDate(state.date, lang) + ", " + time12(state.time) + ". " + t("Change the date or time", "Cambiar la fecha o la hora")}
              onPress={() => nav.navigate("BookWhen")}
              style={({ pressed }) => ({ gap: 2, minHeight: 44, opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: "700", color: C.text }}>{state.from?.label}</Text>
              <Text style={T.caption}>
                {state.whenSet ? shortDate(state.date, lang) + " · " + time12(state.time) + " · " : ""}
                <Text style={{ color: C.emerald, fontWeight: "700" }}>{state.whenSet ? t("Change", "Cambiar") : t("Choose date and time", "Elija fecha y hora")}</Text>
              </Text>
            </Pressable>
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: "700", color: C.text }}>{state.to?.label}</Text>
              {quote ? <Text style={T.caption}>{t("About " + driveTime(quote.minutes) + " drive", "Aprox. " + driveTime(quote.minutes) + " de viaje")}</Text> : null}
            </View>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: C.border }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, gap: 1 }}>
            {vehicle ? <Text style={T.smallStrong}>{vehicle.name}</Text> : <Skeleton height={18} width="60%" />}
            <Text style={T.caption}>{bid ? t("Your offer to drivers", "Su oferta a los conductores") : t("Fixed price for the whole vehicle", "Precio fijo por todo el vehículo")}</Text>
          </View>
          {priced ? <Text style={{ fontSize: 20, lineHeight: 26, fontWeight: "800", color: C.text }}>{cents(itemCents)}</Text> : !quote && quoteBusy ? <Skeleton height={24} width={64} /> : <Text style={T.h3}>—</Text>}
        </View>
      </View>

      <QuoteProblem />
      {notesBlocked ? (
        <Text accessibilityRole="alert" style={S.error}>
          {t("Your message for the driver has a phone number, email or link. Please take it out under Driver's language and message.", "Su mensaje para el conductor tiene un teléfono, correo o enlace. Quítelo en Idioma del conductor y mensaje.")}
        </Text>
      ) : null}

      <View style={BOX}>
        <Counter label={t("Travellers", "Viajeros")} value={state.pax} min={1} max={10} onChange={(pax) => set({ pax })} less={t("One fewer traveller", "Un viajero menos")} more={t("One more traveller", "Un viajero más")} />
        <Counter label={t("Large suitcases", "Maletas grandes")} value={bags.large} min={0} max={20} onChange={(n) => set({ bags: n })} less={t("One large suitcase fewer", "Una maleta grande menos")} more={t("One more large suitcase", "Una maleta grande más")} />
        <Counter label={t("Carry-ons", "Maletas de mano")} value={bags.carryOns} min={0} max={20} onChange={(n) => set({ carryOns: n })} less={t("One carry-on fewer", "Una maleta de mano menos")} more={t("One more carry-on", "Una maleta de mano más")} last />
      </View>
      <BagNote />

      <View style={[BOX, { paddingBottom: 14 }]}>
        <View style={{ paddingTop: 14, gap: 2 }}>
          <Text accessibilityRole="header" style={{ fontSize: 16, lineHeight: 22, fontWeight: "800", color: C.text }}>{t("Extras", "Extras")}</Text>
          <Text style={T.caption}>{t("Free, subject to availability. Tell us what you need.", "Gratis, según disponibilidad. Díganos qué necesita.")}</Text>
        </View>
        <Counter label={t("Baby / child seats", "Sillas para bebé / niño")} value={prefs.childSeats} min={0} max={4} onChange={(childSeats) => set({ prefs: { ...prefs, childSeats } })} less={t("One fewer child seat", "Una silla menos")} more={t("One more child seat", "Una silla más")} />
        <Counter label={t("Booster seats", "Boosters (asiento elevador)")} value={prefs.boosters ?? 0} min={0} max={4} onChange={(boosters) => set({ prefs: { ...prefs, boosters } })} less={t("One fewer booster seat", "Un booster menos")} more={t("One more booster seat", "Un booster más")} />
        {prefs.childSeats + (prefs.boosters ?? 0) > 0 ? (
          <Text style={[T.small, { paddingTop: 10 }]}>{t("Add the children's ages under Driver's language and message, so the right seats come along.", "Escriba la edad de los niños en Idioma del conductor y mensaje, para llevar las sillas correctas.")}</Text>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 12 }}>
          <Toggle icon="wifi-outline" label={t("Wi-Fi on board", "Wi-Fi a bordo")} on={prefs.wifi} onPress={() => set({ prefs: { ...prefs, wifi: !prefs.wifi } })} />
          <Toggle icon="cart-outline" label={t("Stroller", "Coche de bebé")} on={prefs.stroller} onPress={() => set({ prefs: { ...prefs, stroller: !prefs.stroller } })} />
          <Toggle icon="paw-outline" label={t("Travelling with a pet", "Viajo con mascota")} on={prefs.pets} onPress={() => set({ prefs: { ...prefs, pets: !prefs.pets } })} />
        </View>
      </View>

      <View style={BOX}>
        <ActionRow
          title={quote?.airportPickup ? t("Flight number", "Número de vuelo") : t("Flight number or hotel", "Número de vuelo u hotel")}
          detail={state.notes.trim() ? state.notes.trim() : quote?.airportPickup ? t("So we can follow your flight if it's delayed", "Para seguir su vuelo si se retrasa") : t("Optional", "Opcional")}
          action={flightOpen ? t("Close", "Cerrar") : state.notes.trim() ? t("Change", "Cambiar") : t("Add", "Agregar")}
          onPress={() => setFlightOpen((v) => !v)}
          last={flightOpen}
        />
        {flightOpen ? (
          <View style={{ paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Input accessibilityLabel={t("Flight number or hotel", "Número de vuelo u hotel")} value={state.notes} onChangeText={(notes) => set({ notes })} maxLength={200} placeholder={t("e.g. AA 1234", "p. ej. AA 1234")} autoCapitalize="characters" autoCorrect={false} />
          </View>
        ) : null}
        {quote && quote.stops.length > 0 ? (
          <ActionRow
            title={t("Stops along the way", "Paradas en el camino")}
            detail={
              !stopsOn
                ? t("This vehicle is a direct ride", "Este vehículo es un traslado directo")
                : pickedStops.length
                  ? pickedStops.map((s) => s.name).join(" · ")
                  : t("Your driver waits while you visit", "Su conductor espera mientras usted visita")
            }
            action={pickedStops.length ? t("Change", "Cambiar") : stopsOn ? t("Add", "Agregar") : t("See", "Ver")}
            onPress={() => nav.navigate("BookStops")}
          />
        ) : null}
        <ActionRow title={t("Driver's language and message", "Idioma del conductor y mensaje")} detail={extras.join(" · ")} action={t("Change", "Cambiar")} onPress={() => nav.navigate("BookExtras")} />
        <ActionRow
          title={state.payMode === "full_100" ? t("Pay by card", "Pagar con tarjeta") : t("Cash to the driver", "Efectivo al conductor")}
          detail={state.payMode === "cash_driver" && priced ? t("Includes the " + feeBps / 100 + "% cash booking fee", "Incluye el cargo del " + feeBps / 100 + "% por reserva en efectivo") : undefined}
          action={payOpen ? t("Close", "Cerrar") : t("Change", "Cambiar")}
          onPress={() => setPayOpen((v) => !v)}
          last
        />
        {payOpen ? (
          <View accessibilityRole="radiogroup" style={{ gap: 10, paddingBottom: 14 }}>
            <Choice icon="card-outline" title={t("Online in full", "En línea, pago total")} detail={t("Pay securely by card", "Pague de forma segura con tarjeta")} right={priced ? cents(itemCents) : undefined} on={state.payMode === "full_100"} onPress={() => set({ payMode: "full_100" })} />
            <Choice
              icon="cash-outline"
              title={t("Cash to the driver", "Efectivo al conductor")}
              detail={t("Includes the " + feeBps / 100 + "% cash booking fee", "Incluye el cargo del " + feeBps / 100 + "% por reserva en efectivo")}
              right={priced ? cents(itemCents + fee) : undefined}
              on={state.payMode === "cash_driver"}
              onPress={() => set({ payMode: "cash_driver" })}
            />
          </View>
        ) : null}
      </View>

      <Card>
        <Text style={T.h3}>{t("Your details", "Sus datos")}</Text>
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
      </Card>

      {error ? (
        <Text accessibilityRole="alert" style={S.error}>
          {error}
        </Text>
      ) : null}

      <Card tone="flat">
        <Text style={T.label}>{t("Every ride includes", "Cada traslado incluye")}</Text>
        {quote?.airportPickup ? <IconLine small icon="airplane-outline" color={C.emerald} text={t("Flight tracking: we follow your flight, so a delay doesn't leave you stranded.", "Seguimiento del vuelo: seguimos su vuelo, así que un retraso no lo deja esperando.")} /> : null}
        <IconLine small icon="time-outline" color={C.emerald} text={t("60 min free waiting after your flight lands or your pickup time.", "60 min de espera gratis después de que aterrice su vuelo o de la hora de recogida.")} />
        <IconLine small icon="happy-outline" color={C.emerald} text={t("Child seats free on request.", "Sillas para niños gratis si las pide.")} />
        <IconLine small icon="shield-checkmark-outline" color={C.emerald} text={t("Free cancellation up to 24 hours before pickup.", "Cancelación gratis hasta 24 horas antes de la recogida.")} />
      </Card>
    </Page>
  );
}

/** A label and − n + on one line of the travellers / bags card. */
function Counter({ label, value, min, max, onChange, less, more, last }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; less: string; more: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 62, paddingVertical: 8, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.border }}>
      <Text style={{ flex: 1, fontSize: 16, lineHeight: 22, fontWeight: "600", color: C.text }}>{label}</Text>
      <Stepper value={value} min={min} max={max} onChange={onChange} lessLabel={less} moreLabel={more} />
    </View>
  );
}
