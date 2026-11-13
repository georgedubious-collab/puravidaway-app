"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { PlacePicker } from "@/components/admin/PlacePicker";
import { Notice, btn, field } from "@/components/admin/ui";
import { PublicLangProvider } from "@/components/PublicLangContext";
import type { HubId } from "@/lib/catalog";
import { PICKUP_TIMES, formatTime12h } from "@/lib/dates";
import { hubPlace, type RidePlace } from "@/lib/places";
import { makeT, type TeamLang } from "@/lib/teamLang";
import { previewBookingEdit, saveBookingEdit, type EditPreview, type PreviewMoney } from "../editActions";

const EDIT_NOTES_MAX = 500;
const TOUR_PICKUP_MAX = 120;
const EDIT_FIELDS = ["date", "time", "notes", "driverNotes", "pickupPlace"];
const money = (v: number | null) => (v === null ? "—" : `$${v.toFixed(2)}`);

interface Props {
  bookingId: string;
  kind: "transfer" | "day_tour" | string;
  lang: TeamLang;
  today: string;
  hubs: { id: HubId; name: string }[];
  /** The stored ends (null = older ride without a map point: the team picks again). */
  origin: RidePlace | null;
  destination: RidePlace | null;
  date: string;
  time: string;
  notes: string;
  driverNotes: string;
  pickupPlace: string;
}

/**
 * "Cambiar recogida, destino y hora" (Jorge, 2026-11-12): the team edits where and when the trip
 * starts, sees what changes and the new route's price, chooses to keep the price (default) or use
 * the new one, and saves (with or without telling the traveller and the driver).
 */
