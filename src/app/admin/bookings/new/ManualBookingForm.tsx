"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Card, btn, field, link } from "@/components/admin/ui";
import { stopFitsRoute, type HubId } from "@/lib/catalog";
import { DEFAULT_PICKUP_TIME, PICKUP_TIMES, formatTime12h } from "@/lib/dates";
import { SIGN_MAX } from "@/lib/sign";
import { makeT, type TeamLang } from "@/lib/teamLang";
import { createTeamBooking, quoteForTeam, type TeamQuote } from "./actions";
import { PlacePicker } from "@/components/admin/PlacePicker";
import { PublicLangProvider } from "@/components/PublicLangContext";
import { hubPlace, placeSpecFields, type RidePlace } from "@/lib/places";

interface Props {
  lang: TeamLang;
  today: string;
  hubs: { id: HubId; name: string }[];
  vehicles: { id: string; name: string; maxPax: number; allowsStops: boolean }[];
  stops: { id: string; name: string; corridors: string[] }[];
  tours: { id: string; name: string }[];
  cashFeeBps: number;
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const int = (v: FormDataEntryValue | null) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * The manual booking form. "Calcular precio" asks the server for the website's price; "Crear
 * reserva" asks to confirm, then saves it through the website's own request path.
 */
export function ManualBookingForm({ lang, today, hubs, vehicles, stops, tours }: Props) {
  const t = makeT(lang);
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<"transfer" | "day_tour">("transfer");
  // Any place, like the website (Jorge, 2026-11-12): our towns as quick picks, or a typed hotel /
  // address found with the website's own place search (Google, through /api/places/*).
  const [originPlace, setOriginPlace] = useState<RidePlace>(hubPlace(hubs[0]?.id ?? "SJO"));
  const [destPlace, setDestPlace] = useState<RidePlace>(hubPlace(hubs[2]?.id ?? hubs[1]?.id ?? "Arenal"));
  const origin: HubId = originPlace.hub;
  const destination: HubId = destPlace.hub;
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const [quote, setQuote] = useState<TeamQuote | null>(null);
  const [asking, setAsking] = useState<null | { email: string; emailTraveller: boolean }>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ refs: string[]; ids: string[] } | null>(null);
  const [pending, start] = useTransition();

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const routeStops = stops.filter((s) => vehicle?.allowsStops && stopFitsRoute(s, origin, destination));

  function read() {
    const fd = new FormData(formRef.current!);
    const date = String(fd.get("date") ?? "");
    const pax = int(fd.get("pax")) ?? 1;
    const spec =
      kind === "transfer"
        ? {
            kind: "transfer",
            ...placeSpecFields(originPlace, destPlace),
            vehicleId,
            stopIds: fd.getAll("stopIds").map(String),
            pax,
            pickupTime: String(fd.get("pickupTime") ?? DEFAULT_PICKUP_TIME),
            pricing: "fixed",
            ...(String(fd.get("notes") ?? "").trim() ? { notes: String(fd.get("notes")).trim() } : {}),
            ...(String(fd.get("driverNotes") ?? "").trim() ? { driverNotes: String(fd.get("driverNotes")).trim() } : {}),
            ...(int(fd.get("bags")) !== undefined ? { bags: int(fd.get("bags")) } : {}),
            ...(int(fd.get("carryOns")) !== undefined ? { carryOns: int(fd.get("carryOns")) } : {}),
            ...(String(fd.get("signText") ?? "").trim() ? { signText: String(fd.get("signText")).trim() } : {}),
            ...(fd.get("signHideName") === "on" ? { signHideName: true } : {}),
          }
        : {
            kind: "day_tour",
            tourId: String(fd.get("tourId") ?? ""),
            upgrade: fd.get("upgrade") === "on",
            pax,
            ...(String(fd.get("pickupPlace") ?? "").trim() ? { pickupPlace: String(fd.get("pickupPlace")).trim() } : {}),
          };
    return {
      spec,
      date,
      mode: String(fd.get("mode") ?? "full_100") as "full_100" | "cash_driver",
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      clientNotes: String(fd.get("clientNotes") ?? "").trim(),
      travellerLang: (fd.get("travellerLang") === "es" ? "es" : "en") as "es" | "en",
      emailTraveller: fd.get("emailTraveller") === "on",
      noSuggestions: fd.get("noSuggestions") === "on",
    };
  }

  function calculate() {
    setError(null);
    setAsking(null);
    const r = read();
    start(async () => setQuote(await quoteForTeam(r.spec, r.date, r.mode)));
  }

