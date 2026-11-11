import * as Linking from "expo-linking";
import { View } from "react-native";
import { useT } from "../i18n";
import { Logo } from "../Logo";
import { goToTab, useNav } from "../nav";
import { useSession } from "../session";
import { C, R, SP, T } from "../theme";
import { Bar, Card, Divider, ListRow, Page, Text } from "../ui";
import { RidePromises } from "./Promises";

/** The panel behind the ☰ button on Explore: the other tabs, the language, how to reach us, and what every ride comes with. */
export function Menu() {
  const { lang, setLang, t } = useT();
  const nav = useNav();
  const { whatsapp } = useSession();

  function go(tab: "Trips" | "Account") {
    nav.goBack();
    goToTab(tab);
  }

  return (
    <Page>
      <Bar style="dark" />
      <Logo size={38} />
      <Card>
        <View>
          <ListRow icon="map-outline" title={t("My trips", "Mis viajes")} detail={t("Your rides and tours, your driver, the chat", "Sus traslados y tours, su conductor, el chat")} onPress={() => go("Trips")} />
          <Divider />
          <ListRow icon="person-circle-outline" title={t("Account", "Cuenta")} detail={t("Sign in, policies", "Iniciar sesión, políticas")} onPress={() => go("Account")} />
          <Divider />
          <ListRow icon="language-outline" title="Language / Idioma" detail={lang === "es" ? "Español · toque para cambiar a inglés" : "English · tap to switch to Spanish"} onPress={() => setLang(lang === "es" ? "en" : "es")} />
          {whatsapp ? (
            <>
              <Divider />
              <ListRow icon="logo-whatsapp" title={t("Message us on WhatsApp", "Escríbanos por WhatsApp")} detail={t("Questions before or during your trip", "Preguntas antes o durante su viaje")} onPress={() => void Linking.openURL("https://wa.me/" + whatsapp)} />
            </>
          ) : null}
        </View>
      </Card>

      <View style={{ backgroundColor: C.surface, borderRadius: R.card, padding: SP.lg, gap: SP.lg }}>
        <Text accessibilityRole="header" style={T.h3}>
          {t("Travel with peace of mind", "Viaje con tranquilidad")}
        </Text>
        <RidePromises />
      </View>
    </Page>
  );
}