export function EditTripCard(p: Props) {
  const t = makeT(p.lang);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const ride = p.kind === "transfer";
  const [origin, setOrigin] = useState<RidePlace>(p.origin ?? hubPlace(p.hubs[0]?.id ?? "SJO"));
  const [destination, setDestination] = useState<RidePlace>(p.destination ?? hubPlace(p.hubs[1]?.id ?? "Arenal"));
  const [preview, setPreview] = useState<EditPreview | null>(null);
  const [choice, setChoice] = useState<"keep" | "new">("keep");
  const [updatePayout, setUpdatePayout] = useState(false);
  const [notify, setNotify] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const times = PICKUP_TIMES.includes(p.time) ? PICKUP_TIMES : [...PICKUP_TIMES, p.time].sort();

  function reset() {
    setPreview(null);
    setAsking(false);
    setError(null);
    setSaved(false);
    setChoice("keep");
    setUpdatePayout(false);
  }

  function read() {
    const fd = new FormData(formRef.current!);
    return {
      date: String(fd.get("date") ?? ""),
      time: String(fd.get("time") ?? ""),
      ...(ride
        ? {
            origin: { id: origin.id, label: origin.label },
            destination: { id: destination.id, label: destination.label },
            notes: String(fd.get("notes") ?? ""),
            driverNotes: String(fd.get("driverNotes") ?? ""),
          }
        : { pickupPlace: String(fd.get("pickupPlace") ?? "") }),
    };
  }

  function review() {
    setError(null);
    setAsking(false);
    setSaved(false);
    const input = read();
    start(async () => setPreview(await previewBookingEdit(p.bookingId, input)));
  }

  const ok = preview?.ok ? preview : null;
  const newPrice = ok?.price.state === "new" ? ok.price : null;
  const chosen: PreviewMoney | null = newPrice && choice === "new" ? (updatePayout || !newPrice.offerAccepted ? newPrice.update : newPrice.keep) : null;

  function save() {
    if (!ok) return;
    const input = read();
    start(async () => {
      const r = await saveBookingEdit(p.bookingId, input, {
        priceChoice: chosen ? "new" : "keep",
        updatePayout,
        expectedTotal: chosen ? chosen.total_price : null,
        notify,
      });
      setAsking(false);
      if (r.ok) {
        setSaved(true);
        setPreview(null);
        router.refresh();
      } else setError(r.error);
    });
  }

  const whoHears = ok
    ? [
        ok.notifies.traveller ? t("el viajero (correo, en su idioma)", "the traveller (email, in their language)") : "",
        ok.notifies.driver ? t("el conductor asignado (app y correo, sin datos ni precio del viajero)", "the assigned driver (app and email, without the traveller's details or price)") : "",
      ].filter(Boolean)
    : [];

  return (
    <form
      ref={formRef}
      // Only the trip fields reset the review (the price choice and "notify" boxes live below it).
      onChange={(e) => {
        if (EDIT_FIELDS.includes((e.target as unknown as { name?: string }).name ?? "")) reset();
      }}
      onSubmit={(e) => e.preventDefault()} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={field.label}>
          {t("Fecha de recogida", "Pickup date")}
          <input name="date" type="date" required min={p.today} defaultValue={p.date} className={field.input} />
        </label>
        <label className={field.label}>
          {t("Hora de recogida (Costa Rica)", "Pickup time (Costa Rica)")}
          <select name="time" defaultValue={p.time} className={field.input}>
            {times.map((h) => (
              <option key={h} value={h}>
                {formatTime12h(h, p.lang)}
              </option>
            ))}
          </select>
          {ride && <span className={field.hint}>{t("De 10 p. m. a 4 a. m. el precio nuevo incluye el recargo nocturno.", "From 10 PM to 4 AM the new price includes the night premium.")}</span>}
        </label>
      </div>

      {ride ? (
        <>
          {(!p.origin || !p.destination) && (
            <Notice tone="amber">
              {t(
                "Esta reserva antigua no tiene el punto en el mapa: elija otra vez la recogida y el destino.",
                "This older booking has no map point: pick the pickup and drop-off again.",
              )}
            </Notice>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <PublicLangProvider lang={p.lang}>
              <PlacePicker
                label={t("Recogida", "Pickup")}
                value={origin}
                hubs={p.hubs}
                lang={p.lang}
                onChange={(x) => {
                  setOrigin(x);
                  reset();
                }}
              />
              <PlacePicker
                label={t("Destino", "Drop-off")}
                value={destination}
                hubs={p.hubs}
                lang={p.lang}
                onChange={(x) => {
                  setDestination(x);
                  reset();
                }}
              />
            </PublicLangProvider>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={field.label}>
              {t("Vuelo, hotel o detalles de la recogida", "Flight, hotel or pickup details")}
              <input name="notes" maxLength={EDIT_NOTES_MAX} defaultValue={p.notes} placeholder={t("AA 1234 · lobby del hotel · portón 2", "AA 1234 · hotel lobby · gate 2")} className={field.input} />
            </label>
            <label className={field.label}>
              {t("Mensaje para el conductor", "Message for the driver")}
              <input name="driverNotes" maxLength={EDIT_NOTES_MAX} defaultValue={p.driverNotes} className={field.input} />
              <span className={field.hint}>{t("Sin teléfonos, correos ni enlaces: el conductor ve ambas notas.", "No phone numbers, emails or links: the driver sees both notes.")}</span>
            </label>
          </div>
        </>
      ) : (
        <label className={field.label}>
          {t("Lugar de recogida (hotel o dirección)", "Pickup place (hotel or address)")}
          <input name="pickupPlace" maxLength={TOUR_PICKUP_MAX} defaultValue={p.pickupPlace} className={field.input} />
          <span className={field.hint}>{t("Sin teléfonos, correos ni enlaces. El conductor lo ve en su viaje.", "No phone numbers, emails or links. The driver sees it on their trip.")}</span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={review} disabled={pending} className={btn.secondary}>
          {pending && !preview ? t("Revisando…", "Checking…") : t("Revisar cambios y precio", "Review changes and price")}
        </button>
        {saved && (
          <span role="status" className="text-sm font-bold text-[#065F46]">
            {t("Guardado. Queda en el historial.", "Saved. It's in the history.")}
          </span>
        )}
        {preview && !preview.ok && (
          <p role="alert" className="text-sm font-semibold text-[#B91C1C]">
            {preview.error}
          </p>
        )}
      </div>

      {ok && (
        <div aria-live="polite" className="space-y-4 rounded-xl border border-[#E3E8E5] bg-[#FAFBFA] p-4">
          <div>
            <p className="text-sm font-extrabold text-[#14231C]">{t("Qué cambia", "What changes")}</p>
            <ul className="mt-2 space-y-1.5 text-sm text-[#33443C]">
              {ok.changes.map((c) => (
                <li key={c.label} className="break-words">
                  <strong>{c.label}:</strong> <span className="text-[#5F6F67] line-through">{c.before}</span> → {c.after}
                </li>
              ))}
              {ok.driveMinutes.after !== ok.driveMinutes.before && ok.driveMinutes.after !== null && (
                <li>
                  <strong>{t("Tiempo de manejo", "Drive time")}:</strong> {ok.driveMinutes.before ?? "—"} → {ok.driveMinutes.after} min
                  {ok.routeKm !== null ? ` · ${ok.routeKm} km` : ""}
                </li>
              )}
            </ul>
          </div>

          <div className="text-sm">
            <p className="font-extrabold text-[#14231C]">{t("Precio", "Price")}</p>
            {ok.price.state === "unaffected" && <p className="mt-1 text-[#5F6F67]">{t("Este cambio no afecta el precio.", "This change doesn't affect the price.")}</p>}
            {ok.price.state === "same" && <p className="mt-1 text-[#5F6F67]">{t("El precio con el cambio es el mismo. No cambia nada de dinero.", "The price with the change is the same. No money changes.")}</p>}
            {ok.price.state === "error" && (
              <div className="mt-1">
                <Notice tone="amber">
                  {t("No se pudo calcular el precio nuevo", "Couldn't work out the new price")}: {ok.price.message}{" "}
                  <strong>{t("El precio no se cambiará.", "The price will not be changed.")}</strong>
                </Notice>
              </div>
            )}
            {newPrice && (
              <fieldset className="mt-2 space-y-2">
                <legend className="sr-only">{t("Qué precio usar", "Which price to use")}</legend>
                <label className="flex items-start gap-2">
                  <input type="radio" name="priceChoice" checked={choice === "keep"} onChange={() => setChoice("keep")} className="mt-1" />
                  <span>
                    <strong>{t("Mantener el precio", "Keep the price")}</strong> · {money(newPrice.before.total_price)} ·{" "}
                    {t("pago al conductor", "driver payout")} {money(newPrice.before.driver_payout)}
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="radio" name="priceChoice" checked={choice === "new"} onChange={() => setChoice("new")} className="mt-1" />
                  <span>
                    <strong>{t("Usar el precio nuevo", "Use the new price")}</strong> ·{" "}
                    {money((updatePayout || !newPrice.offerAccepted ? newPrice.update : newPrice.keep).total_price)} · {t("pago al conductor", "driver payout")}{" "}
                    {money((updatePayout || !newPrice.offerAccepted ? newPrice.update : newPrice.keep).driver_payout)} · {t("nos quedamos", "we keep")}{" "}
                    {money((updatePayout || !newPrice.offerAccepted ? newPrice.update : newPrice.keep).platform_fee)}
                    <span className={field.hint}>
                      {t(
                        "Mismos precios del sitio (temporada, recargo nocturno, ferris); comisión después de ferris y costos de la empresa; un código promocional se reparte mitad y mitad.",
                        "The website's own prices (season, night premium, ferries); commission after ferries and company costs; a promo code is split half and half.",
                      )}
                      {newPrice.update.night_premium > 0 ? ` ${t("Recargo nocturno", "Night premium")}: ${money(newPrice.update.night_premium)}.` : ""}
                      {newPrice.update.cash_fee > 0 ? ` ${t("Cargo por efectivo", "Cash fee")}: ${money(newPrice.update.cash_fee)}.` : ""}
                      {newPrice.update.promo_discount > 0 ? ` ${t("Descuento promocional", "Promo discount")}: −${money(newPrice.update.promo_discount)}.` : ""}
                    </span>
                  </span>
                </label>
                {newPrice.offerAccepted && choice === "new" && (
                  <label className="ml-6 flex items-start gap-2">
                    <input type="checkbox" checked={updatePayout} onChange={(e) => setUpdatePayout(e.target.checked)} className="mt-1 h-4 w-4" />
                    <span>
                      {t(
                        `Actualizar también el pago al conductor a ${money(newPrice.update.driver_payout)} (sin marcar, se mantiene la oferta aceptada de ${money(newPrice.keep.driver_payout)})`,
                        `Also update the driver's payout to ${money(newPrice.update.driver_payout)} (unticked, the accepted offer of ${money(newPrice.keep.driver_payout)} stays)`,
                      )}
                    </span>
                  </label>
                )}
              </fieldset>
            )}
          </div>

          {ok.warnings.map((w) => (
            <Notice key={w} tone="amber">
              {w}
            </Notice>
          ))}

          <label className="flex items-start gap-2 text-sm font-bold text-[#33443C]">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5 h-5 w-5" />
            <span>
              {t("Avisar del cambio", "Tell them about the change")}
              <span className={field.hint}>{whoHears.length ? whoHears.join(" · ") : t("No hay a quién avisar todavía.", "Nobody to tell yet.")}</span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setAsking(true)} disabled={pending} className={btn.primary}>
              {t("Guardar cambios", "Save changes")}
            </button>
            {error && (
              <p role="alert" className="text-sm font-semibold text-[#B91C1C]">
                {error}
              </p>
            )}
          </div>

          {asking && (
            <div
              role="alertdialog"
              aria-label={t("Confirmar el cambio", "Confirm the change")}
              onKeyDown={(e) => e.key === "Escape" && setAsking(false)}
              className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#78350F]"
            >
              <p className="font-extrabold text-[#14231C]">{t("Confirme, por favor", "Please confirm")}</p>
              <p className="mt-1">
                {chosen
                  ? t(`El precio pasa a ${money(chosen.total_price)} y el pago al conductor a ${money(chosen.driver_payout)}.`, `The price becomes ${money(chosen.total_price)} and the driver payout ${money(chosen.driver_payout)}.`)
                  : t("El precio y el pago al conductor no cambian.", "The price and the driver payout don't change.")}{" "}
                {notify && whoHears.length ? t(`Se avisa a: ${whoHears.join("; ")}.`, `Notified: ${whoHears.join("; ")}.`) : t("No se avisa a nadie.", "Nobody is notified.")}{" "}
                {t("Queda en el historial con su nombre.", "Recorded in the history with your name.")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" autoFocus onClick={save} disabled={pending} className={btn.primary}>
                  {pending ? t("Guardando…", "Saving…") : t("Sí, guardar", "Yes, save")}
                </button>
                <button type="button" onClick={() => setAsking(false)} className={btn.secondary}>
                  {t("No, volver", "No, go back")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