  function create() {
    if (!quote?.ok) return;
    const r = read();
    setError(null);
    start(async () => {
      const res = await createTeamBooking(
        {
          items: [{ id: "team-1", date: r.date, totalCents: quote.totalCents, spec: r.spec }],
          mode: r.mode,
          cashFeeBps: quote.cashFeeBps,
          name: r.name,
          email: r.email,
          phone: r.phone,
          notes: r.clientNotes,
          website: "",
          lang: r.travellerLang,
          noSuggestions: r.noSuggestions,
        },
        r.emailTraveller,
      );
      setAsking(null);
      if (res.ok) setDone({ refs: res.refs, ids: res.ids });
      else setError(res.error);
    });
  }

  if (done) {
    return (
      <Card>
        <div role="status" className="space-y-3">
          <p className="text-lg font-extrabold text-[#065F46]">{t("Reserva creada", "Booking created")}</p>
          <p className="text-sm text-[#33443C]">
            {done.refs.map((ref, i) => (
              <Link key={ref} href={done.ids[i] ? `/admin/bookings/${done.ids[i]}` : "/admin/bookings"} className={`font-mono ${link}`}>
                {ref}
              </Link>
            ))}{" "}
            · {t("Esperando pago. Ábrala para confirmarla, asignar un conductor y registrar el pago.", "Awaiting payment. Open it to confirm, assign a driver and record payment.")}
          </p>
          <div className="flex flex-wrap gap-2">
            {done.ids[0] && (
              <Link href={`/admin/bookings/${done.ids[0]}`} className={btn.primary}>
                {t("Abrir la reserva", "Open the booking")}
              </Link>
            )}
            <button type="button" onClick={() => window.location.reload()} className={btn.secondary}>
              {t("Ingresar otra", "Enter another")}
            </button>
          </div>
        </div>
      </Card>
    );
  }

  const total = quote?.ok ? quote.totalCents + quote.cashFeeCents : 0;

