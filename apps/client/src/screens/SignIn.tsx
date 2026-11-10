import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../supabase";
import { C, S } from "../theme";
import { LangToggle, useT } from "../i18n";
import { Btn, LinkBtn } from "../ui";

/** Sign in with an emailed 6-digit code, using the email the trip was booked with. No passwords. */
export function SignIn() {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode() {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setError(t("Enter your email address.", "Escriba su correo electrónico."));
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } });
    setBusy(false);
    if (err) return setError(t("We couldn't send a code to that email. Check the address and try again in a minute.", "No pudimos enviar un código a ese correo. Revise la dirección e intente de nuevo en un minuto."));
    setSent(true);
  }

  async function verify() {
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
    setBusy(false);
    if (err) setError(t("That code didn't work. Check it, or send a new one.", "Ese código no funcionó. Revíselo o pida uno nuevo."));
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[S.screen, { backgroundColor: C.emeraldDark }]}>
      <View style={{ position: "absolute", top: 0, right: 0, paddingTop: insets.top + 12, paddingRight: 20, zIndex: 1 }}>
        <LangToggle dark />
      </View>
      <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 24 }}>
        <View style={{ gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.emeraldBright, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="car-sport" size={32} color="#fff" />
          </View>
          <Text style={{ color: "#fff", fontSize: 30, lineHeight: 34, fontWeight: "800", letterSpacing: -0.6 }}>
            Costa Rica{"\n"}Private Transfers
          </Text>
          <Text style={{ color: "#A7F3D0", fontSize: 15, lineHeight: 21 }}>{t("Your trips, your driver and your chat, in one place.", "Sus viajes, su conductor y su chat, en un solo lugar.")}</Text>
        </View>
        <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 20, gap: 12 }}>
          <Text style={S.h2}>{sent ? t("Enter your code", "Escriba su código") : t("Sign in", "Iniciar sesión")}</Text>
          <Text style={S.muted}>
            {sent
              ? t("We emailed a 6-digit code to ", "Enviamos un código de 6 dígitos a ") + email.trim().toLowerCase() + "."
              : t("Use the email you booked with and we'll send you a 6-digit code. No password needed.", "Use el correo con el que reservó y le enviaremos un código de 6 dígitos. No necesita contraseña.")}
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
              style={S.input}
            />
          ) : (
            <TextInput
              accessibilityLabel={t("6-digit code", "Código de 6 dígitos")}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              placeholderTextColor={C.faint}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              style={[S.input, { letterSpacing: 8, fontSize: 24, fontWeight: "800", textAlign: "center" }]}
            />
          )}
          {error ? <Text style={S.error}>{error}</Text> : null}
          {!sent ? (
            <Btn label={t("Email me a code", "Enviarme un código")} icon="mail-outline" onPress={sendCode} busy={busy} color={C.emerald} />
          ) : (
            <>
              <Btn label={t("Sign in", "Iniciar sesión")} onPress={verify} busy={busy} disabled={code.length !== 6} color={C.emerald} />
              <View style={{ alignItems: "center" }}>
                <LinkBtn
                  label={t("Use a different email", "Usar otro correo")}
                  onPress={() => {
                    setSent(false);
                    setCode("");
                    setError("");
                  }}
                />
              </View>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
