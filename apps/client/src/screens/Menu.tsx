import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { View } from "react-native";
import { useT } from "../i18n";
import { Logo } from "../Logo";
import { goToTab, useNav } from "../nav";
import { useSession } from "../session";
import { C, R, SP, T } from "../theme";
import { Bar, Card, Divider, ListRow, Page, Text, type IconName } from "../ui";

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
        <Pledge icon="pricetag-outline" title={t("Fixed price before you pay", "Precio fijo antes de pagar")} text={t("For the whole car, taxes included.", "Por todo el vehículo, impuestos incluidos.")} />
        <Pledge icon="calendar-clear-outline" title={t("Free cancellation", "Cancelación gratis")} text={t("Up to 24 hours before pickup.", "Hasta 24 horas antes de la recogida.")} />
        <Pledge icon="shield-checkmark-outline" title={t("Drivers with documents checked", "Conductores con documentos verificados")} text={t("ID, licence and insurance reviewed by our team.", "Identificación, licencia y seguro revisados por nuestro equipo.")} />
        <Pledge icon="logo-whatsapp" title={t("WhatsApp support", "Soporte por WhatsApp")} text={t("Our team answers before and during your trip.", "Nuestro equipo le responde antes y durante su viaje.")} />
      </View>
    </Page>
  );
}

function Pledge({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={22} color={C.emerald} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={T.bodyStrong}>{title}</Text>
        <Text style={T.small}>{text}</Text>
      </View>
    </View>
  );
}