  return (
    <form
      ref={formRef}
      onChange={() => {
        setQuote(null);
        setAsking(null);
      }}
      onSubmit={(e) => e.preventDefault()}
      className="space-y-4"
    >
      <Card title={t("Viajero", "Traveller")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={field.label}>
            {t("Nombre completo", "Full name")}
            <input name="name" required maxLength={80} autoComplete="off" className={field.input} />
          </label>
          <label className={field.label}>
            {t("Correo", "Email")}
            <input name="email" type="email" required maxLength={120} autoComplete="off" className={field.input} />
            <span className={field.hint}>{t("Ahí llega el enlace privado del viaje.", "Their private trip link goes here.")}</span>
          </label>
          <label className={field.label}>
            WhatsApp
            <input name="phone" required maxLength={30} placeholder="+1 555 123 4567" className={field.input} />
          </label>
          <label className={field.label}>
            {t("Idioma del viajero", "Traveller's language")}
            <select name="travellerLang" defaultValue="en" className={field.input}>
              <option value="en">{t("Inglés", "English")}</option>
              <option value="es">{t("Español", "Spanish")}</option>
            </select>
          </label>
          <label className={`${field.label} sm:col-span-2`}>
            {t("Notas del viajero (opcional)", "Traveller's notes (optional)")}
            <textarea name="clientNotes" rows={2} maxLength={1000} className={field.textarea} />
          </label>
        </div>
      </Card>

      <Card title={t("Servicio", "Service")}>
        <fieldset className="mb-4 flex flex-wrap gap-2">
          <legend className="sr-only">{t("Tipo", "Type")}</legend>
          {(["transfer", "day_tour"] as const).map((k) => (
            <label key={k} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-bold ${kind === k ? "border-[#047857] bg-[#ECFDF5] text-[#065F46]" : "border-[#DCE3DF] bg-white"}`}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
              {k === "transfer" ? t("Traslado privado", "Private ride") : t("Tour de un día", "Day tour")}
            </label>
          ))}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className={field.label}>
            {t("Fecha", "Date")}
            <input name="date" type="date" required min={today} defaultValue={today} className={field.input} />
          </label>
          {kind === "transfer" ? (
            <>
              <label className={field.label}>
                {t("Hora de recogida (CR)", "Pickup time (CR)")}
                <select name="pickupTime" defaultValue={DEFAULT_PICKUP_TIME} className={field.input}>
                  {PICKUP_TIMES.map((h) => (
                    <option key={h} value={h}>
                      {formatTime12h(h, lang)}
                    </option>
                  ))}
                </select>
                <span className={field.hint}>{t("De noche se suma el recargo nocturno.", "Night hours add the night premium.")}</span>
              </label>
              <label className={field.label}>
                {t("Vehículo", "Vehicle")}
                <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={field.input}>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} · {t("hasta", "up to")} {v.maxPax}
                    </option>
                  ))}
                </select>
              </label>
              <label className={field.label}>
                {t("Viajeros", "Travellers")}
                <input name="pax" type="number" min={1} max={vehicle?.maxPax ?? 60} defaultValue={2} required className={field.input} />
              </label>
              <div className="grid gap-4 sm:col-span-2 lg:col-span-4 lg:grid-cols-2">
                <PublicLangProvider lang={lang}>
                  <PlacePicker
                    label={t("Recogida", "Pickup")}
                    value={originPlace}
                    hubs={hubs}
                    lang={lang}
                    onChange={(p) => {
                      setOriginPlace(p);
                      setQuote(null);
                    }}
                  />
                  <PlacePicker
                    label={t("Destino", "Drop-off")}
                    value={destPlace}
                    hubs={hubs}
                    lang={lang}
                    onChange={(p) => {
                      setDestPlace(p);
                      setQuote(null);
                    }}
                  />
                </PublicLangProvider>
              </div>
              <label className={field.label}>
                {t("Maletas grandes", "Large suitcases")}
                <input name="bags" type="number" min={0} max={20} className={field.input} />
              </label>
              <label className={field.label}>
                {t("Equipaje de mano", "Carry-ons")}
                <input name="carryOns" type="number" min={0} max={20} className={field.input} />
              </label>
              {routeStops.length > 0 && (
                <fieldset className="sm:col-span-2 lg:col-span-4">
                  <legend className={field.label}>{t("Paradas en el camino (opcional)", "Stops on the way (optional)")}</legend>
                  <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
                    {routeStops.map((s) => (
                      <label key={s.id} className="inline-flex min-h-10 items-center gap-2 text-sm">
                        <input type="checkbox" name="stopIds" value={s.id} /> {s.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <label className={`${field.label} sm:col-span-2`}>
                {t("Vuelo u hotel (opcional)", "Flight or hotel (optional)")}
                <input name="notes" maxLength={500} placeholder="AA 1234" className={field.input} />
              </label>
              <label className={`${field.label} sm:col-span-2`}>
                {t("Mensaje para el conductor (sin teléfonos ni correos)", "Message for the driver (no phone numbers or emails)")}
                <input name="driverNotes" maxLength={500} className={field.input} />
              </label>
              <label className={`${field.label} sm:col-span-2`}>
                {t("Rótulo de recogida (opcional)", "Name sign (optional)")}
                <input name="signText" maxLength={SIGN_MAX} className={field.input} />
                <span className={field.hint}>
                  {t("Vacío = nombre e inicial del apellido del viajero.", "Empty = the traveller's first name + last initial.")}
                </span>
              </label>
              <label className="flex items-center gap-2 self-center text-sm font-bold text-[#33443C] sm:col-span-2">
                <input type="checkbox" name="signHideName" className="h-5 w-5" /> {t("No mostrar su nombre (el rótulo lleva la marca)", "Don't show their name (the sign shows the brand)")}
              </label>
            </>
          ) : (
            <>
              <label className={`${field.label} sm:col-span-2`}>
                {t("Tour", "Tour")}
                <select name="tourId" defaultValue={tours[0]?.id} className={field.input}>
                  {tours.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={field.label}>
                {t("Viajeros", "Travellers")}
                <input name="pax" type="number" min={1} max={60} defaultValue={2} required className={field.input} />
              </label>
              <label className="flex items-center gap-2 self-end pb-3 text-sm font-bold text-[#33443C]">
                <input type="checkbox" name="upgrade" className="h-5 w-5" /> {t("Mejora en ruta", "En-route upgrade")}
              </label>
              <label className={`${field.label} sm:col-span-2`}>
                {t("Lugar de recogida (hotel o dirección)", "Pickup place (hotel or address)")}
                <input name="pickupPlace" maxLength={120} className={field.input} />
                <span className={field.hint}>
                  {t("Sin teléfonos, correos ni enlaces. El conductor lo ve en su viaje.", "No phone numbers, emails or links. The driver sees it on their trip.")}
                </span>
              </label>
            </>
          )}
        </div>
      </Card>

      <Card title={t("Pago y aviso", "Payment & notice")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className={field.label}>{t("Forma de pago", "Payment mode")}</legend>
            <div className="mt-1 space-y-1">
              <label className="flex min-h-10 items-center gap-2 text-sm">
                <input type="radio" name="mode" value="full_100" defaultChecked /> {t("En línea, pago completo (precio fijo)", "Online in full (fixed price)")}
              </label>
              <label className="flex min-h-10 items-center gap-2 text-sm">
                <input type="radio" name="mode" value="cash_driver" /> {t("Efectivo al conductor (+ cargo por reserva en efectivo)", "Cash to the driver (+ cash booking fee)")}
              </label>
            </div>
          </fieldset>
          <label className="flex items-start gap-2 text-sm font-bold text-[#33443C]">
            <input type="checkbox" name="emailTraveller" defaultChecked className="mt-0.5 h-5 w-5" />
            <span>
              {t("Enviar al viajero el enlace de su viaje por correo", "Email the traveller their trip link")}
              <span className={field.hint}>
                {t(
                  "El mismo correo que recibe con una solicitud del sitio, en su idioma. Desmárquelo si prefiere enviarlo usted por WhatsApp.",
                  "The same email they get with a website request, in their language. Untick it if you'd rather send it on WhatsApp yourself.",
                )}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm font-bold text-[#33443C]">
            <input type="checkbox" name="noSuggestions" className="mt-0.5 h-5 w-5" />
            <span>
              {t("El viajero no quiere sugerencias después del viaje", "The traveller doesn't want suggestions after the trip")}
              <span className={field.hint}>
                {t("No se le enviará el correo de “reserve su regreso”. Los correos de la reserva sí llegan.", "They won't get the “book your return” email. Booking emails still arrive.")}
              </span>
            </span>
          </label>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={calculate} disabled={pending} className={btn.secondary}>
            {pending && !quote ? t("Calculando…", "Working it out…") : t("Calcular precio", "Work out the price")}
          </button>
          {quote?.ok && (
            <p className="text-sm" aria-live="polite">
              <span className="text-2xl font-extrabold text-[#14231C]">{money(total)}</span>{" "}
              <span className="text-[#5F6F67]">
                {quote.cashFeeCents > 0 && `(${money(quote.totalCents)} + ${money(quote.cashFeeCents)} ${t("cargo por efectivo", "cash fee")}) `}
                {quote.nightCents > 0 && `· ${t("incluye", "includes")} ${money(quote.nightCents)} ${t("de recargo nocturno", "night premium")}`}
              </span>
            </p>
          )}
          {quote && !quote.ok && (
            <p role="alert" className="text-sm font-semibold text-[#B91C1C]">
              {quote.error}
            </p>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!quote?.ok || pending}
            onClick={() => {
              if (formRef.current?.reportValidity()) {
                const r = read();
                setAsking({ email: r.email, emailTraveller: r.emailTraveller });
              }
            }}
            className={btn.primary}
          >
            {t("Crear reserva", "Create booking")}
          </button>
          {!quote?.ok && <span className="text-xs text-[#5F6F67]">{t("Primero calcule el precio.", "Work out the price first.")}</span>}
          {error && (
            <p role="alert" className="text-sm font-semibold text-[#B91C1C]">
              {error}
            </p>
          )}
        </div>
        {asking && quote?.ok && (
          <div
            role="alertdialog"
            aria-label={t("Confirmar la reserva", "Confirm the booking")}
            onKeyDown={(e) => e.key === "Escape" && setAsking(null)}
            className="mt-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#78350F]"
          >
            <p className="font-extrabold text-[#14231C]">{t("Confirme, por favor", "Please confirm")}</p>
            <p className="mt-1">
              {t(
                `Se crea una reserva por ${money(total)} que queda «Esperando pago». ${asking.emailTraveller ? `El viajero recibe por correo el enlace de su viaje (${asking.email}).` : "No se envía nada al viajero."}`,
                `A booking for ${money(total)} is created as "Awaiting payment". ${asking.emailTraveller ? `The traveller is emailed their trip link (${asking.email}).` : "Nothing is sent to the traveller."}`,
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" autoFocus onClick={create} disabled={pending} className={btn.primary}>
                {pending ? t("Creando…", "Creating…") : t("Sí, crear la reserva", "Yes, create the booking")}
              </button>
              <button type="button" onClick={() => setAsking(null)} className={btn.secondary}>
                {t("No, volver", "No, go back")}
              </button>
            </div>
          </div>
        )}
      </Card>
    </form>
  );
}
