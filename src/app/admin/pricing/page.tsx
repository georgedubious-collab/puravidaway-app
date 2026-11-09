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
import { DRIVER_COMMISSION_BPS_DEFAULT } from "@/lib/payout";
import { formatUSD, rideCents } from "@/lib/pricing";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminForm } from "./AdminForm";
import {
  addSeasonRange,
  addStop,
  deleteSeasonRange,
  saveDayTour,
  saveExpedition,
  saveLodgingTier,
  saveAreaFactors,
  saveDriverCommission,
  saveWaitRate,
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
}
interface Settings {
  cash_fee_bps: number;
  ride_base_fare?: number; ride_per_km?: number; ride_per_hour?: number; ride_minimum_fare?: number;
  ferry_vehicle_fare_crc?: number; ferry_passenger_fare_crc?: number; crc_per_usd?: number;
  driver_commission_bps?: number;
  wait_per_hour?: number;
}

/** Example routes shown under the formula so the effect of a change is visible. */
const EXAMPLES: [HubId, HubId][] = [
  ["LIR", "Tamarindo"], ["SJO", "Arenal"], ["SJO", "ManuelAntonio"], ["SJO", "Tamarindo"], ["Arenal", "Monteverde"], ["SJO", "Sierpe"],
];
interface Stop { id: string; name: string; description: string; duration_min: number; price: number | null; detour_km?: number; detour_min?: number; guide_fee?: number; park_fee_included: boolean; entrance?: string; corridors: string[]; active: boolean }
interface Tour { id: string; region: Region; name: string; duration_hours: number; price: number; en_route_upgrade_price: number; active: boolean }
interface Expedition { id: string; name: string; days: number; nights: number; base_price: number; active: boolean }
interface Tier { id: string; name: string; surcharge: number; active: boolean }
interface Season { id: string; name: string; multiplier: number; is_default: boolean }
interface Range { id: string; season_id: string; starts_on: string; ends_on: string; note: string | null }

const input = "min-h-10 rounded-lg border border-slate-300 px-2.5 text-sm w-full";
const label = "block text-xs font-bold text-slate-600";

