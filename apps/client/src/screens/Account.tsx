import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBooking } from "../booking";
import { SITE_URL } from "../config";
import { LangToggle, useT } from "../i18n";
import { LogoMark } from "../Logo";
import { goToTab } from "../nav";
import { useSession } from "../session";
import { C, S, SP, T } from "../theme";
import { Bar, Card, Divider, ListRow, ScreenTitle, Text } from "../ui";
import { SignInCard } from "./SignIn";

/** Who is signed in, how to reach us, the language, the policies, and sign out. */
export function Account() {
  const { lang, setLang, t } = useT();
  const insets = useSafeAreaInsets();
  const { email, whatsapp, signOut } = useSession();
  const { reset } = useBooking();

  async function out() {
    await signOut();
    reset();
    goToTab("Explore");
  }

  return (
    <ScrollView style={S.screen} contentContainerStyle={[S.pad, { paddingTop: insets.top + SP.lg }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets>
      <Bar style="dark" />
      <ScreenTitle title={t("Account", "Cuenta")} right={<LangToggle />} />
      {email === null ? (
        <SignInCard />
      ) : (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.emerald, alignItems: "center", justifyContent: "center" }}>
              <Text maxFontSizeMultiplier={1} style={{ color: "#fff", fontSize: 24, fontWeight: "700" }}>
                {(email[0] ?? "?").toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={T.caption}>{t("Signed in as", "Sesión iniciada como")}</Text>
              <Text style={T.h3} numberOfLines={1}>
                {email}
              </Text>
            </View>
          </View>
          <Text style={T.small}>{t("Your trips are found by this email. Use the same address when you send a trip request.", "Sus viajes se encuentran con este correo. Use la misma dirección cuando envíe una solicitud de viaje.")}</Text>
        </Card>
      )}
      <Card>
        <View>
          {whatsapp ? (
            <>
              <ListRow icon="logo-whatsapp" title={t("Message us on WhatsApp", "Escríbanos por WhatsApp")} detail={t("Questions before or during your trip", "Preguntas antes o durante su viaje")} onPress={() => void Linking.openURL("https://wa.me/" + whatsapp)} />
              <Divider />
            </>
          ) : null}
          <ListRow icon="language-outline" title="Language / Idioma" detail={lang === "es" ? "Español · toque para cambiar a inglés" : "English · tap to switch to Spanish"} onPress={() => setLang(lang === "es" ? "en" : "es")} />
        </View>
      </Card>
      <Card>
        <View>
          <ListRow icon="document-text-outline" title={t("Terms", "Términos")} onPress={() => void WebBrowser.openBrowserAsync(SITE_URL + "/terms")} />
          <Divider />
          <ListRow icon="lock-closed-outline" title={t("Privacy policy", "Política de privacidad")} onPress={() => void WebBrowser.openBrowserAsync(SITE_URL + "/privacy")} />
          <Divider />
          <ListRow icon="calendar-clear-outline" title={t("Cancellation policy", "Política de cancelación")} detail={t("Free up to 24 hours before pickup", "Gratis hasta 24 horas antes de la recogida")} onPress={() => void WebBrowser.openBrowserAsync(SITE_URL + "/cancellation")} />
        </View>
      </Card>
      {email !== null ? (
        <Card>
          <ListRow icon="log-out-outline" title={t("Sign out", "Cerrar sesión")} onPress={() => void out()} tone="red" />
        </Card>
      ) : null}
      <View style={{ alignItems: "center", gap: 6, paddingTop: SP.sm }}>
        <LogoMark size={40} />
        <Text style={T.caption}>Costa Rica Private Transfers</Text>
      </View>
    </ScrollView>
  );
}
