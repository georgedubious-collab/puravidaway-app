import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Car, CheckCircle2, Compass, Languages, ShieldCheck } from "lucide-react";
import { ChatBox } from "@/components/ChatBox";
import { HtmlLang } from "@/components/site/HtmlLang";
import { CostaRicaFlag, UsFlag } from "@/components/site/LangSwitch";
import { LiveRefresh } from "@/components/LiveRefresh";
import { RateDriver } from "@/components/RateDriver";
import { rateDriver } from "./actions";
import { TRIP_TOKEN, bookingDue, serviceLabel, usd, type BookingRow, type BookingStatus } from "@/lib/bookings";
import { localizeCatalog, placeNameFor } from "@/lib/catalogEs";
import { getCatalog } from "@/lib/catalogSource";
import { formatScheduledAtFor } from "@/lib/dates";
import { englishLevelLabel, prefsSummary } from "@/lib/preferences";
import { parsePublicLang, t as pick, type PublicLang } from "@/lib/publicLang";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string | string[] }> };

/**
 * The page's language: the one the trip request was sent in (trips.language), unless
 * the traveller used the flag button on this page (?lang=en|es, this visit only;
 * emails keep following the trip's language).
 */
function pageLang(stored: unknown, asked: string | string[] | undefined): PublicLang {
  return asked === "en" || asked === "es" ? asked : parsePublicLang(stored);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { token } = await params;
  const db = TRIP_TOKEN.test(token) ? createSupabaseAdminClient() : null;
  const { data } = db ? await db.from("trips").select("language").eq("access_token", token).maybeSingle() : { data: null };
  const lang = pageLang(data?.language, (await searchParams).lang);
  return {
    title: pick(lang, "Your trip | Costa Rica Private Transfers", "Su viaje | Costa Rica Private Transfers"),
    robots: { index: false, follow: false },
  };
}

/** What travellers see for each status. */
const TRAVELLER_STATUS: Record<BookingStatus, string> = {
  pending_payment: "Request received · we're confirming availability",
  pending_bids: "Collecting driver offers",
  confirmed: "Confirmed",
  in_progress: "On the road",
  completed: "Completed",
  cancelled: "Cancelled",
};
const TRAVELLER_STATUS_ES: Record<BookingStatus, string> = {
  pending_payment: "Solicitud recibida · estamos confirmando la disponibilidad",
  pending_bids: "Recibiendo ofertas de conductores",
  confirmed: "Confirmado",
  in_progress: "En ruta",
  completed: "Completado",
  cancelled: "Cancelado",
};

interface DriverCard {
  firstName: string;
  bio: string | null;
  english: "fluent" | "basic" | null;
  ict: boolean;
  photo: string | null;
}
interface CarCard {
  name: string;
  color: string | null;
  plate: string | null;
  seats: number | null;
  offers: string[];
  photos: string[];
}

/**
 * Private trip page, reached by the link shown after sending a request and in
 * every email (a 64-character random code, kept in the server-only trips table). Shows each booking and, once a driver is
 * assigned, their profile and car photos. Read with the server key because
 * travellers don't have accounts; only safe, traveller-facing fields are shown.
 * Shown in the language the request was sent in (texts side by side: t("English", "Español")).
 */
