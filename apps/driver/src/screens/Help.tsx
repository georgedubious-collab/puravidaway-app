import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SITE_URL } from "../config";
import { C, S } from "../theme";
import { Back, Btn, Card, Divider, ScreenTitle } from "../ui";

/** Answers to what drivers ask most. Keep in line with how the app actually works. */
const FAQ: { q: string; a: string }[] = [
  {
    q: "How do I get trips?",
    a: "Open jobs appear in the Jobs tab and you get a notification for each new one. Each job shows a suggested payout. Send an offer at that amount or your own, and our team picks a driver. You're notified if the trip is yours; it then appears under Trips.",
  },
  {
    q: "Who gets chosen for a job?",
    a: "Our team looks first at drivers who already have a trip ending near the pickup that day, then at ratings, then at drivers based near the pickup, then at the offer. Keeping your rating high and setting where you're based (Profile → Documents and vehicles) both help.",
  },
  {
    q: "What do I do on the day of a trip?",
    a: "Open the trip and tap \"I'm on my way\" when you set off, \"Client picked up\" when everyone is in the car, and \"Trip ended\" at the drop-off. The trip has Waze and Google Maps buttons for the pickup and the drop-off, and a chat with the traveller and our team.",
  },
  {
    q: "Why does the app share my location?",
    a: "From 3 hours before a pickup (or from when you tap \"I'm on my way\") until you end the trip, your location is shared with our team and with the travellers you're driving, so pickups can be coordinated and everyone knows when you'll arrive. Nothing is shared at any other time, and only your latest position is kept. You can stop sharing in Profile, but drivers who do may not be assigned trips.",
  },
  {
    q: "How and when am I paid?",
    a: "Each trip shows your payout. For trips paid online, we pay you your payout. For cash trips, you collect the amount shown as \"Collect in cash\" from the traveller, keep your payout and pass on the rest. We settle weekly; the Earnings tab shows the balance either way.",
  },
  {
    q: "How do ratings work?",
    a: "After each trip the traveller is asked to rate you from 1 to 5 stars. A rating with a written comment counts double. Better-rated drivers are offered more trips. You can see your rating in Profile.",
  },
  {
    q: "I can't work on some days. What do I do?",
    a: "Open the Calendar tab and tap those days to block them. You won't see or be sent jobs for blocked days. A day with a confirmed trip can't be blocked: contact support so we can reassign the trip.",
  },
  {
    q: "I can't do a trip I already have, or I'm running late.",
    a: "Tell us immediately on WhatsApp using the button below, and write in the trip's chat so the traveller knows. The sooner we know, the easier it is to help the traveller.",
  },
  {
    q: "How do I renew a document that is expiring?",
    a: "Go to Profile → Documents and vehicles, enter the new date and take a photo of the new document (or choose a PDF). Replacing a licence, ID, criminal record or vehicle document pauses new jobs until our team checks it; trips you already have are not affected.",
  },
  {
    q: "Can I share my phone number with travellers?",
    a: "Please keep phone numbers, emails and links out of the chat and your profile. Travellers book through us, and our team shares contact details when a trip needs it. Use the trip's chat to talk to your traveller.",
  },
];

/** Help: common questions, then driver support by WhatsApp or email. */
export function Help({ onBack, demoSupport }: { onBack: () => void; /** Sample contacts for design previews; skips loading. */ demoSupport?: { whatsapp: string; email: string } }) {
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
      <Back label="Profile" onPress={onBack} />
      <ScreenTitle title="Help" subtitle="Quick answers, and our team when you need a person." />
      <Card>
        <Text style={S.h2}>Driver support</Text>
        <Text style={S.muted}>For anything urgent on the day of a trip, use WhatsApp.</Text>
        {support?.whatsapp ? (
          <Btn
            label="WhatsApp us"
            icon="logo-whatsapp"
            onPress={() => void Linking.openURL("https://wa.me/" + support.whatsapp + "?text=" + encodeURIComponent("Hi! I'm a partner driver and I need help."))}
            color="#128C7E"
          />
        ) : null}
        {support?.email ? (
          <Btn label="Email us" icon="mail-outline" alt onPress={() => void Linking.openURL("mailto:" + support.email + "?subject=" + encodeURIComponent("Driver support"))} />
        ) : null}
        {support?.email ? <Text style={[S.muted, { textAlign: "center" }]}>{support.email}</Text> : null}
        {support && !support.whatsapp && !support.email ? <Text style={S.error}>Support contacts couldn&apos;t be loaded. Check your connection.</Text> : null}
      </Card>
      <Text style={[S.label, { marginTop: 4 }]}>Common questions</Text>
      <Card>
        {FAQ.map((f, i) => (
          <View key={f.q}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open === i }}
              onPress={() => setOpen(open === i ? null : i)}
              style={({ pressed }) => ({ paddingVertical: 12, gap: 8, opacity: pressed ? 0.6 : 1 })}
            >
              <View style={S.row}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: C.text, flex: 1 }}>{f.q}</Text>
                <Ionicons name={open === i ? "chevron-up" : "chevron-down"} size={18} color={C.faint} />
              </View>
              {open === i ? <Text style={S.text}>{f.a}</Text> : null}
            </Pressable>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}
