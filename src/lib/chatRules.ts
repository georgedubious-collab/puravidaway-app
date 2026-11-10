/**
 * When the trip chat is open (Jorge, 2026-11-10): from the request (the traveller and
 * our team) and from the driver's assignment (traveller and driver) until 48 hours
 * after the trip ends. After that it is read-only for travellers and drivers; our
 * team can always write. No server-only imports, so pages can use it too.
 */
export type ChatParty = "client" | "driver" | "admin";

export const CHAT_OPEN_AFTER_END_MS = 48 * 3600 * 1000;
/** Rides and day tours that were never marked completed are taken to end 12 hours after pickup. */
const DAY_TRIP_MS = 12 * 3600 * 1000;

export function tripEndsAt(a: { scheduledAt: string | null; completedAt: string | null; serviceType: string; expeditionDays?: number }): Date | null {
  if (a.completedAt) return new Date(a.completedAt);
  if (!a.scheduledAt) return null;
  const start = new Date(a.scheduledAt).getTime();
  if (Number.isNaN(start)) return null;
  const length = a.serviceType === "expedition" ? Math.max(1, a.expeditionDays ?? 1) * 24 * 3600 * 1000 : DAY_TRIP_MS;
  return new Date(start + length);
}

/** When the chat turns read-only, or null when the trip has no date yet. */
export function chatClosesAt(a: Parameters<typeof tripEndsAt>[0]): Date | null {
  const end = tripEndsAt(a);
  return end ? new Date(end.getTime() + CHAT_OPEN_AFTER_END_MS) : null;
}
