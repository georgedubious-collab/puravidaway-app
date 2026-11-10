import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { useT } from "./i18n";
import { registerForPush, unregisterPush } from "./push";
import { supabase } from "./supabase";
import type { AppBooking, AppTrip } from "./types";

/**
 * Who is signed in on this phone (nobody, until an email is confirmed with a
 * code) and their trips. Lives above the navigator, so signing in half-way
 * through a booking changes nothing on screen except what this provides.
 */
interface SessionValue {
  /** The signed-in email, or null when nobody is signed in. */
  email: string | null;
  trips: AppTrip[];
  whatsapp: string;
  /** True while trips are being fetched (first load and refreshes). */
  loading: boolean;
  /** True once trips have been fetched at least once for this sign-in. */
  loaded: boolean;
  error: string;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionValue>({ email: null, trips: [], whatsapp: "", loading: false, loaded: true, error: "", reload: async () => {}, signOut: async () => {} });

export const useSession = () => useContext(Ctx);

/** Every booking with the trip it belongs to. */
export function allBookings(trips: AppTrip[]): { trip: AppTrip; booking: AppBooking }[] {
  return trips.flatMap((trip) => trip.bookings.map((booking) => ({ trip, booking })));
}

export const isPast = (status: string) => status === "completed" || status === "cancelled";

/** Upcoming first (on the road before anything else, then by date); used by My trips and the "next trip" card. */
export function upcomingBookings(trips: AppTrip[]) {
  const byDate = (a: { booking: AppBooking }, b: { booking: AppBooking }) => (a.booking.scheduledAt ?? "").localeCompare(b.booking.scheduledAt ?? "");
  return allBookings(trips)
    .filter((r) => !isPast(r.booking.status))
    .sort((a, b) => Number(b.booking.status === "in_progress") - Number(a.booking.status === "in_progress") || byDate(a, b));
}

export function SessionProvider({
  session,
  children,
  demo,
}: {
  session: Session | null;
  children: ReactNode;
  /** Sample data for design previews; skips the network. */
  demo?: { email: string | null; trips: AppTrip[]; whatsapp?: string; loading?: boolean };
}) {
  const { t } = useT();
  // Read inside load() without making it re-run (and re-register push) when the language changes.
  const tRef = useRef(t);
  tRef.current = t;
  const [trips, setTrips] = useState<AppTrip[]>(demo?.trips ?? []);
  const [whatsapp, setWhatsapp] = useState(demo?.whatsapp ?? "");
  const [loading, setLoading] = useState(demo ? Boolean(demo.loading) : Boolean(session));
  const [loaded, setLoaded] = useState(demo ? !demo.loading : !session);
  const [error, setError] = useState("");
  const signedIn = Boolean(session);
  const isDemo = Boolean(demo);

  const reload = useCallback(async () => {
    if (isDemo) return;
    if (!signedIn) {
      setTrips([]);
      setLoading(false);
      setLoaded(true);
      return;
    }
    setLoading(true);
    const res = await api<{ trips: AppTrip[]; whatsapp: string }>("/client/trips");
    setLoading(false);
    setLoaded(true);
    if (!res.ok || !res.data) return setError(res.error ?? tRef.current("Couldn't load your trips.", "No pudimos cargar sus viajes."));
    setError("");
    setTrips(res.data.trips);
    setWhatsapp(res.data.whatsapp ?? "");
  }, [signedIn, isDemo]);

  useEffect(() => {
    if (isDemo) return;
    if (signedIn) setLoaded(false);
    void reload();
    if (signedIn) void registerForPush();
  }, [reload, signedIn, isDemo]);

  const signOut = useCallback(async () => {
    if (isDemo) return;
    await unregisterPush();
    await supabase.auth.signOut();
  }, [isDemo]);

  const email = demo ? demo.email : session ? (session.user.email ?? "") : null;
  const value = useMemo<SessionValue>(() => ({ email, trips, whatsapp, loading, loaded, error, reload, signOut }), [email, trips, whatsapp, loading, loaded, error, reload, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
