import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT, type Lang } from "../i18n";
import { supabase } from "../supabase";
import { C, R, S } from "../theme";
import { Btn, LinkBtn } from "../ui";

/** Sign in, or start as a new driver, with an emailed 6-digit code. No passwords. */
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
    if (!/^\S+@\S+\.\S+$/.test(e)) return setError(t("Escriba su correo electrónico.", "Enter your email address."));
    setBusy(true);
    setError("");
    // New drivers can start here too: a first sign-in creates the account, then they apply in the app.
    const { error: err } = await supabase.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } });
    setBusy(false);
    if (err)
      return setError(
        t(
          "No pudimos enviar un código a ese correo. Revise la dirección e intente de nuevo en un minuto.",
          "We couldn't send a code to that email. Check the address and try again in a minute.",
        ),
      );
    setSent(true);
  }

  async function verify() {
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
    setBusy(false);
    if (err) setError(t("Ese código no funcionó. Revíselo o pida uno nuevo.", "That code didn't work. Check it, or send a new one."));
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[S.screen, { backgroundColor: C.emeraldDark }]}>
      <View style={{ position: "absolute", top: 0, right: 0, paddingTop: insets.top + 12, paddingRight: 20, zIndex: 1 }}>
        <LangToggle />
      </View>
      <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 24 }}>
        <View style={{ gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.emeraldBright, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="car-sport" size={32} color="#fff" />
          </View>
          <Text style={{ color: "#fff", fontSize: 30, lineHeight: 34, fontWeight: "800", letterSpacing: -0.6 }}>
            Costa Rica{"\n"}Private Transfers
          </Text>
          <View style={{ alignSelf: "flex-start", backgroundColor: "#FBBF24", borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ color: C.emeraldDark, fontWeight: "800", fontSize: 12, letterSpacing: 1 }}>{t("APP PARA SOCIOS", "PARTNER APP")}</Text>
          </View>
        </View>
        <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 20, gap: 12 }}>
          <Text style={S.h2}>{sent ? t("Escriba su código", "Enter your code") : t("Iniciar sesión", "Sign in")}</Text>
          <Text style={S.muted}>
            {sent
              ? t("Le enviamos un código de 6 dígitos a ", "We emailed a 6-digit code to ") + email.trim().toLowerCase() + "."
              : t(
                  "Le enviaremos un código de 6 dígitos por correo. No necesita contraseña. ¿Es nuevo? Use su correo para postularse como conductor.",
                  "We'll email you a 6-digit code. No password needed. New here? Use your email to apply as a driver.",
                )}
          </Text>
          {!sent ? (
            <TextInput
              accessibilityLabel={t("Correo electrónico", "Email")}
              value={email}
              onChangeText={setEmail}
              placeholder={t("usted@ejemplo.com", "you@example.com")}
              placeholderTextColor={C.faint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              style={S.input}
            />
          ) : (
            <TextInput
              accessibilityLabel={t("Código de 6 dígitos", "6-digit code")}
              value={code}
              onChangeText={(x) => setCode(x.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              placeholderTextColor={C.faint}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              style={[S.input, { letterSpacing: 8, fontSize: 24, fontWeight: "800", textAlign: "center" }]}
            />
          )}
          {error ? <Text style={S.error}>{error}</Text> : null}
          {!sent ? (
            <Btn label={t("Enviarme un código", "Email me a code")} icon="mail-outline" onPress={sendCode} busy={busy} color={C.emerald} />
          ) : (
            <>
              <Btn label={t("Iniciar sesión", "Sign in")} onPress={verify} busy={busy} disabled={code.length !== 6} color={C.emerald} />
              <View style={{ alignItems: "center" }}>
                <LinkBtn
                  label={t("Usar otro correo", "Use a different email")}
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

/** "ES | EN" pill on the dark sign-in background, so a driver can switch before signing in. */
function LangToggle() {
  const { lang, setLang } = useT();
  const opt = (l: Lang, label: string, a11y: string) => {
    const on = lang === l;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={a11y}
        accessibilityState={{ selected: on }}
        onPress={() => setLang(l)}
        hitSlop={6}
        style={{ minWidth: 44, minHeight: 32, paddingHorizontal: 12, borderRadius: R.pill, alignItems: "center", justifyContent: "center", backgroundColor: on ? "#fff" : "transparent" }}
      >
        <Text style={{ fontWeight: "800", fontSize: 13, letterSpacing: 0.5, color: on ? C.emeraldDark : "#D1FAE5" }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", padding: 3, borderRadius: R.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" }}>
      {opt("es", "ES", "Español")}
      {opt("en", "EN", "English")}
    </View>
  );
}
