import type { Metadata } from "next";
import { Navigation } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ActionForm";
import { ChatBox } from "@/components/ChatBox";
import { setTripStatus } from "../actions";
import { requireUser } from "@/lib/auth";
import { bagsForTeam } from "@/lib/bags";
import { bookingStatusLabel, serviceLabel, usd, type DriverTrip } from "@/lib/bookings";
import { bookedItemName } from "@/lib/catalog";
import { getCatalog } from "@/lib/catalogSource";
import { formatScheduledAt, formatTime12h, scheduledParts } from "@/lib/dates";
import { googleMapsUrl, navTarget, wazeUrl, type NavTarget } from "@/lib/navigation";
import { prefsSummary } from "@/lib/preferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT, type TeamLang } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { DriverHeader } from "../../DriverHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getTeamLang());
  return {
    title: `${t("Viaje", "Trip")} | Costa Rica Private Transfers ${t("Conductores", "Drivers")}`,
    robots: { index: false, follow: false },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function DriverTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ claimed?: string }>;
}) {
  return (
    <main className="flex-1 bg-slate-50">
      <DriverHeader />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Suspense fallback={<p className="text-sm font-semibold text-slate-500">Cargando… / Loading…</p>}>
          <Trip params={params} searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Trip({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ claimed?: string }> }) {
  const { id } = await params;
  const { claimed } = await searchParams;
  await requireUser(`/driver/trips/${id}`);
  if (!UUID.test(id)) notFound();
  const lang = await getTeamLang();
  const tt = makeT(lang);
  const step = steps(lang);
  const supabase = (await createSupabaseServerClient())!;
  // my_trips(): only this driver's trips, without the client's price (migration 0017).
  const [{ data: mine }, catalog] = await Promise.all([
    supabase.rpc("my_trips").then((r) => r as { data: DriverTrip[] | null }),
    getCatalog(),
  ]);
  const b = (mine ?? []).find((x) => x.id === id);
  if (!b) notFound();

  // The traveller's first name + last initial ("Emily R.", my_trips(), migration 0035).
  // Drivers never get the full name, phone or email (Jorge, 2026-11-10): they use the trip
  // chat, or call our team.
  // The name sign: one value decided by the database (pickup_sign(), migration 0040): the
  // traveller's own text, or our brand name if they chose no name, or the short name.
  const sign = b.sign_text || b.passenger_name || null;
  // Estimated arrival (server: pickup + drive time + stops); nothing when the drive time is unknown.
  const arrive = scheduledParts(b.arrive_at);
  // "4 grandes + 4 de mano"; older bookings have one number only.
  const bags = bagsForTeam(b.luggage_count, b.carry_on_count, lang);

  const name =
    b.service_type === "transfer"
      ? `${b.origin} → ${b.destination}`
      : (bookedItemName(catalog.dayTours, b.catalog_item_id, lang) ?? tt("Viaje", "Trip"));
  const stops = (b.sightseeing_stops ?? [])
    .map((s) => (s.id === "en_route_upgrade" ? "Smart En-Route Transfer" : (catalog.stops.find((x) => x.id === s.id)?.name ?? s.id)))
    .join(", ");
  const asked = prefsSummary(b.preferences, lang);
  // I'm on my way → Client picked up → Trip ended.
  const nextStep: keyof ReturnType<typeof steps> = b.status === "in_progress" ? "completed" : b.en_route_at ? "in_progress" : "en_route";
  const pickup = b.service_type === "transfer" ? navTarget(b.origin, b.origin_coords) : null;
  const dropoff = b.service_type === "transfer" ? navTarget(b.destination, b.destination_coords) : null;

  return (
    <div className="space-y-5">
      <Link href="/driver/trips" className="text-sm font-bold text-emerald-700 underline">
        ← {tt("Mis viajes", "Your trips")}
      </Link>
      {claimed === "1" && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          {tt(
            "Este viaje es suyo. Preséntese en el chat de abajo y confirme la hora de recogida.",
            "This ride is yours. Introduce yourself in the chat below and confirm the pickup time.",
          )}
        </p>
      )}
      {(b.status === "confirmed" || b.status === "in_progress") && (
        <section className="rounded-xl border-2 border-emerald-600 bg-white p-5">
          <h2 className="font-extrabold text-slate-900">{step[nextStep].title}</h2>
          <p className="mt-1 text-xs text-slate-500">{step[nextStep].help}</p>
          <ActionForm
            action={setTripStatus}
            lang={lang}
            submitLabel={step[nextStep].button}
            savedLabel={tt("Listo", "Done")}
            className="mt-3"
          >
            <input type="hidden" name="booking_id" value={b.id} />
            <input type="hidden" name="step" value={nextStep} />
          </ActionForm>
          {nextStep === "in_progress" && (
            <p className="mt-2 text-xs font-semibold text-emerald-700">
              {tt(
                "Va en camino. Nuestro equipo puede ver su avance en la aplicación.",
                "You're on your way. Our team can see your progress in the app.",
              )}
            </p>
          )}
        </section>
      )}
      <div>
        <p className="font-mono text-sm font-bold text-slate-500">{b.booking_ref}</p>
        <h1 className="text-2xl font-extrabold text-slate-900">{name}</h1>
        <p className="text-sm text-slate-600">
          {formatScheduledAt(b.scheduled_at, lang)} · {serviceLabel(b.service_type, lang)} · {bookingStatusLabel(b.status, lang)}
        </p>
      </div>

      {sign && (
        <section className="rounded-xl border-2 border-slate-900 bg-white p-4 text-center" aria-label={tt("Rótulo", "Sign")}>
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{tt("Rótulo", "Sign")}</p>
          <p className="mt-1 break-words text-3xl font-extrabold text-slate-900">{sign}</p>
          <p className="mt-1 text-xs text-slate-500">
            {tt("Escriba esto en el rótulo para recibir al cliente.", "Write this on the sign to meet the traveller.")}
          </p>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {b.driver_payout != null && <Item k={tt("Su pago", "Your payout")} v={usd(b.driver_payout)} />}
          {b.cash_to_collect != null && Number(b.cash_to_collect) > 0 && (
            <Item
              k={tt("Cobrar en efectivo", "Collect in cash")}
              v={tt(
                `${usd(b.cash_to_collect)} del cliente (usted se queda con su pago; el resto se liquida cada semana)`,
                `${usd(b.cash_to_collect)} from the traveller (you keep your payout; the rest is settled weekly)`,
              )}
            />
          )}
          <Item k={tt("Cliente", "Traveller")} v={b.passenger_name || "—"} />
          <Item
            k={tt("Contacto", "Contact")}
            v={tt("Por el chat del viaje (abajo) o llamando a nuestro equipo", "Through the trip chat (below) or by calling our team")}
          />
          {b.passenger_count && <Item k={tt("Pasajeros", "Passengers")} v={b.passenger_count} />}
          {bags != null && <Item k={tt("Maletas", "Bags")} v={bags} />}
          {arrive && <Item k={tt("Llegada aprox.", "Arrives approx.")} v={formatTime12h(arrive.time, lang)} />}
          {b.vehicle_class && (
            <Item k={tt("Tipo de vehículo", "Vehicle class")} v={catalog.vehicles.find((v) => v.id === b.vehicle_class)?.name ?? b.vehicle_class} />
          )}
          {stops && <Item k={tt("Paradas / extras", "Stops / extras")} v={stops} />}
          {asked.length > 0 && <Item k={tt("Solicitó", "Asked for")} v={asked.join(", ")} />}
          {b.flight_or_hotel_notes && <Item k={tt("Vuelo / hotel", "Flight / hotel")} v={b.flight_or_hotel_notes} />}
          {b.driver_notes && <Item k={tt("Mensaje para usted", "Message for you")} v={b.driver_notes} />}
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          {tt(
            "Las horas son hora de Costa Rica. El lugar exacto de recogida (y cualquier cambio de hora) se confirma en el chat de abajo.",
            "Times are Costa Rica time. The exact pickup place (and any time change) is confirmed in the chat below.",
          )}
        </p>
      </section>

      {(pickup || dropoff) && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-extrabold text-slate-900 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-emerald-600" aria-hidden /> {tt("Navegar", "Navigate")}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {tt("Abre la aplicación en su teléfono con el lugar ya puesto.", "Opens the app on your phone with the place filled in.")}
          </p>
          <div className="mt-3 space-y-4">
            {pickup && <NavRow title={tt("Hacia la recogida", "To the pickup")} t={pickup} lang={lang} />}
            {dropoff && (
              <NavRow
                title={tt("Hacia el destino (cuando sus clientes estén a bordo)", "To the drop-off (once your travellers are on board)")}
                t={dropoff}
                lang={lang}
              />
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-extrabold text-slate-900">{tt("Chat con el cliente", "Chat with the traveller")}</h2>
        <p className="mb-2 text-xs text-slate-500">
          {tt(
            "Nuestro equipo puede leer este chat. Los teléfonos, correos y enlaces se ocultan automáticamente.",
            "Our team can read this chat. Phone numbers, emails and links are hidden automatically.",
          )}
        </p>
        <ChatBox
          bookingId={b.id}
          viewer={{ kind: "staff" }}
          lang={lang}
          intro={tt(
            "Preséntese y confirme la hora y el lugar de recogida.",
            "Introduce yourself and confirm the pickup time and place.",
          )}
        />
      </section>
    </div>
  );
}

function steps(lang: TeamLang) {
  const t = makeT(lang);
  return {
    en_route: {
      title: t("¿Va saliendo hacia la recogida?", "Heading to the pickup?"),
      help: t(
        "Toque cuando salga (desde 6 horas antes de la hora de recogida). Al cliente se le avisa que va en camino y nuestro equipo sigue su llegada.",
        "Tap when you set off (from 6 hours before the pickup time). The traveller is told you're on the way and our team follows your arrival.",
      ),
      button: t("Voy en camino", "I'm on my way"),
    },
    in_progress: {
      title: t("Cuando sus clientes estén a bordo", "When your travellers are on board"),
      help: t("Toque en la recogida, cuando todos estén en el carro.", "Tap at the pickup, once everyone is in the car."),
      button: t("Cliente recogido", "Client picked up"),
    },
    completed: {
      title: t("Cuando haya dejado a sus clientes", "When you've dropped your travellers off"),
      help: t(
        "Toque en el destino. Se deja de compartir la ubicación, se le pide al cliente que califique el viaje y se registra su pago.",
        "Tap at the drop-off. Location sharing stops, the traveller is asked to rate the trip, and your payout is recorded.",
      ),
      button: t("Viaje terminado", "Trip ended"),
    },
  };
}

/** Spanish for the notes in src/lib/navigation.ts. */
const NOTE_ES: Record<string, string> = {
  "Drive to the Sierpe boat dock; the boat covers the last part to Drake Bay.":
    "Maneje hasta el muelle de Sierpe; el bote cubre el último tramo hasta Bahía Drake.",
};

function NavRow({ title, t, lang }: { title: string; t: NavTarget; lang: TeamLang }) {
  const btn =
    "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-extrabold transition";
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</p>
      <p className="text-sm font-semibold text-slate-900 break-words">{t.label}</p>
      {t.note && <p className="text-xs text-amber-800">{lang === "en" ? t.note : (NOTE_ES[t.note] ?? t.note)}</p>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <a href={wazeUrl(t)} target="_blank" rel="noopener noreferrer" className={`${btn} bg-sky-500 text-white hover:bg-sky-400`}>
          {lang === "en" ? "Open in Waze" : "Abrir en Waze"}
        </a>
        <a href={googleMapsUrl(t)} target="_blank" rel="noopener noreferrer" className={`${btn} border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50`}>
          Google Maps
        </a>
      </div>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string | number | null | undefined }) {
  return (
    <>
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-semibold text-slate-900 break-words">{v || v === 0 ? v : "—"}</dd>
    </>
  );
}
