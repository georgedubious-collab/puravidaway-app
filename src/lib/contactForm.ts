/** Shared by the contact form (client) and its server action (src/app/contact/actions.ts). */
export const CONTACT_TOPICS = [
  { id: "trip", label: { en: "A question about a trip", es: "Una pregunta sobre un viaje" } },
  { id: "booking", label: { en: "An existing booking", es: "Una reserva existente" } },
  { id: "agents", label: { en: "Hotels & travel agents", es: "Hoteles y agencias de viaje" } },
  { id: "drivers", label: { en: "Drivers", es: "Conductores" } },
  { id: "other", label: { en: "Something else", es: "Otro tema" } },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["id"];

export function isContactTopic(v: unknown): v is ContactTopic {
  return CONTACT_TOPICS.some((x) => x.id === v);
}

export const CONTACT_LIMITS = { name: 100, email: 200, message: 4000, minMessage: 10 } as const;

export interface ContactState {
  ok?: boolean;
  error?: string;
}
