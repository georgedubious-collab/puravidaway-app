import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SITE_URL } from "../config";
import { useT } from "../i18n";
import { C, S } from "../theme";
import { Btn, Card, Divider } from "../ui";

/** Answers to what drivers ask most, as [Spanish, English]. Keep in line with how the app actually works. */
const FAQ: { q: [string, string]; a: [string, string] }[] = [
  {
    q: ["¿Cómo consigo viajes?", "How do I get trips?"],
    a: [
      "Los trabajos disponibles aparecen en Ofertas (menú ☰) y le llega una notificación por cada uno nuevo. Cada trabajo muestra un pago sugerido. Envíe una oferta por ese monto o por el suyo, y nuestro equipo elige un conductor. Le avisamos si el viaje es suyo; luego aparece en Próximos viajes.",
      "Open jobs appear under Offers (☰ menu) and you get a notification for each new one. Each job shows a suggested payout. Send an offer at that amount or your own, and our team picks a driver. You're notified if the trip is yours; it then appears under Upcoming trips.",
    ],
  },
  {
    q: ["¿A quién eligen para un trabajo?", "Who gets chosen for a job?"],
    a: [
      "Nuestro equipo mira primero a los conductores que ya tienen un viaje que termina cerca de la recogida ese día, luego las calificaciones, luego a los conductores con base cerca de la recogida y luego la oferta. Mantener una buena calificación e indicar dónde está su base (menú ☰ → Documentos) le ayudan.",
      "Our team looks first at drivers who already have a trip ending near the pickup that day, then at ratings, then at drivers based near the pickup, then at the offer. Keeping your rating high and setting where you're based (☰ menu → Documents) both help.",
    ],
  },
  {
    q: ["¿Qué hago el día del viaje?", "What do I do on the day of a trip?"],
    a: [
      'Abra el viaje y toque "Voy en camino" cuando salga, "Cliente recogido" cuando todos estén en el carro y "Viaje terminado" en el destino. El viaje tiene botones de Waze y Google Maps para la recogida y el destino, y un chat con el cliente y nuestro equipo.',
      "Open the trip and tap \"I'm on my way\" when you set off, \"Client picked up\" when everyone is in the car, and \"Trip ended\" at the drop-off. The trip has Waze and Google Maps buttons for the pickup and the drop-off, and a chat with the traveller and our team.",
    ],
  },
  {
    q: ["¿Por qué la app comparte mi ubicación?", "Why does the app share my location?"],
    a: [
      'Desde 3 horas antes de una recogida (o desde que toca "Voy en camino") hasta que termina el viaje, su ubicación se comparte con nuestro equipo y con los clientes que usted lleva, para coordinar las recogidas y que todos sepan cuándo va a llegar. No se comparte nada en ningún otro momento, y solo se guarda su última posición. Puede dejar de compartir en Mi cuenta, pero a los conductores que lo hacen quizá no se les asignen viajes.',
      "From 3 hours before a pickup (or from when you tap \"I'm on my way\") until you end the trip, your location is shared with our team and with the travellers you're driving, so pickups can be coordinated and everyone knows when you'll arrive. Nothing is shared at any other time, and only your latest position is kept. You can stop sharing in My account, but drivers who do may not be assigned trips.",
    ],
  },
  {
    q: ["¿Cómo y cuándo me pagan?", "How and when am I paid?"],
    a: [
      'Cada viaje muestra su pago. En los viajes pagados en línea, nosotros le hacemos su pago. En los viajes en efectivo, usted cobra al cliente el monto que aparece como "Cobre en efectivo", se queda con su pago y nos entrega el resto. Liquidamos cada semana; Ganancias (menú ☰) muestra el saldo, sea a su favor o a favor nuestro.',
      'Each trip shows your payout. For trips paid online, we pay you your payout. For cash trips, you collect the amount shown as "Collect in cash" from the traveller, keep your payout and pass on the rest. We settle weekly; Earnings (☰ menu) shows the balance either way.',
    ],
  },
  {
    q: ["¿Cómo funcionan las calificaciones?", "How do ratings work?"],
    a: [
      "Después de cada viaje se le pide al cliente que lo califique de 1 a 5 estrellas. Una calificación con un comentario escrito cuenta doble. A los conductores mejor calificados se les ofrecen más viajes. Puede ver su calificación en Mi cuenta.",
      "After each trip the traveller is asked to rate you from 1 to 5 stars. A rating with a written comment counts double. Better-rated drivers are offered more trips. You can see your rating in My account.",
    ],
  },
  {
    q: ["Algunos días no puedo trabajar. ¿Qué hago?", "I can't work on some days. What do I do?"],
    a: [
      "Abra Disponibilidad (menú ☰) y toque esos días para bloquearlos. En los días bloqueados no verá ni recibirá trabajos. Un día con un viaje confirmado no se puede bloquear: contacte a soporte para que podamos reasignar el viaje.",
      "Open Availability (☰ menu) and tap those days to block them. You won't see or be sent jobs for blocked days. A day with a confirmed trip can't be blocked: contact support so we can reassign the trip.",
    ],
  },
  {
    q: ["No puedo hacer un viaje que ya tengo, o voy tarde.", "I can't do a trip I already have, or I'm running late."],
    a: [
      "Avísenos de inmediato por WhatsApp con el botón de abajo, y escriba en el chat del viaje para que el cliente sepa. Entre más pronto lo sepamos, más fácil es ayudar al cliente.",
      "Tell us immediately on WhatsApp using the button below, and write in the trip's chat so the traveller knows. The sooner we know, the easier it is to help the traveller.",
    ],
  },
  {
    q: ["¿Cómo renuevo un documento que está por vencer?", "How do I renew a document that is expiring?"],
    a: [
      "Vaya a Documentos (menú ☰), escriba la fecha nueva y tome una foto del documento nuevo (o elija un PDF). Reemplazar la licencia, la identificación, la hoja de delincuencia o un documento del vehículo pausa los trabajos nuevos hasta que nuestro equipo lo revise; los viajes que ya tiene no se ven afectados.",
      "Go to Documents (☰ menu), enter the new date and take a photo of the new document (or choose a PDF). Replacing a licence, ID, criminal record or vehicle document pauses new jobs until our team checks it; trips you already have are not affected.",
    ],
  },
  {
    q: ["¿Puedo compartir mi número de teléfono con los clientes?", "Can I share my phone number with travellers?"],
    a: [
      "Por favor no ponga números de teléfono, correos ni enlaces en el chat ni en su perfil. Los clientes reservan con nosotros, y nuestro equipo comparte los datos de contacto cuando un viaje lo necesita. Use el chat del viaje para hablar con su cliente.",
      "Please keep phone numbers, emails and links out of the chat and your profile. Travellers book through us, and our team shares contact details when a trip needs it. Use the trip's chat to talk to your traveller.",
    ],
  },
];

