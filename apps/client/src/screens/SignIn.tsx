import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { supabase } from "../supabase";
import { C, S } from "../theme";
import { useT } from "../i18n";
import { Btn, Card, LinkBtn } from "../ui";

/**
 * No accounts and no passwords: a traveller proves an email is theirs with a
 * 6-digit code we send to it. Used when they send their first trip request
 * (Plan a trip) and when they come back to see their trips on another phone.
 * The code only reaches the inbox's owner, can't be reused and expires quickly.
 */
export const validEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim());

/** Email a code. Returns an error message, or null when sent. */
export async function sendCode(email: string, t: (en: string, es: string) => string): Promise<string | null> {
  const e = email.trim().toLowerCase();
  if (!validEmail(e)) return t("Enter your email address.", "Escriba su correo electrónico.");
  const { error } = await supabase.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } });
  return error
    ? t("We couldn't send a code to that email. Check the address and try again in a minute.", "No pudimos enviar un código a ese correo. Revise la dirección e intente de nuevo en un minuto.")
    : null;
}

/** Check the code; on success the app is signed in as that email. Returns an error message, or null. */
export async function verifyCode(email: string, code: string, t: (en: string, es: string) => string): Promise<string | null> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
  return error ? t("That code didn't work. Check it, or send a new one.", "Ese código no funcionó. Revíselo o pida uno nuevo.") : null;
}

/** The 6-digit code box. */
export function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useT();
  return (
    <TextInput
      accessibilityLabel={t("6-digit code", "Código de 6 dígitos")}
      value={value}
      onChangeText={(v) => onChange(v.replace(/\D/g, "").slice(0, 6))}
      placeholder="••••••"
      placeholderTextColor={C.faint}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      style={[S.input, { letterSpacing: 8, fontSize: 24, fontWeight: "800", textAlign: "center" }]}
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

  async function send() {
    setBusy(true);
    setError("");
    const err = await sendCode(email, t);
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
      <Text style={S.h2}>{sent ? t("Enter your code", "Escriba su código") : t("Already booked?", "¿Ya reservó?")}</Text>
      <Text style={S.muted}>
        {sent
          ? t("We emailed a 6-digit code to ", "Enviamos un código de 6 dígitos a ") + email.trim().toLowerCase() + "."
          : t(
              "Enter the email you used for your trip and we'll send you a 6-digit code to see your trips, your driver and the chat. No account or password needed.",
              "Escriba el correo que usó para su viaje y le enviaremos un código de 6 dígitos para ver sus viajes, su conductor y el chat. No necesita cuenta ni contraseña.",
            )}
      </Text>
      {!sent ? (
        <TextInput
          accessibilityLabel={t("Email", "Correo electrónico")}
          value={email}
          onChangeText={setEmail}
          placeholder={t("you@example.com", "usted@ejemplo.com")}
          placeholderTextColor={C.faint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          style={S.input}
        />
      ) : (
        <CodeInput value={code} onChange={setCode} />
      )}
      {error ? <Text style={S.error}>{error}</Text> : null}
      {!sent ? (
        <Btn label={t("Email me a code", "Enviarme un código")} icon="mail-outline" onPress={() => void send()} busy={busy} alt />
      ) : (
        <>
          <Btn label={t("See my trips", "Ver mis viajes")} onPress={() => void verify()} busy={busy} disabled={code.length !== 6} color={C.emerald} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
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