export default async function TripPage({ params, searchParams }: Props) {
  await connection();
  const { token } = await params;
  if (!TRIP_TOKEN.test(token)) notFound();
  const db = createSupabaseAdminClient();
  if (!db) notFound();
  const { data: trip } = await db.from("trips").select("id, guest_name, language").eq("access_token", token).maybeSingle();
  if (!trip) notFound();
  const tripId = trip.id as string;
  const lang = pageLang(trip.language, (await searchParams).lang);
  const other: PublicLang = lang === "es" ? "en" : "es";
  const t = <T,>(en: T, es: T): T => pick(lang, en, es);

  const { data: bookings } = await db
    .from("bookings")
    .select("*")
    .eq("trip_id", tripId)
    .order("scheduled_at")
    .returns<BookingRow[]>();
  if (!bookings?.length) notFound();
  const catalog = localizeCatalog(await getCatalog(), lang);
  // Ratings already given (one per booking).
  const { data: reviews } = await db
    .from("driver_reviews")
    .select("booking_id, stars")
    .in("booking_id", bookings.map((b) => b.id));
  // Where each driver is, only while they share location for that booking (trip window).
  const { data: locs } = await db
    .from("driver_locations")
    .select("booking_id, lat, lng, recorded_at, eta_at, late_min")
    .in("booking_id", bookings.map((b) => b.id));
  type Loc = { booking_id: string; lat: number; lng: number; recorded_at: string; eta_at: string | null; late_min: number | null };
  const locationOf = (id: string) => (locs as Loc[] | null)?.find((l) => l.booking_id === id);
  const ratingOf = (id: string) => (reviews as { booking_id: string; stars: number }[] | null)?.find((r) => r.booking_id === id)?.stars;

  // Driver + car cards for confirmed bookings only.
  const assigned = bookings.filter(
    (b) => b.assigned_driver_id && b.assigned_vehicle_id && ["confirmed", "in_progress", "completed"].includes(b.status),
  );
  const driverIds = [...new Set(assigned.map((b) => b.assigned_driver_id!))];
  const vehicleIds = [...new Set(assigned.map((b) => b.assigned_vehicle_id!))];
  const [drivers, vehicles] = await Promise.all([
    driverIds.length
      ? db.from("drivers").select("id, bio, english_level, ict_permit_number, documents, profiles!drivers_id_fkey(full_name)").in("id", driverIds)
      : Promise.resolve({ data: [] as never[] }),
    vehicleIds.length
      ? db
          .from("driver_vehicles")
          .select("id, make_model, year, color, plate, passenger_capacity, has_wifi, child_seats, stroller_space, pet_friendly, photos")
          .in("id", vehicleIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  type DriverRow = {
    id: string;
    bio: string | null;
    english_level: "fluent" | "basic" | null;
    ict_permit_number: string | null;
    documents: Record<string, string>;
    profiles: { full_name: string | null } | null;
  };
  type VehicleRow = {
    id: string;
    make_model: string | null;
    year: number | null;
    color: string | null;
    plate: string | null;
    passenger_capacity: number | null;
    has_wifi: boolean;
    child_seats: number;
    stroller_space: boolean;
    pet_friendly: boolean;
    photos: string[];
  };
  const driverRows = (drivers.data ?? []) as unknown as DriverRow[];
  const vehicleRows = (vehicles.data ?? []) as unknown as VehicleRow[];

  // Only the driver's profile photo and the car photos are ever signed for travellers.
  const paths = [
    ...driverRows.map((d) => d.documents?.driver_photo).filter((p): p is string => Boolean(p)),
    ...vehicleRows.flatMap((v) => v.photos ?? []),
  ];
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data } = await db.storage.from("driver-kyc-docs").createSignedUrls(paths, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
  }
  const driverCard = (id: string | null): DriverCard | null => {
    const d = driverRows.find((x) => x.id === id);
    if (!d) return null;
    const photo = d.documents?.driver_photo;
    return {
      firstName: (d.profiles?.full_name ?? "").split(" ")[0] || t("Your driver", "Su conductor"),
      bio: d.bio,
      english: d.english_level,
      ict: Boolean(d.ict_permit_number),
      photo: photo ? (urls[photo] ?? null) : null,
    };
  };
  const carCard = (id: string | null): CarCard | null => {
    const v = vehicleRows.find((x) => x.id === id);
    if (!v) return null;
    return {
      name: [v.make_model, v.year].filter(Boolean).join(" ") || t("Vehicle", "Vehículo"),
      color: v.color,
      plate: v.plate,
      seats: v.passenger_capacity,
      offers: [
        v.has_wifi && "Wi-Fi",
        v.child_seats > 0 &&
          t(`${v.child_seats} child seat${v.child_seats > 1 ? "s" : ""}`, `${v.child_seats} asiento${v.child_seats > 1 ? "s" : ""} para niños`),
        v.stroller_space && t("Room for a stroller", "Espacio para un coche de bebé"),
        v.pet_friendly && t("Pets welcome", "Se aceptan mascotas"),
      ].filter((x): x is string => Boolean(x)),
      photos: (v.photos ?? []).map((p) => urls[p]).filter((u): u is string => Boolean(u)),
    };
  };

  const itemName = (b: BookingRow) =>
    b.service_type === "transfer"
      ? `${lang === "es" ? placeNameFor(b.origin, lang) : b.origin} → ${lang === "es" ? placeNameFor(b.destination, lang) : b.destination}`
      : ([...catalog.dayTours, ...catalog.expeditions].find((x) => x.id === b.catalog_item_id)?.name ?? t("Trip", "Viaje"));
  /** "Chat about this ride" / "Chat sobre este traslado". */
  const chatTitle = (type: string) =>
    t(
      `Chat about this ${serviceLabel(type, "en").toLowerCase()}`,
      `Chat sobre ${type === "transfer" ? "este traslado" : type === "day_tour" ? "este tour" : "esta expedición"}`,
    );

  return (
    <div className="flex-1 bg-slate-50" lang={lang}>
      {lang === "es" && <HtmlLang lang="es" />}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href={t("/", "/es")} className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-950 text-amber-400">
              <Compass className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">Costa Rica Private Transfers</span>
          </Link>
          <Link
            href={`/trip/${token}?lang=${other}`}
            hrefLang={other}
            lang={other}
            aria-label={other === "es" ? "Cambiar a español" : "Switch to English"}
            title={other === "es" ? "Español" : "English"}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-slate-300 px-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            {other === "es" ? <CostaRicaFlag /> : <UsFlag />}
            <span>{other === "es" ? "ES" : "EN"}</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {trip.guest_name
              ? t(`${String(trip.guest_name).split(" ")[0]}'s trip`, `Viaje de ${String(trip.guest_name).split(" ")[0]}`)
              : t("Your trip", "Su viaje")}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t(
              "Keep this page: your driver's profile and car photos appear here once each ride is confirmed.",
              "Guarde esta página: el perfil de su conductor y las fotos del vehículo aparecen aquí una vez confirmado cada traslado.",
            )}
          </p>
        </div>

        {(locs ?? []).length > 0 && <LiveRefresh seconds={20} />}
        {bookings.map((b) => {
          const driver = driverCard(b.assigned_driver_id);
          const car = carCard(b.assigned_vehicle_id);
          const asked = prefsSummary(b.preferences, lang);
          const showDriver = driver && car && ["confirmed", "in_progress", "completed"].includes(b.status);
          return (
            <section key={b.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-500">
                    {formatScheduledAtFor(b.scheduled_at, lang)} · {serviceLabel(b.service_type, lang)} ·{" "}
                    <span className="font-mono">{b.booking_ref}</span>
                  </p>
                  <h2 className="text-lg font-extrabold text-slate-900">{itemName(b)}</h2>
                  {asked.length > 0 && <p className="text-sm text-slate-600">{t("You asked for:", "Usted pidió:")} {asked.join(", ")}</p>}
                </div>
                <div className="text-right">
                  <p className="text-lg font-extrabold text-emerald-700">{usd(bookingDue(b))}</p>
                  <p className="text-xs text-slate-500">
                    {b.payment_mode === "cash_driver"
                      ? t(
                          `Cash to your driver · incl. ${usd(b.cash_fee ?? 0)} cash booking fee`,
                          `Efectivo al conductor · incluye ${usd(b.cash_fee ?? 0)} de cargo por reserva en efectivo`,
                        )
                      : t(
                          "Online in full · secure payment link once confirmed",
                          "En línea, pago completo · enlace de pago seguro una vez confirmado",
                        )}
                  </p>
                  <p className={`text-xs font-bold ${b.status === "confirmed" ? "text-emerald-700" : "text-slate-500"}`}>
                    {(lang === "es" ? TRAVELLER_STATUS_ES : TRAVELLER_STATUS)[b.status]}
                  </p>
                </div>
              </div>

              {showDriver ? (
                <div className="grid gap-4 rounded-xl bg-emerald-50 p-4 sm:grid-cols-[96px_1fr]">
                  {driver.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived private link
                    <img src={driver.photo} alt={t(`${driver.firstName}, your driver`, `${driver.firstName}, su conductor`)} className="h-24 w-24 rounded-full object-cover" />
                  ) : (
                    <div className="h-24 w-24 rounded-full bg-emerald-200" />
                  )}
                  <div>
                    <p className="flex items-center gap-1.5 font-extrabold text-emerald-950">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {t(`${driver.firstName} is your driver`, `${driver.firstName} es su conductor`)}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-2 text-xs font-bold">
                      {driver.english && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-emerald-900">
                          <Languages className="h-3.5 w-3.5" /> {englishLevelLabel(driver.english, lang)}
                        </span>
                      )}
                      {driver.ict && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-emerald-900">
                          <ShieldCheck className="h-3.5 w-3.5" /> {t("ICT tourist-transport permit", "Permiso de transporte turístico del ICT")}
                        </span>
                      )}
                    </p>
                    {driver.bio && <p className="mt-2 whitespace-pre-line text-sm text-emerald-950">{driver.bio}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <p className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-950">
                      <Car className="h-4 w-4" /> {car.name}
                      {car.color && <span className="font-semibold">· {car.color}</span>}
                      {car.plate && <span className="rounded bg-white px-1.5 font-mono text-xs">{car.plate}</span>}
                    </p>
                    {(car.offers.length > 0 || car.seats) && (
                      <p className="mt-1 text-xs text-emerald-900">
                        {[car.seats && t(`${car.seats} passenger seats`, `${car.seats} asientos para pasajeros`), ...car.offers].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {car.photos.length > 0 && (
                      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {car.photos.map((u) => (
                          <li key={u}>
                            <a href={u} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived private link */}
                              <img src={u} alt={`${car.name}`} className="aspect-square w-full rounded-lg object-cover" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                b.status !== "cancelled" && (
                  <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    {t(
                      "We're matching you with a hand-picked local driver. Their profile and car photos will show here.",
                      "Le estamos asignando un conductor local elegido por nuestro equipo. Su perfil y las fotos del vehículo aparecerán aquí.",
                    )}
                  </p>
                )
              )}

              {showDriver && locationOf(b.id) && (b.status === "confirmed" || b.status === "in_progress") && (
                <div className="rounded-xl border border-emerald-200 bg-white p-4">
                  <p className="text-sm font-extrabold text-slate-900">
                    {b.status === "in_progress"
                      ? t("You're on the road", "Usted va en ruta")
                      : t(`Where ${driver.firstName} is now`, `Dónde está ${driver.firstName} ahora`)}
                  </p>
                  {b.status === "confirmed" && locationOf(b.id)!.eta_at && (
                    <p className="text-sm text-slate-700">
                      {t(
                        `Arriving at your pickup around ${formatScheduledAtFor(locationOf(b.id)!.eta_at, "en").split(" · ").pop()} with current traffic.`,
                        `Llega a su recogida alrededor de las ${formatScheduledAtFor(locationOf(b.id)!.eta_at, "es").split(" · ").pop()} con el tráfico actual.`,
                      )}
                    </p>
                  )}
                  <iframe
                    title={t(`Map: ${driver.firstName}`, `Mapa: ${driver.firstName}`)}
                    className="mt-2 h-56 w-full rounded-lg border border-slate-200"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${locationOf(b.id)!.lng - 0.02},${locationOf(b.id)!.lat - 0.02},${locationOf(b.id)!.lng + 0.02},${locationOf(b.id)!.lat + 0.02}&layer=mapnik&marker=${locationOf(b.id)!.lat},${locationOf(b.id)!.lng}`}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {t(
                      "Updates by itself. Shown from 3 hours before your pickup until the trip ends.",
                      "Se actualiza sola. Se muestra desde 3 horas antes de su recogida hasta que termina el viaje.",
                    )}
                  </p>
                </div>
              )}

              {b.status === "completed" && driver && (
                ratingOf(b.id) ? (
                  <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
                    {t(
                      `You rated ${driver.firstName} ${ratingOf(b.id)} star${ratingOf(b.id) === 1 ? "" : "s"}. Thank you!`,
                      `Usted calificó a ${driver.firstName} con ${ratingOf(b.id)} estrella${ratingOf(b.id) === 1 ? "" : "s"}. ¡Gracias!`,
                    )}
                  </p>
                ) : (
                  <RateDriver action={rateDriver} token={token} bookingId={b.id} driverFirstName={driver.firstName} lang={lang} />
                )
              )}

              {b.status !== "cancelled" && (
                <div>
                  <h3 className="mb-2 text-sm font-extrabold text-slate-900">{chatTitle(b.service_type)}</h3>
                  <ChatBox
                    bookingId={b.id}
                    viewer={{ kind: "traveller", token }}
                    lang={lang}
                    intro={
                      showDriver
                        ? t(
                            `Questions for ${driver.firstName} or our team? Write here. We'll email you when someone replies.`,
                            `¿Preguntas para ${driver.firstName} o para nuestro equipo? Escriba aquí. Le avisaremos por correo cuando alguien responda.`,
                          )
                        : t(
                            "Questions about this booking? Write here. Our team replies here and we'll email you when we do.",
                            "¿Preguntas sobre esta reserva? Escriba aquí. Nuestro equipo responde aquí y le avisaremos por correo cuando lo haga.",
                          )
                    }
                  />
                </div>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