/** Help: common questions, then driver support by WhatsApp or email. */
export function Help({ demoSupport }: { /** Sample contacts for design previews; skips loading. */ demoSupport?: { whatsapp: string; email: string } }) {
  const { t } = useT();
  const [open, setOpen] = useState<number | null>(0);
  const [support, setSupport] = useState<{ whatsapp: string; email: string } | null>(demoSupport ?? null);

  useEffect(() => {
    if (demoSupport) return;
    void fetch(SITE_URL + "/api/v1/support")
      .then((r) => r.json() as Promise<{ whatsapp?: string; email?: string }>)
      .then((d) => setSupport({ whatsapp: d.whatsapp ?? "", email: d.email ?? "" }))
      .catch(() => setSupport({ whatsapp: "", email: "" }));
  }, [demoSupport]);

  return (
    <ScrollView style={S.screen} contentContainerStyle={S.pad}>
      <Text style={S.muted}>{t("Respuestas rápidas, y nuestro equipo cuando necesite a una persona.", "Quick answers, and our team when you need a person.")}</Text>
      <Card>
        <Text style={S.h2}>{t("Soporte para conductores", "Driver support")}</Text>
        <Text style={S.muted}>{t("Para cualquier urgencia el día de un viaje, use WhatsApp.", "For anything urgent on the day of a trip, use WhatsApp.")}</Text>
        {support?.whatsapp ? (
          <Btn
            label={t("Escribirnos por WhatsApp", "WhatsApp us")}
            icon="logo-whatsapp"
            onPress={() =>
              void Linking.openURL(
                "https://wa.me/" + support.whatsapp + "?text=" + encodeURIComponent(t("¡Hola! Soy conductor socio y necesito ayuda.", "Hi! I'm a partner driver and I need help.")),
              )
            }
            color="#128C7E"
          />
        ) : null}
        {support?.email ? (
          <Btn
            label={t("Escribirnos un correo", "Email us")}
            icon="mail-outline"
            alt
            onPress={() => void Linking.openURL("mailto:" + support.email + "?subject=" + encodeURIComponent(t("Soporte para conductores", "Driver support")))}
          />
        ) : null}
        {support?.email ? <Text style={[S.muted, { textAlign: "center" }]}>{support.email}</Text> : null}
        {support && !support.whatsapp && !support.email ? (
          <Text style={S.error}>{t("No se pudieron cargar los contactos de soporte. Revise su conexión.", "Support contacts couldn't be loaded. Check your connection.")}</Text>
        ) : null}
      </Card>
      <Text style={[S.label, { marginTop: 4 }]}>{t("Preguntas frecuentes", "Common questions")}</Text>
      <Card>
        {FAQ.map((f, i) => (
          <View key={f.q[1]}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open === i }}
              onPress={() => setOpen(open === i ? null : i)}
              style={({ pressed }) => ({ paddingVertical: 12, gap: 8, opacity: pressed ? 0.6 : 1 })}
            >
              <View style={S.row}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: C.text, flex: 1 }}>{t(...f.q)}</Text>
                <Ionicons name={open === i ? "chevron-up" : "chevron-down"} size={18} color={C.faint} />
              </View>
              {open === i ? <Text style={S.text}>{t(...f.a)}</Text> : null}
            </Pressable>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}
