"use server";

import { CONTACT_LIMITS, CONTACT_TOPICS, isContactTopic, type ContactState } from "@/lib/contactForm";
import { ADMIN_EMAIL, sendEmail } from "@/lib/email";
import { t, type PublicLang } from "@/lib/publicLang";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * Contact form (/contact and /es/contacto): emails the team through Resend
 * (src/lib/email.ts) at ADMIN_NOTIFY_EMAIL, with the traveller's address as
 * reply-to. Nothing is stored, and the message is never logged.
 */
export async function sendContactMessage(_prev: ContactState, fd: FormData): Promise<ContactState> {
  const lang: PublicLang = fd.get("lang") === "es" ? "es" : "en";
  const str = (k: string) => String(fd.get(k) ?? "").trim();

  // Honeypot: people never see this field; bots fill it. Pretend it worked.
  if (str("website")) return { ok: true };

  const name = str("name");
  const email = str("email");
  const topic = str("topic");
  const message = str("message");

  if (!name || name.length > CONTACT_LIMITS.name) {
    return { error: t(lang, "Please enter your name.", "Por favor escriba su nombre.") };
  }
  if (email.length > CONTACT_LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { error: t(lang, "Please enter a valid email address.", "Por favor escriba un correo válido.") };
  }
  if (!isContactTopic(topic)) {
    return { error: t(lang, "Please choose a topic.", "Por favor elija un tema.") };
  }
  if (message.length < CONTACT_LIMITS.minMessage || message.length > CONTACT_LIMITS.message) {
    return {
      error: t(
        lang,
        `Please write a message between ${CONTACT_LIMITS.minMessage} and ${CONTACT_LIMITS.message} characters.`,
        `Por favor escriba un mensaje de entre ${CONTACT_LIMITS.minMessage} y ${CONTACT_LIMITS.message} caracteres.`,
      ),
    };
  }

  const unavailable = t(
    lang,
    `Sorry, the form isn't working right now. Please message us on WhatsApp or email ${CONTACT_EMAIL}.`,
    `Lo sentimos, el formulario no está funcionando en este momento. Escríbanos por WhatsApp o a ${CONTACT_EMAIL}.`,
  );
  if (!process.env.RESEND_API_KEY || !ADMIN_EMAIL) return { error: unavailable };

  const topicLabel = CONTACT_TOPICS.find((x) => x.id === topic)!.label.en;
  const sent = await sendEmail({
    to: ADMIN_EMAIL,
    // No personal data in the subject: sendEmail logs subjects when something fails.
    subject: `Website contact form: ${topicLabel}`,
    replyTo: email,
    lines: [
      `Topic: ${topicLabel}`,
      `Name: ${name}`,
      `Email: ${email}`,
      `Page language: ${lang === "es" ? "Spanish" : "English"}`,
      "Message:",
      ...message.split(/\n{2,}/),
      "Reply to this email to answer the traveller.",
    ],
  });
  return sent ? { ok: true } : { error: unavailable };
}