export default async function PricingPage() {
  await requireRole("admin", "/admin/pricing");
  const db = (await createSupabaseServerClient())!;
  const [v, s, t, e, l, se, r, ps, hp] = await Promise.all([
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
          { durationMin: x.duration_min, detourKm: Number(x.detour_km ?? 0), detourMin: Number(x.detour_min ?? 0), guideFeeCents: Math.round(Number(x.guide_fee ?? 0) * 100) },
          exampleCatalog.rideFormula,
          Math.round(waitPerHour * 100),
        )
      : Math.round(Number(x.price ?? 0) * 100);
  const commissionReady = ps.data?.driver_commission_bps !== undefined;
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

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Prices &amp; catalog</h1>
        <p className="mt-1 text-sm text-slate-600">
          Changes show on the site as soon as you press Save. Prices are in US dollars, before the
          season multiplier. Untick <strong>Live</strong> to hide something without deleting it.
        </p>
      </div>

      {!formulaReady && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Run migration <code>20261109000013_ride_formula.sql</code> in the Supabase SQL editor to edit the ride
          formula, vehicle factors and area factors. Until then the site uses the built-in numbers shown below.
        </p>
      )}

      <Section
        title="Ride price formula"
        note="Price of a Standard Sedan ride: the larger of the minimum fare and base + per km × road km + per hour × driving hours. Then × the vehicle factor × the pickup town's area factor, + the vehicle's extra fee, rounded to whole dollars. Stops are added on top, and the season multiplier applies to the total."
      >
        <Card>
          <AdminForm action={saveRideFormula} className="grid gap-3 sm:grid-cols-6 items-end">
            <Field l="Base fare (USD)"><input name="ride_base_fare" inputMode="decimal" defaultValue={formula.base} className={input} disabled={!formulaReady} /></Field>
            <Field l="Per km (USD)"><input name="ride_per_km" inputMode="decimal" defaultValue={formula.perKm} className={input} disabled={!formulaReady} /></Field>
            <Field l="Per hour driving (USD)"><input name="ride_per_hour" inputMode="decimal" defaultValue={formula.perHour} className={input} disabled={!formulaReady} /></Field>
            <Field l="Minimum fare (USD)"><input name="ride_minimum_fare" inputMode="decimal" defaultValue={formula.minimum} className={input} disabled={!formulaReady} /></Field>
          </AdminForm>
          <table className="mt-4 w-full text-sm">
            <caption className="text-left text-xs font-bold text-slate-600 mb-1">With today&apos;s numbers (green season, before stops)</caption>
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1 font-semibold">Route</th>
                {(v.data ?? []).filter((x) => x.active).map((x) => (
                  <th key={x.id} className="py-1 font-semibold text-right">{x.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EXAMPLES.map(([a, b]) => (
                <tr key={a + b} className="border-t border-slate-100">
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
        title="Area factors"
        note="A town's factor multiplies rides that start there, where drivers are scarcer and must come from far away (1.15 = +15%). Southern Nicoya's applies when the pickup OR the drop-off is there and the route takes the Puntarenas ferry (the queue, and the driver crosses back); rides that go around by road, e.g. from Liberia, don't get it. If both a town's and Southern Nicoya's apply, the higher one counts. Lower a factor as local partner drivers join."
      >
        <Card>
          <AdminForm action={saveAreaFactors} className="grid gap-3 grid-cols-2 sm:grid-cols-5 items-end">
            {HUBS.map((h) => (
              <Field key={h.id} l={h.name}>
                <input name={`area_${h.id}`} inputMode="decimal" defaultValue={areaBps[h.id] / 10000} className={input} disabled={!formulaReady} />
              </Field>
            ))}
            {EXTRA_AREAS.map((a) => (
              <Field key={a.id} l={a.name}>
                {/* Only sent once migration 0015 has added the area (the database refuses it before). */}
                <input name={`area_${a.id}`} inputMode="decimal" defaultValue={areaBps[a.id] / 10000} className={input} disabled={!extraAreasReady} />
              </Field>
            ))}
          </AdminForm>
        </Card>
      </Section>

      <Section title="Vehicles" note="Factor multiplies the Standard ride price (Economy 0.90, Standard 1.00, SUV 1.20, 4x4 1.30, Van 1.35). Extra fee is a fixed amount per ride, e.g. the Sierpe boat in the combo.">
        {(v.data ?? []).map((x) => (
          <Card key={x.id}>
            <AdminForm action={saveVehicle} className="grid gap-3 sm:grid-cols-6 items-end">
              <input type="hidden" name="id" value={x.id} />
              <Field l="Name" className="sm:col-span-2"><input name="name" defaultValue={x.name} className={input} /></Field>
              <Field l="Price factor"><input name="price_factor" inputMode="decimal" defaultValue={x.price_factor ?? 1} className={input} disabled={!formulaReady} /></Field>
              <Field l="Extra fee (USD)"><input name="extra_fee" inputMode="decimal" defaultValue={x.extra_fee ?? 0} className={input} disabled={!formulaReady} /></Field>
              <Field l="Max passengers"><input name="max_pax" type="number" min={1} defaultValue={x.max_pax} className={input} /></Field>
              <Field l="Luggage"><input name="luggage" defaultValue={x.luggage} className={input} /></Field>
              <Field l="Badge" className="sm:col-span-2"><input name="badge" defaultValue={x.badge} className={input} /></Field>
              <label className="flex items-center gap-2 text-sm font-bold min-h-10">
                <input type="checkbox" name="allows_stops" defaultChecked={x.allows_stops ?? true} disabled={!formulaReady} /> Stops allowed
              </label>
              <label className="flex items-center gap-2 text-sm font-bold min-h-10 sm:col-span-2">
                <input type="checkbox" name="spanish_speaking_driver" defaultChecked={x.spanish_speaking_driver ?? false} disabled={!formulaReady} /> Spanish-speaking driver
              </label>
              <Live on={x.active} />
            </AdminForm>
          </Card>
        ))}
      </Section>

      <Section
        title="Sightseeing stops"
        note="Stops are optional paid extras on the road between two towns. Price = minutes at the stop × the waiting rate + detour km and minutes at the ride formula's rates + guide fee, rounded to whole dollars (park entrance is separate). Tick every town the stop sits between: a ride offers it only when BOTH its pickup and drop-off are ticked. Tick just one town for a stop in that town. Never offered on the Sierpe ↔ Drake Bay boat."
      >
        <Card>
          {!stopsReady && (
            <p className="mb-3 text-sm text-amber-800">
              Run migration <code>20261109000021_stop_pricing.sql</code> to price stops by waiting time and detour. Until then
              each stop keeps its flat price.
            </p>
          )}
          <AdminForm action={saveWaitRate} className="grid gap-3 sm:grid-cols-6 items-end">
            <Field l="Waiting rate (USD per hour at a stop)" className="sm:col-span-2">
              <input name="wait_per_hour" inputMode="decimal" defaultValue={waitPerHour} className={input} disabled={!stopsReady} />
            </Field>
          </AdminForm>
          <p className="mt-2 text-xs text-slate-600">The driver gets their usual share of it (80% at today&apos;s commission).</p>
        </Card>
        {(s.data ?? []).map((x) => (
          <Card key={x.id}>
            <AdminForm action={saveStop} className="grid gap-3 sm:grid-cols-6 items-end">
              <input type="hidden" name="id" value={x.id} />
              <Field l="Name" className="sm:col-span-3"><input name="name" defaultValue={x.name} className={input} /></Field>
              <Field l="Minutes at the stop"><input name="duration_min" type="number" min={5} defaultValue={x.duration_min} className={input} /></Field>
              <Field l="Detour km (there and back)"><input name="detour_km" inputMode="decimal" defaultValue={x.detour_km ?? 0} className={input} disabled={!stopsReady} /></Field>
              <Field l="Detour minutes"><input name="detour_min" type="number" min={0} defaultValue={x.detour_min ?? 0} className={input} disabled={!stopsReady} /></Field>
              <Field l="Guide fee (USD)"><input name="guide_fee" inputMode="decimal" defaultValue={x.guide_fee ?? 0} className={input} disabled={!stopsReady} /></Field>
              <Field l="Price (computed)"><p className="min-h-10 flex items-center font-extrabold text-emerald-700">{formatUSD(stopPrice(x))}</p></Field>
              {x.entrance === undefined ? (
                // Before migration 0014: the old yes/no switch.
                <label className="flex items-center gap-2 text-sm min-h-10">
                  <input type="checkbox" name="park_fee_included" defaultChecked={x.park_fee_included} /> Park fee included
                </label>
              ) : (
                <Field l="Entrance">
                  <select name="entrance" defaultValue={x.entrance} className={input}>
                    {STOP_ENTRANCES.map((e) => (
                      <option key={e} value={e}>{ENTRANCE_ADMIN_LABEL[e]}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field l="Description" className="sm:col-span-6"><input name="description" defaultValue={x.description} className={input} /></Field>
              <Corridors selected={x.corridors} />
              <Live on={x.active} />
            </AdminForm>
          </Card>
        ))}
        <Card>
          <h3 className="font-extrabold text-slate-900 mb-3">Add a stop</h3>
          <AdminForm action={addStop} submitLabel="Add stop (hidden until you tick Live)" className="grid gap-3 sm:grid-cols-6 items-end">
            <Field l="Name" className="sm:col-span-3"><input name="name" required className={input} /></Field>
            <Field l="Minutes at the stop"><input name="duration_min" type="number" min={5} required className={input} /></Field>
            <Field l="Detour km (there and back)"><input name="detour_km" inputMode="decimal" defaultValue={0} className={input} disabled={!stopsReady} /></Field>
            <Field l="Detour minutes"><input name="detour_min" type="number" min={0} defaultValue={0} className={input} disabled={!stopsReady} /></Field>
            <Field l="Guide fee (USD)"><input name="guide_fee" inputMode="decimal" defaultValue={0} className={input} disabled={!stopsReady} /></Field>
            <Field l="Description" className="sm:col-span-6"><input name="description" className={input} /></Field>
            <Corridors selected={[]} />
          </AdminForm>
        </Card>
      </Section>

      <Section title="1-day tours">
        {(t.data ?? []).map((x) => (
          <Card key={x.id}>
            <AdminForm action={saveDayTour} className="grid gap-3 sm:grid-cols-6 items-end">
              <input type="hidden" name="id" value={x.id} />
              <Field l={`Name · ${REGION_NAMES[x.region] ?? x.region}`} className="sm:col-span-3"><input name="name" defaultValue={x.name} className={input} /></Field>
              <Field l="Price (USD)"><input name="price" inputMode="decimal" defaultValue={x.price} className={input} /></Field>
              <Field l="En-route upgrade"><input name="en_route_upgrade_price" inputMode="decimal" defaultValue={x.en_route_upgrade_price} className={input} /></Field>
              <Field l="Hours"><input name="duration_hours" inputMode="decimal" defaultValue={x.duration_hours} className={input} /></Field>
              <Live on={x.active} />
            </AdminForm>
          </Card>
        ))}
      </Section>

      <Section title="Expeditions & lodging">
        {(e.data ?? []).map((x) => (
          <Card key={x.id}>
            <AdminForm action={saveExpedition} className="grid gap-3 sm:grid-cols-6 items-end">
              <input type="hidden" name="id" value={x.id} />
              <Field l={`Name · ${x.days}D/${x.nights}N`} className="sm:col-span-4"><input name="name" defaultValue={x.name} className={input} /></Field>
              <Field l="Base price (USD)"><input name="base_price" inputMode="decimal" defaultValue={x.base_price} className={input} /></Field>
              <Live on={x.active} />
            </AdminForm>
          </Card>
        ))}
        {(l.data ?? []).map((x) => (
          <Card key={x.id}>
            <AdminForm action={saveLodgingTier} className="grid gap-3 sm:grid-cols-6 items-end">
              <input type="hidden" name="id" value={x.id} />
              <Field l="Lodging tier" className="sm:col-span-4"><input name="name" defaultValue={x.name} className={input} /></Field>
              <Field l="Surcharge (USD)"><input name="surcharge" inputMode="decimal" defaultValue={x.surcharge} className={input} /></Field>
              <Live on={x.active} />
            </AdminForm>
          </Card>
        ))}
      </Section>

      <Section
        title="Ferries"
        note="Gulf of Nicoya car ferries (Puntarenas ↔ Paquera / Playa Naranjo), per crossing, in colones as the ferry company charges them. Added on top of the ride price whenever Google's route takes a ferry, for the car with its driver plus each passenger, converted to dollars at the exchange rate here and rounded to whole dollars. Not season-adjusted. Check the exchange rate about once a week."
      >
        <Card>
          {!ferryReady && (
            <p className="mb-3 text-sm text-amber-800">
              Run migration <code>20261109000015_nicoya_ferry.sql</code> in the Supabase SQL editor to edit the ferry
              fares and the Southern Nicoya factor. Until then the site uses the numbers shown.
            </p>
          )}
          <AdminForm action={saveFerryFares} className="grid gap-3 sm:grid-cols-6 items-end">
            <Field l="Car + driver (₡ per crossing)" className="sm:col-span-2"><input name="ferry_vehicle_fare_crc" type="number" min={0} step={100} defaultValue={ferry.vehicleCrc} className={input} disabled={!ferryReady} /></Field>
            <Field l="Per passenger (₡ per crossing)" className="sm:col-span-2"><input name="ferry_passenger_fare_crc" type="number" min={0} step={50} defaultValue={ferry.passengerCrc} className={input} disabled={!ferryReady} /></Field>
            <Field l="Colones per US dollar" className="sm:col-span-2"><input name="crc_per_usd" inputMode="decimal" defaultValue={ferry.rate} className={input} disabled={!ferryReady} /></Field>
          </AdminForm>
          <p className="mt-3 text-xs text-slate-600">
            At ₡{ferry.rate} per dollar: car + driver {usd(ferry.vehicleCrc)}, each passenger {usd(ferry.passengerCrc)}.
            A crossing with 2 passengers adds {formatUSD(Math.round(crcToCents(ferry.vehicleCrc + 2 * ferry.passengerCrc, ferry.rate) / 100) * 100)}.
          </p>
        </Card>
      </Section>

      <Section
        title="Drivers' payout"
        note="Our share of each ride and day tour, as a percentage of the price minus pass-through costs (ferry tickets go to the driver in full). Drivers see only their payout on the job board and their trips, never the client's price. Expeditions are arranged by the team and have no automatic payout."
      >
        <Card>
          {!commissionReady && (
            <p className="mb-3 text-sm text-amber-800">
              Run migration <code>20261109000017_driver_job_board.sql</code> in the Supabase SQL editor to edit this.
              Until then the site uses {DRIVER_COMMISSION_BPS_DEFAULT / 100}%.
            </p>
          )}
          <AdminForm action={saveDriverCommission} className="grid gap-3 sm:grid-cols-6 items-end">
            <Field l="Our commission (%)" className="sm:col-span-2">
              <input name="commission_percent" inputMode="decimal" defaultValue={commissionBps / 100} className={input} disabled={!commissionReady} />
            </Field>
          </AdminForm>
          <p className="mt-3 text-xs text-slate-600">
            Example: a {formatUSD(16200)} ride pays the driver {formatUSD(Math.round(16200 * (1 - commissionBps / 10000)))}. Changing this only
            affects new bookings; each booking keeps the payout it was created with.
          </p>
        </Card>
      </Section>

      <Section
        title="Payment"
        note="Travellers pay online in full, or pay the driver in cash on rides and 1-day tours plus this cash booking fee (a % of the ride or tour price, shown in their trip total). Expeditions are always paid online."
      >
        <Card>
          {ps.error ? (
            <p className="text-sm text-amber-800">
              Run migration <code>20261108000012_payment_options.sql</code> in the Supabase SQL editor to edit the
              cash fee. Until then the site uses {CASH_FEE_BPS_DEFAULT / 100}%.
            </p>
          ) : (
            <AdminForm action={savePaymentSettings} className="grid gap-3 sm:grid-cols-6 items-end">
              <Field l="Cash booking fee (%)" className="sm:col-span-2">
                <input name="cash_fee_percent" inputMode="decimal" defaultValue={cashFeeBps / 100} className={input} />
              </Field>
            </AdminForm>
          )}
        </Card>
      </Section>

      <Section title="Seasons" note="A travel date uses the highest season whose dates include it; any other date uses the default season.">
        {(se.data ?? []).map((x) => (
          <Card key={x.id}>
            <AdminForm action={saveSeason} className="grid gap-3 sm:grid-cols-6 items-end">
              <input type="hidden" name="id" value={x.id} />
              <Field l={x.is_default ? "Name (default season)" : "Name"} className="sm:col-span-4"><input name="name" defaultValue={x.name} className={input} /></Field>
              <Field l="Multiplier (1.15 = +15%)"><input name="multiplier" inputMode="decimal" defaultValue={x.multiplier} className={input} /></Field>
            </AdminForm>
            {!x.is_default && (
              <ul className="mt-3 space-y-1.5 text-sm">
                {(r.data ?? []).filter((rr) => rr.season_id === x.id).map((rr) => (
                  <li key={rr.id} className="flex flex-wrap items-center gap-3">
                    <span>
                      {rr.starts_on} → {rr.ends_on}
                      {rr.note ? <span className="text-slate-500"> · {rr.note}</span> : null}
                    </span>
                    <AdminForm action={deleteSeasonRange} submitLabel="Remove" className="inline-flex">
                      <input type="hidden" name="id" value={rr.id} />
                    </AdminForm>
                  </li>
                ))}
              </ul>
            )}
            {!x.is_default && (
              <AdminForm action={addSeasonRange} submitLabel="Add dates" className="mt-3 grid gap-3 sm:grid-cols-6 items-end">
                <input type="hidden" name="season_id" value={x.id} />
                <Field l="From"><input type="date" name="starts_on" required className={input} /></Field>
                <Field l="To"><input type="date" name="ends_on" required className={input} /></Field>
                <Field l="Note" className="sm:col-span-2"><input name="note" placeholder="e.g. Semana Santa 2032" className={input} /></Field>
              </AdminForm>
            )}
          </Card>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
        {note && <p className="text-sm text-slate-500">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4">{children}</div>;
}

function Field({ l, className = "", children }: { l: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`${label} ${className}`}>
      {l}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function Live({ on }: { on: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm font-bold min-h-10">
      <input type="checkbox" name="active" defaultChecked={on} /> Live
    </label>
  );
}

function Corridors({ selected }: { selected: string[] }) {
  return (
    <fieldset className="sm:col-span-6">
      <legend className={label}>Corridors</legend>
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
