import { HUBS, REGION_NAMES, type Region } from "@/lib/catalog";
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
  saveSeason,
  saveStop,
  saveVehicle,
} from "./actions";

/* Row shapes as stored in the database (money is numeric dollars). */
interface Vehicle { id: string; name: string; base_rate: number; max_pax: number; luggage: string; badge: string; active: boolean }
interface Stop { id: string; name: string; description: string; duration_min: number; price: number; park_fee_included: boolean; corridors: string[]; active: boolean }
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
  const [v, s, t, e, l, se, r] = await Promise.all([
    db.from("vehicle_classes").select("*").order("sort_order").returns<Vehicle[]>(),
    db.from("sightseeing_stops").select("*").order("sort_order").returns<Stop[]>(),
    db.from("day_tours").select("*").order("sort_order").returns<Tour[]>(),
    db.from("expeditions").select("*").order("sort_order").returns<Expedition[]>(),
    db.from("lodging_tiers").select("*").order("sort_order").returns<Tier[]>(),
    db.from("seasons").select("*").order("priority").returns<Season[]>(),
    db.from("season_ranges").select("*").order("starts_on").returns<Range[]>(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Prices &amp; catalog</h1>
        <p className="mt-1 text-sm text-slate-600">
          Changes show on the site as soon as you press Save. Prices are in US dollars, before the
          season multiplier. Untick <strong>Live</strong> to hide something without deleting it.
        </p>
      </div>

      <Section title="Vehicles" note="Transfer price = vehicle rate + stops, × season. (Per-route pricing is still an open decision.)">
        {(v.data ?? []).map((x) => (
          <Card key={x.id}>
            <AdminForm action={saveVehicle} className="grid gap-3 sm:grid-cols-6 items-end">
              <input type="hidden" name="id" value={x.id} />
              <Field l="Name" className="sm:col-span-2"><input name="name" defaultValue={x.name} className={input} /></Field>
              <Field l="Rate (USD)"><input name="base_rate" inputMode="decimal" defaultValue={x.base_rate} className={input} /></Field>
              <Field l="Max passengers"><input name="max_pax" type="number" min={1} defaultValue={x.max_pax} className={input} /></Field>
              <Field l="Luggage"><input name="luggage" defaultValue={x.luggage} className={input} /></Field>
              <Field l="Badge"><input name="badge" defaultValue={x.badge} className={input} /></Field>
              <Live on={x.active} />
            </AdminForm>
          </Card>
        ))}
      </Section>

      <Section title="Sightseeing stops" note="Corridors = which pickup or drop-off towns offer this stop.">
        {(s.data ?? []).map((x) => (
          <Card key={x.id}>
            <AdminForm action={saveStop} className="grid gap-3 sm:grid-cols-6 items-end">
              <input type="hidden" name="id" value={x.id} />
              <Field l="Name" className="sm:col-span-3"><input name="name" defaultValue={x.name} className={input} /></Field>
              <Field l="Price (USD)"><input name="price" inputMode="decimal" defaultValue={x.price} className={input} /></Field>
              <Field l="Minutes"><input name="duration_min" type="number" min={5} defaultValue={x.duration_min} className={input} /></Field>
              <label className="flex items-center gap-2 text-sm min-h-10">
                <input type="checkbox" name="park_fee_included" defaultChecked={x.park_fee_included} /> Park fee included
              </label>
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
            <Field l="Price (USD)"><input name="price" inputMode="decimal" required className={input} /></Field>
            <Field l="Minutes"><input name="duration_min" type="number" min={5} required className={input} /></Field>
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
