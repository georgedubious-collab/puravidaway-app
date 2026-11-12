import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { View } from "react-native";
import { SITE_URL } from "../config";
import { useT } from "../i18n";
import { supabase } from "../supabase";
import { C, T } from "../theme";
import { Btn, Card, Input, LinkBtn, Text } from "../ui";

/**
 * No accounts and no passwords: a traveller proves an email is theirs with a
 * 6-digit code we send to it. Used when they send their first trip request
 * (the "Confirm your email" panel) and when they come back to see their trips
 * on another phone. The code only reaches the inbox's owner, can't be reused
 * and expires quickly.
 */
export const validEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim());

/**
 * Email a code. Returns an error message, or null when sent.
 *
 * Our server sends it (/api/v1/auth/send-code), never the phone, so bots can't create accounts:
 * "booking" (sending a trip request) may create the account; "trips" ("Already booked?") only
 * works for an email that has trips, and the answer never says which (onNeutral gets the
 * "If this email has trips with us…" wording to show instead).
 */
export async function sendCode(
  email: string,
  t: (en: string, es: string) => string,
  purpose: "booking" | "trips" = "booking",
  onNeutral?: (message: string) => void,
): Promise<string | null> {
  const e = email.trim().toLowerCase();
  if (!validEmail(e)) return t("Enter your email address.", "Escriba su correo electrónico.");
  const failed = t(
    "We couldn't send a code to that email. Check the address and try again in a minute.",
    "No pudimos enviar un código a ese correo. Revise la dirección e intente de nuevo en un minuto.",
  );
  try {
    const res = await fetch(SITE_URL + "/api/v1/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e, purpose, lang: t("en", "es") }),
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; neutral?: boolean; message?: string; error?: string } | null;
    if (!json) return failed;
    if (!json.ok) return json.error ?? failed;
    if (json.neutral && json.message) onNeutral?.(json.message);
    return null;
  } catch {
    return t("We couldn't reach the server. Check your connection.", "No pudimos conectar con el servidor. Revise su conexión.");
  }
}

/** Check the code; on success the app is signed in as that email. Returns an error message, or null. */
export async function verifyCode(email: string, code: string, t: (en: string, es: string) => string): Promise<string | null> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
  return error ? t("That code didn't work. Check it, or send a new one.", "Ese código no funcionó. Revíselo o pida uno nuevo.") : null;
}

/** The 6-digit code box. */
export function CodeInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const { t } = useT();
  return (
    <Input
      accessibilityLabel={t("6-digit code", "Código de 6 dígitos")}
      value={value}
      onChangeText={(v) => onChange(v.replace(/\D/g, "").slice(0, 6))}
      placeholder="••••••"
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      style={{ letterSpacing: 10, fontSize: 28, fontWeight: "800", textAlign: "center", minHeight: 68 }}
    />
  );
}

/**
 * "Already booked? See your trips": email, then the code. Shown in My trips and
 * Account when nobody is signed in on this phone.
 */
export function SignInCard({ demoSent }: { demoSent?: string }) {
  const { t } = useT();
  const [email, setEmail] = useState(demoSent ?? "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(Boolean(demoSent));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [neutral, setNeutral] = useState("");

  async function send() {
    setBusy(true);
    setError("");
    setNeutral("");
    const err = await sendCode(email, t, "trips", setNeutral);
    setBusy(false);
    if (err) return setError(err);
    setSent(true);
  }

  async function verify() {
    setBusy(true);
    setError("");
    const err = await verifyCode(email, code, t);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <Card>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.emeraldTint, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={sent ? "keypad-outline" : "mail-outline"} size={24} color={C.emerald} />
      </View>
      <Text style={T.h2}>{sent ? t("Enter your code", "Escriba su código") : t("Already booked?", "¿Ya reservó?")}</Text>
      <Text style={T.body}>
        {sent
          ? neutral
            ? neutral + " (" + email.trim().toLowerCase() + ")"
            : t("We emailed a 6-digit code to ", "Enviamos un código de 6 dígitos a ") + email.trim().toLowerCase() + "."
          : t(
              "Enter the email you used for your trip and we'll send you a 6-digit code to see your trips, your driver and the chat. No account or password needed.",
              "Escriba el correo que usó para su viaje y le enviaremos un código de 6 dígitos para ver sus viajes, su conductor y el chat. No necesita cuenta ni contraseña.",
            )}
      </Text>
      {!sent ? (
        <Input
          accessibilityLabel={t("Email", "Correo electrónico")}
          value={email}
          onChangeText={setEmail}
          placeholder={t("you@example.com", "usted@ejemplo.com")}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />
      ) : (
        <CodeInput value={code} onChange={setCode} />
      )}
      {error ? <Text style={{ color: C.red, fontWeight: "600", fontSize: 15, lineHeight: 21 }}>{error}</Text> : null}
      {!sent ? (
        <Btn label={t("Email me a code", "Enviarme un código")} icon="mail-outline" onPress={() => void send()} busy={busy} alt />
      ) : (
        <>
          <Btn label={t("See my trips", "Ver mis viajes")} onPress={() => void verify()} busy={busy} disabled={code.length !== 6} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap" }}>
            <LinkBtn label={t("Send a new code", "Enviar otro código")} onPress={() => void send()} disabled={busy} />
            <LinkBtn
              label={t("Different email", "Otro correo")}
              color={C.muted}
              onPress={() => {
                setSent(false);
                setCode("");
                setError("");
              }}
            />
          </View>
        </>
      )}
    </Card>
  );
}
