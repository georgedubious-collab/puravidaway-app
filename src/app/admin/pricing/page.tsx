import {
  AREA_FACTOR_BPS_DEFAULT,
  CASH_FEE_BPS_DEFAULT,
  ENTRANCE_ADMIN_LABEL,
  CRC_PER_USD_DEFAULT,
  EXTRA_AREAS,
  FERRY_FARES_DEFAULT,
  crcToCents,
  HUBS,
  REGION_NAMES,
  RIDE_FORMULA_DEFAULT,
  STOP_ENTRANCES,
  WAIT_PER_HOUR_CENTS_DEFAULT,
  stopPriceCents,
  type AreaId,
  type HubId,
  type Region,
} from "@/lib/catalog";
import { CUSTOM_STOP_LIMITS_DEFAULT } from "@/lib/customStops";
import { DRIVER_COMMISSION_BPS_DEFAULT } from "@/lib/payout";
import { formatUSD, nightPremiumCents, rideCents } from "@/lib/pricing";
import { NIGHT_PREMIUM_DEFAULT, hourLabel, nightPercent, nightPremiumOn, nightWindow, type NightPremium } from "@/lib/nightPremium";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeT } from "@/lib/teamLang";
import { getTeamLang } from "@/lib/teamLangServer";
import { AdminForm } from "./AdminForm";
import Link from "next/link";
import { PageHeader, SectionHeading } from "@/components/admin/ui";
import type { ConfirmRule } from "@/components/admin/AdminActionForm";
import {
  addSeasonRange,
  addStop,
  deleteSeasonRange,
  saveDayTour,
  saveAreaFactors,
  saveDriverCommission,
  saveNightPremium,
  saveWaitRate,
  saveCustomStopLimits,
  saveFerryFares,
  savePaymentSettings,
  saveRideFormula,
  saveSeason,
  saveStop,
  saveVehicle,
} from "./actions";

/* Row shapes as stored in the database (money is numeric dollars). */
interface Vehicle {
  id: string; name: string; max_pax: number; luggage: string; badge: string; active: boolean;
  /* From migration 0013; undefined until it is run. */
  price_factor?: number; extra_fee?: number; allows_stops?: boolean; spanish_speaking_driver?: boolean;
  /* From migration 0039; undefined until it is run. */
  example_models?: string | null;
}
interface Settings {
  cash_fee_bps: number;
  ride_base_fare?: number; ride_per_km?: number; ride_per_hour?: number; ride_minimum_fare?: number;
  ferry_vehicle_fare_crc?: number; ferry_passenger_fare_crc?: number; crc_per_usd?: number;
  driver_commission_bps?: number;
  wait_per_hour?: number;
  /* From migration 0057; undefined until it has run. */
  custom_stop_max?: number; custom_stop_max_wait_min?: number; custom_stop_max_detour_min?: number;
  /* From migration 0041; undefined until it has run. */
  night_premium_bps?: number; night_start_hour?: number; night_end_hour?: number;
}

/** Example routes shown under the formula so the effect of a change is visible. */
const EXAMPLES: [HubId, HubId][] = [
  ["LIR", "Tamarindo"], ["SJO", "Arenal"], ["SJO", "ManuelAntonio"], ["SJO", "Tamarindo"], ["Arenal", "Monteverde"], ["SJO", "Sierpe"],
];
interface Stop { id: string; name: string; description: string; duration_min: number; price: number | null; detour_km?: number; detour_min?: number; tour_price_pp?: number; park_fee_included: boolean; entrance?: string; corridors: string[]; active: boolean }
interface Tour { id: string; region: Region; name: string; duration_hours: number; price: number | null; price_pp_solo?: number; price_pp_small?: number; price_pp_group?: number; cost_pp?: number; en_route_upgrade_price: number; active: boolean }
interface Expedition { id: string; name: string; days: number; nights: number; base_price: number; active: boolean }
interface Tier { id: string; name: string; surcharge: number; active: boolean }
interface Season { id: string; name: string; multiplier: number; is_default: boolean }
interface Range { id: string; season_id: string; starts_on: string; ends_on: string; note: string | null }

const input = "min-h-10 w-full rounded-xl border border-[#DCE3DF] bg-white px-2.5 text-sm focus:border-[#047857] focus:outline-none focus:ring-2 focus:ring-[#047857]/20 disabled:bg-[#F1F4F2]";
const label = "block text-xs font-bold text-[#5F6F67]";

