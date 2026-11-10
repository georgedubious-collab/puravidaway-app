import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";
import { supabase } from "../supabase";
import { C, R, S } from "../theme";
import { Btn, LinkBtn } from "../ui";

/** Sign in, or start as a new driver, with an emailed 6-digit code. No passwords. */
export function SignIn() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode() {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setError("Enter your email address.");
    setBusy(true);
    setError("");
    // New drivers can start here too: a first sign-in creates the account, then they apply in the app.
    const { error: err } = await supabase.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } });
    setBusy(false);
    if (err) return setError("We couldn't send a code to that email. Check the address and try again in a minute.");
    setSent(true);
  }

  async function verify() {
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
    setBusy(false);
    if (err) setError("That code didn't work. Check it, or send a new one.");
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[S.screen, { backgroundColor: C.emeraldDark }]}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 24 }}>
        <View style={{ gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.emeraldBright, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="car-sport" size={32} color="#fff" />
          </View>
          <Text style={{ color: "#fff", fontSize: 30, lineHeight: 34, fontWeight: "800", letterSpacing: -0.6 }}>
            Costa Rica{"\n"}Private Transfers
          </Text>
          <View style={{ alignSelf: "flex-start", backgroundColor: "#FBBF24", borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ color: C.emeraldDark, fontWeight: "800", fontSize: 12, letterSpacing: 1 }}>PARTNER APP</Text>
          </View>
        </View>
        <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 20, gap: 12 }}>
          <Text style={S.h2}>{sent ? "Enter your code" : "Sign in"}</Text>
          <Text style={S.muted}>
            {sent ? "We emailed a 6-digit code to " + email.trim().toLowerCase() + "." : "We'll email you a 6-digit code. No password needed. New here? Use your email to apply as a driver."}
          </Text>
          {!sent ? (
            <TextInput
              accessibilityLabel="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={C.faint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              style={S.input}
            />
          ) : (
            <TextInput
              accessibilityLabel="6-digit code"
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
            <Btn label="Email me a code" icon="mail-outline" onPress={sendCode} busy={busy} color={C.emerald} />
          ) : (
            <>
              <Btn label="Sign in" onPress={verify} busy={busy} disabled={code.length !== 6} color={C.emerald} />
              <View style={{ alignItems: "center" }}>
                <LinkBtn
                  label="Use a different email"
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
