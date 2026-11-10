import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";
import { supabase } from "../supabase";
import { C, S } from "../theme";
import { Btn } from "../ui";

/** Sign in with an emailed 6-digit code, using the email the trip was booked with. No passwords. */
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
      <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 14 }}>
        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800" }}>Costa Rica Private Transfers</Text>
        <Text style={{ color: "#A7F3D0", fontSize: 15 }}>
          {sent
            ? "We emailed you a 6-digit code. Enter it here."
            : "Sign in with the email you used for your trip request to see your trips, your driver and the chat."}
        </Text>
        {!sent ? (
          <TextInput
            accessibilityLabel="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
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
            placeholder="123456"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            style={[S.input, { letterSpacing: 6, fontSize: 22, textAlign: "center" }]}
          />
        )}
        {error ? <Text style={{ color: "#FCA5A5", fontWeight: "600" }}>{error}</Text> : null}
        {!sent ? (
          <Btn label="Email me a code" onPress={sendCode} busy={busy} color={C.emerald} />
        ) : (
          <>
            <Btn label="Sign in" onPress={verify} busy={busy} disabled={code.length !== 6} color={C.emerald} />
            <Btn
              label="Use a different email"
              alt
              onPress={() => {
                setSent(false);
                setCode("");
                setError("");
              }}
            />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