export default async function PricingPage() {
  await requireRole("admin", "/admin/pricing");
  const lang = await getTeamLang();
  const t = makeT(lang);
  const db = (await createSupabaseServerClient())!;
  const [v, s, tours, e, l, se, r, ps, hp] = await Promise.all([
    db.from("vehicle_classes").select("*").order("sort_order").returns<Vehicle[]>(),
    db.from("sightseeing_stops").select("*").order("sort_order").returns<Stop[]>(),
    db.from("day_tours").select("*").order("sort_order").returns<Tour[]>(),
    db.from("expeditions").select("*").order("sort_order").returns<Expedition[]>(),
    db.from("lodging_tiers").select("*").order("sort_order").returns<Tier[]>(),
    db.from("seasons").select("*").order("priority").returns<Season[]>(),
    db.from("season_ranges").select("*").order("starts_on").returns<Range[]>(),
    db.from("pricing_settings").select("*").maybeSingle<Settings>(),
    db.from("hub_pricing").select("hub_id, area_factor").returns<{ hub_id: AreaId; area_factor: number }[]>(),
  ]);
  const cashFeeBps = ps.data?.cash_fee_bps ?? CASH_FEE_BPS_DEFAULT;
  // Migration 0013 adds the formula columns and hub_pricing.
  const formulaReady = !hp.error && ps.data?.ride_base_fare !== undefined;
  const dollars = (c: number) => c / 100;
  const formula = {
    base: ps.data?.ride_base_fare ?? dollars(RIDE_FORMULA_DEFAULT.baseFareCents),
    perKm: ps.data?.ride_per_km ?? dollars(RIDE_FORMULA_DEFAULT.perKmCents),
    perHour: ps.data?.ride_per_hour ?? dollars(RIDE_FORMULA_DEFAULT.perHourCents),
    minimum: ps.data?.ride_minimum_fare ?? dollars(RIDE_FORMULA_DEFAULT.minimumFareCents),
  };
  // Migration 0015 adds the ferry fares and the Southern Nicoya area.
  const ferryReady = ps.data?.crc_per_usd !== undefined;
  const extraAreasReady = (hp.data ?? []).some((h) => h.hub_id === "SouthNicoya");
  const commissionBps = ps.data?.driver_commission_bps ?? DRIVER_COMMISSION_BPS_DEFAULT;
  // Migration 0021: stops priced from waiting time + detour.
  const stopsReady = ps.data?.wait_per_hour !== undefined;
  const waitPerHour = Number(ps.data?.wait_per_hour ?? WAIT_PER_HOUR_CENTS_DEFAULT / 100);
  const stopPrice = (x: Stop) =>
    stopsReady
      ? stopPriceCents(
          { durationMin: x.duration_min, detourKm: Number(x.detour_km ?? 0), detourMin: Number(x.detour_min ?? 0) },
          exampleCatalog.rideFormula,
          Math.round(waitPerHour * 100),
        )
      : Math.round(Number(x.price ?? 0) * 100);
  // Migration 0057: "add your own stop" and its limits.
  const ownStopsReady = ps.data?.custom_stop_max !== undefined;
  const ownStops = {
    max: ps.data?.custom_stop_max ?? CUSTOM_STOP_LIMITS_DEFAULT.maxStops,
    waitHours: (ps.data?.custom_stop_max_wait_min ?? CUSTOM_STOP_LIMITS_DEFAULT.maxWaitMinutes) / 60,
    detourMin: ps.data?.custom_stop_max_detour_min ?? CUSTOM_STOP_LIMITS_DEFAULT.maxDetourMinutes,
  };
  const tourPP = (x: Stop) => Math.round(Number(x.tour_price_pp ?? 0) * 100);
  const commissionReady = ps.data?.driver_commission_bps !== undefined;
  // Migration 0041: night pickups.
  const nightReady = ps.data?.night_premium_bps !== undefined;
  const night: NightPremium = {
    bps: ps.data?.night_premium_bps ?? NIGHT_PREMIUM_DEFAULT.bps,
    startHour: ps.data?.night_start_hour ?? NIGHT_PREMIUM_DEFAULT.startHour,
    endHour: ps.data?.night_end_hour ?? NIGHT_PREMIUM_DEFAULT.endHour,
  };
  const ferry = {
    vehicleCrc: ps.data?.ferry_vehicle_fare_crc ?? FERRY_FARES_DEFAULT.vehicleCrc,
    passengerCrc: ps.data?.ferry_passenger_fare_crc ?? FERRY_FARES_DEFAULT.passengerCrc,
    rate: Number(ps.data?.crc_per_usd ?? CRC_PER_USD_DEFAULT),
  };
  const usd = (crc: number) => formatUSD(crcToCents(crc, ferry.rate));
  const areaBps = { ...AREA_FACTOR_BPS_DEFAULT };
  for (const h of hp.data ?? []) areaBps[h.hub_id] = Math.round(Number(h.area_factor) * 10000);
  const exampleCatalog = {
    rideFormula: {
      baseFareCents: Math.round(formula.base * 100),
      perKmCents: Math.round(formula.perKm * 100),
      perHourCents: Math.round(formula.perHour * 100),
      minimumFareCents: Math.round(formula.minimum * 100),
    },
    areaFactorBps: areaBps,
  };
  const hubName = (id: HubId) => HUBS.find((h) => h.id === id)?.name ?? id;
  const liveLabel = t("Visible", "Live");
  const priceChange = (fields: string[], what: string): ConfirmRule[] => [
    {
      kind: "changed",
      fields,
      message: t(
        `Cambia ${what}: se aplica de inmediato a las reservas nuevas del sitio web y de la app. Las reservas ya hechas mantienen su precio.`,
        `This changes ${what}: it applies right away to new bookings on the website and app. Existing bookings keep their price.`,
      ),
    },
  ];
  const corridorsLegend = t("Corredores", "Corridors");
  const migration = (file: string) => (
    <>
      {t("Corra la migración", "Run migration")} <code>{file}</code>
    </>
  );
  const ferryTwo = formatUSD(Math.round(crcToCents(ferry.vehicleCrc + 2 * ferry.passengerCrc, ferry.rate) / 100) * 100);
  const payRide = formatUSD(Math.round(16200 * (1 - commissionBps / 10000)));
  const payTour = formatUSD(Math.round(40000 * (1 - commissionBps / 10000)));
  // The same $162 example ride with a pickup at the first night hour (green season).
  const nightRideCents = 16200 + nightPremiumCents(16200, 10000, `${String(night.startHour).padStart(2, "0")}:00`, night);
  const nightRide = formatUSD(nightRideCents);
  const payNightRide = formatUSD(Math.round(nightRideCents * (1 - commissionBps / 10000)));

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("Precios y catálogo", "Prices & catalog")}
        subtitle={
          lang === "en" ? (
            <>
              Changes show on the site as soon as you press Save (you&apos;re asked to confirm price changes). Prices are in US dollars,
              before the season multiplier. Untick <strong>Live</strong> to hide something without deleting it.
            </>
          ) : (
            <>
              Los cambios se ven en el sitio en cuanto presiona Guardar (se le pide confirmar los cambios de precio). Los precios están en
              dólares, antes del multiplicador de temporada. Desmarque <strong>Visible</strong> para ocultar algo sin borrarlo.
            </>
          )
        }
        actions={
          <Link href="/admin/promos" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DCE3DF] bg-white px-4 text-sm font-bold text-[#14231C] hover:bg-[#F1F4F2]">
            {t("Códigos promocionales", "Promo codes")} →
          </Link>
        }
      />

      {!formulaReady && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {migration("20261109000013_ride_formula.sql")}{" "}
          {t(
            "en el editor SQL de Supabase para editar la fórmula de traslados, los factores de vehículo y los factores de zona. Mientras tanto el sitio usa los números de fábrica que se ven abajo.",
            "in the Supabase SQL editor to edit the ride formula, vehicle factors and area factors. Until then the site uses the built-in numbers shown below.",
          )}
        </p>
      )}

      <Section
        title={t("Fórmula del precio de traslados", "Ride price formula")}
        note={t(
          "Precio de un traslado en Sedán Estándar: el mayor entre la tarifa mínima y base + por km × km de carretera + por hora × horas de manejo. Luego × el factor del vehículo × el factor de zona del pueblo de recogida, + el cargo extra del vehículo, redondeado a dólares enteros. Las paradas se suman aparte, y el multiplicador de temporada se aplica al total.",
          "Price of a Standard Sedan ride: the larger of the minimum fare and base + per km × road km + per hour × driving hours. Then × the vehicle factor × the pickup town's area factor, + the vehicle's extra fee, rounded to whole dollars. Stops are added on top, and the season multiplier applies to the total.",
        )}
      >
        <Card>
          <AdminForm lang={lang} action={saveRideFormula} confirm={priceChange(["ride_base_fare", "ride_per_km", "ride_per_hour", "ride_minimum_fare"], t("la fórmula del precio de los traslados", "the ride price formula"))} className="grid gap-3 sm:grid-cols-6 items-end">
            <Field l={t("Tarifa base (USD)", "Base fare (USD)")}><input name="ride_base_fare" inputMode="decimal" defaultValue={formula.base} className={input} disabled={!formulaReady} /></Field>
            <Field l={t("Por km (USD)", "Per km (USD)")}><input name="ride_per_km" inputMode="decimal" defaultValue={formula.perKm} className={input} disabled={!formulaReady} /></Field>
            <Field l={t("Por hora de manejo (USD)", "Per hour driving (USD)")}><input name="ride_per_hour" inputMode="decimal" defaultValue={formula.perHour} className={input} disabled={!formulaReady} /></Field>
            <Field l={t("Tarifa mínima (USD)", "Minimum fare (USD)")}><input name="ride_minimum_fare" inputMode="decimal" defaultValue={formula.minimum} className={input} disabled={!formulaReady} /></Field>
          </AdminForm>
          <table className="mt-4 w-full text-sm">
            <caption className="text-left text-xs font-bold text-[#5F6F67] mb-1">
              {t("Con los números de hoy (temporada verde, sin paradas)", "With today's numbers (green season, before stops)")}
            </caption>
            <thead>
              <tr className="text-left text-xs text-[#5F6F67]">
                <th className="py-1 font-semibold">{t("Ruta", "Route")}</th>
                {(v.data ?? []).filter((x) => x.active).map((x) => (
                  <th key={x.id} className="py-1 font-semibold text-right">{x.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EXAMPLES.map(([a, b]) => (
                <tr key={a + b} className="border-t border-[#EDF1EE]">
                  <td className="py-1.5">{hubName(a)} → {hubName(b)}</td>
                  {(v.data ?? []).filter((x) => x.active).map((x) => (
                    <td key={x.id} className="py-1.5 text-right font-semibold">
                      {formatUSD(
                        rideCents(a, b, {
                          priceFactorBps: Math.round(Number(x.price_factor ?? 1) * 10000),
                          extraFeeCents: Math.round(Number(x.extra_fee ?? 0) * 100),
                        }, exampleCatalog),
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section
        title={t("Factores de zona", "Area factors")}
        note={t(
          "El factor de un pueblo multiplica los traslados que salen de ahí, donde hay menos conductores y deben venir de lejos (1.15 = +15%). El del Sur de Nicoya se aplica cuando la recogida O el destino está ahí y la ruta usa el ferry de Puntarenas (la fila, y el conductor tiene que cruzar de vuelta); los traslados que dan la vuelta por carretera, por ejemplo desde Liberia, no lo llevan. Si aplican el de un pueblo y el del Sur de Nicoya, cuenta el más alto. Baje un factor conforme se unan conductores socios locales.",
          "A town's factor multiplies rides that start there, where drivers are scarcer and must come from far away (1.15 = +15%). Southern Nicoya's applies when the pickup OR the drop-off is there and the route takes the Puntarenas ferry (the queue, and the driver crosses back); rides that go around by road, e.g. from Liberia, don't get it. If both a town's and Southern Nicoya's apply, the higher one counts. Lower a factor as local partner drivers join.",
        )}
      >
        <Card>
          <AdminForm lang={lang} action={saveAreaFactors} confirm={priceChange([...HUBS.map((h) => `area_${h.id}`), ...EXTRA_AREAS.map((a) => `area_${a.id}`)], t("los factores de zona", "the area factors"))} className="grid gap-3 grid-cols-2 sm:grid-cols-5 items-end">
            {HUBS.map((h) => (
              <Field key={h.id} l={h.name}>
                <input name={`area_${h.id}`} inputMode="decimal" defaultValue={areaBps[h.id] / 10000} className={input} disabled={!formulaReady} />
              </Field>
            ))}
            {EXTRA_AREAS.map((a) => (
              <Field key={a.id} l={a.id === "SouthNicoya" ? t("Sur de Nicoya", a.name) : a.name}>
                {/* Only sent once migration 0015 has added the area (the database refuses it before). */}
                <input name={`area_${a.id}`} inputMode="decimal" defaultValue={areaBps[a.id] / 10000} className={input} disabled={!extraAreasReady} />
              </Field>
            ))}
          </AdminForm>
        </Card>
      </Section>

      <Section
        title={t("Vehículos", "Vehicles")}
        note={t(
          "El factor multiplica el precio del traslado Estándar (Económico 0.90, Estándar 1.00, Minivan 1.20, 4x4 1.30, Van 1.35). El cargo extra es un monto fijo por traslado, por ejemplo el bote de Sierpe en el combo.",
          "Factor multiplies the Standard ride price (Economy 0.90, Standard 1.00, Minivan 1.20, 4x4 1.30, Van 1.35). Extra fee is a fixed amount per ride, e.g. the Sierpe boat in the combo.",
        )}
      >
        {(v.data ?? []).map((x) => (
          <Card key={x.id}>
            <AdminForm lang={lang} action={saveVehicle} confirm={priceChange(["price_factor", "extra_fee", "active"], t(`el precio o la visibilidad de ${x.name}`, `the price or visibility of ${x.name}`))} className="grid gap-3 sm:grid-cols-6 items-end">
              <input type="hidden" name="id" value={x.id} />
              <Field l={t("Nombre", "Name")} className="sm:col-span-2"><input name="name" defaultValue={x.name} className={input} /></Field>
              {x.example_models !== undefined && (
                <Field l={t("Modelos de ejemplo", "Example models")} className="sm:col-span-4">
                  <input name="example_models" maxLength={80} defaultValue={x.example_models ?? ""} placeholder="Toyota Prado" className={input} />
                  <span className="mt-1 block text-xs font-normal text-[#5F6F67]">
                    {t(
                      "Solo el modelo, por ejemplo «Toyota Prado». El sitio y la app agregan « o similar» automáticamente. Vacío = no se muestra ningún ejemplo.",
                      "Only the model, e.g. \"Toyota Prado\". The site and the app add \" or similar\" automatically. Empty = no example is shown.",
                    )}
                  </span>
                </Field>
              )}
              <Field l={t("Factor de precio", "Price factor")}><input name="price_factor" inputMode="decimal" defaultValue={x.price_factor ?? 1} className={input} disabled={!formulaReady} /></Field>
              <Field l={t("Cargo extra (USD)", "Extra fee (USD)")}><input name="extra_fee" inputMode="decimal" defaultValue={x.extra_fee ?? 0} className={input} disabled={!formulaReady} /></Field>
              <Field l={t("Máximo de pasajeros", "Max passengers")}><input name="max_pax" type="number" min={1} defaultValue={x.max_pax} className={input} /></Field>
              <Field l={t("Equipaje", "Luggage")}><input name="luggage" defaultValue={x.luggage} className={input} /></Field>
              <Field l={t("Etiqueta", "Badge")} className="sm:col-span-2"><input name="badge" defaultValue={x.badge} className={input} /></Field>
              <label className="flex items-center gap-2 text-sm font-bold min-h-10">
                <input type="checkbox" name="allows_stops" defaultChecked={x.allows_stops ?? true} disabled={!formulaReady} /> {t("Permite paradas", "Stops allowed")}
              </label>
              <label className="flex items-center gap-2 text-sm font-bold min-h-10 sm:col-span-2">
                <input type="checkbox" name="spanish_speaking_driver" defaultChecked={x.spanish_speaking_driver ?? false} disabled={!formulaReady} /> {t("Conductor que habla español", "Spanish-speaking driver")}
              </label>
              <Live on={x.active} label={liveLabel} />
            </AdminForm>
          </Card>
        ))}
      </Section>

      <Section
        title={t("Paradas turísticas", "Sightseeing stops")}
        note={t(
          "Las paradas son extras opcionales pagados en la carretera entre dos pueblos. Parte del conductor = minutos en la parada × la tarifa de espera + km y minutos de desvío a las tarifas de la fórmula de traslados, redondeado a dólares enteros. Las paradas que en realidad son tours (caminata guiada, Poás + café) suman un precio de tour POR PERSONA por el guía, la entrada y la actividad, como los tours de costaricatravelplanner.com. Marque cada pueblo entre los que está la parada: un traslado la ofrece solo cuando su recogida Y su destino están marcados. Marque un solo pueblo para una parada en ese pueblo. Nunca se ofrece en el bote Sierpe ↔ Bahía Drake.",
          "Stops are optional paid extras on the road between two towns. Driver's part = minutes at the stop × the waiting rate + detour km and minutes at the ride formula's rates, rounded to whole dollars. Stops that are really tours (guided walk, Poás + coffee) add a tour price PER PERSON for the guide, entrance and activity, like the tours on costaricatravelplanner.com. Tick every town the stop sits between: a ride offers it only when BOTH its pickup and drop-off are ticked. Tick just one town for a stop in that town. Never offered on the Sierpe ↔ Drake Bay boat.",
        )}
      >
        <Card>
          {!stopsReady && (
            <p className="mb-3 text-sm text-amber-800">
              {migration("20261109000021_stop_pricing.sql")}{" "}
              {t(
                "para cobrar las paradas por tiempo de espera y desvío. Mientras tanto cada parada mantiene su precio fijo.",
                "to price stops by waiting time and detour. Until then each stop keeps its flat price.",
              )}
            </p>
          )}
          <AdminForm lang={lang} action={saveWaitRate} confirm={priceChange(["wait_per_hour"], t("la tarifa de espera de las paradas", "the waiting rate for stops"))} className="grid gap-3 sm:grid-cols-6 items-end">
            <Field l={t("Tarifa de espera (USD por hora en una parada)", "Waiting rate (USD per hour at a stop)")} className="sm:col-span-2">
              <input name="wait_per_hour" inputMode="decimal" defaultValue={waitPerHour} className={input} disabled={!stopsReady} />
            </Field>
          </AdminForm>
          <p className="mt-2 text-xs text-[#5F6F67]">
            {t(
              "El conductor recibe su parte habitual (80% con la comisión de hoy).",
              "The driver gets their usual share of it (80% at today's commission).",
            )}
          </p>
        </Card>
        <Card>
          <h3 className="text-sm font-extrabold text-[#12241C]">{t("Paradas propias del cliente", "Travellers' own stops")}</h3>
          <p className="mt-1 mb-3 text-xs text-[#5F6F67]">
            {t(
              "En un traslado, el cliente puede agregar cualquier lugar que encuentre en el buscador y decir cuánto tiempo se queda. Precio de cada parada = minutos en la parada × la tarifa de espera de arriba + km y minutos extra de manejo (la ruta con las paradas menos la ruta directa, según Google) a las tarifas de la fórmula de traslados, redondeado a dólares enteros; luego la temporada. Sin guía ni entradas: el cliente paga las entradas en el lugar. Si un traslado pasa de estos límites, la página le pide al cliente que nos escriba para cotizarlo.",
              "On a ride, the traveller can add any place the search finds and say how long they stay. Each stop's price = minutes at the stop × the waiting rate above + extra km and driving minutes (the route through the stops minus the direct route, from Google) at the ride formula's rates, rounded to whole dollars; then the season. No guide and no tickets: the traveller pays entrances at the place. Past these limits the page asks the traveller to message us for a quote.",
            )}
          </p>
          {!ownStopsReady && (
            <p className="mb-3 text-sm text-amber-800">
              {t(
                "Estos límites se podrán cambiar cuando termine la actualización automática de la base de datos (unos minutos después de publicar). Mientras tanto se usan los valores que ve aquí.",
                "These limits can be changed once the automatic database update has finished (a few minutes after publishing). Until then the values shown here apply.",
              )}
            </p>
          )}
          <AdminForm lang={lang} action={saveCustomStopLimits} className="grid gap-3 sm:grid-cols-6 items-end">
            <Field l={t("Paradas propias por traslado (0 = apagado)", "Own stops per ride (0 = off)")} className="sm:col-span-2">
              <input name="custom_stop_max" type="number" min={0} max={5} step={1} defaultValue={ownStops.max} className={input} disabled={!ownStopsReady} />
            </Field>
            <Field l={t("Máximo de horas en paradas (propias + del catálogo)", "Most hours at stops (own + catalog)")} className="sm:col-span-2">
              <input name="custom_stop_max_wait_hours" inputMode="decimal" defaultValue={ownStops.waitHours} className={input} disabled={!ownStopsReady} />
            </Field>
            <Field l={t("Máximo de minutos extra de manejo", "Most extra driving minutes")} className="sm:col-span-2">
              <input name="custom_stop_max_detour_min" type="number" min={0} max={480} step={5} defaultValue={ownStops.detourMin} className={input} disabled={!ownStopsReady} />
            </Field>
          </AdminForm>
        </Card>
        {(s.data ?? []).map((x) => (
          <Card key={x.id}>
            <AdminForm lang={lang} action={saveStop} confirm={priceChange(["duration_min", "detour_km", "detour_min", "tour_price_pp", "entrance", "park_fee_included", "active"], t(`el precio o la visibilidad de la parada ${x.name}`, `the price or visibility of the stop ${x.name}`))} className="grid gap-3 sm:grid-cols-6 items-end">
              <input type="hidden" name="id" value={x.id} />
              <Field l={t("Nombre", "Name")} className="sm:col-span-3"><input name="name" defaultValue={x.name} className={input} /></Field>
              <Field l={t("Minutos en la parada", "Minutes at the stop")}><input name="duration_min" type="number" min={5} defaultValue={x.duration_min} className={input} /></Field>
              <Field l={t("Km de desvío (ida y vuelta)", "Detour km (there and back)")}><input name="detour_km" inputMode="decimal" defaultValue={x.detour_km ?? 0} className={input} disabled={!stopsReady} /></Field>
              <Field l={t("Minutos de desvío", "Detour minutes")}><input name="detour_min" type="number" min={0} defaultValue={x.detour_min ?? 0} className={input} disabled={!stopsReady} /></Field>
              <Field l={t("Precio del tour por persona (USD)", "Tour price per person (USD)")}><input name="tour_price_pp" inputMode="decimal" defaultValue={x.tour_price_pp ?? 0} className={input} disabled={!stopsReady} /></Field>
              <Field l={t("Precio (calculado)", "Price (computed)")}>
                <p className="min-h-10 flex items-center font-extrabold text-[#047857]">
                  {formatUSD(stopPrice(x))}{tourPP(x) > 0 ? ` + ${formatUSD(tourPP(x))}/${t("persona", "person")}` : ""}
                </p>
              </Field>
              {x.entrance === undefined ? (
                // Before migration 0014: the old yes/no switch.
                <label className="flex items-center gap-2 text-sm min-h-10">
                  <input type="checkbox" name="park_fee_included" defaultChecked={x.park_fee_included} /> {t("Entrada al parque incluida", "Park fee included")}
                </label>
              ) : (
                <Field l={t("Entrada", "Entrance")}>
                  <select name="entrance" defaultValue={x.entrance} className={input}>
                    {STOP_ENTRANCES.map((e) => (
                      <option key={e} value={e}>{lang === "en" ? ENTRANCE_ADMIN_LABEL[e] : ENTRANCE_LABEL_ES[e]}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field l={t("Descripción", "Description")} className="sm:col-span-6"><input name="description" defaultValue={x.description} className={input} /></Field>
              <Corridors selected={x.corridors} legend={corridorsLegend} />
              <Live on={x.active} label={liveLabel} />
            </AdminForm>
          </Card>
        ))}
        <Card>
          <h3 className="font-extrabold text-[#14231C] mb-3">{t("Agregar una parada", "Add a stop")}</h3>
          <AdminForm
            lang={lang}
            action={addStop}
            submitLabel={t("Agregar parada (oculta hasta que marque Visible)", "Add stop (hidden until you tick Live)")}
            className="grid gap-3 sm:grid-cols-6 items-end"
          >
            <Field l={t("Nombre", "Name")} className="sm:col-span-3"><input name="name" required className={input} /></Field>
            <Field l={t("Minutos en la parada", "Minutes at the stop")}><input name="duration_min" type="number" min={5} required className={input} /></Field>
            <Field l={t("Km de desvío (ida y vuelta)", "Detour km (there and back)")}><input name="detour_km" inputMode="decimal" defaultValue={0} className={input} disabled={!stopsReady} /></Field>
            <Field l={t("Minutos de desvío", "Detour minutes")}><input name="detour_min" type="number" min={0} defaultValue={0} className={input} disabled={!stopsReady} /></Field>
            <Field l={t("Precio del tour por persona (USD)", "Tour price per person (USD)")}><input name="tour_price_pp" inputMode="decimal" defaultValue={0} className={input} disabled={!stopsReady} /></Field>
            <Field l={t("Descripción", "Description")} className="sm:col-span-6"><input name="description" className={input} /></Field>
            <Corridors selected={[]} legend={corridorsLegend} />
          </AdminForm>
        </Card>
      </Section>

      <Section
        title={t("Tours de un día", "1-day tours")}
        note={t(
          "Precio por persona (vehículo privado, guía, entradas y almuerzo), con una tarifa menor para 2–3 clientes y para 4 o más; 7 o más pagan la tarifa de 4+. La mejora en ruta es un monto fijo por grupo. 'Nuestros costos por persona' es lo que pagamos por entradas, almuerzo y actividades: se resta del precio antes de calcular la parte del conductor.",
          "Priced per person (private vehicle, guide, entrances and lunch), with a lower rate for 2–3 travellers and for 4 or more; 7+ pay the 4+ rate. The en-route upgrade is a flat amount per group. 'Our costs per person' is what we pay for entrances, lunch and activities: it comes off the price before the driver's share is worked out.",
        )}
      >
        {(tours.data ?? []).map((x) => (
          <Card key={x.id}>
            {x.price_pp_solo === undefined && (
              <p className="mb-3 text-sm text-amber-800">
                {migration("20261109000022_tour_pricing.sql")}{" "}
                {t("para cobrar este tour por persona.", "to price this tour per person.")}
              </p>
            )}
            <AdminForm lang={lang} action={saveDayTour} confirm={priceChange(["price_pp_solo", "price_pp_small", "price_pp_group", "cost_pp", "en_route_upgrade_price", "active"], t(`el precio o la visibilidad del tour ${x.name}`, `the price or visibility of the tour ${x.name}`))} className="grid gap-3 sm:grid-cols-6 items-end">
              <input type="hidden" name="id" value={x.id} />
              <Field l={`${t("Nombre", "Name")} · ${REGION_NAMES[x.region] ?? x.region}`} className="sm:col-span-3"><input name="name" defaultValue={x.name} className={input} /></Field>
              <Field l={t("Por persona · 1 cliente", "Per person · 1 traveller")}><input name="price_pp_solo" inputMode="decimal" defaultValue={x.price_pp_solo ?? 0} className={input} disabled={x.price_pp_solo === undefined} /></Field>
              <Field l={t("Por persona · 2–3", "Per person · 2–3")}><input name="price_pp_small" inputMode="decimal" defaultValue={x.price_pp_small ?? 0} className={input} disabled={x.price_pp_solo === undefined} /></Field>
              <Field l={t("Por persona · 4+", "Per person · 4+")}><input name="price_pp_group" inputMode="decimal" defaultValue={x.price_pp_group ?? 0} className={input} disabled={x.price_pp_solo === undefined} /></Field>
              <Field l={t("Nuestros costos por persona", "Our costs per person")}><input name="cost_pp" inputMode="decimal" defaultValue={x.cost_pp ?? 0} className={input} disabled={x.cost_pp === undefined} /></Field>
              <Field l={t("Mejora en ruta", "En-route upgrade")}><input name="en_route_upgrade_price" inputMode="decimal" defaultValue={x.en_route_upgrade_price} className={input} /></Field>
              <Field l={t("Horas", "Hours")}><input name="duration_hours" inputMode="decimal" defaultValue={x.duration_hours} className={input} /></Field>
              <Live on={x.active} label={liveLabel} />
            </AdminForm>
          </Card>
        ))}
      </Section>

      {/* Multi-day trips were retired on 2026-11-11 (Jorge): read-only record, never sold again. */}
      <details className="rounded-xl border border-[#E3E8E5] bg-[#FAFBFA] p-4">
        <summary className="cursor-pointer text-sm font-bold text-[#33443C]">
          {t("Retirado: viajes de varios días y hospedaje", "Retired: multi-day trips & lodging")}
        </summary>
        <p className="mt-2 text-sm text-[#5F6F67]">
          {t(
            "Desde el 11 de noviembre de 2026 solo vendemos traslados y tours de un día. Los viajes de varios días ya no se muestran ni se pueden reservar; estas filas se guardan, inactivas, solo para las reservas y los pagos anteriores.",
            "Since 11 November 2026 we only sell transfers and 1-day tours. Multi-day trips are no longer shown or bookable; these rows are kept, inactive, only for earlier bookings and payments.",
          )}
        </p>
        <ul className="mt-2 space-y-1 text-sm text-[#5F6F67]">
          {(e.data ?? []).map((x) => (
            <li key={x.id}>
              {x.name} · {x.days}D/{x.nights}N · ${x.base_price} · {x.active ? t("activo", "active") : t("inactivo", "inactive")}
            </li>
          ))}
          {(l.data ?? []).map((x) => (
            <li key={x.id}>
              {t("Hospedaje", "Lodging")}: {x.name} · +${x.surcharge} · {x.active ? t("activo", "active") : t("inactivo", "inactive")}
            </li>
          ))}
        </ul>
      </details>

      <Section
        title={t("Ferris", "Ferries")}
        note={t(
          "Ferris del Golfo de Nicoya (Puntarenas ↔ Paquera / Playa Naranjo), por cruce, en colones como los cobra la naviera. Se suman al precio del traslado cada vez que la ruta de Google usa un ferry, por el carro con su conductor más cada pasajero, convertidos a dólares con el tipo de cambio de aquí y redondeados a dólares enteros. No se ajustan por temporada. Revise el tipo de cambio más o menos una vez por semana.",
          "Gulf of Nicoya car ferries (Puntarenas ↔ Paquera / Playa Naranjo), per crossing, in colones as the ferry company charges them. Added on top of the ride price whenever Google's route takes a ferry, for the car with its driver plus each passenger, converted to dollars at the exchange rate here and rounded to whole dollars. Not season-adjusted. Check the exchange rate about once a week.",
        )}
      >
        <Card>
          {!ferryReady && (
            <p className="mb-3 text-sm text-amber-800">
              {migration("20261109000015_nicoya_ferry.sql")}{" "}
              {t(
                "en el editor SQL de Supabase para editar las tarifas del ferry y el factor del Sur de Nicoya. Mientras tanto el sitio usa los números que se ven.",
                "in the Supabase SQL editor to edit the ferry fares and the Southern Nicoya factor. Until then the site uses the numbers shown.",
              )}
            </p>
          )}
          <AdminForm lang={lang} action={saveFerryFares} confirm={priceChange(["ferry_vehicle_fare_crc", "ferry_passenger_fare_crc", "crc_per_usd"], t("las tarifas del ferry o el tipo de cambio", "the ferry fares or the exchange rate"))} className="grid gap-3 sm:grid-cols-6 items-end">
            <Field l={t("Carro + conductor (₡ por cruce)", "Car + driver (₡ per crossing)")} className="sm:col-span-2"><input name="ferry_vehicle_fare_crc" type="number" min={0} step={100} defaultValue={ferry.vehicleCrc} className={input} disabled={!ferryReady} /></Field>
            <Field l={t("Por pasajero (₡ por cruce)", "Per passenger (₡ per crossing)")} className="sm:col-span-2"><input name="ferry_passenger_fare_crc" type="number" min={0} step={50} defaultValue={ferry.passengerCrc} className={input} disabled={!ferryReady} /></Field>
            <Field l={t("Colones por dólar (tipo de cambio)", "Colones per US dollar")} className="sm:col-span-2"><input name="crc_per_usd" inputMode="decimal" defaultValue={ferry.rate} className={input} disabled={!ferryReady} /></Field>
          </AdminForm>
          <p className="mt-3 text-xs text-[#5F6F67]">
            {lang === "en"
              ? `At ₡${ferry.rate} per dollar: car + driver ${usd(ferry.vehicleCrc)}, each passenger ${usd(ferry.passengerCrc)}. A crossing with 2 passengers adds ${ferryTwo}.`
              : `A ₡${ferry.rate} por dólar: carro + conductor ${usd(ferry.vehicleCrc)}, cada pasajero ${usd(ferry.passengerCrc)}. Un cruce con 2 pasajeros suma ${ferryTwo}.`}
          </p>
        </Card>
      </Section>

      <Section
        title={t("Pago a los conductores", "Drivers' payout")}
        note={t(
          "Nuestra parte de cada traslado y tour de un día, como porcentaje del precio neto: después de los tiquetes del ferry (que van completos al conductor) y después de las entradas, el almuerzo y las actividades que pagamos en tours y paradas guiadas. Los conductores solo ven su pago en la bolsa de trabajos y en sus viajes, nunca el precio del cliente. Las expediciones las organiza el equipo y no tienen pago automático.",
          "Our share of each ride and day tour, as a percentage of the net price: after ferry tickets (which go to the driver in full) and after the entrances, lunch and activities we pay on tours and guided stops. Drivers see only their payout on the job board and their trips, never the client's price. Expeditions are arranged by the team and have no automatic payout.",
        )}
      >
        <Card>
          {!commissionReady && (
            <p className="mb-3 text-sm text-amber-800">
              {migration("20261109000017_driver_job_board.sql")}{" "}
              {t(
                `en el editor SQL de Supabase para editar esto. Mientras tanto el sitio usa ${DRIVER_COMMISSION_BPS_DEFAULT / 100}%.`,
                `in the Supabase SQL editor to edit this. Until then the site uses ${DRIVER_COMMISSION_BPS_DEFAULT / 100}%.`,
              )}
            </p>
          )}
          <AdminForm lang={lang} action={saveDriverCommission} confirm={priceChange(["commission_percent"], t("nuestra comisión y el pago a los conductores", "our commission and the drivers' payout"))} className="grid gap-3 sm:grid-cols-6 items-end">
            <Field l={t("Nuestra comisión (%)", "Our commission (%)")} className="sm:col-span-2">
              <input name="commission_percent" inputMode="decimal" defaultValue={commissionBps / 100} className={input} disabled={!commissionReady} />
            </Field>
          </AdminForm>
          <p className="mt-3 text-xs text-[#5F6F67]">
            {lang === "en"
              ? `Example: a ${formatUSD(16200)} ride pays the driver ${payRide}. On tours and guided stops, the entrances, lunch and activities we pay are taken off first: a ${formatUSD(59000)} tour with ${formatUSD(19000)} of costs pays the driver ${payTour}. Changing this only affects new bookings; each booking keeps the payout it was created with.`
              : `Ejemplo: un traslado de ${formatUSD(16200)} le paga al conductor ${payRide}. En tours y paradas guiadas, primero se restan las entradas, el almuerzo y las actividades que pagamos: un tour de ${formatUSD(59000)} con ${formatUSD(19000)} de costos le paga al conductor ${payTour}. Cambiar esto solo afecta las reservas nuevas; cada reserva mantiene el pago con el que se creó.`}
          </p>
        </Card>
      </Section>

      <Section
        title={t("Recogidas nocturnas", "Night pickups")}
        note={t(
          "Los clientes pueden pedir la recogida a cualquier hora. Un traslado cuya hora de recogida (hora de Costa Rica) cae en este horario cuesta este porcentaje más. Se aplica solo al traslado, después del vehículo, la zona y la temporada; las paradas, el ferry, la lancha de Bahía Drake y las entradas no tienen recargo. El horario va desde la hora «Desde» hasta justo antes de la hora «Hasta» y puede cruzar la medianoche. El pago al conductor sube con el recargo. Los tours de un día y las expediciones no cambian. Ponga 0% (o la misma hora en ambos) para no cobrar recargo.",
          "Travellers can ask for a pickup at any hour. A ride whose pickup time (Costa Rica time) falls in this window costs this percentage more. It applies to the ride only, after the vehicle, area and season; stops, the ferry, the Drake Bay boat and entrances are not marked up. The window runs from the \"From\" hour up to just before the \"Until\" hour and may cross midnight. The driver's payout rises with the premium. Day tours and expeditions don't change. Set 0% (or the same hour in both) to charge no premium.",
        )}
      >
        <Card>
          {!nightReady && (
            <p className="mb-3 text-sm text-amber-800">
              {t(
                `Estos valores se podrán editar cuando termine la actualización de la base de datos (se aplica sola después de publicar). Mientras tanto el sitio usa +${nightPercent(NIGHT_PREMIUM_DEFAULT)} de ${hourLabel(NIGHT_PREMIUM_DEFAULT.startHour, "es")} a ${hourLabel(NIGHT_PREMIUM_DEFAULT.endHour, "es")}.`,
                `These values can be edited once the database update has finished (it runs by itself after publishing). Until then the site uses +${nightPercent(NIGHT_PREMIUM_DEFAULT)} from ${hourLabel(NIGHT_PREMIUM_DEFAULT.startHour)} to ${hourLabel(NIGHT_PREMIUM_DEFAULT.endHour)}.`,
              )}
            </p>
          )}
          <AdminForm lang={lang} action={saveNightPremium} confirm={priceChange(["night_premium_percent", "night_start_hour", "night_end_hour"], t("el recargo nocturno", "the night premium"))} className="grid gap-3 sm:grid-cols-6 items-end">
            <Field l={t("Recargo nocturno (%)", "Night premium (%)")} className="sm:col-span-2">
              <input name="night_premium_percent" inputMode="decimal" defaultValue={night.bps / 100} className={input} disabled={!nightReady} />
            </Field>
            <Field l={t("Desde (hora)", "From (hour)")} className="sm:col-span-2">
              <select name="night_start_hour" defaultValue={night.startHour} className={input} disabled={!nightReady}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{hourLabel(h, lang)}</option>
                ))}
              </select>
            </Field>
            <Field l={t("Hasta (hora, sin incluirla)", "Until (hour, not included)")} className="sm:col-span-2">
              <select name="night_end_hour" defaultValue={night.endHour} className={input} disabled={!nightReady}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{hourLabel(h, lang)}</option>
                ))}
              </select>
            </Field>
          </AdminForm>
          <p className="mt-3 text-xs text-[#5F6F67]">
            {nightPremiumOn(night)
              ? lang === "en"
                ? `Today: a ride that costs ${formatUSD(16200)} by day costs ${nightRide} with a pickup ${nightWindow(night)}, and the driver's payout goes from ${payRide} to ${payNightRide}. Changing this only affects new bookings.`
                : `Hoy: un traslado que de día cuesta ${formatUSD(16200)} cuesta ${nightRide} con recogida ${nightWindow(night, "es")}, y el pago al conductor pasa de ${payRide} a ${payNightRide}. Cambiar esto solo afecta las reservas nuevas.`
              : t("Hoy no se cobra recargo nocturno.", "No night premium is charged today.")}
          </p>
        </Card>
      </Section>

      <Section
        title={t("Pago", "Payment")}
        note={t(
          "Los clientes pagan en línea el total, o le pagan al conductor en efectivo en traslados y tours de un día más este cargo por reserva en efectivo (un % del precio del traslado o tour, que se muestra en el total de su viaje).",
          "Travellers pay online in full, or pay the driver in cash on rides and 1-day tours plus this cash booking fee (a % of the ride or tour price, shown in their trip total).",
        )}
      >
        <Card>
          {ps.error ? (
            <p className="text-sm text-amber-800">
              {migration("20261108000012_payment_options.sql")}{" "}
              {t(
                `en el editor SQL de Supabase para editar el cargo por efectivo. Mientras tanto el sitio usa ${CASH_FEE_BPS_DEFAULT / 100}%.`,
                `in the Supabase SQL editor to edit the cash fee. Until then the site uses ${CASH_FEE_BPS_DEFAULT / 100}%.`,
              )}
            </p>
          ) : (
            <AdminForm lang={lang} action={savePaymentSettings} confirm={priceChange(["cash_fee_percent"], t("el cargo por reserva en efectivo", "the cash booking fee"))} className="grid gap-3 sm:grid-cols-6 items-end">
              <Field l={t("Cargo por reserva en efectivo (%)", "Cash booking fee (%)")} className="sm:col-span-2">
                <input name="cash_fee_percent" inputMode="decimal" defaultValue={cashFeeBps / 100} className={input} />
              </Field>
            </AdminForm>
          )}
        </Card>
      </Section>

      <Section
        title={t("Temporadas", "Seasons")}
        note={t(
          "Una fecha de viaje usa la temporada más alta cuyas fechas la incluyen; cualquier otra fecha usa la temporada predeterminada.",
          "A travel date uses the highest season whose dates include it; any other date uses the default season.",
        )}
      >
        {(se.data ?? []).map((x) => (
          <Card key={x.id}>
            <AdminForm lang={lang} action={saveSeason} confirm={priceChange(["multiplier"], t(`el multiplicador de ${x.name}`, `the multiplier of ${x.name}`))} className="grid gap-3 sm:grid-cols-6 items-end">
              <input type="hidden" name="id" value={x.id} />
              <Field
                l={x.is_default ? t("Nombre (temporada predeterminada)", "Name (default season)") : t("Nombre", "Name")}
                className="sm:col-span-4"
              >
                <input name="name" defaultValue={x.name} className={input} />
              </Field>
              <Field l={t("Multiplicador (1.15 = +15%)", "Multiplier (1.15 = +15%)")}><input name="multiplier" inputMode="decimal" defaultValue={x.multiplier} className={input} /></Field>
            </AdminForm>
            {!x.is_default && (
              <ul className="mt-3 space-y-1.5 text-sm">
                {(r.data ?? []).filter((rr) => rr.season_id === x.id).map((rr) => (
                  <li key={rr.id} className="flex flex-wrap items-center gap-3">
                    <span>
                      {rr.starts_on} → {rr.ends_on}
                      {rr.note ? <span className="text-[#5F6F67]"> · {rr.note}</span> : null}
                    </span>
                    <AdminForm lang={lang} action={deleteSeasonRange} submitLabel={t("Quitar", "Remove")} danger confirm={[{ kind: "always", message: t(`Se borran las fechas ${rr.starts_on} → ${rr.ends_on} de ${x.name}: esos días vuelven a la temporada predeterminada para las reservas nuevas.`, `The dates ${rr.starts_on} → ${rr.ends_on} are removed from ${x.name}: those days go back to the default season for new bookings.`) }]} className="inline-flex">
                      <input type="hidden" name="id" value={rr.id} />
                    </AdminForm>
                  </li>
                ))}
              </ul>
            )}
            {!x.is_default && (
              <AdminForm lang={lang} action={addSeasonRange} submitLabel={t("Agregar fechas", "Add dates")} confirm={[{ kind: "always", message: t(`Las fechas nuevas usan el multiplicador de ${x.name} para las reservas nuevas.`, `The new dates use the ${x.name} multiplier for new bookings.`) }]} className="mt-3 grid gap-3 sm:grid-cols-6 items-end">
                <input type="hidden" name="season_id" value={x.id} />
                <Field l={t("Desde", "From")}><input type="date" name="starts_on" required className={input} /></Field>
                <Field l={t("Hasta", "To")}><input type="date" name="ends_on" required className={input} /></Field>
                <Field l={t("Nota", "Note")} className="sm:col-span-2"><input name="note" placeholder={t("p. ej. Semana Santa 2032", "e.g. Semana Santa 2032")} className={input} /></Field>
              </AdminForm>
            )}
          </Card>
        ))}
      </Section>
    </div>
  );
}

/** Stop entrance choices in Spanish (English: ENTRANCE_ADMIN_LABEL in src/lib/catalog.ts). */
const ENTRANCE_LABEL_ES: Record<(typeof STOP_ENTRANCES)[number], string> = {
  free: "Gratis, no se necesita tiquete",
  included: "Incluida en nuestro precio de la parada",
  gate: "El cliente paga en la entrada",
};

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <SectionHeading title={title} note={note} />
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#E3E8E5] bg-white p-4 sm:p-5">{children}</div>;
}

function Field({ l, className = "", children }: { l: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`${label} ${className}`}>
      {l}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function Live({ on, label: text }: { on: boolean; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm font-bold min-h-10">
      <input type="checkbox" name="active" defaultChecked={on} /> {text}
    </label>
  );
}

function Corridors({ selected, legend }: { selected: string[]; legend: string }) {
  return (
    <fieldset className="sm:col-span-6">
      <legend className={label}>{legend}</legend>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {HUBS.map((h) => (
          <label key={h.id} className="flex items-center gap-1.5 text-sm min-h-8">
            <input type="checkbox" name="corridors" value={h.id} defaultChecked={selected.includes(h.id)} />
            {h.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
