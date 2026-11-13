/**
 * Security test for the Supabase migrations, run against an in-memory Postgres
 * (PGlite) with small stand-ins for Supabase's auth and storage schemas.
 *
 *   npm i --no-save @electric-sql/pglite && node supabase/tests/rls.test.mjs
 *
 * Each check acts as a real user (admin, clients, approved/pending drivers,
 * logged-out visitor) and asserts what they can and cannot see or change.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const db = new PGlite();

// --- Minimal Supabase stand-ins -------------------------------------------
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now(), email_confirmed_at timestamptz default now(), last_sign_in_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
`);

const dir = join(root, "supabase/migrations");
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(dir, f), "utf8"));
}
await db.exec(`
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant all on all tables in schema public, storage to anon, authenticated, service_role;
  grant all on all sequences in schema public to anon, authenticated, service_role;
  grant execute on all functions in schema public, auth, storage to anon, authenticated, service_role;
`);

// --- Helpers ----------------------------------------------------------------
let passed = 0;
const failures = [];
const U = {
  admin: "00000000-0000-0000-0000-00000000000a",
  client: "00000000-0000-0000-0000-00000000000c",
  client2: "00000000-0000-0000-0000-0000000000c2",
  driver: "00000000-0000-0000-0000-00000000000d",
  pending: "00000000-0000-0000-0000-0000000000e0",
};

async function as(user, sql, params = []) {
  await db.exec("reset role");
  if (user === "anon") {
    await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  } else if (user === "server") {
    await db.exec(`set role service_role; select set_config('request.jwt.claim.sub', '', false);`);
  } else {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${U[user]}', false);`);
  }
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
async function expectRows(name, user, sql, n) {
  try {
    const r = await as(user, sql);
    const got = r.rows.length === 1 && "n" in r.rows[0] ? Number(r.rows[0].n) : r.rows.length;
    if (got === n) passed++;
    else failures.push(`${name}: expected ${n}, got ${got}`);
  } catch (e) {
    failures.push(`${name}: unexpected error ${e.message}`);
  }
}
async function expectOk(name, user, sql) {
  try { await as(user, sql); passed++; } catch (e) { failures.push(`${name}: ${e.message}`); }
}
async function expectBlocked(name, user, sql, { affected } = {}) {
  try {
    const r = await as(user, sql);
    if (affected !== undefined && (r.affectedRows ?? 0) === 0) { passed++; return; }
    failures.push(`${name}: was allowed`);
  } catch { passed++; }
}

// --- Fixture: users -----------------------------------------------------------
for (const [k, id] of Object.entries(U)) {
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${k}@example.com`]);
}
await db.exec(`
  update public.profiles set role = 'admin' where id = '${U.admin}';
  update public.profiles set role = 'driver' where id in ('${U.driver}', '${U.pending}');
  insert into public.drivers (id, kyc_status, license_expiry, documents) values
    ('${U.driver}', 'approved', '2099-01-01', '{"license": "${U.driver}/license-0.pdf"}'),
    ('${U.pending}', 'pending', null, '{}');
  insert into public.driver_vehicles (id, driver_id, status, passenger_capacity, ins_insurance_expiry, dekra_inspection_expiry, marchamo_year, documents, photos) values
    ('30000000-0000-0000-0000-000000000001', '${U.driver}', 'approved', 4, '2099-01-01', '2099-01-01', 2099,
     '{"insurance": "${U.driver}/vehicles/1/insurance-0.pdf", "dekra": "${U.driver}/vehicles/1/dekra-0.pdf",
       "marchamo": "${U.driver}/vehicles/1/marchamo-0.pdf"}',
     '["${U.driver}/vehicles/1/photo-0.jpg", "${U.driver}/vehicles/1/photo-1.jpg"]');
`);

// --- Catalog ------------------------------------------------------------------
await expectRows("visitor reads active vehicles", "anon", "select * from public.vehicle_classes", 6);
await expectRows("visitor reads stops", "anon", "select * from public.sightseeing_stops", 5);
// Migration 0011: corridor lists for the "both ends" stop rule.
await expectRows("Tárcoles/Carara corridors updated", "anon",
  "select * from public.sightseeing_stops where id in ('tarcoles','carara') and corridors = array['SJO','Monteverde','ManuelAntonio','Sierpe','DrakeBay']::text[]", 2);
await expectRows("Río Celeste no longer on LIR ↔ Tamarindo", "anon",
  "select * from public.sightseeing_stops where id = 'rioceleste' and corridors = array['Arenal','LIR']::text[]", 1);
// Migration 0015: Southern Nicoya area + ferry fares.
await expectRows("Southern Nicoya area factor seeded", "anon", "select * from public.hub_pricing where hub_id = 'SouthNicoya' and area_factor = 1.35", 1);
await expectRows("ferry fares (colones) and exchange rate seeded", "anon", "select * from public.pricing_settings where ferry_vehicle_fare_crc = 15000 and ferry_passenger_fare_crc = 1500 and crc_per_usd = 452", 1);
await expectBlocked("absurd exchange rate refused", "admin", "update public.pricing_settings set crc_per_usd = 5");
await expectBlocked("unknown pricing area refused", "admin", "insert into public.hub_pricing (hub_id, area_factor) values ('Nowhere', 1)");
await expectBlocked("visitor cannot change ferry fares", "anon", "update public.pricing_settings set ferry_vehicle_fare_crc = 1", { affected: 0 });
// Migration 0023: company-paid tour costs, deducted before the driver's share.
await expectRows("tour costs per person seeded", "anon", "select * from public.day_tours where id = 'dt1' and cost_pp = 95", 1);
await expectRows("bookings record company costs", "admin", "select 1 from information_schema.columns where table_name = 'bookings' and column_name = 'company_costs'", 1);
await expectRows("drivers' functions never expose company costs", "admin",
  "select 1 from pg_proc where proname in ('driver_jobs','my_trips') and pg_get_function_result(oid) ~ 'company_costs'", 0);
// Migration 0022: day tours per person, tiered by group size.
await expectRows("Arenal day tour tiers seeded", "anon", "select * from public.day_tours where id = 'dt1' and price_pp_solo = 350 and price_pp_small = 295 and price_pp_group = 275", 1);
await expectBlocked("negative tour price refused", "admin", "update public.day_tours set price_pp_group = -1 where id = 'dt1'");
// Migration 0021: stops priced by waiting time + detour.
await expectRows("waiting rate seeded at $20/hour", "anon", "select * from public.pricing_settings where wait_per_hour = 20", 1);
await expectRows("Poás detour and per-person tour price seeded", "anon", "select * from public.sightseeing_stops where id = 'poas' and detour_km = 24 and detour_min = 40 and tour_price_pp = 55", 1);
await expectRows("Tárcoles is a plain stop (no tour part)", "anon", "select * from public.sightseeing_stops where id = 'tarcoles' and tour_price_pp = 0", 1);
await expectRows("on-the-way stops have no detour", "anon", "select * from public.sightseeing_stops where id in ('tarcoles','sloth') and detour_km = 0 and detour_min = 0", 2);
await expectBlocked("negative detour refused", "admin", "update public.sightseeing_stops set detour_km = -1 where id = 'poas'");
// Migration 0014: entrance is free / included / gate.
await expectRows("Tárcoles is a free stop", "anon", "select * from public.sightseeing_stops where id = 'tarcoles' and entrance = 'free'", 1);
await expectRows("other stops default to paid at the gate", "anon", "select * from public.sightseeing_stops where id <> 'tarcoles' and entrance = 'gate'", 4);
await expectBlocked("entrance only takes the three choices", "admin", "update public.sightseeing_stops set entrance = 'maybe' where id = 'carara'");
await expectOk("admin marks an entrance as included", "admin", "update public.sightseeing_stops set entrance = 'included' where id = 'carara'");
await expectBlocked("visitor cannot change prices", "anon", "update public.vehicle_classes set base_rate = 1", { affected: 0 });
await expectBlocked("client cannot change prices", "client", "update public.vehicle_classes set base_rate = 1", { affected: 0 });
await expectOk("admin changes a price", "admin", "update public.vehicle_classes set base_rate = 180 where id = 'suv'");
await expectOk("admin hides a stop", "admin", "update public.sightseeing_stops set active = false where id = 'sloth'");
await expectRows("visitor no longer sees hidden stop", "anon", "select * from public.sightseeing_stops", 4);
await expectRows("admin still sees hidden stop", "admin", "select * from public.sightseeing_stops", 5);

// --- Pricing settings (migration 0012) -------------------------------------------
await expectRows("visitor reads the cash fee (10%)", "anon", "select * from public.pricing_settings where cash_fee_bps = 1000", 1);
await expectBlocked("visitor cannot change the cash fee", "anon", "update public.pricing_settings set cash_fee_bps = 0", { affected: 0 });
await expectBlocked("client cannot change the cash fee", "client", "update public.pricing_settings set cash_fee_bps = 0", { affected: 0 });
await expectBlocked("visitor cannot add a settings row", "anon", "insert into public.pricing_settings (id, cash_fee_bps) values (false, 0)");
await expectBlocked("only one settings row can exist", "admin", "insert into public.pricing_settings (id, cash_fee_bps) values (false, 0)");
await expectOk("admin changes the cash fee", "admin", "update public.pricing_settings set cash_fee_bps = 1200");
await expectRows("visitor sees the new cash fee", "anon", "select * from public.pricing_settings where cash_fee_bps = 1200", 1);
await expectBlocked("cash fee above 50% is refused", "admin", "update public.pricing_settings set cash_fee_bps = 6000");
await expectOk("admin resets the cash fee", "admin", "update public.pricing_settings set cash_fee_bps = 1000");

// Ride formula (migration 0013)
// Migration 0016: price level on par with Daytrip.
await expectRows("visitor reads the ride formula", "anon", "select * from public.pricing_settings where ride_base_fare = 30 and ride_per_km = 0.90 and ride_per_hour = 10 and ride_minimum_fare = 120", 1);
await expectBlocked("visitor cannot change the ride formula", "anon", "update public.pricing_settings set ride_per_km = 0", { affected: 0 });
await expectBlocked("client cannot change the ride formula", "client", "update public.pricing_settings set ride_minimum_fare = 1", { affected: 0 });
await expectOk("admin changes the ride formula", "admin", "update public.pricing_settings set ride_per_km = 0.75");
await expectBlocked("negative per-km price is refused", "admin", "update public.pricing_settings set ride_per_km = -1");
await expectOk("admin resets the ride formula", "admin", "update public.pricing_settings set ride_per_km = 0.90");
await expectRows("visitor reads the 10 town + 1 extra area factors", "anon", "select * from public.hub_pricing", 11);
await expectRows("Osa pickups cost 15% more (Sierpe, Drake Bay, Puerto Jiménez)", "anon", "select * from public.hub_pricing where hub_id in ('Sierpe','DrakeBay','PuertoJimenez') and area_factor = 1.15", 3);
await expectBlocked("visitor cannot change an area factor", "anon", "update public.hub_pricing set area_factor = 1", { affected: 0 });
await expectBlocked("client cannot change an area factor", "client", "update public.hub_pricing set area_factor = 1", { affected: 0 });
await expectBlocked("client cannot add a town", "client", "insert into public.hub_pricing (hub_id) values ('SJO')");
await expectBlocked("unknown town is refused", "admin", "insert into public.hub_pricing (hub_id) values ('Narnia')");
await expectOk("admin changes an area factor", "admin", "update public.hub_pricing set area_factor = 1.05 where hub_id = 'LIR'");
await expectBlocked("area factor above 2 is refused", "admin", "update public.hub_pricing set area_factor = 3 where hub_id = 'LIR'");
await expectRows("Economy and Standard sedans exist", "anon", "select * from public.vehicle_classes where id in ('economy','sedan') and base_rate is null", 2);
await expectRows("Economy is a direct ride with a Spanish-speaking driver", "anon", "select * from public.vehicle_classes where id = 'economy' and price_factor = 0.90 and not allows_stops and spanish_speaking_driver", 1);
await expectBlocked("client cannot change a vehicle factor", "client", "update public.vehicle_classes set price_factor = 0.5", { affected: 0 });
await expectBlocked("vehicle factor above 3 is refused", "admin", "update public.vehicle_classes set price_factor = 5 where id = 'van'");

// --- Seasons --------------------------------------------------------------------
for (const [d, s] of [["2026-10-20", "green"], ["2026-12-10", "high"], ["2026-12-25", "peak"],
                      ["2027-02-10", "high"], ["2027-03-25", "peak"], ["2027-06-01", "green"]]) {
  const r = await db.query(`select public.season_for_date($1::date) as s`, [d]);
  if (r.rows[0].s === s) passed++; else failures.push(`season ${d}: expected ${s}, got ${r.rows[0].s}`);
}

// --- Profiles & roles -------------------------------------------------------------
await expectRows("visitor sees no profiles", "anon", "select * from public.profiles", 0);
await expectRows("client sees only own profile", "client", "select * from public.profiles", 1);
await expectRows("admin sees all profiles", "admin", "select * from public.profiles", 5);
await expectOk("client edits own name", "client", `update public.profiles set full_name = 'Sarah' where id = '${U.client}'`);
await expectBlocked("client cannot change own email", "client", `update public.profiles set email = 'boss@example.com' where id = '${U.client}'`);
await expectBlocked("client cannot make self admin", "client", `update public.profiles set role = 'admin' where id = '${U.client}'`);
await expectBlocked("client cannot edit someone else", "client", `update public.profiles set full_name = 'x' where id = '${U.client2}'`, { affected: 0 });

// --- Drivers / KYC ------------------------------------------------------------------
await expectRows("client sees no driver KYC", "client", "select * from public.drivers", 0);
await expectRows("driver sees only own KYC", "driver", "select * from public.drivers", 1);
await expectOk("driver updates own license", "pending", `update public.drivers set license_number = 'B1-123' where id = '${U.pending}'`);
await expectBlocked("pending driver cannot approve self", "pending", `update public.drivers set kyc_status = 'approved' where id = '${U.pending}'`);
await expectBlocked("client cannot apply as already approved", "client",
  `insert into public.drivers (id, kyc_status) values ('${U.client}', 'approved')`);
await expectBlocked("client cannot upload KYC docs before applying", "client",
  `insert into storage.objects (bucket_id, name) values ('driver-kyc-docs', '${U.client}/x.pdf')`);
await expectBlocked("client cannot apply on someone else's behalf", "client",
  `insert into public.drivers (id) values ('${U.client2}')`);
await expectOk("client applies as a driver (pending)", "client",
  `insert into public.drivers (id, license_number) values ('${U.client}', 'B1-999')`);
await expectRows("application is pending", "client",
  `select * from public.drivers where id = '${U.client}' and kyc_status = 'pending' and submitted_at is not null`, 1);
await expectOk("applicant uploads to own folder", "client",
  `insert into storage.objects (bucket_id, name) values ('driver-kyc-docs', '${U.client}/licence.pdf')`);
await expectRows("applicant cannot write a review note (silently ignored)", "client",
  `update public.drivers set kyc_note = 'looks great', reviewed_at = now() where id = '${U.client}' returning kyc_note`, 1);
await expectRows("review note stayed empty", "admin",
  `select * from public.drivers where id = '${U.client}' and kyc_note is null and reviewed_at is null`, 1);
await expectRows("applicant still cannot see other drivers", "client", "select * from public.drivers", 1);
await expectOk("admin approves a driver", "admin", `update public.drivers set kyc_status = 'approved' where id = '${U.pending}'`);
await expectOk("admin suspends driver again", "admin", `update public.drivers set kyc_status = 'pending' where id = '${U.pending}'`);
await expectBlocked("approved driver cannot change an expiry date without the new document", "driver",
  `update public.drivers set license_expiry = '2098-01-01' where id = '${U.driver}'`);
await expectOk("approved driver renews licence with the new document", "driver",
  `update public.drivers set license_expiry = '2098-01-01',
     documents = documents || '{"license": "${U.driver}/license-1.pdf"}' where id = '${U.driver}'`);
await expectRows("renewal flags the record for review", "admin",
  `select * from public.drivers where id = '${U.driver}' and needs_review and kyc_status = 'approved'`, 1);
await expectOk("location ping", "driver", `update public.drivers set last_lat = 9.9 where id = '${U.driver}'`);
await expectOk("admin clears the review flag", "admin", `update public.drivers set needs_review = false where id = '${U.driver}'`);
await expectOk("location ping again", "driver", `update public.drivers set last_lat = 9.8 where id = '${U.driver}'`);
await expectRows("location pings don't flag for review", "admin",
  `select * from public.drivers where id = '${U.driver}' and not needs_review`, 1);
await expectOk("applicant links a document in own folder", "client",
  `update public.drivers set documents = '{"license": "${U.client}/license-1.pdf"}' where id = '${U.client}'`);
await expectBlocked("applicant cannot link someone else's file", "client",
  `update public.drivers set documents = '{"license": "${U.driver}/license-1.pdf"}' where id = '${U.client}'`);
await expectBlocked("pending applicant cannot go on duty", "client",
  `update public.drivers set is_on_duty = true where id = '${U.client}'`);
await expectOk("approved driver goes on duty", "driver", `update public.drivers set is_on_duty = true where id = '${U.driver}'`);
await expectOk("admin suspends the driver", "admin", `update public.drivers set kyc_status = 'suspended' where id = '${U.driver}'`);
await expectRows("suspension takes them off duty", "admin",
  `select * from public.drivers where id = '${U.driver}' and not is_on_duty`, 1);
await expectOk("admin re-approves", "admin", `update public.drivers set kyc_status = 'approved' where id = '${U.driver}'`);

// Document validity: licence, Dekra and Marchamo have no grace period, insurance has 15 days.
const approvedNow = (name, n) =>
  expectRows(name, "driver", "select 1 where public.is_approved_driver()", n);
const setDriver = (sql) => as("server", `update public.drivers set ${sql} where id = '${U.driver}'`);
const setCar = (sql) => as("server", `update public.driver_vehicles set ${sql} where id = '30000000-0000-0000-0000-000000000001'`);
await approvedNow("approved driver with current documents gets trips", 1);
await setCar("ins_insurance_expiry = public.cr_today() - 15");
await approvedNow("insurance expired 15 days ago: still in grace", 1);
await setCar("ins_insurance_expiry = public.cr_today() - 16");
await approvedNow("insurance expired 16 days ago: no trips", 0);
await setCar("ins_insurance_expiry = '2099-01-01'");
await setDriver("license_expiry = public.cr_today() - 1");
await approvedNow("licence expired yesterday: no trips (no grace)", 0);
await setDriver("license_expiry = public.cr_today()");
await approvedNow("licence expiring today still counts", 1);
await setCar("marchamo_year = extract(year from public.cr_today())::int - 1");
await approvedNow("last year's Marchamo: no trips", 0);
await expectBlocked("expired documents: cannot go on duty", "driver",
  `update public.drivers set is_on_duty = true where id = '${U.driver}'`);
await setCar("marchamo_year = 2099, dekra_inspection_expiry = public.cr_today() - 1");
await approvedNow("Dekra expired yesterday: no trips (no grace)", 0);
await expectBlocked("cannot move the Dekra date without the new certificate", "driver",
  `update public.driver_vehicles set dekra_inspection_expiry = '2098-01-01' where id = '30000000-0000-0000-0000-000000000001'`);
await expectOk("Dekra renewed with the new certificate", "driver",
  `update public.driver_vehicles set dekra_inspection_expiry = '2098-01-01',
     documents = documents || '{"dekra": "${U.driver}/vehicles/1/dekra-1.pdf"}' where id = '30000000-0000-0000-0000-000000000001'`);
await expectRows("renewal flags the vehicle for review", "admin",
  `select 1 from public.driver_vehicles where id = '30000000-0000-0000-0000-000000000001' and needs_review and status = 'approved'`, 1);
await approvedNow("documents renewed: trips again", 1);

// --- Vehicles ------------------------------------------------------------------------
await expectRows("driver sees own vehicle", "driver", "select * from public.driver_vehicles", 1);
await expectRows("client sees no vehicles", "client2", "select * from public.driver_vehicles", 0);
await expectBlocked("non-driver cannot add a vehicle", "client2",
  `insert into public.driver_vehicles (driver_id) values ('${U.client2}')`);
await expectBlocked("cannot add a vehicle to someone else", "pending",
  `insert into public.driver_vehicles (driver_id) values ('${U.driver}')`);
await expectOk("driver adds a second vehicle (starts pending)", "driver",
  `insert into public.driver_vehicles (id, driver_id, status, make_model) values
   ('30000000-0000-0000-0000-000000000002', '${U.driver}', 'approved', 'Toyota Hiace')`);
await expectRows("new vehicle forced to pending", "admin",
  "select 1 from public.driver_vehicles where id = '30000000-0000-0000-0000-000000000002' and status = 'pending'", 1);
await expectBlocked("driver cannot approve own vehicle", "driver",
  "update public.driver_vehicles set status = 'approved' where id = '30000000-0000-0000-0000-000000000002'");
await expectBlocked("vehicle photos must be in own folder", "driver",
  `update public.driver_vehicles set photos = '["${U.pending}/x.jpg"]' where id = '30000000-0000-0000-0000-000000000002'`);
await expectOk("driver adds photos", "driver",
  `update public.driver_vehicles set photos = '["${U.driver}/vehicles/2/a.jpg", "${U.driver}/vehicles/2/b.jpg"]'
   where id = '30000000-0000-0000-0000-000000000002'`);
await expectBlocked("other driver cannot edit the vehicle", "pending",
  "update public.driver_vehicles set plate = 'X' where id = '30000000-0000-0000-0000-000000000002'", { affected: 0 });
await expectOk("admin approves the vehicle", "admin",
  "update public.driver_vehicles set status = 'approved' where id = '30000000-0000-0000-0000-000000000002'");
await expectOk("driver removes a vehicle", "driver",
  "delete from public.driver_vehicles where id = '30000000-0000-0000-0000-000000000002'");
await setCar("status = 'suspended'");
await approvedNow("no approved vehicle: no trips", 0);
await setCar("status = 'approved'");
await approvedNow("vehicle approved again: trips", 1);

// The admin pages join drivers to profiles with the hint profiles!drivers_id_fkey
// (drivers has two links to profiles since reviewed_by was added).
await expectRows("drivers_id_fkey constraint name is stable", "admin",
  "select 1 from pg_constraint where conname = 'drivers_id_fkey'", 1);

// --- Bookings -----------------------------------------------------------------------
await expectBlocked("client cannot create a booking with their own price", "client",
  `insert into public.bookings (client_id, service_type, total_price) values ('${U.client}', 'transfer', 1)`);
await expectOk("server creates bookings", "server", `
  insert into public.bookings (id, client_id, service_type, total_price, status) values
    ('10000000-0000-0000-0000-000000000001', '${U.client}', 'transfer', 190, 'pending_bids'),
    ('10000000-0000-0000-0000-000000000002', '${U.client2}', 'transfer', 200, 'confirmed')`);
await expectRows("client sees own booking only", "client", "select * from public.bookings", 1);
// Migration 0017: drivers read jobs and their trips through functions, never the booking row.
await expectOk("server sets the payout on the open ride", "server",
  "update public.bookings set driver_payout = 152, platform_fee = 38, scheduled_at = now() + interval '5 days', passenger_count = 2 where id = '10000000-0000-0000-0000-000000000001'");
await expectRows("approved driver sees the open job with the payout", "driver", "select * from public.driver_jobs() where driver_payout = 152", 1);
await expectRows("driver cannot read the full booking row", "driver", "select * from public.bookings", 0);
await expectRows("pending driver sees no jobs", "pending", "select * from public.driver_jobs()", 0);
await expectRows("client sees no open jobs", "client2", "select * from public.driver_jobs()", 0);
await expectRows("job board never exposes the client's price or contact", "admin",
  "select 1 from pg_proc where proname in ('driver_jobs','my_trips') and pg_get_function_result(oid) ~ '(total_price|platform_fee|amount_paid|guest|client_id|client_notes)'", 0);
await expectRows("job board shows the route town to town only", "admin",
  "select 1 from pg_proc where proname = 'driver_jobs' and pg_get_function_result(oid) ~ 'origin_town' and pg_get_function_result(oid) !~ 'origin_coords'", 1);
await expectRows("visitor sees no bookings", "anon", "select * from public.bookings", 0);
await expectBlocked("client cannot change own price", "client", "update public.bookings set total_price = 1", { affected: 0 });
await expectRows("booking ref generated", "admin", "select * from public.bookings where booking_ref like 'CRPT-1000%'", 2);

// --- Trip requests (file 7) -------------------------------------------------------
await expectOk("server saves the traveller's contact details", "server", `
  insert into public.trips (id, access_token, guest_name, guest_email, guest_phone) values
    ('40000000-0000-0000-0000-000000000001', repeat('ab', 32), 'Ana', 'ana@example.com', '+1 555 0100')`);
await expectOk("server saves a guest trip request", "server", `
  insert into public.bookings (id, trip_id, service_type, total_price, client_notes) values
    ('10000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000001', 'transfer', 230, 'Flight AA123')`);
await expectRows("visitor cannot see guest requests", "anon", "select * from public.bookings where trip_id is not null", 0);
await expectRows("other clients cannot see guest requests", "client2", "select * from public.bookings where trip_id is not null", 0);
// Migration 0012: payment options (online in full, or cash to the driver + cash fee).
await expectOk("server saves a cash-to-driver booking with its fee", "server",
  `update public.bookings set payment_mode = 'cash_driver', cash_fee = 23 where id = '10000000-0000-0000-0000-000000000009'`);
await expectOk("old deposit_20 rows stay valid", "server",
  `update public.bookings set payment_mode = 'deposit_20' where id = '10000000-0000-0000-0000-000000000009'`);
await expectBlocked("unknown payment mode is refused", "server",
  `update public.bookings set payment_mode = 'cash' where id = '10000000-0000-0000-0000-000000000009'`);
await expectBlocked("negative cash fee is refused", "server",
  `update public.bookings set cash_fee = -1 where id = '10000000-0000-0000-0000-000000000009'`);
await expectBlocked("visitor cannot change the cash fee on a booking", "anon",
  `update public.bookings set cash_fee = 0 where id = '10000000-0000-0000-0000-000000000009'`, { affected: 0 });
await expectBlocked("client cannot create a request directly", "client", `
  insert into public.bookings (service_type, total_price, client_notes) values ('transfer', 1, 'x')`);
await expectBlocked("admin cannot assign another driver's vehicle", "admin", `
  update public.bookings set assigned_driver_id = '${U.pending}', assigned_vehicle_id = '30000000-0000-0000-0000-000000000001'
   where id = '10000000-0000-0000-0000-000000000009'`);
await expectOk("admin assigns driver and vehicle", "admin", `
  update public.bookings set assigned_driver_id = '${U.driver}', assigned_vehicle_id = '30000000-0000-0000-0000-000000000001',
     status = 'confirmed' where id = '10000000-0000-0000-0000-000000000009'`);
await expectOk("admin writes an internal note", "admin", `
  insert into public.booking_admin_notes (booking_id, notes) values ('10000000-0000-0000-0000-000000000009', 'VIP')`);
await expectRows("assigned driver cannot read internal notes", "driver", "select * from public.booking_admin_notes", 0);
await expectRows("assigned driver sees the trip through my_trips()", "driver",
  "select 1 from public.my_trips() where id = '10000000-0000-0000-0000-000000000009'", 1);
await expectRows("assigned driver still cannot read the booking row itself", "driver",
  "select 1 from public.bookings where id = '10000000-0000-0000-0000-000000000009'", 0);
await expectRows("other driver's trips are not in my_trips()", "pending", "select * from public.my_trips()", 0);
// Migration 0035: passenger short name, bags and estimated arrival for the driver.
await expectRows("driver sees the passenger's first name only", "driver",
  "select 1 from public.my_trips() where id = '10000000-0000-0000-0000-000000000009' and passenger_name = 'Ana'", 1);
await expectRows("short name is first name + last initial", "admin",
  "select 1 where public.passenger_short_name('  emily rose   Smith ') = 'Emily S.' and public.passenger_short_name('Ana') = 'Ana'", 1);
await expectRows("a phone or email typed as the name never becomes a short name", "admin",
  "select 1 where public.passenger_short_name('8888 1234') is null and public.passenger_short_name('') is null and public.passenger_short_name('ana@x.com') = 'Anaxcom'", 1);
await expectBlocked("more than 20 bags refused", "server",
  "update public.bookings set luggage_count = 21 where id = '10000000-0000-0000-0000-000000000009'");
await expectOk("server saves bags, drive time and a stop", "server", `
  update public.bookings set luggage_count = 4, drive_minutes = 150, scheduled_at = now() + interval '2 days',
     sightseeing_stops = '[{"id":"tarcoles","price":15},{"id":"poas","price":68}]' where id = '10000000-0000-0000-0000-000000000009'`);
await expectRows("driver sees the bags", "driver",
  "select 1 from public.my_trips() where id = '10000000-0000-0000-0000-000000000009' and luggage_count = 4", 1);
// 150 min drive + Tárcoles 45 + Poás 120 at the stop + 40 detour = 355 min.
await expectRows("arrival = pickup + drive time + stops and detours", "driver",
  "select 1 from public.my_trips() where id = '10000000-0000-0000-0000-000000000009' and arrive_at - scheduled_at = interval '355 minutes'", 1);
await expectOk("server forgets the drive time", "server",
  "update public.bookings set drive_minutes = null where id = '10000000-0000-0000-0000-000000000009'");
await expectRows("no drive time: no arrival estimate", "driver",
  "select 1 from public.my_trips() where id = '10000000-0000-0000-0000-000000000009' and arrive_at is null", 1);
// Migration 0036: drivers never see the client's price, only their payout (cash to collect is the one exception).
await expectOk("server records a custom-offer note with the fixed price", "server",
  "update public.bookings set client_notes = 'Offer; fixed price was $260.00' where id = '10000000-0000-0000-0000-000000000009'");
await expectRows("assigned driver cannot read the client's price", "driver",
  "select total_price from public.bookings where id = '10000000-0000-0000-0000-000000000009'", 0);
await expectRows("assigned driver cannot read the price note", "driver",
  "select client_notes from public.bookings where id = '10000000-0000-0000-0000-000000000009'", 0);
await expectRows("no bookings policy lets the assigned driver read the row", "admin",
  "select 1 from pg_policies where tablename = 'bookings' and cmd in ('SELECT', 'ALL') and coalesce(qual, '') ~ 'assigned_driver_id'", 0);
await expectRows("assigned driver still reads the trip with stops, without stop prices", "driver",
  `select 1 from public.my_trips() where id = '10000000-0000-0000-0000-000000000009'
     and jsonb_array_length(sightseeing_stops) = 2 and sightseeing_stops->0->>'id' = 'tarcoles' and sightseeing_stops::text !~ 'price'`, 1);
await expectRows("no cash to collect on a trip that isn't paid in cash", "driver",
  "select 1 from public.my_trips() where id = '10000000-0000-0000-0000-000000000009' and cash_to_collect is null", 1);
await expectOk("server lists stops with prices on the open job", "server",
  "update public.bookings set sightseeing_stops = '[{\"id\":\"carara\",\"price\":123}]' where id = '10000000-0000-0000-0000-000000000001'");
await expectRows("job board shows the stop without its price", "driver",
  "select 1 from public.driver_jobs() where id = '10000000-0000-0000-0000-000000000001' and sightseeing_stops = '[{\"id\":\"carara\"}]'::jsonb", 1);
await expectRows("drivers' functions never return the client's price columns", "admin",
  "select 1 from pg_proc where proname in ('driver_jobs','my_trips','my_chat_unread','tracking_window') and pg_get_function_result(oid) ~ '(total_price|platform_fee|amount_paid|client_notes|company_costs|pricing_mode)'", 0);
// Migration 0037: bags split into large suitcases (luggage_count) and carry-ons (carry_on_count).
const BAGS = "'10000000-0000-0000-0000-000000000009'";
await expectRows("booking without a carry-on count: driver gets the large count and null", "driver",
  `select 1 from public.my_trips() where id = ${BAGS} and luggage_count = 4 and carry_on_count is null`, 1);
await expectBlocked("more than 20 carry-ons refused", "server", `update public.bookings set carry_on_count = 21 where id = ${BAGS}`);
await expectBlocked("negative carry-ons refused", "server", `update public.bookings set carry_on_count = -1 where id = ${BAGS}`);
await expectOk("server saves the carry-ons", "server", `update public.bookings set carry_on_count = 3 where id = ${BAGS}`);
await expectRows("driver sees large suitcases and carry-ons", "driver",
  `select 1 from public.my_trips() where id = ${BAGS} and luggage_count = 4 and carry_on_count = 3`, 1);
await expectRows("my_trips() still returns the stops without prices after 0037", "driver",
  `select 1 from public.my_trips() where id = ${BAGS} and jsonb_array_length(sightseeing_stops) = 2 and sightseeing_stops::text !~ 'price'`, 1);
await expectRows("my_trips() returns carry_on_count and still no price columns", "admin",
  "select 1 from pg_proc where proname = 'my_trips' and pg_get_function_result(oid) ~ 'carry_on_count' and pg_get_function_result(oid) !~ '(total_price|platform_fee|amount_paid|client_notes|company_costs|pricing_mode)'", 1);
await expectRows("assigned driver still cannot read the booking row (price, carry-ons or anything)", "driver",
  `select total_price, carry_on_count from public.bookings where id = ${BAGS}`, 0);
await expectRows("job board does not show bags", "admin",
  "select 1 from pg_proc where proname = 'driver_jobs' and pg_get_function_result(oid) ~ '(luggage_count|carry_on_count)'", 0);
// Migration 0040: the name sign at the pickup. One computed value for the driver (my_trips().sign_text).
const TRIP9 = "'40000000-0000-0000-0000-000000000001'";
await expectOk("server stores a full name on the test trip", "server", `update public.trips set guest_name = 'Emily Rose Smith' where id = ${TRIP9}`);
await expectRows("sign, nothing chosen: first name + last initial", "driver",
  `select 1 from public.my_trips() where id = ${BAGS} and sign_text = 'Emily S.' and passenger_name = 'Emily S.'`, 1);
await expectOk("server saves the traveller's own sign text", "server", `update public.bookings set sign_text = 'The Smith Family' where id = ${BAGS}`);
await expectRows("sign, own text: the driver gets exactly that text", "driver",
  `select 1 from public.my_trips() where id = ${BAGS} and sign_text = 'The Smith Family'`, 1);
await expectBlocked("own text together with 'no name' is refused", "server", `update public.bookings set sign_hide_name = true where id = ${BAGS}`);
await expectOk("server saves 'Don't show my name'", "server", `update public.bookings set sign_text = null, sign_hide_name = true where id = ${BAGS}`);
await expectRows("sign, no name: the driver gets the brand name", "driver",
  `select 1 from public.my_trips() where id = ${BAGS} and sign_text = 'Costa Rica Private Transfers'`, 1);
await expectRows("pickup_sign(): own text wins, then 'no name', then the short name, then the brand", "admin",
  `select 1 where public.pickup_sign('  VIP Tours  ', false, 'Emily Rose Smith') = 'VIP Tours'
     and public.pickup_sign(null, true, 'Emily Rose Smith') = 'Costa Rica Private Transfers'
     and public.pickup_sign('', false, 'Emily Rose Smith') = 'Emily S.'
     and public.pickup_sign(null, null, 'emily') = 'Emily'
     and public.pickup_sign(null, false, '8888 1234') = 'Costa Rica Private Transfers'
     and public.pickup_sign(null, false, null) = 'Costa Rica Private Transfers'`, 1);
await expectBlocked("a phone number on the sign is refused", "server", `update public.bookings set sign_hide_name = false, sign_text = 'Call 8888 1234' where id = ${BAGS}`);
await expectBlocked("a spaced phone number on the sign is refused", "server", `update public.bookings set sign_hide_name = false, sign_text = '+506 8888-1234' where id = ${BAGS}`);
await expectBlocked("an email on the sign is refused", "server", `update public.bookings set sign_hide_name = false, sign_text = 'ana@example.com' where id = ${BAGS}`);
await expectBlocked("a link on the sign is refused", "server", `update public.bookings set sign_hide_name = false, sign_text = 'www.mytours.com' where id = ${BAGS}`);
await expectBlocked("a sign longer than 40 characters is refused", "server", `update public.bookings set sign_hide_name = false, sign_text = repeat('a', 41) where id = ${BAGS}`);
await expectBlocked("an empty or untrimmed sign text is refused", "server", `update public.bookings set sign_hide_name = false, sign_text = ' Smith ' where id = ${BAGS}`);
await expectBlocked("a new booking with contact details on the sign is refused", "server",
  `insert into public.bookings (trip_id, service_type, total_price, sign_text) values (${TRIP9}, 'transfer', 100, 'wa.me/50688881234')`);
await expectRows("the refused changes left 'no name' in place", "driver",
  `select 1 from public.my_trips() where id = ${BAGS} and sign_text = 'Costa Rica Private Transfers'`, 1);
await expectRows("the driver's trip never carries the full name, phone or email", "driver",
  `select 1 from public.my_trips() m where m.id = ${BAGS} and (m::text ~* 'Rose|Smith|ana@example|555 0100')`, 0);
// Migration 0045 adds pickup_place after sign_text (still after every older column).
await expectRows("my_trips() returns sign_text (then pickup_place) last and no contact or price columns", "admin",
  "select 1 from pg_proc where proname = 'my_trips' and pg_get_function_result(oid) ~ 'carry_on_count smallint, sign_text text, pickup_place text\\)$' and pg_get_function_result(oid) !~ '(guest_|email|phone|total_price|platform_fee|amount_paid|client_notes|company_costs|pricing_mode|sign_hide_name)'", 1);
await expectRows("assigned driver still reads 0 rows from bookings (sign columns included)", "driver",
  `select sign_text, sign_hide_name from public.bookings`, 0);
await expectRows("assigned driver still reads 0 rows from trips (full name, phone, email)", "driver",
  `select guest_name, guest_phone, guest_email from public.trips`, 0);
await expectRows("job board does not show the sign", "admin",
  "select 1 from pg_proc where proname = 'driver_jobs' and pg_get_function_result(oid) ~ 'sign'", 0);
await expectBlocked("driver cannot change the sign", "driver", `update public.bookings set sign_text = 'x' where id = ${BAGS}`, { affected: 0 });
await expectOk("server resets the sign and the name", "server", `
  update public.bookings set sign_text = null, sign_hide_name = false where id = ${BAGS};`);
await expectOk("server resets the test trip's name", "server", `update public.trips set guest_name = 'Ana' where id = ${TRIP9}`);
await expectOk("server resets the test job", "server",
  "update public.bookings set sightseeing_stops = '[]' where id = '10000000-0000-0000-0000-000000000001'");
await expectOk("server resets the test note", "server",
  "update public.bookings set client_notes = 'Flight AA123' where id = '10000000-0000-0000-0000-000000000009'");
await expectOk("server resets the test trip", "server",
  "update public.bookings set luggage_count = null, carry_on_count = null, scheduled_at = null, sightseeing_stops = '[]' where id = '10000000-0000-0000-0000-000000000009'");

// --- Preferences & profiles (file 8) -----------------------------------------------
await expectOk("driver writes a bio", "driver",
  `update public.drivers set bio = 'Driving visitors around Arenal since 2010-2024, birder and dad of two.', english_level = 'fluent' where id = '${U.driver}'`);
await expectRows("bio change on an approved driver is flagged", "admin",
  `select 1 from public.drivers where id = '${U.driver}' and needs_review`, 1);
for (const [label, bio] of [["phone", "Call me at +506 8888-1234"], ["email", "write to pepe@gmail.com"], ["link", "see www.mytours.cr"], ["whatsapp", "wa.me/50688881234"]]) {
  await expectBlocked(`bio cannot contain a ${label}`, "driver", `update public.drivers set bio = '${bio}' where id = '${U.driver}'`);
}
await expectBlocked("English level must be fluent or basic", "driver",
  `update public.drivers set english_level = 'native' where id = '${U.driver}'`);
await expectOk("admin clears review flag", "admin", `update public.drivers set needs_review = false where id = '${U.driver}'`);
await expectOk("driver lists vehicle features", "driver",
  `update public.driver_vehicles set has_wifi = true, child_seats = 2 where id = '30000000-0000-0000-0000-000000000001'`);
await expectRows("feature change on an approved vehicle is flagged", "admin",
  "select 1 from public.driver_vehicles where id = '30000000-0000-0000-0000-000000000001' and needs_review", 1);
await expectOk("server saves preferences with a request", "server", `
  update public.bookings set preferences = '{"language":"english","child_seats":1,"pets":true}', driver_notes = 'We have a small dog'
   where id = '10000000-0000-0000-0000-000000000001'`);
await expectRows("job board shows preferences and the driver message", "admin",
  "select 1 from pg_proc where proname = 'driver_jobs' and pg_get_function_result(oid) ~ 'preferences' and pg_get_function_result(oid) ~ 'driver_notes'", 1);

const B = "'10000000-0000-0000-0000-000000000009'";
// --- Trip chat with guests (file 9) --------------------------------------------------
await expectOk("server posts a traveller message (no account)", "server", `
  insert into public.trip_chats (booking_id, sender_id, sender_role, message)
  values ('10000000-0000-0000-0000-000000000009', null, 'client', 'Hi! We land at 2pm.')`);
await expectBlocked("only travellers can post without an account", "server", `
  insert into public.trip_chats (booking_id, sender_id, sender_role, message)
  values ('10000000-0000-0000-0000-000000000009', null, 'driver', 'x')`);
// Migration 0034: contact details are hidden (not refused) and the original kept for admins.
await expectOk("traveller's phone number is hidden, not refused", "server", `
  insert into public.trip_chats (booking_id, sender_id, sender_role, message)
  values (${B}, null, 'client', 'text me at 8888 1234')`);
await expectRows("stored without the number", "admin",
  "select 1 from public.trip_chats where message = 'text me at [hidden]'", 1);
await as("server", "delete from public.trip_chats where message = 'text me at [hidden]'");
await expectBlocked("assigned driver cannot write to the chat directly", "driver", `
  insert into public.trip_chats (booking_id, sender_id, sender_role, message)
  values (${B}, '${U.driver}', 'driver', 'Pura vida!')`);
await expectBlocked("admins cannot write to the chat directly either", "admin", `
  insert into public.trip_chats (booking_id, sender_id, sender_role, message)
  values (${B}, '${U.admin}', 'admin', 'Hello')`);
await expectBlocked("participants cannot edit messages", "driver", `
  update public.trip_chats set message = 'x' where booking_id = ${B}`, { affected: 0 });
await expectOk("server posts the driver's reply", "server",
  `select public.post_chat_message(${B}, '${U.driver}', 'driver', 'Pura vida! I will be there at 1:45.', null, null)`);
await expectOk("server posts for the team, who may share contact details", "server",
  `select public.post_chat_message(${B}, '${U.admin}', 'admin', 'Driver phone: +506 8888 1234', null, null)`);
await expectRows("team message is stored as written", "admin",
  "select 1 from public.trip_chats where message = 'Driver phone: +506 8888 1234' and not flagged", 1);
await expectRows("assigned driver reads the trip chat", "driver",
  "select * from public.trip_chats where booking_id = '10000000-0000-0000-0000-000000000009'", 3);
await expectRows("other client cannot read it", "client2",
  "select * from public.trip_chats where booking_id = '10000000-0000-0000-0000-000000000009'", 0);
await expectRows("read receipts are server-only", "admin", "select * from public.chat_reads", 0);
await expectBlocked("drivers cannot touch read receipts", "driver",
  "insert into public.chat_reads (booking_id, party) values ('10000000-0000-0000-0000-000000000009', 'driver')");

// --- Review fixes for the chat (file 9) ----------------------------------------------
await expectRows("assigned driver cannot read the traveller's contact details or trip link", "driver", "select * from public.trips", 0);
await expectRows("booking rows no longer hold contact details", "admin",
  "select 1 from information_schema.columns where table_name = 'bookings' and column_name in ('guest_name','guest_email','guest_phone')", 0);
await expectRows("admin reads trip contacts", "admin", "select * from public.trips", 1);
await expectRows("visitor cannot read trip contacts", "anon", "select * from public.trips", 0);
// Migration 0033: the language of each trip request (emails and the trip page follow it).
await expectRows("trip language defaults to English", "admin", "select 1 from public.trips where language = 'en'", 1);
await expectOk("server saves a Spanish trip request", "server", `
  insert into public.trips (id, access_token, guest_name, guest_email, guest_phone, language) values
    ('40000000-0000-0000-0000-000000000002', repeat('cd', 32), 'Luis', 'luis@example.com', '+506 5550 0100', 'es')`);
await expectRows("Spanish trip is stored as 'es'", "admin", "select 1 from public.trips where language = 'es'", 1);
await expectBlocked("unknown trip language is refused", "server",
  "update public.trips set language = 'fr' where id = '40000000-0000-0000-0000-000000000002'");
await expectBlocked("drivers cannot change a trip's language", "driver", "update public.trips set language = 'es'", { affected: 0 });
await expectOk("remove the Spanish test trip", "server", "delete from public.trips where id = '40000000-0000-0000-0000-000000000002'");
await expectRows("trip requests: first five from one network allowed", "server",
  "select n from (select count(*) filter (where public.allow_trip_request('1.2.3.4', 'x' || g || '@example.com')) as n from generate_series(1, 7) g) t", 5);
await expectRows("trip requests: three per email address", "server",
  "select n from (select count(*) filter (where public.allow_trip_request('9.9.9.' || g, 'same@example.com')) as n from generate_series(1, 5) g) t", 3);
await expectRows("chat flood guard: 8 a minute per side", "server",
  `select n from (select count(*) as n from public.trip_chats where booking_id = '10000000-0000-0000-0000-000000000009' and sender_role = 'client') t`, 1);
for (let i = 0; i < 7; i++) {
  await expectOk(`message ${i + 2} in a minute is fine`, "server", "select public.post_chat_message('10000000-0000-0000-0000-000000000009', null, 'client', 'hello " + i + "', null, null)");
}
await expectBlocked("ninth message in a minute is refused", "server",
  "select public.post_chat_message('10000000-0000-0000-0000-000000000009', null, 'client', 'one more', null, null)");
await expectRows("first email to a party is allowed", "server",
  "select 1 where public.claim_chat_email('10000000-0000-0000-0000-000000000009', 'admin')", 1);
await expectRows("second email before they read is not", "server",
  "select 1 where public.claim_chat_email('10000000-0000-0000-0000-000000000009', 'admin')", 0);
await as("server", "update public.chat_reads set last_read_at = now() - interval '5 minutes', last_emailed_at = now() - interval '10 minutes' where party = 'admin'");
await expectRows("after they read, the next message emails again", "server",
  "select 1 where public.claim_chat_email('10000000-0000-0000-0000-000000000009', 'admin')", 1);
await as("server", "update public.chat_reads set last_read_at = now() where party = 'admin'");
await expectRows("no email while they're reading", "server",
  "select 1 where public.claim_chat_email('10000000-0000-0000-0000-000000000009', 'admin')", 0);
await expectOk("dates are not phone numbers", "server", `
  insert into public.trip_chats (booking_id, sender_role, message)
  values ('10000000-0000-0000-0000-000000000009', 'client', 'We land 2026-10-20 or 21.10.2026 at 2pm')`);
for (const m of ["8888_1234", "8888/1234", "mail a@b.com", "instagram @pepe_tours", "see www.x.com", "wa.me/50688881234"]) {
  await expectRows(`hidden in chat: ${m}`, "server",
    `select 1 where public.hide_contact_details('${m}') like '%[hidden]%'`, 1);
}
for (const m of ["We land 2026-10-20 or 21.10.2026 at 2pm", "Flight AA 1234 at 14:30", "4 adults, 2 kids", "2019-2024"]) {
  await expectRows(`kept in chat: ${m}`, "server", `select 1 where public.hide_contact_details('${m}') = '${m}'`, 1);
}
// The server's filter hides first and passes the original along: admins only.
await as("server", `update public.chat_reads set last_read_at = null, last_emailed_at = null where party = 'client'`);
await db.exec(`update public.trip_chats set sent_at = now() - interval '2 minutes' where booking_id = ${B}`);
await expectOk("server posts a filtered message with its original", "server",
  `select public.post_chat_message(${B}, '${U.driver}', 'driver', 'call me on [hidden]', 'call me on ocho ocho ocho ocho 1234', '{phone}')`);
await expectRows("message is marked flagged", "admin", "select 1 from public.trip_chats where flagged and message = 'call me on [hidden]'", 1);
await expectRows("admin reads the original", "admin", "select 1 from public.contact_flags where original like '%ocho ocho%' and source = 'chat'", 1);
await expectRows("driver cannot read originals", "driver", "select * from public.contact_flags", 0);
await expectRows("traveller account cannot read originals", "client", "select * from public.contact_flags", 0);
await expectRows("visitor cannot read originals", "anon", "select * from public.contact_flags", 0);
await expectBlocked("driver cannot write flags", "driver",
  `insert into public.contact_flags (booking_id, source, original) values (${B}, 'chat', 'x')`);
await expectOk("admin marks a flag reviewed", "admin", `update public.contact_flags set reviewed_at = now(), reviewed_by = '${U.admin}'`);
await expectBlocked("driver cannot mark flags reviewed", "driver", "update public.contact_flags set reviewed_at = null", { affected: 0 });
await expectRows("driver sees unread messages for their trip", "driver",
  `select 1 from public.my_chat_unread() where booking_id = ${B} and unread > 0`, 1);
await expectRows("other client sees no unread counts", "client2", "select * from public.my_chat_unread()", 0);
await expectRows("unread email waits 10 minutes", "server", "select * from public.claim_unread_chat_emails(interval '10 minutes')", 0);
await db.exec(`update public.trip_chats set sent_at = now() - interval '15 minutes' where booking_id = ${B}`);
await expectRows("then one email for the unread messages", "server", "select * from public.claim_unread_chat_emails(interval '10 minutes')", 1);
await expectRows("and no second email until they read", "server", "select * from public.claim_unread_chat_emails(interval '10 minutes')", 0);
await expectBlocked("drivers cannot claim chat emails", "driver", "select * from public.claim_unread_chat_emails(interval '0 minutes')");
// Booking notes the assigned driver can read never keep contact details.
await expectOk("server saves notes with a phone number", "server",
  `update public.bookings set flight_or_hotel_notes = 'Hotel Diria, call 8888-1234', client_notes = 'mail ana@x.com' where id = ${B}`);
await expectRows("booking row (which the assigned driver can read) keeps no contact details", "admin",
  `select 1 from public.bookings where id = ${B} and flight_or_hotel_notes = 'Hotel Diria, call [hidden]' and client_notes = 'mail [hidden]'`, 1);
await expectRows("admin keeps the original notes", "admin",
  `select 1 from public.contact_flags where booking_id = ${B} and source = 'booking_notes'`, 2);
await expectOk("server records a driver's language", "server", `update public.profiles set app_lang = 'en' where id = '${U.driver}'`);
await expectBlocked("unknown language refused", "server", `update public.profiles set app_lang = 'fr' where id = '${U.driver}'`);

// --- Bids -----------------------------------------------------------------------------
// Offers go through offer_job(); see the job-board section below for the full flow.
await expectBlocked("driver cannot offer on a booking that isn't on the board", "driver",
  `select public.offer_job('10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 150)`);
await expectBlocked("driver cannot mark an offer accepted", "driver",
  `update public.bids set status = 'accepted' where driver_id = '${U.driver}'`, { affected: 0 });
await expectOk("server closes the request", "server",
  `update public.bookings set status = 'confirmed' where id = '10000000-0000-0000-0000-000000000001'`);
await expectRows("other client sees no offers", "client2", "select * from public.bids", 0);

// --- Job board offers (migration 0017) -------------------------------------------------------
const V1 = "'30000000-0000-0000-0000-000000000001'";
const J3 = "'10000000-0000-0000-0000-000000000003'";
await expectOk("server posts a new ride to the job board", "server", `
  insert into public.bookings (id, client_id, service_type, total_price, driver_payout, platform_fee, status, passenger_count, scheduled_at)
  values (${J3}, '${U.client}', 'transfer', 200, 160, 40, 'pending_bids', 3, now() + interval '3 days')`);
await expectBlocked("pending driver cannot offer", "pending", `select public.offer_job(${J3}, ${V1}, 160)`);
await expectBlocked("driver cannot offer with someone else's vehicle", "driver",
  `select public.offer_job(${J3}, '30000000-0000-0000-0000-000000000099', 160)`);
await expectOk("server sets the vehicle's seats", "server", `update public.driver_vehicles set passenger_capacity = 2 where id = ${V1}`);
await expectBlocked("too few seats for the group", "driver", `select public.offer_job(${J3}, ${V1}, 160)`);
await expectOk("server sets the vehicle's seats", "server", `update public.driver_vehicles set passenger_capacity = 4 where id = ${V1}`);
await expectBlocked("offer below 70% of the payout refused", "driver", `select public.offer_job(${J3}, ${V1}, 100)`);
await expectBlocked("offer above 130% of the payout refused", "driver", `select public.offer_job(${J3}, ${V1}, 250)`);
await expectBlocked("offer note cannot contain a phone number", "driver", `select public.offer_job(${J3}, ${V1}, 160, 'call me 8888-1234')`);
await expectRows("approved driver sends an offer", "driver", `select public.offer_job(${J3}, ${V1}, 150, 'Already in La Fortuna that day') as ref`, 1);
await expectRows("driver changes the offer (one per driver per job)", "driver", `select public.offer_job(${J3}, ${V1}, 155) as ref`, 1);
await expectRows("one offer row, at the new amount", "admin", `select 1 from public.bids where booking_id = ${J3} and driver_id = '${U.driver}' and bid_amount = 155 and status = 'submitted'`, 1);
await expectRows("driver sees their offer on the job", "driver", `select 1 from public.driver_jobs() where id = ${J3} and my_offer = 155 and my_offer_status = 'submitted'`, 1);
await expectBlocked("driver cannot insert an offer directly", "driver",
  `insert into public.bids (booking_id, driver_id, bid_amount) values (${J3}, '${U.driver}', 1)`);
await expectBlocked("driver cannot edit the amount directly", "driver", `update public.bids set bid_amount = 999 where booking_id = ${J3}`, { affected: 0 });
await expectRows("client sees no offers", "client", "select * from public.bids", 0);
await expectBlocked("driver cannot accept an offer", "driver", `select public.accept_offer((select id from public.bids where booking_id = ${J3}))`);
await expectRows("admin accepts the offer", "admin", `select public.accept_offer((select id from public.bids where booking_id = ${J3})) as ref`, 1);
await expectRows("accepting assigned, confirmed and set the payout to the offer", "admin",
  `select 1 from public.bookings where id = ${J3} and status = 'confirmed' and assigned_driver_id = '${U.driver}' and assigned_vehicle_id = ${V1} and driver_payout = 155 and platform_fee = 45 and claimed_at is not null`, 1);
await expectBlocked("an accepted offer cannot be accepted again", "admin", `select public.accept_offer((select id from public.bids where booking_id = ${J3}))`);
await expectBlocked("no offers on a booking that left the board", "driver", `select public.offer_job(${J3}, ${V1}, 160)`);
await expectRows("assigned job left the board", "driver", `select * from public.driver_jobs() where id = ${J3}`, 0);
await expectRows("assigned job is in the driver's trips with the agreed payout", "driver",
  `select * from public.my_trips() where id = ${J3} and driver_payout = 155`, 1);
await expectOk("server posts a second ride", "server", `
  insert into public.bookings (id, client_id, service_type, total_price, driver_payout, platform_fee, status, passenger_count, scheduled_at)
  values ('10000000-0000-0000-0000-000000000004', '${U.client}', 'transfer', 100, 80, 20, 'pending_bids', 1, now() + interval '4 days')`);
await expectRows("driver offers on it", "driver", `select public.offer_job('10000000-0000-0000-0000-000000000004', ${V1}, 80) as ref`, 1);
await expectOk("driver withdraws the offer", "driver",
  `update public.bids set status = 'withdrawn' where booking_id = '10000000-0000-0000-0000-000000000004' and driver_id = '${U.driver}'`);
await expectBlocked("a withdrawn offer cannot be accepted", "admin",
  `select public.accept_offer((select id from public.bids where booking_id = '10000000-0000-0000-0000-000000000004'))`);
await expectRows("commission setting seeded", "anon", "select * from public.pricing_settings where driver_commission_bps = 2000", 1);
// Migration 0018: where the driver is based.
await expectOk("driver sets their home town", "driver", `update public.drivers set home_hub = 'Arenal' where id = '${U.driver}'`);
await expectRows("home town change does not send the driver back to review", "admin",
  `select 1 from public.drivers where id = '${U.driver}' and home_hub = 'Arenal' and not needs_review`, 1);
await expectOk("driver can be based in Puerto Jiménez", "driver", `update public.drivers set home_hub = 'PuertoJimenez' where id = '${U.driver}'`);
await expectRows("…saved", "driver", `select 1 from public.drivers where id = '${U.driver}' and home_hub = 'PuertoJimenez'`, 1);
await expectOk("…and Southern Nicoya still allowed", "driver", `update public.drivers set home_hub = 'SouthNicoya' where id = '${U.driver}'`);
await expectRows("one home-town check on drivers", "server",
  "select 1 from pg_constraint where conrelid = 'public.drivers'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%home_hub%'", 1);
await expectOk("driver back to La Fortuna", "driver", `update public.drivers set home_hub = 'Arenal' where id = '${U.driver}'`);
await expectBlocked("unknown home town refused", "driver", `update public.drivers set home_hub = 'Paris' where id = '${U.driver}'`);

// Migration 0019: travellers rate drivers; a comment counts double.
const B9 = "'10000000-0000-0000-0000-000000000009'";
await expectOk("server completes the trip", "server", `update public.bookings set status = 'completed' where id = ${B9}`);
await expectOk("server saves a stars-only rating", "server",
  `insert into public.driver_reviews (booking_id, driver_id, stars) values (${B9}, '${U.driver}', 5)`);
await expectRows("stars-only rating counts once", "admin", `select 1 from public.drivers where id = '${U.driver}' and rating_avg = 5.00 and rating_count = 1`, 1);
await expectBlocked("one rating per booking", "server", `insert into public.driver_reviews (booking_id, driver_id, stars) values (${B9}, '${U.driver}', 4)`);
await expectOk("server saves a rating with a comment on another trip", "server",
  `insert into public.driver_reviews (booking_id, driver_id, stars, comment) values ('10000000-0000-0000-0000-000000000003', '${U.driver}', 4, 'Punctual and careful on the mountain roads')`);
await expectRows("a comment counts double: (5×1 + 4×2) / 3 = 4.33 from 3", "admin",
  `select 1 from public.drivers where id = '${U.driver}' and rating_avg = 4.33 and rating_count = 3`, 1);
await expectBlocked("review comment cannot carry a phone number", "server",
  `insert into public.driver_reviews (booking_id, driver_id, stars, comment) values ('10000000-0000-0000-0000-000000000004', '${U.driver}', 5, 'call me 8888-1234')`);
await expectBlocked("stars must be 1–5", "server", `insert into public.driver_reviews (booking_id, driver_id, stars) values ('10000000-0000-0000-0000-000000000004', '${U.driver}', 6)`);
await expectRows("driver reads their own ratings", "driver", "select * from public.driver_reviews", 2);
await expectRows("another driver sees none", "pending", "select * from public.driver_reviews", 0);
await expectRows("clients see no ratings", "client", "select * from public.driver_reviews", 0);
await expectRows("visitors see no ratings", "anon", "select * from public.driver_reviews", 0);
await expectBlocked("driver cannot rate themselves", "driver",
  `insert into public.driver_reviews (booking_id, driver_id, stars) values ('10000000-0000-0000-0000-000000000004', '${U.driver}', 5)`);
await expectRows("review reminder column exists (migration 0020)", "admin",
  "select 1 from information_schema.columns where table_name = 'bookings' and column_name = 'review_reminded_at'", 1);
await expectOk("admin removes a rating", "admin", `delete from public.driver_reviews where booking_id = ${B9}`);
await expectRows("totals follow the removal", "admin", `select 1 from public.drivers where id = '${U.driver}' and rating_avg = 4.00 and rating_count = 2`, 1);

// Migration 0024: drivers start and complete their own trips.
await expectBlocked("driver cannot start a trip days ahead", "driver", `select public.driver_set_trip_status(${J3}, 'in_progress')`);
await expectOk("server moves the pickup to one hour from now", "server", `update public.bookings set scheduled_at = now() + interval '1 hour' where id = ${J3}`);
await expectBlocked("driver cannot complete a trip that hasn't started", "driver", `select public.driver_set_trip_status(${J3}, 'completed')`);
await expectBlocked("another driver cannot start it", "pending", `select public.driver_set_trip_status(${J3}, 'in_progress')`);
await expectBlocked("a client cannot start it", "client", `select public.driver_set_trip_status(${J3}, 'in_progress')`);
await expectRows("driver starts the trip", "driver", `select public.driver_set_trip_status(${J3}, 'in_progress') as ref`, 1);
await expectBlocked("driver cannot start it twice", "driver", `select public.driver_set_trip_status(${J3}, 'in_progress')`);
await expectBlocked("driver cannot set other statuses", "driver", `select public.driver_set_trip_status(${J3}, 'cancelled')`);
await expectRows("driver completes the trip", "driver", `select public.driver_set_trip_status(${J3}, 'completed') as ref`, 1);
// Migration 0032: drivers block days in their calendar.
await expectOk("server posts a job six days ahead", "server", `
  insert into public.bookings (id, client_id, service_type, total_price, driver_payout, platform_fee, status, passenger_count, scheduled_at)
  values ('10000000-0000-0000-0000-000000000008', '${U.client}', 'transfer', 100, 80, 20, 'pending_bids', 1, now() + interval '6 days')`);
// The driver can't read booking rows, so the day is worked out the same way the job's time was.
const DAY8 = "((now() + interval '6 days') at time zone 'America/Costa_Rica')::date";
await expectRows("driver sees the job", "driver", "select 1 from public.driver_jobs() where id = '10000000-0000-0000-0000-000000000008'", 1);
await expectRows("driver offers on it", "driver", "select public.offer_job('10000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000001', 80) as ref", 1);
await expectOk("driver blocks that day", "driver", `select public.set_unavailable(${DAY8}, true)`);
await expectRows("the blocked day is saved", "driver", "select * from public.driver_unavailable", 1);
await expectRows("blocking withdrew the open offer", "admin", "select 1 from public.bids where booking_id = '10000000-0000-0000-0000-000000000008' and status = 'withdrawn'", 1);
await expectRows("jobs on a blocked day are hidden", "driver", "select 1 from public.driver_jobs() where id = '10000000-0000-0000-0000-000000000008'", 0);
await expectBlocked("no offers on a blocked day", "driver", "select public.offer_job('10000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000001', 80)");
await expectBlocked("a past day cannot be blocked", "driver", "select public.set_unavailable(public.cr_today() - 1, true)");
await expectBlocked("a driver cannot write the calendar directly", "driver", `insert into public.driver_unavailable (driver_id, day) values ('${U.driver}', public.cr_today() + 30)`);
await expectBlocked("a client has no calendar", "client2", "select public.set_unavailable(public.cr_today() + 3, true)");
await expectRows("another driver sees no one else's days", "pending", "select * from public.driver_unavailable", 0);
await expectRows("the team sees blocked days", "admin", "select * from public.driver_unavailable", 1);
await expectOk("server assigns the driver a trip nine days ahead", "server", `
  insert into public.bookings (id, client_id, service_type, total_price, status, assigned_driver_id, scheduled_at)
  values ('10000000-0000-0000-0000-00000000000a', '${U.client}', 'transfer', 100, 'confirmed', '${U.driver}', now() + interval '9 days')`);
await expectBlocked("a day with a confirmed trip cannot be blocked", "driver",
  "select public.set_unavailable(((now() + interval '9 days') at time zone 'America/Costa_Rica')::date, true)");
await expectOk("driver unblocks the day", "driver", `select public.set_unavailable(${DAY8}, false)`);
await expectRows("the job is back", "driver", "select 1 from public.driver_jobs() where id = '10000000-0000-0000-0000-000000000008'", 1);
await expectOk("server removes the calendar-test bookings", "server", "delete from public.bookings where id in ('10000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-00000000000a')");
// Migration 0031: replacing key documents pauses new jobs until the team checks them.
await expectOk("server makes sure the driver is approved with a fresh review", "server", `update public.drivers set needs_review = false where id = '${U.driver}'`);
await expectOk("driver edits their bio (small change)", "driver", `update public.drivers set bio = 'Twenty years driving visitors around Arenal and the northern plains, birder.' where id = '${U.driver}'`);
await expectRows("a small edit flags but does not pause", "admin", `select 1 from public.drivers where id = '${U.driver}' and needs_review and not review_hold`, 1);
await expectOk("driver replaces their licence file", "driver", `update public.drivers set documents = documents || '{"license": "${U.driver}/license-new.pdf"}' where id = '${U.driver}'`);
await expectRows("replacing the licence pauses new jobs", "admin", `select 1 from public.drivers where id = '${U.driver}' and review_hold and kyc_status = 'approved'`, 1);
await expectOk("driver tries to clear the hold", "driver", `update public.drivers set review_hold = false where id = '${U.driver}'`);
await expectRows("a driver cannot clear the hold", "admin", `select 1 from public.drivers where id = '${U.driver}' and review_hold`, 1);
await expectOk("server posts a job for the hold test", "server", `
  insert into public.bookings (id, client_id, service_type, total_price, driver_payout, platform_fee, status, passenger_count, scheduled_at)
  values ('10000000-0000-0000-0000-000000000007', '${U.client}', 'transfer', 100, 80, 20, 'pending_bids', 1, now() + interval '4 days')`);
await expectBlocked("a driver on hold cannot send offers", "driver", `select public.offer_job('10000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000001', 80)`);
await expectOk("admin checks the change", "admin", `update public.drivers set needs_review = false where id = '${U.driver}'`);
await expectRows("the admin's check clears the hold", "admin", `select 1 from public.drivers where id = '${U.driver}' and not review_hold`, 1);
await expectOk("driver replaces the vehicle's insurance", "driver", `update public.driver_vehicles set documents = documents || '{"insurance": "${U.driver}/vehicles/1/insurance-new.pdf"}' where id = '30000000-0000-0000-0000-000000000001'`);
await expectRows("the vehicle is paused", "admin", "select 1 from public.driver_vehicles where id = '30000000-0000-0000-0000-000000000001' and review_hold and status = 'approved'", 1);
await expectBlocked("a vehicle on hold cannot be offered", "driver", `select public.offer_job('10000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000001', 80)`);
await expectOk("admin checks the vehicle", "admin", "update public.driver_vehicles set needs_review = false where id = '30000000-0000-0000-0000-000000000001'");
await expectRows("offers work again", "driver", `select public.offer_job('10000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000001', 80) as ref`, 1);
await expectOk("server removes the hold-test job", "server", "delete from public.bookings where id = '10000000-0000-0000-0000-000000000007'");
// Migration 0038: vehicle categories. A tagged vehicle only receives the jobs it can serve.
const CJ = (n) => `'10000000-0000-0000-0000-0000000000${n}'`;
const CLASS_JOBS = { economy: CJ("b1"), sedan: CJ("b2"), suv: CJ("b3"), "4x4": CJ("b4"), van: CJ("b5"), sierpe_combo: CJ("b6") };
await expectOk("server posts one ride per vehicle class and a day tour", "server", `
  insert into public.bookings (id, client_id, service_type, vehicle_class, total_price, driver_payout, platform_fee, status, passenger_count, scheduled_at) values
    ${Object.entries(CLASS_JOBS).map(([c, id]) => `(${id}, '${U.client}', 'transfer', '${c}', 100, 80, 20, 'pending_bids', 2, now() + interval '12 days')`).join(",\n    ")},
    (${CJ("b7")}, '${U.client}', 'day_tour', null, 100, 80, 20, 'pending_bids', 2, now() + interval '12 days')`);
const classJobIds = [...Object.values(CLASS_JOBS), CJ("b7")].join(", ");
const jobsSeen = (cls) => `select 1 from public.driver_jobs() where id in (${classJobIds})${cls ? ` and vehicle_class = '${cls}'` : ""}`;
await expectRows("the 4-traveller class is sold as a minivan, not an SUV", "anon", "select 1 from public.vehicle_classes where id = 'suv' and name = 'Minivan (MPV)' and badge = 'Roomy for 4 + bags' and max_pax = 4 and price_factor = 1.20", 1);
await expectRows("untagged vehicle: the driver gets every job, as before", "driver", jobsSeen(), 7);
await expectOk("driver tries to set their own vehicle's category", "driver", `update public.driver_vehicles set vehicle_class = 'van' where id = ${V1}`);
await expectRows("a driver cannot set their own vehicle's category", "admin", `select 1 from public.driver_vehicles where id = ${V1} and vehicle_class is null`, 1);
await expectOk("driver adds a vehicle and tries to tag it", "driver", `insert into public.driver_vehicles (id, driver_id, make_model, vehicle_class) values ('30000000-0000-0000-0000-0000000000c1', '${U.driver}', 'Toyota Hiace', 'van')`);
await expectRows("a new vehicle starts without a category", "admin", "select 1 from public.driver_vehicles where id = '30000000-0000-0000-0000-0000000000c1' and vehicle_class is null and status = 'pending'", 1);
await expectBlocked("an unknown category is refused", "admin", `update public.driver_vehicles set vehicle_class = 'sierpe_combo' where id = ${V1}`);
await expectOk("admin tags the vehicle as a sedan", "admin", `update public.driver_vehicles set vehicle_class = 'sedan' where id = ${V1}`);
await expectRows("tagging does not pause or un-approve the vehicle", "admin", `select 1 from public.driver_vehicles where id = ${V1} and vehicle_class = 'sedan' and status = 'approved' and not review_hold`, 1);
await expectRows("driver reads their vehicle's category", "driver", `select 1 from public.driver_vehicles where id = ${V1} and vehicle_class = 'sedan'`, 1);
await expectRows("sedan driver gets economy and sedan jobs, and the day tour", "driver", jobsSeen(), 3);
await expectRows("sedan driver does not get the minivan (suv) job", "driver", jobsSeen("suv"), 0);
await expectBlocked("sedan driver cannot offer on the minivan (suv) job", "driver", `select public.offer_job(${CLASS_JOBS.suv}, ${V1}, 80)`);
await expectRows("sedan driver offers on the economy job", "driver", `select public.offer_job(${CLASS_JOBS.economy}, ${V1}, 80) as ref`, 1);
await expectRows("sedan driver offers on the day tour (tours are not filtered by category)", "driver", `select public.offer_job(${CJ("b7")}, ${V1}, 80) as ref`, 1);
await expectOk("admin tags the vehicle as a van", "admin", `update public.driver_vehicles set vehicle_class = 'van' where id = ${V1}`);
await expectRows("van gets the minivan (suv) job", "driver", jobsSeen("suv"), 1);
await expectRows("van gets the van job", "driver", jobsSeen("van"), 1);
await expectRows("van does not get the 4x4 job", "driver", jobsSeen("4x4"), 0);
await expectRows("van does not get the 4x4 + boat job", "driver", jobsSeen("sierpe_combo"), 0);
await expectBlocked("van cannot offer on the 4x4 job", "driver", `select public.offer_job(${CLASS_JOBS["4x4"]}, ${V1}, 80)`);
await expectRows("van offers on the minivan (suv) job", "driver", `select public.offer_job(${CLASS_JOBS.suv}, ${V1}, 80) as ref`, 1);
await expectOk("admin tags the vehicle as a 4x4", "admin", `update public.driver_vehicles set vehicle_class = '4x4' where id = ${V1}`);
await expectRows("4x4 gets the 4x4 + boat (sierpe_combo) job", "driver", jobsSeen("sierpe_combo"), 1);
await expectRows("4x4 gets the 4x4 job", "driver", jobsSeen("4x4"), 1);
await expectRows("4x4 does not get the van job", "driver", jobsSeen("van"), 0);
await expectRows("4x4 offers on the 4x4 + boat job", "driver", `select public.offer_job(${CLASS_JOBS.sierpe_combo}, ${V1}, 80) as ref`, 1);
await expectOk("admin tags the vehicle as economy", "admin", `update public.driver_vehicles set vehicle_class = 'economy' where id = ${V1}`);
await expectRows("economy gets only the economy job and the day tour", "driver", jobsSeen(), 2);
await expectOk("admin tags it as a minivan (suv)", "admin", `update public.driver_vehicles set vehicle_class = 'suv' where id = ${V1}`);
await expectRows("minivan gets economy, sedan and minivan jobs, and the day tour", "driver", jobsSeen(), 4);
// The whole table, straight from the database function (same table as scripts/test-vehicle-eligibility.mjs).
await expectRows("vehicle_can_serve() matches the decided table", "admin", `
  select 1 from (values
    ('economy', array['economy']), ('sedan', array['economy','sedan']), ('suv', array['economy','sedan','suv']),
    ('4x4', array['economy','sedan','suv','4x4','sierpe_combo']), ('van', array['economy','sedan','suv','van']),
    ('van_4x4', array['economy','sedan','suv','van','4x4','sierpe_combo'])) as want(vehicle, jobs)
  cross join unnest(array['economy','sedan','suv','4x4','van','sierpe_combo']) as job
  where public.vehicle_can_serve(want.vehicle, job) is distinct from (job = any (want.jobs))`, 0);
await expectRows("no category, no job class or an unknown job class: not restricted", "admin",
  "select 1 where public.vehicle_can_serve(null, '4x4') and public.vehicle_can_serve('economy', null) and public.vehicle_can_serve('economy', 'limo')", 1);
// Migration 0039: (A) the board hides jobs that are too big for every one of the driver's
// vehicles, (B) van_4x4 gets van AND 4x4 jobs, (C) example models on every category.
const BIG = { sedan6: CJ("c1"), van6: CJ("c2"), tour6: CJ("c3"), fourByFour6: CJ("c4"), noCount: CJ("c5") };
const bigIds = Object.values(BIG).join(", ");
const sees = (id) => `select 1 from public.driver_jobs() where id = ${id}`;
await expectOk("server posts 6-traveller jobs and one job without a traveller count", "server", `
  insert into public.bookings (id, client_id, service_type, vehicle_class, total_price, driver_payout, platform_fee, status, passenger_count, scheduled_at) values
    (${BIG.sedan6}, '${U.client}', 'transfer', 'sedan', 100, 80, 20, 'pending_bids', 6, now() + interval '13 days'),
    (${BIG.van6}, '${U.client}', 'transfer', 'van', 100, 80, 20, 'pending_bids', 6, now() + interval '13 days'),
    (${BIG.tour6}, '${U.client}', 'day_tour', null, 100, 80, 20, 'pending_bids', 6, now() + interval '13 days'),
    (${BIG.fourByFour6}, '${U.client}', 'transfer', '4x4', 100, 80, 20, 'pending_bids', 6, now() + interval '13 days'),
    (${BIG.noCount}, '${U.client}', 'transfer', 'sedan', 100, 80, 20, 'pending_bids', null, now() + interval '13 days')`);
await expectOk("admin tags the 4-seat vehicle as a sedan", "admin", `update public.driver_vehicles set vehicle_class = 'sedan' where id = ${V1}`);
await expectRows("the test vehicle has 4 seats", "admin", `select 1 from public.driver_vehicles where id = ${V1} and passenger_capacity = 4`, 1);
await expectRows("4-seat sedan: a 6-traveller job in its own category is hidden", "driver", sees(BIG.sedan6), 0);
await expectRows("4-seat sedan: the 6-traveller van job is hidden", "driver", sees(BIG.van6), 0);
await expectRows("4-seat sedan: the 6-traveller day tour is hidden (tours follow the seat rule)", "driver", sees(BIG.tour6), 0);
await expectBlocked("and the offer on that 6-traveller job is refused, as before", "driver", `select public.offer_job(${BIG.sedan6}, ${V1}, 80)`);
await expectRows("4-seat sedan still gets the 2-traveller economy and sedan jobs and the day tour", "driver", jobsSeen(), 3);
await expectOk("server makes it an 8-seat vehicle", "server", `update public.driver_vehicles set passenger_capacity = 8 where id = ${V1}`);
await expectRows("8 seats but still tagged sedan: the 6-traveller sedan job shows", "driver", sees(BIG.sedan6), 1);
await expectRows("8 seats but tagged sedan: the van job stays hidden (category)", "driver", sees(BIG.van6), 0);
await expectOk("admin tags it as a van", "admin", `update public.driver_vehicles set vehicle_class = 'van' where id = ${V1}`);
await expectRows("8-seat van sees the 6-traveller van job", "driver", sees(BIG.van6), 1);
await expectRows("8-seat van sees the 6-traveller day tour", "driver", sees(BIG.tour6), 1);
await expectRows("8-seat van does not see the 6-traveller 4x4 job", "driver", sees(BIG.fourByFour6), 0);
await expectRows("8-seat van offers on the 6-traveller van job", "driver", `select public.offer_job(${BIG.van6}, ${V1}, 80) as ref`, 1);
// Category and seats must be right on the SAME vehicle.
await expectOk("server adds an approved 4-seat 4x4 to the same driver", "server", `
  insert into public.driver_vehicles (id, driver_id, status, make_model, passenger_capacity, vehicle_class)
  values ('30000000-0000-0000-0000-0000000000c2', '${U.driver}', 'approved', 'Toyota Prado', 4, '4x4')`);
await expectRows("the 4-seat 4x4 brings the 2-traveller 4x4 job", "driver", jobsSeen("4x4"), 1);
await expectRows("4-seat 4x4 + 8-seat van: the 6-traveller 4x4 job stays hidden", "driver", sees(BIG.fourByFour6), 0);
await expectOk("server removes the second vehicle", "server", "delete from public.driver_vehicles where id = '30000000-0000-0000-0000-0000000000c2'");
// No seat number: offer_job() counts it as 0 seats, so the board shows no job with travellers.
await expectOk("server clears the vehicle's seat number", "server", `update public.driver_vehicles set passenger_capacity = null where id = ${V1}`);
await expectBlocked("offer_job refuses a vehicle without a seat number (2 travellers)", "driver", `select public.offer_job(${CLASS_JOBS.economy}, ${V1}, 80)`);
await expectRows("so the board shows it no job that has travellers", "driver", `select 1 from public.driver_jobs() where passenger_count is not null`, 0);
await expectRows("a job without a traveller count is still listed", "driver", sees(BIG.noCount), 1);
await expectRows("and offer_job accepts it there too (board and offers agree)", "driver", `select public.offer_job(${BIG.noCount}, ${V1}, 80) as ref`, 1);
await expectOk("admin removes the category", "admin", `update public.driver_vehicles set vehicle_class = null where id = ${V1}`);
await expectRows("untagged and without seats: still no job with travellers", "driver", `select 1 from public.driver_jobs() where passenger_count is not null`, 0);
// B. A van that is also a 4x4.
await expectOk("driver tries to tag their own vehicle as van_4x4", "driver", `update public.driver_vehicles set vehicle_class = 'van_4x4' where id = ${V1}`);
await expectRows("a driver cannot set their own vehicle to van_4x4", "admin", `select 1 from public.driver_vehicles where id = ${V1} and vehicle_class is null`, 1);
await expectOk("server gives it 8 seats again", "server", `update public.driver_vehicles set passenger_capacity = 8 where id = ${V1}`);
await expectOk("admin tags it as van_4x4", "admin", `update public.driver_vehicles set vehicle_class = 'van_4x4' where id = ${V1}`);
await expectRows("tagging van_4x4 does not pause or un-approve the vehicle", "admin", `select 1 from public.driver_vehicles where id = ${V1} and vehicle_class = 'van_4x4' and status = 'approved' and not review_hold`, 1);
await expectRows("van_4x4 gets the van job", "driver", jobsSeen("van"), 1);
await expectRows("van_4x4 gets the minivan (suv) job", "driver", jobsSeen("suv"), 1);
await expectRows("van_4x4 gets the 4x4 job", "driver", jobsSeen("4x4"), 1);
await expectRows("van_4x4 gets the 4x4 + boat (sierpe_combo) job", "driver", jobsSeen("sierpe_combo"), 1);
await expectRows("van_4x4 gets all six classes and the day tour", "driver", jobsSeen(), 7);
await expectRows("8-seat van_4x4 sees the 6-traveller 4x4 job", "driver", sees(BIG.fourByFour6), 1);
await expectRows("van_4x4 offers on the van job", "driver", `select public.offer_job(${CLASS_JOBS.van}, ${V1}, 80) as ref`, 1);
await expectRows("van_4x4 offers on the 4x4 + boat job", "driver", `select public.offer_job(${CLASS_JOBS.sierpe_combo}, ${V1}, 80) as ref`, 1);
await expectBlocked("a category that does not exist is still refused", "admin", `update public.driver_vehicles set vehicle_class = 'van_4x2' where id = ${V1}`);
await expectOk("server restores the 4 seats and the minivan tag", "server", `update public.driver_vehicles set passenger_capacity = 4, vehicle_class = 'suv' where id = ${V1}`);
await expectOk("server removes the big-group jobs", "server", `delete from public.bookings where id in (${bigIds})`);
// C. Example models: read wherever the catalog is read, written by admins only.
await expectRows("visitor reads example models for all six categories", "anon", "select 1 from public.vehicle_classes where example_models is not null and example_models <> ''", 6);
await expectRows("client reads them too", "client", "select 1 from public.vehicle_classes where example_models is not null", 6);
await expectRows("driver reads them too", "driver", "select 1 from public.vehicle_classes where example_models is not null", 6);
await expectRows("the seeded examples", "anon", `
  select 1 from public.vehicle_classes where (id, example_models) in (('economy', 'Toyota Yaris'), ('sedan', 'Toyota Corolla'),
    ('suv', 'Mitsubishi Xpander'), ('4x4', 'Toyota Prado'), ('van', 'Toyota HiAce'), ('sierpe_combo', 'Toyota Prado'))`, 6);
await expectRows("category names no longer carry model names", "anon", "select 1 from public.vehicle_classes where (id, name) in (('4x4', 'Executive 4x4'), ('van', 'Private Van'), ('suv', 'Minivan (MPV)'))", 3);
await expectRows("no category name mentions a model", "anon", "select 1 from public.vehicle_classes where name ~* '(prado|fortuner|hiace|staria|toyota|hyundai)'", 0);
await expectRows("prices and sizes are untouched by the rename", "anon", "select 1 from public.vehicle_classes where (id = '4x4' and price_factor = 1.30 and max_pax = 4 and luggage = '4 suitcases') or (id = 'van' and price_factor = 1.35 and max_pax = 10 and luggage = '10 suitcases')", 2);
await expectBlocked("visitor cannot change example models", "anon", "update public.vehicle_classes set example_models = 'Ferrari'", { affected: 0 });
await expectBlocked("driver cannot change example models", "driver", "update public.vehicle_classes set example_models = 'Ferrari'", { affected: 0 });
await expectOk("admin edits the example models", "admin", "update public.vehicle_classes set example_models = 'Toyota Prado, Toyota Fortuner' where id = '4x4'");
await expectRows("visitor sees the admin's edit", "anon", "select 1 from public.vehicle_classes where id = '4x4' and example_models = 'Toyota Prado, Toyota Fortuner'", 1);
await expectBlocked("an over-long example text is refused", "admin", `update public.vehicle_classes set example_models = repeat('x', 81) where id = '4x4'`);
await expectOk("admin puts the example back", "admin", "update public.vehicle_classes set example_models = 'Toyota Prado' where id = '4x4'");
await expectRows("drivers still cannot read booking rows", "driver", "select * from public.bookings", 0);
await expectRows("the job board still never exposes the client's price or contact", "admin",
  "select 1 from pg_proc where proname = 'driver_jobs' and pg_get_function_result(oid) ~ '(total_price|platform_fee|amount_paid|guest|client_id|client_notes|phone|email)'", 0);
await expectOk("server removes the category-test jobs", "server", `delete from public.bookings where id in (${classJobIds})`);
await expectOk("server removes the category-test vehicle", "server", "delete from public.driver_vehicles where id = '30000000-0000-0000-0000-0000000000c1'");
await expectOk("server clears the category again", "server", `update public.driver_vehicles set vehicle_class = null where id = ${V1}`);
// Migration 0030: test checkout payments are marked as such.
await expectOk("server records a test payment", "server", `
  insert into public.payments (booking_id, provider, amount, type, status) values ('10000000-0000-0000-0000-000000000002', 'test', 200, 'full', 'succeeded')`);
await expectBlocked("unknown payment provider refused", "server", `
  insert into public.payments (booking_id, provider, amount, type, status) values ('10000000-0000-0000-0000-000000000002', 'paypal', 200, 'full', 'succeeded')`);
await expectBlocked("a client cannot record a payment", "client2", `
  insert into public.payments (booking_id, provider, amount, type, status) values ('10000000-0000-0000-0000-000000000002', 'test', 1, 'full', 'succeeded')`);
await expectBlocked("a driver cannot record a payment", "driver", `
  insert into public.payments (booking_id, provider, amount, type, status) values ('10000000-0000-0000-0000-000000000002', 'test', 1, 'full', 'succeeded')`);
await expectOk("server removes the test payment", "server", "delete from public.payments where provider = 'test'");
// Migration 0028: driver location around trips, with consent.
await expectRows("no position is stored without consent", "driver", "select public.report_location(9.99, -84.2) as ok", 1);
await expectRows("nothing stored yet", "admin", "select * from public.driver_locations", 0);
await expectOk("driver agrees to share location", "driver", "select public.set_location_consent(true)");
await expectOk("server opens a new trip one hour from now for the driver", "server", `
  insert into public.bookings (id, client_id, service_type, total_price, status, assigned_driver_id, scheduled_at)
  values ('10000000-0000-0000-0000-000000000005', '${U.client}', 'transfer', 100, 'confirmed', '${U.driver}', now() + interval '1 hour')`);
await expectRows("driver has a tracking window", "driver", "select * from public.tracking_window()", 1);
await expectRows("position accepted inside the window", "driver", "select 1 where public.report_location(9.99, -84.2, 12, 20, 90)", 1);
await expectRows("team sees the latest position", "admin", "select * from public.driver_locations where lat = 9.99 and booking_id = '10000000-0000-0000-0000-000000000005'", 1);
await expectRows("a second report replaces the first (no history)", "driver", "select 1 where public.report_location(10.01, -84.3)", 1);
await expectRows("still one row per driver", "admin", "select * from public.driver_locations", 1);
await expectRows("driver sees their own position", "driver", "select * from public.driver_locations", 1);
await expectRows("clients never see driver positions", "client", "select * from public.driver_locations", 0);
await expectRows("visitors never see driver positions", "anon", "select * from public.driver_locations", 0);
await expectBlocked("driver cannot write a position directly", "driver",
  `insert into public.driver_locations (driver_id, lat, lng) values ('${U.driver}', 1, 1)`);
await expectRows("another driver has no window", "pending", "select * from public.tracking_window()", 0);
await expectOk("server moves that pickup five hours ahead", "server", "update public.bookings set scheduled_at = now() + interval '5 hours' where id = '10000000-0000-0000-0000-000000000005'");
await expectRows("outside the window the position is refused", "driver", "select 1 where not public.report_location(9.5, -84.1)", 1);
await expectRows("and the stored position is erased", "admin", "select * from public.driver_locations", 0);
await expectOk("server brings the pickup back and the driver reports again", "server", "update public.bookings set scheduled_at = now() + interval '1 hour' where id = '10000000-0000-0000-0000-000000000005'");
await expectRows("accepted again", "driver", "select 1 where public.report_location(9.99, -84.2)", 1);
// Migration 0029: "on my way" opens the window early; arrival estimates live on the position row.
await expectOk("server moves the pickup five hours ahead again", "server", "update public.bookings set scheduled_at = now() + interval '5 hours' where id = '10000000-0000-0000-0000-000000000005'");
await expectRows("five hours ahead there is no window yet", "driver", "select * from public.tracking_window()", 0);
await expectRows("driver taps I'm on my way", "driver", "select public.driver_set_trip_status('10000000-0000-0000-0000-000000000005', 'en_route') as ref", 1);
await expectRows("on my way opens the tracking window", "driver", "select * from public.tracking_window()", 1);
await expectRows("and positions are accepted", "driver", "select 1 where public.report_location(10.2, -84.4)", 1);
await expectRows("my_trips shows the step", "driver", "select 1 from public.my_trips() where id = '10000000-0000-0000-0000-000000000005' and en_route_at is not null", 1);
await expectOk("server stores an arrival estimate", "server", `update public.driver_locations set eta_at = now() + interval '6 hours', late_min = 60 where driver_id = '${U.driver}'`);
await expectOk("server moves the pickup within three hours", "server", "update public.bookings set scheduled_at = now() + interval '1 hour' where id = '10000000-0000-0000-0000-000000000005'");
await expectRows("driver taps Client picked up", "driver", "select public.driver_set_trip_status('10000000-0000-0000-0000-000000000005', 'in_progress') as ref", 1);
await expectRows("the arrival estimate is cleared after pickup", "admin", `select 1 from public.driver_locations where driver_id = '${U.driver}' and eta_at is null and late_min is null`, 1);
await expectRows("driver taps Trip ended", "driver", "select public.driver_set_trip_status('10000000-0000-0000-0000-000000000005', 'completed') as ref", 1);
await expectRows("ending the trip erases the position", "admin", "select * from public.driver_locations", 0);
await expectRows("and closes the window", "driver", "select * from public.tracking_window()", 0);
await expectOk("server opens one more trip for the consent test", "server", `
  insert into public.bookings (id, client_id, service_type, total_price, status, assigned_driver_id, scheduled_at)
  values ('10000000-0000-0000-0000-000000000006', '${U.client}', 'transfer', 100, 'confirmed', '${U.driver}', now() + interval '1 hour')`);
await expectRows("accepted on the new trip", "driver", "select 1 where public.report_location(9.99, -84.2)", 1);
await expectBlocked("on my way is refused more than six hours ahead", "driver",
  "select public.driver_set_trip_status((select id from public.bookings where status = 'pending_bids' limit 1), 'en_route')");
await expectOk("driver withdraws consent", "driver", "select public.set_location_consent(false)");
await expectRows("withdrawing erases the position", "admin", "select * from public.driver_locations", 0);
await expectRows("and further positions are refused", "driver", "select 1 where not public.report_location(9.99, -84.2)", 1);
await expectOk("server cancels the extra trip", "server", "update public.bookings set status = 'cancelled' where id = '10000000-0000-0000-0000-000000000006'");
// Migration 0026: push tokens for the mobile apps.
await expectOk("driver registers their phone", "driver", "select public.register_device('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]', 'android', 'driver')");
await expectRows("driver sees their own token", "driver", "select * from public.device_tokens", 1);
await expectRows("nobody else sees it", "client", "select * from public.device_tokens", 0);
await expectRows("visitors see no tokens", "anon", "select * from public.device_tokens", 0);
await expectBlocked("cannot register a token for someone else", "client",
  `insert into public.device_tokens (token, user_id, platform, app) values ('ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]', '${U.driver}', 'ios', 'driver')`);
await expectBlocked("unknown platform refused", "driver", "select public.register_device('ExponentPushToken[cccccccccccccccccccccc]', 'windows', 'driver')");
await expectOk("the same phone signs in as another user", "client", "select public.register_device('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]', 'android', 'client')");
await expectRows("the token moved to the new user", "driver", "select * from public.device_tokens", 0);
// Migration 0025: settlements.
await expectOk("server makes the completed trip a cash trip", "server", `update public.bookings set payment_mode = 'cash_driver', cash_fee = 20 where id = ${J3}`);
await expectRows("driver sees how much cash to collect (price + fee)", "driver", `select 1 from public.my_trips() where id = ${J3} and cash_to_collect = 220`, 1);
await expectRows("online trips show no cash to collect", "driver", `select 1 from public.my_trips() where id <> ${J3} and cash_to_collect is not null and payment_mode <> 'cash_driver'`, 0);
await expectBlocked("driver cannot mark their own trip settled", "driver", `update public.bookings set driver_settled_at = now() where id = ${J3}`, { affected: 0 });
await expectOk("admin settles the trip", "admin", `update public.bookings set driver_settled_at = now() where id = ${J3}`);
await expectRows("driver sees it settled", "driver", `select 1 from public.my_trips() where id = ${J3} and driver_settled_at is not null`, 1);
await expectRows("trip is completed with both times recorded", "admin", `select 1 from public.bookings where id = ${J3} and status = 'completed' and started_at is not null and completed_at is not null`, 1);
await expectBlocked("commission above 50% refused", "admin", "update public.pricing_settings set driver_commission_bps = 9000");

// --- Trip chat --------------------------------------------------------------------------
await expectBlocked("client cannot write to the chat directly", "client", `
  insert into public.trip_chats (booking_id, sender_id, sender_role, message)
  values ('10000000-0000-0000-0000-000000000001', '${U.client}', 'client', 'Hola!')`);
await expectOk("server posts the client's message", "server",
  `select public.post_chat_message('10000000-0000-0000-0000-000000000001', '${U.client}', 'client', 'Hola!', null, null)`);
await expectBlocked("client cannot post as admin", "client", `
  insert into public.trip_chats (booking_id, sender_id, sender_role, message)
  values ('10000000-0000-0000-0000-000000000001', '${U.client}', 'admin', 'x')`);
await expectBlocked("stranger cannot post", "client2", `
  insert into public.trip_chats (booking_id, sender_id, sender_role, message)
  values ('10000000-0000-0000-0000-000000000001', '${U.client2}', 'client', 'x')`);
await expectRows("unassigned driver cannot read chat", "driver", "select * from public.trip_chats where booking_id <> '10000000-0000-0000-0000-000000000009'", 0);
await expectRows("admin reads chat", "admin", "select * from public.trip_chats where booking_id <> '10000000-0000-0000-0000-000000000009'", 1);

// --- Payments -------------------------------------------------------------------------------
await expectBlocked("client cannot record a payment", "client", `
  insert into public.payments (booking_id, amount, type) values ('10000000-0000-0000-0000-000000000001', 38, 'deposit')`);
await expectOk("server records a payment", "server", `
  insert into public.payments (booking_id, amount, type, status) values ('10000000-0000-0000-0000-000000000001', 38, 'deposit', 'succeeded')`);
await expectRows("client reads own payment", "client", "select * from public.payments", 1);
await expectRows("other client reads none", "client2", "select * from public.payments", 0);

// --- KYC document storage -----------------------------------------------------------------
await expectOk("driver uploads to own folder", "driver",
  `insert into storage.objects (bucket_id, name) values ('driver-kyc-docs', '${U.driver}/license.pdf')`);
await expectBlocked("driver cannot upload to another folder", "driver",
  `insert into storage.objects (bucket_id, name) values ('driver-kyc-docs', '${U.pending}/license.pdf')`);
await expectBlocked("non-applicant cannot upload KYC docs", "client2",
  `insert into storage.objects (bucket_id, name) values ('driver-kyc-docs', '${U.client2}/x.pdf')`);
await expectRows("other driver cannot read the document", "pending", "select * from storage.objects", 0);
await expectRows("admin reads the documents", "admin", "select * from storage.objects", 2);

// --- Night pickups (migration 0041) -------------------------------------------------------------
// The premium and its hours live in pricing_settings; the server's price functions are run
// here with the values read from this database, so a change in /admin/pricing changes prices.
await expectRows("night premium seeded: +20% from 22:00 to 04:00", "anon",
  "select 1 from public.pricing_settings where night_premium_bps = 2000 and night_start_hour = 22 and night_end_hour = 4", 1);
await expectBlocked("visitor cannot change the night premium", "anon", "update public.pricing_settings set night_premium_bps = 0", { affected: 0 });
await expectBlocked("driver cannot change the night premium", "driver", "update public.pricing_settings set night_premium_bps = 0", { affected: 0 });
await expectBlocked("night premium above 100% refused", "admin", "update public.pricing_settings set night_premium_bps = 10001");
await expectBlocked("negative night premium refused", "admin", "update public.pricing_settings set night_premium_bps = -1");
await expectBlocked("night start hour 24 refused", "admin", "update public.pricing_settings set night_start_hour = 24");
await expectBlocked("night end hour -1 refused", "admin", "update public.pricing_settings set night_end_hour = -1");
await expectRows("bookings keep their night premium, 0 unless set", "admin", "select 1 from public.bookings where night_premium <> 0", 0);
await expectBlocked("negative night premium on a booking refused", "server",
  "update public.bookings set night_premium = -1 where id = '10000000-0000-0000-0000-000000000009'");
await expectRows("drivers' functions never return the night premium (it is part of the client's price)", "admin",
  "select 1 from pg_proc where proname in ('driver_jobs','my_trips') and pg_get_function_result(oid) ~ 'night'", 0);
{
  const { registerHooks } = await import("node:module");
  // The app's files import each other without ".ts"; add it for Node.
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
      return nextResolve(specifier, context);
    },
  });
  const warn = console.warn;
  console.warn = () => {}; // the catalog warns about the WhatsApp number when loaded outside the site
  const { BUILT_IN_CATALOG } = await import("../../src/lib/catalogModel.ts");
  const { parseSpec, priceItem } = await import("../../src/lib/tripRequest.ts");
  const { splitPayout } = await import("../../src/lib/payout.ts");
  const { quoteTransfer } = await import("../../src/lib/pricing.ts");
  const { seasonForYmd } = await import("../../src/lib/catalogModel.ts");
  console.warn = warn;
  const expectEq = (name, got, want) => {
    if (got === want) passed++;
    else failures.push(`${name}: expected ${want}, got ${got}`);
  };
  /** The catalog with the night settings and the commission read from this database, as a visitor. */
  const liveCatalog = async () => {
    const r = (await as("anon", "select night_premium_bps, night_start_hour, night_end_hour, driver_commission_bps from public.pricing_settings")).rows[0];
    return {
      ...BUILT_IN_CATALOG,
      driverCommissionBps: Number(r.driver_commission_bps),
      nightPremium: { bps: Number(r.night_premium_bps), startHour: Number(r.night_start_hour), endHour: Number(r.night_end_hour) },
    };
  };
  const DATE = "2027-06-15"; // green season
  const ride = (time) => ({ kind: "transfer", origin: "SJO", destination: "ManuelAntonio", vehicleId: "sedan", stopIds: [], pax: 2, ...(time ? { pickupTime: time } : {}), pricing: "fixed" });
  let catalog = await liveCatalog();
  const price = (time) => priceItem(parseSpec(ride(time)), DATE, catalog);
  const usd = (c) => `$${(c / 100).toFixed(2)}`;
  const day = price("09:00");
  const shown = [];
  for (const [time, night] of [["21:30", false], ["22:00", true], ["23:30", true], ["03:30", true], ["04:00", false]]) {
    const p = price(time);
    expectEq(`night premium ${night ? "applied" : "not applied"} at ${time}`, p.totalCents, night ? Math.round(day.totalCents * 1.2) : day.totalCents);
    expectEq(`night premium amount at ${time}`, p.nightCents, night ? Math.round(day.totalCents * 0.2) : 0);
    shown.push(`${time} ${usd(p.totalCents)}`);
  }
  expectEq("old-style request without a pickup time: no premium", price(null).totalCents, day.totalCents);
  // Driver payout: commission after pass-throughs, so it rises with the premium.
  const night = price("23:30");
  const payDay = splitPayout(day.totalCents, day.passThroughCents, catalog, day.companyCostCents).payoutCents;
  const payNight = splitPayout(night.totalCents, night.passThroughCents, catalog, night.companyCostCents).payoutCents;
  const keep = 1 - catalog.driverCommissionBps / 10000;
  expectEq("driver payout by day", payDay, Math.round(day.totalCents * keep));
  expectEq("driver payout rises with the night premium", payNight - payDay, Math.round(night.nightCents * keep));
  // Pass-through costs are not marked up: the ferry and the Drake Bay boat fee.
  const season = seasonForYmd(DATE, catalog);
  const ferryRoute = { km: 180, drivingMinutes: 240, totalMinutes: 330, ferries: 1 };
  const q = (time, o) => quoteTransfer({ origin: "SJO", destination: "Tamarindo", vehicleId: "sedan", stopIds: [], pax: 2, season, catalog, pickupTime: time, ...o });
  const fDay = q("09:00", { route: ferryRoute });
  const fNight = q("23:30", { route: ferryRoute });
  expectEq("ferry fare not marked up at night", fNight.ferryCents, fDay.ferryCents);
  expectEq("with a ferry, the premium is on the ride only", fNight.totalCents - fDay.totalCents, Math.round((fDay.totalCents - fDay.ferryCents) * 0.2));
  const boatFee = catalog.vehicles.find((v) => v.id === "sierpe_combo").extraFeeCents;
  const bDay = q("09:00", { destination: "DrakeBay", vehicleId: "sierpe_combo" });
  const bNight = q("03:30", { destination: "DrakeBay", vehicleId: "sierpe_combo" });
  expectEq("Drake Bay boat fee not marked up at night", bNight.totalCents - bDay.totalCents, Math.round((bDay.totalCents - boatFee) * 0.2));
  const sDay = priceItem(parseSpec({ ...ride("09:00"), stopIds: ["tarcoles", "carara"] }), DATE, catalog);
  const sNight = priceItem(parseSpec({ ...ride("23:30"), stopIds: ["tarcoles", "carara"] }), DATE, catalog);
  expectEq("stops and their entrances not marked up at night", sNight.totalCents - sDay.totalCents, night.nightCents);
  // Travellers book at the fixed price only (2026-11-11): an offer is never parsed, so never priced.
  expectEq("a traveller's offer is not parsed", parseSpec({ ...ride("23:30"), pricing: "bid", offerCents: 15000 }), null);
  console.log(`  night pickups (values from the database): ${shown.join(" · ")}; driver payout ${usd(payDay)} → ${usd(payNight)}`);

  // Migration 0055: Puerto Jiménez, priced like every other town with the area factor and the
  // season multipliers read from this database (never hard-coded).
  {
    const areas = (await as("anon", "select hub_id, area_factor from public.hub_pricing")).rows;
    const seasonRows = (await as("anon", "select id, multiplier from public.seasons")).rows;
    const pjCatalog = {
      ...catalog,
      areaFactorBps: { ...catalog.areaFactorBps, ...Object.fromEntries(areas.map((r) => [r.hub_id, Math.round(Number(r.area_factor) * 10000)])) },
      seasons: catalog.seasons.map((s) => {
        const row = seasonRows.find((r) => r.id === s.id);
        return row ? { ...s, multiplierBps: Math.round(Number(row.multiplier) * 10000) } : s;
      }),
    };
    expectEq("Puerto Jiménez area factor read from the database", pjCatalog.areaFactorBps.PuertoJimenez, 11500);
    const pj = (o, d, vehicleId, date, cat = pjCatalog) =>
      priceItem(parseSpec({ kind: "transfer", origin: o, destination: d, vehicleId, stopIds: [], pax: 2, pickupTime: "08:00", pricing: "fixed" }), date, cat);
    // Standard: max($120, $30 + $0.90 × km + $10 × hours) × vehicle × pickup area, whole dollars.
    expectEq("SJO → Puerto Jiménez, Standard, green season ($30 + 370 km + 6 h)", pj("SJO", "PuertoJimenez", "sedan", DATE).totalCents, 42300);
    expectEq("Puerto Jiménez → SJO costs the Osa area factor more (×1.15)", pj("PuertoJimenez", "SJO", "sedan", DATE).totalCents, 48600);
    expectEq("Manuel Antonio → Puerto Jiménez, Standard", pj("ManuelAntonio", "PuertoJimenez", "sedan", DATE).totalCents, 26900);
    expectEq("Sierpe → Puerto Jiménez, Standard (Osa pickup)", pj("Sierpe", "PuertoJimenez", "sedan", DATE).totalCents, 19700);
    expectEq("SJO → Puerto Jiménez, Economy (×0.90)", pj("SJO", "PuertoJimenez", "economy", DATE).totalCents, 38100);
    expectEq("SJO → Puerto Jiménez, Van (×1.35)", pj("SJO", "PuertoJimenez", "van", DATE).totalCents, 57100);
    const high = seasonForYmd("2027-01-20", pjCatalog);
    expectEq("high season multiplier from the database", high.multiplierBps, Math.round(Number(seasonRows.find((r) => r.id === "high")?.multiplier) * 10000));
    expectEq("SJO → Puerto Jiménez in high season = green price × the database multiplier",
      pj("SJO", "PuertoJimenez", "sedan", "2027-01-20").totalCents, Math.round((42300 * high.multiplierBps) / 10000));
    expectEq("the drive time comes from the town table (6 h)",
      quoteTransfer({ origin: "SJO", destination: "PuertoJimenez", vehicleId: "sedan", stopIds: [], pax: 2, season: high, catalog: pjCatalog }).driveMinutes, 360);
    await expectOk("admin changes the Puerto Jiménez area factor", "admin", "update public.hub_pricing set area_factor = 1.25 where hub_id = 'PuertoJimenez'");
    const changed = Math.round(Number((await as("anon", "select area_factor from public.hub_pricing where hub_id = 'PuertoJimenez'")).rows[0].area_factor) * 10000);
    expectEq("…the price follows the database", pj("PuertoJimenez", "SJO", "sedan", DATE, { ...pjCatalog, areaFactorBps: { ...pjCatalog.areaFactorBps, PuertoJimenez: changed } }).totalCents, 52900);
    await expectOk("admin restores the Puerto Jiménez area factor", "admin", "update public.hub_pricing set area_factor = 1.15 where hub_id = 'PuertoJimenez'");
  }

  // The team changes the settings in /admin/pricing: prices follow the database.
  await expectOk("admin changes the night premium and its hours", "admin",
    "update public.pricing_settings set night_premium_bps = 3000, night_start_hour = 21, night_end_hour = 5");
  catalog = await liveCatalog();
  expectEq("after the change, 21:30 is night at +30%", price("21:30").totalCents, Math.round(day.totalCents * 1.3));
  expectEq("after the change, 04:00 is night too", price("04:00").totalCents, Math.round(day.totalCents * 1.3));
  expectEq("after the change, 05:00 is day", price("05:00").totalCents, day.totalCents);
  await expectOk("admin switches the night premium off", "admin", "update public.pricing_settings set night_premium_bps = 0");
  catalog = await liveCatalog();
  expectEq("premium off: 23:30 costs the day price", price("23:30").totalCents, day.totalCents);
  await expectOk("admin restores the night settings", "admin",
    "update public.pricing_settings set night_premium_bps = 2000, night_start_hour = 22, night_end_hour = 4");
  // The server stores the premium with the booking.
  await expectOk("server saves a night ride with its premium", "server",
    `update public.bookings set total_price = ${night.totalCents / 100}, night_premium = ${night.nightCents / 100}, driver_payout = ${payNight / 100}
      where id = '10000000-0000-0000-0000-000000000009'`);
  await expectRows("admin sees the premium on the booking", "admin",
    `select 1 from public.bookings where id = '10000000-0000-0000-0000-000000000009' and night_premium = ${night.nightCents / 100}`, 1);
  await expectOk("server resets the test booking's price", "server",
    "update public.bookings set total_price = 230, night_premium = 0, driver_payout = null where id = '10000000-0000-0000-0000-000000000009'");
}

// Migration 0042: electric vehicles. A mark on the vehicle set by the team only; a free
// "if available" request in the preferences; a badge for the traveller. No category, no price.
{
  const EV = "'30000000-0000-0000-0000-0000000000e1'";
  await expectRows("vehicles are not electric unless the team says so", "admin", "select 1 from public.driver_vehicles where is_electric", 0);
  await expectOk("driver tries to mark their own vehicle as electric", "driver", `update public.driver_vehicles set is_electric = true where id = ${V1}`);
  await expectRows("a driver cannot mark their own vehicle as electric (update ignored)", "admin", `select 1 from public.driver_vehicles where id = ${V1} and not is_electric`, 1);
  await expectOk("driver adds a vehicle and tries to mark it as electric", "driver",
    `insert into public.driver_vehicles (id, driver_id, make_model, is_electric) values (${EV}, '${U.driver}', 'BYD Yuan Plus', true)`);
  await expectRows("a new vehicle starts as not electric (insert ignored)", "admin", `select 1 from public.driver_vehicles where id = ${EV} and not is_electric and status = 'pending'`, 1);
  await expectBlocked("a client cannot mark a vehicle as electric", "client", `update public.driver_vehicles set is_electric = true where id = ${V1}`, { affected: 0 });
  await expectBlocked("a visitor cannot mark a vehicle as electric", "anon", `update public.driver_vehicles set is_electric = true where id = ${V1}`, { affected: 0 });
  const stateSql = `select vehicle_class, status, review_hold, needs_review, passenger_capacity from public.driver_vehicles where id = ${V1}`;
  const before = (await as("admin", stateSql)).rows[0];
  await expectOk("admin marks the vehicle as electric", "admin", `update public.driver_vehicles set is_electric = true where id = ${V1}`);
  await expectRows("the admin's mark is saved", "admin", `select 1 from public.driver_vehicles where id = ${V1} and is_electric`, 1);
  const after = (await as("admin", stateSql)).rows[0];
  if (JSON.stringify(before) === JSON.stringify(after)) passed++;
  else failures.push(`marking a vehicle electric changed its category, approval or seats: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  await expectRows("driver reads the mark on their own vehicle", "driver", `select 1 from public.driver_vehicles where id = ${V1} and is_electric`, 1);
  await expectOk("driver edits their vehicle and tries to remove the mark", "driver", `update public.driver_vehicles set is_electric = false where id = ${V1}`);
  await expectRows("a driver cannot remove the mark either", "admin", `select 1 from public.driver_vehicles where id = ${V1} and is_electric`, 1);
  await expectRows("visitors cannot read vehicles directly", "anon", "select 1 from public.driver_vehicles", 0);
  await expectRows("a signed-in client cannot read vehicles directly", "client", "select 1 from public.driver_vehicles", 0);
  await expectRows("the electric mark adds no vehicle class", "anon", "select * from public.vehicle_classes", 6);
  await expectRows("the category rule does not know about the electric mark", "admin",
    "select 1 from pg_proc where proname = 'vehicle_can_serve' and pg_get_function_arguments(oid) = 'p_vehicle_class text, p_job_class text'", 1);
  await expectRows("drivers' functions do not return the vehicle mark", "admin",
    "select 1 from pg_proc where proname in ('driver_jobs','my_trips') and pg_get_function_result(oid) ~ 'is_electric'", 0);

  // The traveller's badge: the server looks up trips by the email they were booked with
  // (src/lib/travellerTrips.ts) and reads the assigned vehicle of confirmed bookings only.
  const badgeFor = (email) => `
    select v.is_electric from public.trips t
      join public.bookings b on b.trip_id = t.id and b.status in ('confirmed','in_progress','completed') and b.assigned_driver_id is not null
      join public.driver_vehicles v on v.id = b.assigned_vehicle_id
     where t.guest_email ilike '${email}'`;
  const B9 = "'10000000-0000-0000-0000-000000000009'";
  const keep = (await as("server", `select status, assigned_driver_id, assigned_vehicle_id, preferences from public.bookings where id = ${B9}`)).rows[0];
  await expectOk("server saves another traveller's trip", "server", `
    insert into public.trips (id, access_token, guest_name, guest_email, guest_phone) values
      ('40000000-0000-0000-0000-0000000000e2', repeat('ef', 32), 'Bea', 'bea@example.com', '+1 555 0200')`);
  await expectOk("server saves that traveller's ride, with nobody assigned", "server", `
    insert into public.bookings (id, trip_id, service_type, total_price) values
      ('10000000-0000-0000-0000-0000000000e2', '40000000-0000-0000-0000-0000000000e2', 'transfer', 150)`);
  await expectOk("server stores the request and assigns the electric vehicle to Ana's ride", "server", `
    update public.bookings set preferences = '{"language":"english","wifi":false,"stroller":false,"childSeats":0,"pets":false,"electric":true}',
      assigned_driver_id = '${U.driver}', assigned_vehicle_id = ${V1}, status = 'confirmed' where id = ${B9}`);
  await expectRows("Ana's own booking exposes the electric badge", "server", `select 1 from (${badgeFor("ana@example.com")}) x where x.is_electric`, 1);
  await expectRows("another traveller gets nothing about that vehicle", "server", badgeFor("bea@example.com"), 0);
  await expectRows("an unknown email gets nothing", "server", badgeFor("nobody@example.com"), 0);
  await expectRows("the request is stored with the booking", "admin", `select 1 from public.bookings where id = ${B9} and (preferences->>'electric')::boolean`, 1);
  await expectRows("drivers still read 0 bookings", "driver", "select * from public.bookings", 0);
  await expectRows("drivers still read 0 trips (name, phone, email)", "driver", "select * from public.trips", 0);
  await expectRows("the driver sees the request on their trip, through my_trips() only", "driver",
    `select 1 from public.my_trips() where id = ${B9} and (preferences->>'electric')::boolean`, 1);
  await expectRows("drivers' functions still return no client price, phone or email", "admin",
    "select 1 from pg_proc where proname in ('driver_jobs','my_trips') and pg_get_function_result(oid) ~ '(total_price|guest_phone|guest_email|guest_name)'", 0);
  await expectOk("admin removes the mark", "admin", `update public.driver_vehicles set is_electric = false where id = ${V1}`);
  await expectRows("without the mark there is no badge", "server", `select 1 from (${badgeFor("ana@example.com")}) x where x.is_electric`, 0);
  await as("server", `update public.bookings set status = '${keep.status}', assigned_driver_id = ${keep.assigned_driver_id ? `'${keep.assigned_driver_id}'` : "null"},
    assigned_vehicle_id = ${keep.assigned_vehicle_id ? `'${keep.assigned_vehicle_id}'` : "null"}, preferences = '${JSON.stringify(keep.preferences ?? {})}' where id = ${B9}`);
  await expectOk("server removes the other traveller's test trip", "server", "delete from public.trips where id = '40000000-0000-0000-0000-0000000000e2'");
  await expectOk("server removes the test vehicle", "server", `delete from public.driver_vehicles where id = ${EV}`);

  // The request itself: optional, so older apps (which never send it) keep working.
  const { parsePrefs, prefsSummary, prefMismatches } = await import("../../src/lib/preferences.ts");
  const eq = (name, got, want) => {
    if (JSON.stringify(got) === JSON.stringify(want)) passed++;
    else failures.push(`${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  };
  const old = { language: "english", wifi: false, stroller: false, childSeats: 0, pets: false };
  eq("a request without `electric` (older apps) parses as before", parsePrefs(old), old);
  eq("a request with electric: true parses", parsePrefs({ ...old, electric: true }), { ...old, electric: true });
  eq("electric: false is the same as not asking", parsePrefs({ ...old, electric: false }), old);
  eq("electric: null is the same as not asking", parsePrefs({ ...old, electric: null }), old);
  eq("a wrong value for electric is refused", parsePrefs({ ...old, electric: "yes" }), null);
  eq("boosters and electric together parse", parsePrefs({ ...old, boosters: 2, electric: true }), { language: "english", wifi: false, stroller: false, childSeats: 0, boosters: 2, pets: false, electric: true });
  eq("summary, English", prefsSummary({ ...old, electric: true }, "en"), ["English-speaking driver", "electric vehicle, if available"]);
  eq("summary, Spanish", prefsSummary({ ...old, electric: true }, "es"), ["Conductor que habla inglés", "vehículo eléctrico, si hay disponible"]);
  eq("no request, no word in the summary", prefsSummary(old, "en"), ["English-speaking driver"]);
  const fluent = { english_level: "fluent" };
  const plain = { has_wifi: false, child_seats: 0, stroller_space: false, pet_friendly: false };
  eq("asked and not electric: warning, Spanish", prefMismatches({ ...old, electric: true }, fluent, { ...plain, is_electric: false }, "es"), ["no es eléctrico"]);
  eq("asked and not electric: warning, English", prefMismatches({ ...old, electric: true }, fluent, plain, "en"), ["not electric"]);
  eq("asked and electric: no warning", prefMismatches({ ...old, electric: true }, fluent, { ...plain, is_electric: true }, "es"), []);
  eq("not asked: no warning either way", prefMismatches(old, fluent, plain, "es"), []);
}

// --- Multi-day trips retired (migration 0043) ---------------------------------------------------
// The rows stay (old bookings point at them) but are inactive and readable by admins only.
await expectRows("every multi-day trip is inactive", "admin", "select * from public.expeditions where active", 0);
await expectRows("every lodging tier is inactive", "admin", "select * from public.lodging_tiers where active", 0);
await expectRows("multi-day trips are kept (not deleted)", "admin", "select * from public.expeditions", 2);
await expectRows("lodging tiers are kept (not deleted)", "admin", "select * from public.lodging_tiers", 3);
for (const who of ["anon", "client", "driver"]) {
  await expectRows(`${who} cannot read multi-day trips`, who, "select * from public.expeditions", 0);
  await expectRows(`${who} cannot read lodging tiers`, who, "select * from public.lodging_tiers", 0);
}
await expectOk("admin switches a multi-day trip back on (by mistake)", "admin", "update public.expeditions set active = true where id = 'md1'");
await expectRows("…visitors still cannot read it", "anon", "select * from public.expeditions", 0);
await expectRows("…travellers still cannot read it", "client", "select * from public.expeditions", 0);
await expectOk("admin switches it off again", "admin", "update public.expeditions set active = false where id = 'md1'");
await expectBlocked("visitor cannot switch a multi-day trip on", "anon", "update public.expeditions set active = true", { affected: 0 });
// A multi-day booking made before 2026-11-11 still reads as before.
await expectOk("server stores an earlier multi-day booking", "server", `
  insert into public.bookings (id, client_id, service_type, catalog_item_id, lodging_tier, total_price, status) values
    ('10000000-0000-0000-0000-0000000000e1', '${U.client2}', 'expedition', 'md1', 'base', 695, 'confirmed')`);
await expectRows("admin still reads the earlier multi-day booking", "admin",
  "select * from public.bookings where id = '10000000-0000-0000-0000-0000000000e1' and service_type = 'expedition' and catalog_item_id = 'md1' and lodging_tier = 'base'", 1);
await expectRows("its traveller still reads it", "client2", "select * from public.bookings where id = '10000000-0000-0000-0000-0000000000e1'", 1);
await expectRows("another traveller does not", "client", "select * from public.bookings where id = '10000000-0000-0000-0000-0000000000e1'", 0);
await expectOk("server removes the test booking", "server", "delete from public.bookings where id = '10000000-0000-0000-0000-0000000000e1'");
{
  // New multi-day requests are refused on the server, with a clear message in both languages.
  const { isRetiredExpeditionSpec, parseSpec, RETIRED_EXPEDITION_ERROR } = await import("../../src/lib/tripRequest.ts");
  const { localizeServerMessage } = await import("../../src/lib/serverMessagesEs.ts");
  const { parseStoredCart } = await import("../../src/lib/cart.ts");
  const { bookedItemName } = await import("../../src/lib/catalog.ts");
  const { BUILT_IN_CATALOG } = await import("../../src/lib/catalogModel.ts");
  const eq = (name, got, want) => {
    if (JSON.stringify(got) === JSON.stringify(want)) passed++;
    else failures.push(`${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  };
  const oldItem = { kind: "expedition", expeditionId: "md1", tierId: "base" };
  eq("a multi-day item from an older page is recognised", isRetiredExpeditionSpec(oldItem), true);
  eq("a ride is not", isRetiredExpeditionSpec({ kind: "transfer" }), false);
  eq("a multi-day item can no longer be parsed (never priced or saved)", parseSpec(oldItem), null);
  eq("refusal message, English", /no longer offered/.test(RETIRED_EXPEDITION_ERROR), true);
  eq("refusal message, Spanish", localizeServerMessage(RETIRED_EXPEDITION_ERROR, "es").startsWith("Ya no ofrecemos viajes de varios días"), true);
  eq("a multi-day item saved in a browser's trip is dropped on load",
    parseStoredCart(JSON.stringify([{ kind: "expedition", id: "x", title: "t", detail: "d", date: "2027-01-10", totalCents: 100, spec: oldItem }])), []);
  eq("the public catalog has no multi-day trips", "expeditions" in BUILT_IN_CATALOG || "lodgingTiers" in BUILT_IN_CATALOG, false);
  eq("an earlier multi-day booking still shows its name (English)", bookedItemName([], "md1"), "Corcovado National Park — Overnight at Sirena Station (via Sierpe)");
  eq("…and in Spanish", bookedItemName([], "md1", "es"), "Parque Nacional Corcovado — noche en la Estación Sirena (vía Sierpe)");
  eq("a day tour name still wins", bookedItemName([{ id: "dt1", name: "Tour" }], "dt1"), "Tour");
}

// --- Automations (migration 0045): reminders, low-rating alert, follow-up, unsubscribe list -----
{
  const B = "10000000-0000-0000-0000-0000000000a4";
  await expectOk("server stores a confirmed ride", "server", `
    insert into public.bookings (id, client_id, service_type, total_price, status, assigned_driver_id, assigned_vehicle_id, scheduled_at) values
      ('${B}', '${U.client}', 'transfer', 120, 'confirmed', '${U.driver}', '30000000-0000-0000-0000-000000000001', now() + interval '24 hours')`);
  await expectRows("confirmed_at is stamped when a booking is confirmed", "admin", `select * from public.bookings where id = '${B}' and confirmed_at is not null`, 1);
  await expectRows("…and the three message columns start empty", "admin",
    `select * from public.bookings where id = '${B}' and reminder_traveller_at is null and reminder_driver_at is null and followup_sent_at is null`, 1);
  // Mark first: only the first of two checks running at once gets the row (and sends).
  await expectRows("traveller reminder: first mark wins", "server",
    `update public.bookings set reminder_traveller_at = now() where id = '${B}' and reminder_traveller_at is null returning id`, 1);
  await expectRows("traveller reminder: second mark gets nothing (never sent twice)", "server",
    `update public.bookings set reminder_traveller_at = now() where id = '${B}' and reminder_traveller_at is null returning id`, 0);
  await expectRows("driver reminder: first mark wins", "server",
    `update public.bookings set reminder_driver_at = now() where id = '${B}' and reminder_driver_at is null returning id`, 1);
  await expectRows("driver reminder: second mark gets nothing", "server",
    `update public.bookings set reminder_driver_at = now() where id = '${B}' and reminder_driver_at is null returning id`, 0);
  await expectOk("team takes the driver off the ride", "server", `update public.bookings set assigned_driver_id = null, assigned_vehicle_id = null where id = '${B}'`);
  await expectRows("a new driver gets their own reminder (driver column cleared)…", "admin",
    `select * from public.bookings where id = '${B}' and reminder_driver_at is null`, 1);
  await expectRows("…the traveller's stays sent", "admin", `select * from public.bookings where id = '${B}' and reminder_traveller_at is not null`, 1);
  await expectRows("follow-up: first mark wins", "server",
    `update public.bookings set followup_sent_at = now() where id = '${B}' and followup_sent_at is null returning id`, 1);
  await expectRows("follow-up: never twice", "server",
    `update public.bookings set followup_sent_at = now() where id = '${B}' and followup_sent_at is null returning id`, 0);
  await expectRows("drivers' functions never expose the message columns", "admin",
    "select 1 from pg_proc where proname in ('driver_jobs','my_trips') and pg_get_function_result(oid) ~ '(reminder_|followup_|confirmed_at)'", 0);

  // Low-rating alert: once per rating.
  await expectOk("the ride is done", "server", `update public.bookings set status = 'completed', assigned_driver_id = '${U.driver}' where id = '${B}'`);
  await expectOk("server stores a 2-star rating", "server",
    `insert into public.driver_reviews (booking_id, driver_id, stars, comment) values ('${B}', '${U.driver}', 2, 'Late')`);
  await expectRows("low-rating alert: first mark wins", "server",
    `update public.driver_reviews set team_alerted_at = now() where booking_id = '${B}' and team_alerted_at is null returning id`, 1);
  await expectRows("low-rating alert: never twice", "server",
    `update public.driver_reviews set team_alerted_at = now() where booking_id = '${B}' and team_alerted_at is null returning id`, 0);

  // The unsubscribe list: written by the server only, read by admins only.
  await expectOk("server adds an address to the unsubscribe list", "server",
    "insert into public.email_optouts (email, source) values ('emily.smith@example.com', 'link')");
  await expectBlocked("addresses are stored lower-case only", "server", "insert into public.email_optouts (email) values ('Someone@Example.com')");
  for (const who of ["anon", "client", "client2", "driver", "pending"]) {
    await expectRows(`${who} cannot read the unsubscribe list`, who, "select * from public.email_optouts", 0);
    await expectBlocked(`${who} cannot add to the unsubscribe list`, who, "insert into public.email_optouts (email) values ('x@example.com')");
    await expectBlocked(`${who} cannot remove from the unsubscribe list`, who, "delete from public.email_optouts", { affected: 0 });
  }
  await expectRows("admin reads the unsubscribe list", "admin", "select * from public.email_optouts", 1);
  await expectBlocked("even an admin cannot write it from the browser (server only)", "admin", "insert into public.email_optouts (email) values ('y@example.com')");
  // The "Don't send me suggestions after my trip" tickbox when booking.
  await expectOk("server adds an address from the booking tickbox", "server",
    "insert into public.email_optouts (email, source) values ('ticked@example.com', 'booking')");
  await expectBlocked("unknown sources refused", "server", "insert into public.email_optouts (email, source) values ('z@example.com', 'web')");
  await expectRows("travellers still cannot read it", "client", "select * from public.email_optouts", 0);

  // Day-tour pickup place (bookings.pickup_place).
  const T = "10000000-0000-0000-0000-0000000000a5";
  await expectOk("server stores a confirmed day tour with its pickup place", "server", `
    insert into public.bookings (id, client_id, service_type, catalog_item_id, total_price, status, assigned_driver_id, assigned_vehicle_id, scheduled_at, pickup_place) values
      ('${T}', '${U.client}', 'day_tour', 'dt1', 590, 'confirmed', '${U.driver}', '30000000-0000-0000-0000-000000000001', now() + interval '3 days', 'Hotel Lomas del Volcán, La Fortuna')`);
  await expectRows("the assigned driver sees the pickup place in my_trips()", "driver",
    `select 1 from public.my_trips() where id = '${T}' and pickup_place = 'Hotel Lomas del Volcán, La Fortuna'`, 1);
  await expectRows("another driver does not see the trip", "pending", `select 1 from public.my_trips() where id = '${T}'`, 0);
  await expectRows("travellers' own booking shows it", "client", `select 1 from public.bookings where id = '${T}' and pickup_place is not null`, 1);
  await expectRows("drivers still read 0 rows from bookings", "driver", "select pickup_place from public.bookings", 0);
  await expectRows("the job board never carries the pickup place", "admin",
    "select 1 from pg_proc where proname in ('driver_jobs','open_trip_requests') and pg_get_function_result(oid) ~ 'pickup_place'", 0);
  await expectBlocked("pickup place with a phone number refused", "server", `update public.bookings set pickup_place = 'Call me +506 8888 7777' where id = '${T}'`);
  await expectBlocked("pickup place with an email refused", "server", `update public.bookings set pickup_place = 'ana@example.com' where id = '${T}'`);
  await expectBlocked("pickup place with a link refused", "server", `update public.bookings set pickup_place = 'www.hotel.com' where id = '${T}'`);
  await expectBlocked("pickup place over 120 characters refused", "server", `update public.bookings set pickup_place = '${"a".repeat(121)}' where id = '${T}'`);
  await expectOk("pickup place of exactly 120 characters is fine", "server", `update public.bookings set pickup_place = '${"a".repeat(120)}' where id = '${T}'`);
  await expectBlocked("pickup place with leading spaces refused", "server", `update public.bookings set pickup_place = ' Hotel' where id = '${T}'`);
  // The change history (migration 0044) logs only its listed columns: the message stamps never add
  // history rows. Since migration 0056 a changed pickup place is logged ('places', the team's edit).
  await expectRows("message stamps never add history rows", "admin",
    `select count(*) as n from public.booking_events where booking_id in ('${B}', '${T}') and (before::text || after::text) ~ '(reminder_|followup_|confirmed_at|team_alerted)'`, 0);
  await expectRows("…a changed pickup place is logged as 'places' (migration 0056)", "admin",
    `select count(*) as n from public.booking_events where booking_id = '${T}' and action = 'places' and after ? 'pickup_place'`, 1);
  const tourEvents = Number((await as("admin", `select count(*) as n from public.booking_events where booking_id = '${T}'`)).rows[0].n);
  await expectOk("server stamps the tour's reminders", "server",
    `update public.bookings set reminder_traveller_at = now(), reminder_driver_at = now(), followup_sent_at = now() where id = '${T}'`);
  await expectRows("…and the stamps add nothing to the tour's history", "admin", `select count(*) as n from public.booking_events where booking_id = '${T}'`, tourEvents);
  await expectOk("server cleans up the tour", "server", `delete from public.bookings where id = '${T}'`);

  await expectOk("server cleans up the list", "server", "delete from public.email_optouts");
  await expectOk("server cleans up the rating", "server", `delete from public.driver_reviews where booking_id = '${B}'`);
  await expectOk("server cleans up the booking", "server", `delete from public.bookings where id = '${B}'`);
}

// --- Booking change history (migration 0044) -----------------------------------------------------
{
  const B9 = "10000000-0000-0000-0000-000000000009";
  const ev = (where) => `select count(*) as n from public.booking_events where booking_id = '${B9}' and ${where}`;
  // Earlier sections changed booking 0009: the server set the payment mode, the admin assigned
  // the driver + vehicle and confirmed it, and wrote an internal note.
  await expectRows("admin's status change is in the history, with the admin as actor", "admin",
    ev(`action = 'status' and actor_id = '${U.admin}' and before->>'status' = 'pending_payment' and after->>'status' = 'confirmed'`), 1);
  await expectRows("admin's driver + vehicle assignment is in the history", "admin",
    ev(`action = 'assignment' and actor_id = '${U.admin}' and after->>'driver_id' = '${U.driver}' and after->>'vehicle_id' = '30000000-0000-0000-0000-000000000001'`), 1);
  await expectRows("internal note is in the history", "admin", ev(`action = 'notes' and actor_id = '${U.admin}' and after->>'notes' = 'VIP'`), 1);
  await expectRows("server's changes are logged without a person", "admin", ev(`action = 'payment_mode' and actor_id is null`), 2);
  const before = Number((await as("admin", ev("true"))).rows[0].n);
  await expectOk("admin saves the same values again", "admin",
    `update public.bookings set status = status, amount_paid = amount_paid, assigned_driver_id = assigned_driver_id where id = '${B9}'`);
  await expectOk("server touches a column that is not tracked", "server",
    `update public.bookings set review_reminded_at = now() where id = '${B9}'`);
  await expectRows("unchanged values and untracked columns add no event", "admin", ev("true"), before);
  await expectOk("admin records an amount received", "admin", `update public.bookings set amount_paid = 120.50 where id = '${B9}'`);
  await expectRows("amount received logged with before and after", "admin",
    ev(`action = 'amount_paid' and (before->>'amount_paid')::numeric = 0 and (after->>'amount_paid')::numeric = 120.50 and actor_id = '${U.admin}'`), 1);
  await expectOk("admin edits the internal note", "admin", `update public.booking_admin_notes set notes = 'VIP, early flight' where booking_id = '${B9}'`);
  await expectRows("note edit logged (old and new text)", "admin",
    ev(`action = 'notes' and before->>'notes' = 'VIP' and after->>'notes' = 'VIP, early flight'`), 1);
  await expectOk("admin settles the driver", "admin", `update public.bookings set driver_settled_at = now() where id = '${B9}'`);
  await expectRows("settlement logged", "admin", ev(`action = 'settled' and after->>'driver_settled_at' is not null`), 1);
  await expectOk("admin cancels the booking", "admin", `update public.bookings set status = 'cancelled' where id = '${B9}'`);
  await expectRows("cancellation logged", "admin", ev(`action = 'status' and after->>'status' = 'cancelled'`), 1);
  await expectOk("server records a booking entered by the team", "server",
    `insert into public.booking_events (booking_id, actor_id, action, after) values ('${B9}', '${U.admin}', 'created_by_team', '{"mode":"full_100"}')`);
  await expectBlocked("unknown event kind refused", "server",
    `insert into public.booking_events (booking_id, action) values ('${B9}', 'card_number')`);
  for (const who of ["client", "client2", "driver", "pending", "anon"]) {
    await expectRows(`${who} cannot read the change history`, who, "select * from public.booking_events", 0);
    await expectBlocked(`${who} cannot write the change history`, who,
      `insert into public.booking_events (booking_id, action) values ('${B9}', 'status')`);
  }
  await expectBlocked("admin cannot write the history directly", "admin",
    `insert into public.booking_events (booking_id, action) values ('${B9}', 'status')`);
  await expectBlocked("admin cannot rewrite history", "admin", `update public.booking_events set action = 'notes'`, { affected: 0 });
  await expectBlocked("admin cannot delete history", "admin", `delete from public.booking_events`, { affected: 0 });
  await expectRows("history never holds chat or card columns", "admin",
    "select 1 from information_schema.columns where table_name = 'booking_events' and column_name ~ '(message|card|chat)'", 0);
  await expectRows("drivers still read no booking rows", "driver", "select * from public.bookings", 0);
}

// --- Sign-in codes: rate limits and lookups (migration 0050) -----------------------------------
{
  for (const who of ["client", "driver", "admin", "anon"]) {
    await expectRows(`${who} cannot read sign-in code requests`, who, "select * from public.auth_code_requests", 0);
    await expectBlocked(`${who} cannot add sign-in code requests`, who,
      "insert into public.auth_code_requests (ip, email) values ('1.1.1.1', 'x@example.com')");
  }
  // Limits as in src/lib/authCode.ts CODE_LIMITS: 3 per email per hour, 6 per day, 10 per IP per hour.
  const allow = async (ip, email) =>
    (await as("server", `select public.allow_auth_code($1, $2, 3, 6, 10) as r`, [ip, email])).rows[0].r;
  const seq = [];
  for (let i = 0; i < 4; i++) seq.push(await allow(`10.0.0.${i}`, "Limit@Example.com"));
  const want = (name, got, w) => (JSON.stringify(got) === JSON.stringify(w) ? passed++ : failures.push(`${name}: expected ${JSON.stringify(w)}, got ${JSON.stringify(got)}`));
  want("email: 3 an hour, the 4th refused (case-insensitive)", seq, ["ok", "ok", "ok", "email_hour"]);
  // Three more from earlier today (outside the hour) → 6 in the day.
  await db.exec(`update public.auth_code_requests set at = now() - interval '2 hours' where email = 'limit@example.com'`);
  const day = [];
  for (let i = 0; i < 3; i++) day.push(await allow(`10.0.1.${i}`, "limit@example.com"));
  await db.exec(`update public.auth_code_requests set at = now() - interval '2 hours' where email = 'limit@example.com'`);
  day.push(await allow("10.0.1.9", "limit@example.com"));
  want("email: 6 a day, the 7th refused even outside the hour", day, ["ok", "ok", "ok", "email_day"]);
  await db.exec(`update public.auth_code_requests set at = now() - interval '25 hours' where email = 'limit@example.com'`);
  want("email: a day later it works again (old rows removed)", await allow("10.0.2.1", "limit@example.com"), "ok");
  const ip = [];
  for (let i = 0; i < 11; i++) ip.push(await allow("203.0.113.9", `p${i}@example.com`));
  want("IP: 10 an hour across emails, the 11th refused", [ip.slice(0, 10).every((r) => r === "ok"), ip[10]], [true, "ip_hour"]);
  want("refused requests aren't recorded", Number((await as("server", "select count(*) n from public.auth_code_requests where ip = '203.0.113.9'")).rows[0].n), 10);
  want("another IP is unaffected", await allow("203.0.113.10", "p99@example.com"), "ok");

  await db.exec(`
    insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000f1', 'Status@Example.com', null);
    insert into public.trips (id, access_token, guest_email) values ('00000000-0000-0000-0000-0000000000f2', repeat('s', 48), 'TRIPPER@example.com');
  `);
  const status = async (e) => (await as("server", "select * from public.auth_email_status($1)", [e])).rows[0];
  want("status: account found (any case), unconfirmed", await status("status@example.com"),
    { user_id: "00000000-0000-0000-0000-0000000000f1", confirmed: false, has_trip: false });
  want("status: no account, has a trip", await status("tripper@example.com"), { user_id: null, confirmed: false, has_trip: true });
  want("status: nothing", await status("nobody@example.com"), { user_id: null, confirmed: false, has_trip: false });
  await db.exec(`delete from auth.users where id = '00000000-0000-0000-0000-0000000000f1'`);
}

// --- One-time cleanup of bot sign-ups (migration 0051) ----------------------------------------
// The migration already ran on an empty database above; here it runs again over fixtures.
{
  const J = (n) => `00000000-0000-0000-0000-00000000f${String(n).padStart(3, "0")}`;
  const before = "'2026-11-11 10:00+00'";
  await db.exec(`
    insert into auth.users (id, email, created_at, email_confirmed_at, last_sign_in_at) values
      ('${J(1)}', 'j.u.n.k@gmail.com',      ${before}, null, null),               -- junk: deleted
      ('${J(2)}', 'junk2@example.com',      ${before}, null, null),               -- junk: deleted
      ('${J(3)}', 'confirmed@example.com',  ${before}, now(), null),              -- confirmed client: kept
      ('${J(4)}', 'signedin@example.com',   ${before}, null, now()),              -- signed in once: kept
      ('${J(5)}', 'newdriver@example.com',  ${before}, null, null),               -- driver row: kept
      ('${J(6)}', 'admin2@example.com',     ${before}, null, null),               -- admin: kept
      ('${J(7)}', 'Traveller@Example.com',  ${before}, null, null),               -- trip email: kept
      ('${J(8)}', 'late@example.com',       '2026-11-14 10:00+00', null, null),   -- after the cutoff: kept
      ('${J(9)}', 'pushonly@example.com',   ${before}, null, null),               -- device token: kept
      ('${J(10)}', 'booker@example.com',    ${before}, null, null),               -- linked booking: kept
      ('${J(11)}', 'noted@example.com',     ${before}, null, null);               -- named on a CRM note (0049): kept
    update public.profiles set role = 'driver' where id = '${J(5)}';
    insert into public.drivers (id, kyc_status) values ('${J(5)}', 'pending');
    update public.profiles set role = 'admin' where id = '${J(6)}';
    insert into public.trips (id, access_token, guest_email) values ('${J(77)}', repeat('t', 48), 'traveller@example.COM');
    insert into public.device_tokens (user_id, token, platform, app) values ('${J(9)}', 'ExponentPushToken[cleanup-test]', 'android', 'client');
    update public.bookings set client_id = '${J(10)}' where id = (select id from public.bookings order by created_at limit 1);
    -- customer_notes stamps updated_by (and its history actor_id) from the session, so act as that account.
    select set_config('request.jwt.claim.sub', '${J(11)}', false);
    insert into public.customer_notes (customer_key, note) values ('cleanup-test@example.com', 'x');
    select set_config('request.jwt.claim.sub', '', false);
  `);
  // auth.users is read as the database owner (the migration runner), not as an API role.
  const count = async (sql) => Number((await db.query(sql)).rows[0].n);
  const same = (name, got, w) => (got === w ? passed++ : failures.push(`${name}: expected ${w}, got ${got}`));
  const users = "select count(*) n from auth.users where id::text like '00000000-0000-0000-0000-00000000f%'";
  same("cleanup fixtures in place", await count(users), 11);
  same("CRM note names the account", await count(`select count(*) n from public.customer_notes where updated_by = '${J(11)}'`), 1);
  await db.exec(readFileSync(join(dir, "20261112000051_cleanup_bot_signups.sql"), "utf8"));
  same("cleanup: only the two junk accounts are deleted", await count(users), 9);
  same("cleanup: junk accounts gone", await count(`select count(*) n from auth.users where id in ('${J(1)}', '${J(2)}')`), 0);
  await expectRows("cleanup: their profiles gone too", "server", `select * from public.profiles where id in ('${J(1)}', '${J(2)}')`, 0);
  for (const [k, what] of [[3, "confirmed client"], [4, "client who signed in"], [5, "driver"], [6, "admin"], [7, "client with a trip email"],
    [8, "unconfirmed account after the cutoff"], [9, "account with a push token"], [10, "account linked to a booking"],
    [11, "account named on a CRM customer note (0049)"]]) {
    await expectRows(`cleanup keeps the ${what}`, "server", `select * from public.profiles where id = '${J(k)}'`, 1);
  }
  for (const k of Object.keys(U)) await expectRows(`cleanup keeps test user ${k}`, "server", `select * from public.profiles where id = '${U[k]}'`, 1);
}

// --- CRM part 3 (migration 0049): customers, refunds, new history entries ------------------------
{
  const T = (n) => `20000000-0000-0000-0000-0000000000c${n}`;
  const BK = (n) => `10000000-0000-0000-0000-0000000000c${n}`;
  const tok = (n) => `'${String(n).repeat(64)}'`;
  const V1 = "30000000-0000-0000-0000-000000000001";
  await db.exec(`
    insert into public.trips (id, access_token, guest_name, guest_email, guest_phone, language) values
      ('${T(1)}', ${tok(1)}, 'Ana Gómez', ' AnaCRM@Example.com ', '+506 8888-1234', 'es'),
      ('${T(2)}', ${tok(2)}, 'Ana G.', 'anacrm@example.com', null, 'es'),
      ('${T(3)}', ${tok(3)}, 'Bob', '', '+1 (555) 222-3333', 'en');
    insert into public.bookings (id, trip_id, client_id, service_type, total_price, amount_paid, status, assigned_driver_id, assigned_vehicle_id, scheduled_at) values
      ('${BK(1)}', '${T(1)}', null, 'transfer', 100, 100, 'completed', '${U.driver}', '${V1}', now() - interval '20 days'),
      ('${BK(2)}', '${T(2)}', null, 'transfer', 50, 50, 'confirmed', '${U.driver}', '${V1}', now() + interval '5 days'),
      ('${BK(3)}', '${T(1)}', null, 'transfer', 30, 30, 'cancelled', null, null, now() + interval '9 days'),
      ('${BK(4)}', '${T(3)}', null, 'transfer', 70, 0, 'pending_payment', null, null, now() + interval '3 days'),
      ('${BK(5)}', '${T(3)}', '${U.client}', 'transfer', 80, 80, 'confirmed', '${U.driver}', '${V1}', now() + interval '2 days');
    insert into public.driver_reviews (booking_id, driver_id, trip_id, stars, comment) values ('${BK(1)}', '${U.driver}', '${T(1)}', 4, 'Muy bien');
  `);
  const ana = "anacrm@example.com";
  // Customers: grouped by email (any case/spaces), else phone digits.
  await expectRows("admin sees two customers", "admin", "select * from public.admin_customers(null, null, 'last', 0, 0) where customer_key in ('anacrm@example.com', 'tel:15552223333')", 2);
  await expectRows("Ana's two trips are one customer: 3 bookings, 1 completed, 1 cancelled, $150 spent, ★4", "admin",
    `select * from public.admin_customers(null, '${ana}') where bookings = 3 and completed = 1 and cancelled = 1 and total_spent = 150 and ratings = 1 and avg_rating = 4 and name like 'Ana G%' and email = '${ana}' and phone = '+506 8888-1234'`, 1);
  await expectRows("search by phone digits finds Bob", "admin", "select * from public.admin_customers('555 222', null) where customer_key = 'tel:15552223333'", 1);
  await expectRows("customer's trips", "admin", `select * from public.admin_customer_trips('${ana}')`, 2);
  for (const who of ["client", "client2", "driver", "pending", "anon"]) {
    await expectRows(`${who} sees no customers`, who, "select * from public.admin_customers(null, null, 'last', 0, 0)", 0);
    await expectRows(`${who} sees no customer trips`, who, `select * from public.admin_customer_trips('${ana}')`, 0);
  }
  // Team tags and notes.
  await expectOk("admin tags a customer VIP with a note", "admin",
    `insert into public.customer_notes (customer_key, tags, note) values ('${ana}', array['VIP','honeymoon'], 'Prefers WhatsApp')`);
  await expectRows("who changed it is set by the database", "admin", `select * from public.customer_notes where customer_key = '${ana}' and updated_by = '${U.admin}'`, 1);
  await expectRows("VIP shows on the customer", "admin", `select * from public.admin_customers(null, '${ana}') where vip`, 1);
  await expectRows("search by tag", "admin", "select * from public.admin_customers('honeymoon', null)", 1);
  await expectOk("admin edits the note", "admin", `update public.customer_notes set note = 'Prefers email' where customer_key = '${ana}'`);
  await expectRows("note changes are kept with who did them", "admin",
    `select * from public.customer_note_events where customer_key = '${ana}' and actor_id = '${U.admin}'`, 2);
  await expectBlocked("key must be lower-case", "admin", `insert into public.customer_notes (customer_key) values ('Bob@x.com')`);
  for (const who of ["client", "driver", "anon"]) {
    await expectRows(`${who} cannot read customer notes`, who, "select * from public.customer_notes", 0);
    await expectRows(`${who} cannot read customer note history`, who, "select * from public.customer_note_events", 0);
    await expectBlocked(`${who} cannot write customer notes`, who, `insert into public.customer_notes (customer_key, note) values ('x@y.com', 'hi')`);
  }
  await expectBlocked("admin cannot rewrite the note history", "admin", `delete from public.customer_note_events`, { affected: 0 });

  // Team edits the name sign: same rules as the traveller, recorded with who did it.
  await expectOk("admin sets the sign", "admin", `update public.bookings set sign_text = 'Familia Gómez', sign_hide_name = false where id = '${BK(2)}'`);
  await expectRows("sign change logged with the admin as actor", "admin",
    `select * from public.booking_events where booking_id = '${BK(2)}' and action = 'sign' and actor_id = '${U.admin}' and after->>'sign_text' = 'Familia Gómez'`, 1);
  await expectBlocked("sign with a phone number refused, also for the team", "admin", `update public.bookings set sign_text = 'Call 8888 1234' where id = '${BK(2)}'`);
  await expectBlocked("sign longer than 40 refused", "admin", `update public.bookings set sign_text = '${"x".repeat(41)}' where id = '${BK(2)}'`);

  // Driver removed: the booking goes back to open; the server records why.
  await expectOk("admin removes the driver (back to open for drivers)", "admin",
    `update public.bookings set assigned_driver_id = null, assigned_vehicle_id = null, status = 'pending_bids' where id = '${BK(2)}'`);
  await expectRows("removal logged as an assignment change by the admin", "admin",
    `select * from public.booking_events where booking_id = '${BK(2)}' and action = 'assignment' and actor_id = '${U.admin}' and before->>'driver_id' = '${U.driver}' and after->>'driver_id' is null`, 1);
  await expectOk("server records why (driver dropped out)", "server",
    `insert into public.booking_events (booking_id, actor_id, action, before, after) values ('${BK(2)}', '${U.admin}', 'driver_removed', '{"driver_id":"${U.driver}"}', '{"reason":"driver_dropped","team_alerted":true}')`);
  await expectOk("server records a WhatsApp message opened", "server",
    `insert into public.booking_events (booking_id, actor_id, action, after) values ('${BK(2)}', '${U.admin}', 'whatsapp_opened', '{"kind":"driver_confirmed"}')`);
  await expectBlocked("admin cannot write those entries directly", "admin",
    `insert into public.booking_events (booking_id, action) values ('${BK(2)}', 'driver_removed')`);
  await expectRows("drivers can't see removals", "driver", "select * from public.booking_events", 0);
  await expectOk("admin assigns the driver again", "admin",
    `update public.bookings set assigned_driver_id = '${U.driver}', assigned_vehicle_id = '${V1}', status = 'confirmed' where id = '${BK(2)}'`);

  // Cancel + refund (cancel_booking) and refund paid.
  await expectBlocked("refund different from the policy needs a reason", "admin",
    `select public.cancel_booking('${BK(5)}', 'traveller', now(), 30, 80, 'free_24h', 40, null)`);
  await expectBlocked("refund can't exceed what was received", "admin",
    `select public.cancel_booking('${BK(5)}', 'team', null, 30, 80, 'we_cancelled', 90, 'goodwill')`);
  await expectRows("…and nothing was cancelled by those attempts", "admin", `select * from public.bookings where id = '${BK(5)}' and status = 'confirmed'`, 1);
  for (const who of ["client", "driver", "anon"]) {
    await expectBlocked(`${who} cannot cancel through cancel_booking`, who,
      `select public.cancel_booking('${BK(5)}', 'traveller', now(), 30, 80, 'free_24h', 80, null)`);
  }
  await expectOk("admin cancels: traveller asked 30 h ahead, full refund", "admin",
    `select public.cancel_booking('${BK(5)}', 'traveller', now(), 30, 80, 'free_24h', 80, null)`);
  await expectRows("booking cancelled", "admin", `select * from public.bookings where id = '${BK(5)}' and status = 'cancelled'`, 1);
  await expectRows("refund row with policy, rule and amount received", "admin",
    `select * from public.booking_refunds where booking_id = '${BK(5)}' and refund_due = 80 and refund_policy = 80 and amount_received = 80 and refund_rule = 'free_24h' and created_by = '${U.admin}'`, 1);
  await expectRows("cancellation + status in the history, by the admin", "admin",
    `select count(*) as n from public.booking_events where booking_id = '${BK(5)}' and actor_id = '${U.admin}' and (action = 'cancellation' or (action = 'status' and after->>'status' = 'cancelled'))`, 2);
  await expectBlocked("cancelling twice refused", "admin", `select public.cancel_booking('${BK(5)}', 'team', null, 30, 80, 'we_cancelled', 80, null)`);
  await expectBlocked("refund paid must have amount, date and method", "admin",
    `update public.booking_refunds set refund_paid_amount = 80 where booking_id = '${BK(5)}'`);
  await expectOk("admin marks the refund paid (SINPE)", "admin",
    `update public.booking_refunds set refund_paid_amount = 80, refund_paid_on = current_date, refund_method = 'sinpe' where booking_id = '${BK(5)}'`);
  await expectRows("refund paid logged", "admin",
    `select * from public.booking_events where booking_id = '${BK(5)}' and action = 'refund_paid' and after->>'method' = 'sinpe' and actor_id = '${U.admin}'`, 1);
  await expectBlocked("unknown refund method refused", "admin", `update public.booking_refunds set refund_method = 'bitcoin' where booking_id = '${BK(5)}'`);
  await expectRows("the traveller still reads their own booking row", "client", `select * from public.bookings where id = '${BK(5)}'`, 1);
  for (const who of ["client", "client2", "driver", "pending", "anon"]) {
    await expectRows(`${who} cannot read refunds`, who, "select * from public.booking_refunds", 0);
    await expectBlocked(`${who} cannot write refunds`, who,
      `insert into public.booking_refunds (booking_id, cancelled_by, refund_policy, refund_rule, refund_due) values ('${BK(4)}', 'team', 0, 'we_cancelled', 0)`);
  }
  // Cancellation notices: the driver has no way to the traveller's contact details or the money.
  await expectRows("driver reads no trips (traveller contact)", "driver", "select * from public.trips", 0);
  await expectRows("driver reads no booking rows", "driver", "select * from public.bookings", 0);
  await expectRows("driver's own trips hold no traveller email or phone columns", "admin",
    "select 1 from information_schema.routines r join information_schema.parameters p on p.specific_name = r.specific_name where r.routine_name = 'my_trips' and p.parameter_mode = 'OUT' and p.parameter_name ~ '(email|phone|guest_name|total_price|amount_paid|refund)'", 0);
  await expectRows("refund columns are not on bookings (travellers can read their rows)", "admin",
    "select 1 from information_schema.columns where table_name = 'bookings' and column_name ~ '^(refund|cancelled_by)'", 0);
}

// --- Vehicle photos: remove / reorder (migration 0048) -----------------------------------------
{
  const V1 = "'30000000-0000-0000-0000-000000000001'";
  const p = (n) => `"${U.driver}/vehicles/30000000-0000-0000-0000-000000000001/photo-${n}.jpg"`;
  await expectOk("server sets up an approved vehicle with 3 photos", "server",
    `update public.driver_vehicles set status = 'approved', review_hold = false, needs_review = false,
       photos = '[${p(1)}, ${p(2)}, ${p(3)}]' where id = ${V1}`);
  await expectBlocked("another driver cannot reorder these photos", "pending",
    `update public.driver_vehicles set photos = '[${p(3)}, ${p(1)}, ${p(2)}]' where id = ${V1}`, { affected: 0 });
  await expectBlocked("another driver cannot remove these photos", "pending",
    `update public.driver_vehicles set photos = '[${p(1)}]' where id = ${V1}`, { affected: 0 });
  await expectRows("still 3 photos in the original order", "admin",
    `select 1 from public.driver_vehicles where id = ${V1} and photos = '[${p(1)}, ${p(2)}, ${p(3)}]'::jsonb`, 1);
  await expectOk("driver makes the third photo the main one", "driver",
    `update public.driver_vehicles set photos = '[${p(3)}, ${p(1)}, ${p(2)}]' where id = ${V1}`);
  await expectOk("driver removes one photo (3 → 2)", "driver",
    `update public.driver_vehicles set photos = '[${p(3)}, ${p(1)}]' where id = ${V1}`);
  await expectBlocked("approved vehicle cannot go below 2 photos", "driver",
    `update public.driver_vehicles set photos = '[${p(3)}]' where id = ${V1}`);
  await expectBlocked("approved vehicle cannot drop all photos", "driver",
    `update public.driver_vehicles set photos = '[]' where id = ${V1}`);
  await expectRows("photo changes mark the vehicle changed but do not pause it", "admin",
    `select 1 from public.driver_vehicles where id = ${V1} and needs_review and not review_hold and status = 'approved'
       and photos = '[${p(3)}, ${p(1)}]'::jsonb`, 1);
  await expectOk("admin may still clear photos", "admin", `update public.driver_vehicles set photos = '[${p(3)}]' where id = ${V1}`);
  await expectOk("driver adds a photo to a vehicle below the minimum", "driver",
    `update public.driver_vehicles set photos = '[${p(3)}, ${p(4)}]' where id = ${V1}`);
  // A pending vehicle (not yet approved) may go below 2 while the driver is still setting it up.
  await expectOk("driver adds a pending vehicle", "driver",
    `insert into public.driver_vehicles (id, driver_id, make_model, photos) values ('30000000-0000-0000-0000-0000000000f1', '${U.driver}', 'Kia', '["${U.driver}/vehicles/f1/a.jpg", "${U.driver}/vehicles/f1/b.jpg"]')`);
  await expectOk("pending vehicle may drop to 1 photo", "driver",
    `update public.driver_vehicles set photos = '["${U.driver}/vehicles/f1/a.jpg"]' where id = '30000000-0000-0000-0000-0000000000f1'`);
  await expectOk("driver removes the test vehicle", "driver", "delete from public.driver_vehicles where id = '30000000-0000-0000-0000-0000000000f1'");

  // Storage: only the server (after its own checks) or an admin deletes a photo file.
  await expectOk("server stores a photo file", "server",
    `insert into storage.objects (bucket_id, name) values ('driver-kyc-docs', '${U.driver}/vehicles/x/photo-del.jpg')`);
  await expectBlocked("driver cannot delete storage files directly", "driver",
    `delete from storage.objects where name = '${U.driver}/vehicles/x/photo-del.jpg'`, { affected: 0 });
  await expectBlocked("another driver cannot delete them either", "pending",
    `delete from storage.objects where name = '${U.driver}/vehicles/x/photo-del.jpg'`, { affected: 0 });
  await expectRows("a traveller cannot read driver files", "client",
    `select 1 from storage.objects where bucket_id = 'driver-kyc-docs' and name = '${U.driver}/vehicles/x/photo-del.jpg'`, 0);
  await expectRows("the owning driver can read the file", "driver",
    `select 1 from storage.objects where bucket_id = 'driver-kyc-docs' and name = '${U.driver}/vehicles/x/photo-del.jpg'`, 1);
  await expectOk("server deletes the photo file", "server",
    `delete from storage.objects where name = '${U.driver}/vehicles/x/photo-del.jpg'`);
  await expectRows("the file is gone", "server", `select 1 from storage.objects where name = '${U.driver}/vehicles/x/photo-del.jpg'`, 0);

  // Licence plate photo: a vehicle document for the team only (Jorge, 2026-11-12).
  const plate = (n) => `${U.driver}/vehicles/30000000-0000-0000-0000-000000000001/plate_photo-${n}.jpg`;
  await expectOk("server: approved vehicle, not paused", "server",
    `update public.driver_vehicles set status = 'approved', review_hold = false, needs_review = false where id = ${V1}`);
  await expectOk("driver adds the plate photo the first time", "driver",
    `update public.driver_vehicles set documents = documents || '{"plate_photo": "${plate(1)}"}' where id = ${V1}`);
  await expectRows("adding it the first time does not pause the approved vehicle", "admin",
    `select 1 from public.driver_vehicles where id = ${V1} and status = 'approved' and not review_hold and documents ->> 'plate_photo' = '${plate(1)}'`, 1);
  await expectOk("driver replaces the plate photo", "driver",
    `update public.driver_vehicles set documents = documents || '{"plate_photo": "${plate(2)}"}' where id = ${V1}`);
  await expectRows("replacing it pauses the vehicle like other vehicle documents", "admin",
    `select 1 from public.driver_vehicles where id = ${V1} and status = 'approved' and review_hold`, 1);
  await expectOk("admin checks it", "admin", `update public.driver_vehicles set needs_review = false where id = ${V1}`);
  await expectRows("the hold clears after the team's check", "admin", `select 1 from public.driver_vehicles where id = ${V1} and not review_hold`, 1);
  await expectBlocked("another driver cannot set this vehicle's plate photo", "pending",
    `update public.driver_vehicles set documents = documents || '{"plate_photo": "${U.pending}/x.jpg"}' where id = ${V1}`, { affected: 0 });
  await expectOk("server stores the plate photo file", "server",
    `insert into storage.objects (bucket_id, name) values ('driver-kyc-docs', '${plate(2)}')`);
  await expectRows("a traveller cannot read the plate photo file", "client", `select 1 from storage.objects where name = '${plate(2)}'`, 0);
  await expectRows("another driver cannot read the plate photo file", "pending", `select 1 from storage.objects where name = '${plate(2)}'`, 0);
  await expectRows("a visitor cannot read the plate photo file", "anon", `select 1 from storage.objects where name = '${plate(2)}'`, 0);
  await expectRows("the owning driver can read it", "driver", `select 1 from storage.objects where name = '${plate(2)}'`, 1);
  await expectRows("the team can read it", "admin", `select 1 from storage.objects where name = '${plate(2)}'`, 1);
}

// --- Dispatch calendar assigns like the booking page (2026-11-12) ---------------------------------
// Both pages call the same server action, updateBooking (src/app/admin/bookings/actions.ts). The
// booking page sends status + driver/vehicle + amount received; the calendar sends status +
// driver/vehicle only (the action then leaves the amount alone). Both updates run as the admin
// here, exactly as the action sends them, and must leave the same change history.
{
  const PAGE = "10000000-0000-0000-0000-0000000000a1";
  const CAL = "10000000-0000-0000-0000-0000000000a2";
  const V = "30000000-0000-0000-0000-000000000001";
  await expectOk("server saves two bookings waiting for a driver", "server", `
    insert into public.bookings (id, trip_id, service_type, total_price, status, amount_paid) values
      ('${PAGE}', '40000000-0000-0000-0000-000000000001', 'transfer', 150, 'pending_bids', 0),
      ('${CAL}',  '40000000-0000-0000-0000-000000000001', 'transfer', 150, 'pending_bids', 0)`);
  await expectOk("booking page assigns (status + driver + vehicle + amount received)", "admin",
    `update public.bookings set status = 'confirmed', assigned_driver_id = '${U.driver}', assigned_vehicle_id = '${V}', amount_paid = 0 where id = '${PAGE}'`);
  await expectOk("calendar assigns (status + driver + vehicle)", "admin",
    `update public.bookings set status = 'confirmed', assigned_driver_id = '${U.driver}', assigned_vehicle_id = '${V}' where id = '${CAL}'`);
  const hist = async (id) =>
    (await as("admin", `select action, actor_id, before, after from public.booking_events where booking_id = '${id}' order by action`)).rows
      .map((r) => JSON.stringify(r));
  const [fromPage, fromCal] = [await hist(PAGE), await hist(CAL)];
  if (fromCal.length === 2 && JSON.stringify(fromCal) === JSON.stringify(fromPage)) passed++;
  else failures.push(`calendar and booking page write the same history: page ${fromPage.join(" | ")} vs calendar ${fromCal.join(" | ")}`);
  await expectRows("calendar's assignment is logged with the admin as actor", "admin",
    `select count(*) as n from public.booking_events where booking_id = '${CAL}' and action = 'assignment' and actor_id = '${U.admin}' and after->>'driver_id' = '${U.driver}' and after->>'vehicle_id' = '${V}'`, 1);
  await expectRows("calendar leaves the amount received out of the history", "admin",
    `select count(*) as n from public.booking_events where booking_id = '${CAL}' and action = 'amount_paid'`, 0);
  await expectRows("drivers cannot read the calendar's bookings", "driver", `select * from public.bookings where id in ('${PAGE}', '${CAL}')`, 0);
}

// --- Team alerts on the team's phones (migration 0053) --------------------------------------------
{
  const A2 = "00000000-0000-0000-0000-0000000000a2";
  await db.query(`insert into auth.users (id, email) values ($1, 'admin2@example.com')`, [A2]);
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); update public.profiles set role = 'admin' where id = '${A2}'`);
  U.admin2 = A2;
  const KEY = "B".repeat(87);
  const AUTH = "a".repeat(22);
  const reg = (ep) => `select public.register_admin_push('https://push.example/${ep}', '${KEY}', '${AUTH}', 'iPhone · Safari')`;
  await expectOk("admin switches alerts on for a phone", "admin", reg("one"));
  await expectOk("admin switches alerts on for a second phone (direct insert)", "admin",
    `insert into public.admin_push_subscriptions (endpoint, p256dh, auth, label) values ('https://push.example/two', '${KEY}', '${AUTH}', 'Chrome')`);
  await expectRows("the server sees both phones", "server", `select * from public.admin_push_subscriptions where admin_id = '${U.admin}'`, 2);
  await expectRows("the admin cannot read subscriptions through the API (not even their own)", "admin", "select * from public.admin_push_subscriptions", 0);
  await expectRows("another admin cannot read them", "admin2", "select * from public.admin_push_subscriptions", 0);
  await expectRows("a driver cannot read them", "driver", "select * from public.admin_push_subscriptions", 0);
  await expectRows("a traveller cannot read them", "client", "select * from public.admin_push_subscriptions", 0);
  await expectRows("a visitor cannot read them", "anon", "select * from public.admin_push_subscriptions", 0);
  await expectRows("the admin's own count is 2", "admin", "select public.my_admin_push_count() as n", 2);
  await expectRows("a driver's count is 0", "driver", "select public.my_admin_push_count() as n", 0);
  await expectBlocked("a driver cannot register for team alerts", "driver", reg("driver"));
  await expectBlocked("a traveller cannot register for team alerts", "client", reg("client"));
  await expectBlocked("a visitor cannot register for team alerts", "anon", reg("anon"));
  await expectBlocked("a driver cannot insert a subscription directly", "driver",
    `insert into public.admin_push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/d', '${KEY}', '${AUTH}')`);
  await expectBlocked("an admin cannot insert a subscription for another admin", "admin",
    `insert into public.admin_push_subscriptions (admin_id, endpoint, p256dh, auth) values ('${A2}', 'https://push.example/x', '${KEY}', '${AUTH}')`);
  await expectBlocked("a non-https endpoint is refused", "admin", `select public.register_admin_push('http://push.example/y', '${KEY}', '${AUTH}', '')`);
  await expectBlocked("an admin cannot change a subscription (no update)", "admin",
    `update public.admin_push_subscriptions set admin_id = '${A2}' where endpoint = 'https://push.example/one'`, { affected: 0 });
  await expectOk("another admin's unregister of someone else's phone does nothing", "admin2", "select public.unregister_admin_push('https://push.example/one')");
  await expectBlocked("another admin's direct delete of someone else's phone does nothing", "admin2",
    "delete from public.admin_push_subscriptions where endpoint = 'https://push.example/one'", { affected: 0 });
  await expectRows("…both phones still there", "server", `select * from public.admin_push_subscriptions where admin_id = '${U.admin}'`, 2);
  await expectOk("the same phone signed in as another admin is handed over", "admin2", reg("one"));
  await expectRows("…now it belongs to admin 2", "server", `select * from public.admin_push_subscriptions where endpoint = 'https://push.example/one' and admin_id = '${A2}'`, 1);
  await expectOk("admin switches a phone off", "admin", "select public.unregister_admin_push('https://push.example/two')");
  await expectRows("…it's gone", "server", "select * from public.admin_push_subscriptions where endpoint = 'https://push.example/two'", 0);
  await expectOk("the server removes a phone the push service says is gone (410)", "server",
    "delete from public.admin_push_subscriptions where endpoint = 'https://push.example/one'");
  await expectRows("…none left", "server", "select * from public.admin_push_subscriptions", 0);

  // Per-admin settings.
  await expectOk("admin saves their alert settings", "admin",
    `insert into public.admin_alert_prefs (muted_kinds, quiet_start, quiet_end) values (array['new_request'], 22, 6)`);
  await expectRows("…and reads them back", "admin", "select * from public.admin_alert_prefs where quiet_start = 22", 1);
  await expectRows("another admin cannot read them", "admin2", "select * from public.admin_alert_prefs", 0);
  await expectRows("a driver cannot read them", "driver", "select * from public.admin_alert_prefs", 0);
  await expectBlocked("another admin cannot change them", "admin2", "update public.admin_alert_prefs set muted_kinds = '{}'", { affected: 0 });
  await expectBlocked("a driver cannot create alert settings", "driver", "insert into public.admin_alert_prefs (muted_kinds) values ('{}')");
  await expectBlocked("an unknown alert kind is refused", "admin", "update public.admin_alert_prefs set muted_kinds = array['nope']");
  await expectBlocked("half a quiet-hours range is refused", "admin", "update public.admin_alert_prefs set quiet_end = null");
  await expectBlocked("hour 24 is refused", "admin", "update public.admin_alert_prefs set quiet_start = 24");

  // Once only.
  await expectOk("the server claims an alert", "server", "insert into public.team_alerts (kind, dedupe_key) values ('low_rating', 'r1')");
  await expectRows("claiming it again claims nothing", "server",
    "insert into public.team_alerts (kind, dedupe_key) values ('low_rating', 'r1') on conflict (kind, dedupe_key) do nothing returning id", 0);
  await expectRows("the same key under another kind is its own alert", "server",
    "insert into public.team_alerts (kind, dedupe_key) values ('tonight', 'r1') on conflict (kind, dedupe_key) do nothing returning id", 1);
  await expectRows("admins can read the alerts sent", "admin2", "select * from public.team_alerts", 2);
  await expectRows("drivers cannot", "driver", "select * from public.team_alerts", 0);
  await expectBlocked("admins cannot write alerts", "admin", "insert into public.team_alerts (kind, dedupe_key) values ('tonight', 'fake')");

  // "Trip without a driver": the column is claimed once.
  const NB = "10000000-0000-0000-0000-0000000000b9";
  await expectOk("server saves an unassigned booking", "server", `
    insert into public.bookings (id, trip_id, service_type, total_price, status, amount_paid, scheduled_at)
    values ('${NB}', '40000000-0000-0000-0000-000000000001', 'transfer', 150, 'pending_bids', 0, now() + interval '5 hours')`);
  await expectRows("first claim of the no-driver alert wins", "server",
    `update public.bookings set no_driver_alert_at = now() where id = '${NB}' and no_driver_alert_at is null returning id`, 1);
  await expectRows("second claim gets nothing (never repeats)", "server",
    `update public.bookings set no_driver_alert_at = now() where id = '${NB}' and no_driver_alert_at is null returning id`, 0);
  await expectRows("claiming leaves no entry in the booking history", "admin",
    `select count(*) as n from public.booking_events where booking_id = '${NB}'`, 0);
}

// --- Promo codes and the money report (migration 0052) ------------------------------------------
{
  const T1 = "40000000-0000-0000-0000-0000000005a1";
  const T2 = "40000000-0000-0000-0000-0000000005a2";
  const BK = (n) => `10000000-0000-0000-0000-0000000005b${n}`;
  // The tables: admins only; nobody else reads or writes them.
  for (const who of ["anon", "client", "driver"]) {
    await expectRows(`${who} cannot read promo codes`, who, "select * from public.promo_codes", 0);
    await expectBlocked(`${who} cannot create a promo code`, who,
      "insert into public.promo_codes (code, discount_type, value) values ('HACK50', 'percent', 50)");
    await expectRows(`${who} cannot read promo redemptions`, who, "select * from public.promo_redemptions", 0);
    await expectRows(`${who} cannot read failed code checks`, who, "select * from public.promo_code_checks", 0);
  }
  await expectOk("admin creates a code (lower case is stored upper case)", "admin",
    "insert into public.promo_codes (code, discount_type, value, max_uses, max_uses_per_email) values ('summer10', 'percent', 10, 2, 1)");
  await expectRows("code stored upper-case, creator from the session", "admin",
    `select * from public.promo_codes where code = 'SUMMER10' and created_by = '${U.admin}'`, 1);
  await expectBlocked("same code in another case refused", "admin",
    "insert into public.promo_codes (code, discount_type, value) values ('Summer10', 'fixed', 5)");
  await expectBlocked("percent above 100 refused", "admin",
    "insert into public.promo_codes (code, discount_type, value) values ('TOOMUCH', 'percent', 150)");
  await expectBlocked("zero discount refused", "admin",
    "insert into public.promo_codes (code, discount_type, value) values ('ZERO', 'fixed', 0)");
  await expectBlocked("code with spaces refused", "admin",
    "insert into public.promo_codes (code, discount_type, value) values ('TWO WORDS', 'fixed', 5)");
  await expectBlocked("end before start refused", "admin",
    "insert into public.promo_codes (code, discount_type, value, valid_from, valid_to) values ('BACKWARDS', 'fixed', 5, '2026-12-10', '2026-12-01')");
  await expectOk("an update that tries to change created_by…", "admin",
    `update public.promo_codes set created_by = '${U.client}', description = 'Summer' where code = 'SUMMER10'`);
  await expectRows("…keeps the admin as creator", "admin", `select * from public.promo_codes where code = 'SUMMER10' and created_by = '${U.admin}'`, 1);
  await expectOk("admin switches a code off", "admin", "update public.promo_codes set active = false where code = 'SUMMER10'");
  await expectOk("…and on again", "admin", "update public.promo_codes set active = true where code = 'SUMMER10'");
  await expectBlocked("a client can't switch a code off", "client", "update public.promo_codes set active = false where code = 'SUMMER10'", { affected: true });

  // The server saves two discounted bookings on one trip (the client's), one booking on another trip.
  await db.exec(`insert into public.trips (id, access_token, guest_email) values
    ('${T1}', '${"a".repeat(64)}', 'client@example.com'), ('${T2}', '${"b".repeat(64)}', 'other@example.com')`);
  await expectOk("server saves discounted bookings with the promo columns", "server", `
    insert into public.bookings (id, trip_id, client_id, service_type, total_price, driver_payout, platform_fee, pass_through, promo_code, promo_discount, status) values
      ('${BK(1)}', '${T1}', '${U.client}', 'transfer', 180, 150, 30, 30, 'SUMMER10', 20, 'pending_payment'),
      ('${BK(2)}', '${T1}', '${U.client}', 'transfer', 90.99, 70, 20.99, 0, 'SUMMER10', 10.01, 'pending_payment'),
      ('${BK(3)}', '${T2}', null, 'transfer', 100, 80, 20, null, 'SUMMER10', 10, 'pending_payment')`);
  await expectBlocked("negative promo discount refused", "server",
    `update public.bookings set promo_discount = -1 where id = '${BK(1)}'`);
  const code = (await as("server", "select id from public.promo_codes where code = 'SUMMER10'")).rows[0].id;
  for (const who of ["anon", "client", "driver", "admin"]) {
    await expectBlocked(`${who} cannot record a redemption (only the server does)`, who,
      `insert into public.promo_redemptions (booking_id, trip_id, promo_code_id, code, email, discount, platform_part, driver_part)
       values ('${BK(1)}', '${T1}', '${code}', 'SUMMER10', 'x@example.com', 1, 0.5, 0.5)`);
  }
  await expectOk("server records the redemptions (driver's half rounded down)", "server", `
    insert into public.promo_redemptions (booking_id, trip_id, promo_code_id, code, email, discount, platform_part, driver_part) values
      ('${BK(1)}', '${T1}', '${code}', 'SUMMER10', 'client@example.com', 20, 10, 10),
      ('${BK(2)}', '${T1}', '${code}', 'SUMMER10', 'client@example.com', 10.01, 5.01, 5.00),
      ('${BK(3)}', '${T2}', '${code}', 'SUMMER10', 'other@example.com', 10, 5, 5)`);
  await expectBlocked("a split that doesn't add up is refused", "server", `
    insert into public.promo_redemptions (booking_id, trip_id, promo_code_id, code, email, discount, platform_part, driver_part)
    values ('${BK(3)}', '${T2}', '${code}', 'SUMMER10', 'other@example.com', 10, 6, 5)`);
  await expectBlocked("a code that was used can't be deleted (history kept)", "server", `delete from public.promo_codes where id = '${code}'`);
  await expectRows("admin reads the redemptions", "admin", "select * from public.promo_redemptions", 3);
  await expectRows("the traveller can't read the redemption of their own booking", "client", "select * from public.promo_redemptions", 0);
  await expectRows("the traveller reads their own booking's discount", "client",
    `select * from public.bookings where id = '${BK(1)}' and promo_code = 'SUMMER10' and promo_discount = 20`, 1);

  // Usage: trips (not bookings), cancelled left out, per email.
  const usage = async (email) => (await as("server", `select * from public.promo_usage('${code}', $1)`, [email])).rows[0];
  let u = await usage("Client@Example.com ");
  if (u.total === 2 && u.by_email === 1) passed++;
  else failures.push(`promo usage counts trips (2) and this email's trips (1): got ${JSON.stringify(u)}`);
  await db.exec(`update public.bookings set status = 'cancelled' where id = '${BK(3)}'`);
  u = await usage("other@example.com");
  if (u.total === 1 && u.by_email === 0) passed++;
  else failures.push(`a cancelled booking no longer counts as a use: got ${JSON.stringify(u)}`);

  // Drivers: no rows, and my_trips() never carries the client's price, the code or the discount.
  await db.exec(`update public.bookings set assigned_driver_id = '${U.driver}', status = 'confirmed' where id = '${BK(1)}'`);
  await expectRows("drivers read no bookings rows (promo bookings included)", "driver", `select * from public.bookings where id = '${BK(1)}'`, 0);
  const cols = (await as("driver", "select * from public.my_trips()")).fields.map((f) => f.name);
  if (!cols.some((c) => /promo|total_price|platform_fee|pass_through/.test(c)) && cols.includes("driver_payout")) passed++;
  else failures.push(`my_trips() must not return promo or price columns: ${cols.join(", ")}`);
  const mine = (await as("driver", `select driver_payout from public.my_trips() where id = '${BK(1)}'`)).rows[0];
  if (mine && Number(mine.driver_payout) === 150) passed++;
  else failures.push(`the driver sees their reduced payout only: got ${JSON.stringify(mine)}`);

  // Failed-check limit: counted per network for an hour.
  const allowed = async (ip) => (await as("server", "select public.promo_check_allowed($1, 3) as ok", [ip])).rows[0].ok;
  for (let i = 0; i < 3; i++) await as("server", "select public.promo_check_failed($1)", ["198.51.100.7"]);
  if ((await allowed("198.51.100.7")) === false && (await allowed("198.51.100.8")) === true) passed++;
  else failures.push("three failed checks block that network only");
  await db.exec("update public.promo_code_checks set at = now() - interval '2 hours' where ip = '198.51.100.7'");
  if ((await allowed("198.51.100.7")) === true) passed++;
  else failures.push("the block lifts after an hour");
}

// --- Migration 0054: 1-hour posting window, "Volver a publicar", automatic repost 48 h before ----
{
  const PW = (n) => `'54000000-0000-0000-0000-00000000000${n}'`;
  await db.exec(`update public.driver_vehicles set passenger_capacity = 6, vehicle_class = null where id = ${V1}`);
  await db.exec(`delete from public.driver_unavailable where driver_id = '${U.driver}'`);
  await expectOk("server posts a ride to the board", "server", `
    insert into public.bookings (id, client_id, service_type, total_price, driver_payout, platform_fee, status, passenger_count, scheduled_at)
    values (${PW(1)}, '${U.client}', 'transfer', 200, 160, 40, 'pending_bids', 2, now() + interval '5 days')`);
  await expectRows("posting a job opens a 1-hour window", "admin",
    `select 1 from public.bookings where id = ${PW(1)} and posted_at > now() - interval '1 minute' and posting_closes_at - posted_at = interval '1 hour'`, 1);
  await expectRows("open posting is on the job board", "driver", `select 1 from public.driver_jobs() where id = ${PW(1)}`, 1);
  await expectRows("driver offers during the hour", "driver", `select public.offer_job(${PW(1)}, ${V1}, 150) as ref`, 1);
  // An hour later.
  await db.exec(`update public.bookings set posting_closes_at = now() - interval '1 minute', posted_at = now() - interval '61 minutes' where id = ${PW(1)}`);
  await expectRows("after 1 hour the job leaves the board", "driver", `select 1 from public.driver_jobs() where id = ${PW(1)}`, 0);
  try {
    await as("driver", `select public.offer_job(${PW(1)}, ${V1}, 155)`);
    failures.push("offer after the window closed: was allowed");
  } catch (e) {
    if (/This job is no longer open\./.test(e.message)) passed++;
    else failures.push(`offer after the window: unexpected message ${e.message}`);
  }
  await expectRows("…the offer from the hour is kept, unchanged", "admin",
    `select 1 from public.bids where booking_id = ${PW(1)} and bid_amount = 150 and status = 'submitted'`, 1);
  await expectRows("…and the booking still needs a driver (status unchanged)", "admin",
    `select 1 from public.bookings where id = ${PW(1)} and status = 'pending_bids' and assigned_driver_id is null`, 1);

  // "Volver a publicar".
  for (const who of ["driver", "client", "anon"]) {
    await expectBlocked(`${who} cannot repost a job`, who, `select public.repost_job(${PW(1)})`);
  }
  await expectRows("admin reposts: a new 1-hour window", "admin", `select public.repost_job(${PW(1)}) = now() + interval '1 hour' as ok`, 1);
  await expectRows("…the job is back on the board with the driver's offer", "driver",
    `select 1 from public.driver_jobs() where id = ${PW(1)} and my_offer = 150`, 1);
  await expectRows("…logged in the history by the admin", "admin",
    `select 1 from public.booking_events where booking_id = ${PW(1)} and action = 'reposted' and actor_id = '${U.admin}' and (after->>'offers')::int = 1`, 1);
  await expectBlocked("cannot repost while the window is still open", "admin", `select public.repost_job(${PW(1)})`);
  await expectRows("driver can offer again", "driver", `select public.offer_job(${PW(1)}, ${V1}, 152) as ref`, 1);

  // Accepting after the window closed still works.
  await db.exec(`update public.bookings set posting_closes_at = now() - interval '5 minutes' where id = ${PW(1)}`);
  await expectRows("admin accepts an offer after the window closed", "admin",
    `select public.accept_offer((select id from public.bids where booking_id = ${PW(1)})) as ref`, 1);
  await expectRows("…assigned and confirmed", "admin",
    `select 1 from public.bookings where id = ${PW(1)} and status = 'confirmed' and assigned_driver_id = '${U.driver}' and driver_payout = 152`, 1);
  await expectBlocked("a booking with a driver cannot be reposted", "admin", `select public.repost_job(${PW(1)})`);
  // Driver removed → back to "Open for drivers" with a fresh window (the trigger).
  await db.exec(`update public.bookings set posting_closes_at = now() - interval '2 days' where id = ${PW(1)}`);
  await expectOk("team removes the driver: back on the board", "admin",
    `update public.bookings set status = 'pending_bids', assigned_driver_id = null, assigned_vehicle_id = null where id = ${PW(1)}`);
  await expectRows("…with a new 1-hour window", "admin",
    `select 1 from public.bookings where id = ${PW(1)} and posted_at > now() - interval '1 minute' and posting_closes_at - posted_at = interval '1 hour'`, 1);

  // Automatic repost 48 hours before pickup, once per booking.
  await db.exec(`
    insert into public.bookings (id, client_id, service_type, total_price, driver_payout, platform_fee, status, passenger_count, scheduled_at, created_at) values
      (${PW(2)}, '${U.client}', 'transfer', 200, 160, 40, 'pending_bids', 2, now() + interval '47 hours', now() - interval '5 days'),
      (${PW(3)}, '${U.client}', 'transfer', 200, 160, 40, 'pending_bids', 2, now() + interval '40 hours', now() - interval '1 hour'),
      (${PW(4)}, '${U.client}', 'day_tour', 300, 200, 100, 'pending_bids', 2, now() + interval '30 hours', now() - interval '6 days'),
      (${PW(5)}, '${U.client}', 'transfer', 200, 160, 40, 'pending_bids', 2, now() + interval '3 days', now() - interval '6 days'),
      (${PW(6)}, '${U.client}', 'transfer', 200, 160, 40, 'pending_payment', 2, now() + interval '20 hours', now() - interval '6 days');
    update public.bookings set posted_at = created_at, posting_closes_at = created_at + interval '1 hour'
     where id in (${PW(2)}, ${PW(3)}, ${PW(4)}, ${PW(5)});
    update public.bookings set posted_at = now() - interval '10 hours', posting_closes_at = now() - interval '9 hours' where id = ${PW(4)};`);
  await expectBlocked("an admin cannot run the automatic repost", "admin", "select * from public.auto_repost_jobs()");
  await expectBlocked("a driver cannot run the automatic repost", "driver", "select * from public.auto_repost_jobs()");
  const reposted = (await as("server", "select * from public.auto_repost_jobs() as id")).rows.map((r) => r.id);
  if (JSON.stringify(reposted) === JSON.stringify(["54000000-0000-0000-0000-000000000002"])) passed++;
  else failures.push(`auto repost: only the booking posted > 48 h before pickup, pickup now within 48 h: got ${JSON.stringify(reposted)}`);
  await expectRows("…opened a new window and marked it", "admin",
    `select 1 from public.bookings where id = ${PW(2)} and auto_reposted_at > now() - interval '1 minute' and posted_at = auto_reposted_at and posting_closes_at - posted_at = interval '1 hour'`, 1);
  await expectRows("…back on the job board", "driver", `select 1 from public.driver_jobs() where id = ${PW(2)}`, 1);
  await expectRows("…logged as a system event", "admin",
    `select 1 from public.booking_events where booking_id = ${PW(2)} and action = 'auto_reposted' and actor_id is null`, 1);
  await expectRows("late booking (created < 48 h before pickup) is skipped", "admin",
    `select 1 from public.bookings where id = ${PW(3)} and auto_reposted_at is null`, 1);
  await expectRows("posting made < 48 h before pickup is skipped", "admin",
    `select 1 from public.bookings where id = ${PW(4)} and auto_reposted_at is null`, 1);
  await expectRows("pickup more than 48 h away: not yet", "admin",
    `select 1 from public.bookings where id = ${PW(5)} and auto_reposted_at is null`, 1);
  await expectRows("unpaid request never posted: not posted automatically", "admin",
    `select 1 from public.bookings where id = ${PW(6)} and auto_reposted_at is null and status = 'pending_payment'`, 1);
  // Once only: even after this window closes too.
  await db.exec(`update public.bookings set posting_closes_at = now() - interval '1 minute' where id = ${PW(2)}`);
  await expectRows("auto repost happens once per booking", "server", "select * from public.auto_repost_jobs()", 0);
  await expectRows("…one auto_reposted event", "admin",
    `select 1 from public.booking_events where booking_id = ${PW(2)} and action = 'auto_reposted'`, 1);
}


// --- Migration 0056: the team edits pickup / drop-off / time; every change in the history ------
{
  const PE = "56000000-0000-0000-0000-000000000001";
  const PT = "56000000-0000-0000-0000-000000000002";
  const ev = (where) => `select count(*) as n from public.booking_events where booking_id = '${PE}' and ${where}`;
  await expectOk("server saves a confirmed ride SJO → hotel", "server", `
    insert into public.bookings (id, client_id, service_type, vehicle_class, total_price, driver_payout, platform_fee, status, assigned_driver_id, assigned_vehicle_id, passenger_count, scheduled_at,
      origin, destination, origin_coords, destination_coords, drive_minutes, flight_or_hotel_notes)
    values ('${PE}', '${U.client}', 'transfer', 'sedan', 200, 160, 40, 'confirmed', '${U.driver}', ${V1}, 2, now() + interval '5 days',
      'Juan Santamaría Airport (SJO)', 'Hotel A, Calle 1, Quepos',
      '{"lat":9.9939,"lng":-84.2088,"place_id":"hub:SJO","town":"SJO","route":{"km":160,"drivingMinutes":190,"totalMinutes":190,"ferries":0}}',
      '{"lat":9.43,"lng":-84.16,"place_id":"ChIJhotelAAAAAAAA","town":"ManuelAntonio"}', 190, 'AA 100')`);
  await expectRows("new kind 'places' is allowed and the older kinds are kept", "admin",
    "select 1 from pg_constraint where conname = 'booking_events_action_check' and pg_get_constraintdef(oid) ~ 'places' and pg_get_constraintdef(oid) ~ 'auto_reposted' and pg_get_constraintdef(oid) ~ 'trip_link_emailed'", 1);
  await expectBlocked("unknown kinds are still refused", "server",
    `insert into public.booking_events (booking_id, action) values ('${PE}', 'pickup_moved')`);

  // The admin changes the drop-off (the edit form's update, through the admin's own session).
  await expectOk("admin changes the drop-off, drive time and flight notes", "admin", `
    update public.bookings set destination = 'Hotel B, Manuel Antonio road', destination_coords = '{"lat":9.39,"lng":-84.14,"place_id":"ChIJhotelBBBBBBBB","town":"ManuelAntonio"}',
      origin_coords = jsonb_set(origin_coords, '{route}', '{"km":171,"drivingMinutes":205,"totalMinutes":205,"ferries":0}'), drive_minutes = 205,
      flight_or_hotel_notes = 'AA 100 · lobby' where id = '${PE}'`);
  await expectRows("…one 'places' entry by the admin", "admin", ev(`action = 'places' and actor_id = '${U.admin}'`), 1);
  await expectRows("…with the old and new drop-off and place id", "admin",
    ev(`action = 'places' and before->>'destination' = 'Hotel A, Calle 1, Quepos' and after->>'destination' = 'Hotel B, Manuel Antonio road' and before->>'destination_place_id' = 'ChIJhotelAAAAAAAA' and after->>'destination_place_id' = 'ChIJhotelBBBBBBBB'`), 1);
  await expectRows("…and the notes and drive time, old → new", "admin",
    ev(`action = 'places' and before->>'flight_or_hotel_notes' = 'AA 100' and after->>'flight_or_hotel_notes' = 'AA 100 · lobby' and (before->>'drive_minutes')::int = 190 and (after->>'drive_minutes')::int = 205`), 1);
  await expectRows("…only the fields that changed (the pickup didn't)", "admin", ev(`action = 'places' and (after ? 'origin' or before ? 'origin' or after ? 'pickup_place')`), 0);
  await expectRows("…no price or payout entry: the price was kept", "admin", ev(`action in ('price', 'payout')`), 0);

  // "Use the new price": the 0044 trigger logs price and payout with the admin's name.
  await expectOk("admin moves the time and uses the new price", "admin",
    `update public.bookings set scheduled_at = scheduled_at + interval '2 hours', total_price = 215, driver_payout = 172, platform_fee = 43 where id = '${PE}'`);
  await expectRows("…time, price and payout each logged by the admin", "admin",
    ev(`actor_id = '${U.admin}' and action in ('schedule', 'price', 'payout')`), 3);
  await expectRows("…and no extra 'places' entry (no place changed)", "admin", ev(`action = 'places'`), 1);
  await expectOk("saving the same values again", "admin",
    `update public.bookings set destination = destination, flight_or_hotel_notes = flight_or_hotel_notes where id = '${PE}'`);
  await expectRows("…adds nothing to the history", "admin", ev(`action = 'places'`), 1);

  // Who can change it and who can read it.
  for (const who of ["driver", "client", "anon"]) {
    await expectBlocked(`${who} cannot change the pickup`, who,
      `update public.bookings set origin = 'Somewhere else' where id = '${PE}'`, { affected: 0 });
  }
  await expectRows("…the pickup is unchanged", "admin", `select 1 from public.bookings where id = '${PE}' and origin = 'Juan Santamaría Airport (SJO)'`, 1);
  for (const who of ["driver", "client"]) {
    await expectRows(`${who} cannot read the 'places' history`, who, `select * from public.booking_events where action = 'places'`, 0);
  }
  await expectRows("the assigned driver sees the new drop-off in my_trips()", "driver",
    `select 1 from public.my_trips() where id = '${PE}' and destination = 'Hotel B, Manuel Antonio road'`, 1);
  await expectRows("the traveller's own booking shows it", "client",
    `select 1 from public.bookings where id = '${PE}' and destination = 'Hotel B, Manuel Antonio road'`, 1);

  // Day tour: the pickup place.
  await expectOk("server saves a day tour", "server", `
    insert into public.bookings (id, client_id, service_type, catalog_item_id, total_price, status, scheduled_at, pickup_place)
    values ('${PT}', '${U.client}', 'day_tour', 'dt1', 300, 'pending_payment', now() + interval '6 days', 'Hotel Uno')`);
  await expectOk("admin changes the tour's pickup place", "admin", `update public.bookings set pickup_place = 'Hotel Dos, La Fortuna' where id = '${PT}'`);
  await expectRows("…logged with who, old → new", "admin",
    `select 1 from public.booking_events where booking_id = '${PT}' and action = 'places' and actor_id = '${U.admin}' and before->>'pickup_place' = 'Hotel Uno' and after->>'pickup_place' = 'Hotel Dos, La Fortuna'`, 1);
  await expectBlocked("…still no contact details in it", "admin", `update public.bookings set pickup_place = 'Room 4, call +506 8888 7777' where id = '${PT}'`);
  await expectOk("server cleans up", "server", `delete from public.bookings where id in ('${PE}', '${PT}')`);
}

// --- Migration 0057: "add your own stop" (src/lib/customStops.ts) -------------------------------
{
  const CS = "57000000-0000-0000-0000-000000000001";
  const OWN = `[{"id":"tarcoles","price":15},
    {"id":"custom-1","custom":true,"name":"La Fortuna Waterfall","address":"Alajuela, La Fortuna","place_id":"ChIJwaterfallAAAAAA","lat":10.4433,"lng":-84.6712,"minutes":90,"detour_km":11,"detour_min":24,"price":44},
    {"id":"custom-2","custom":true,"name":"Proyecto Asis","place_id":"ChIJasisAAAAAAAAAA","lat":10.4,"lng":-84.5,"minutes":120,"detour_km":24,"detour_min":38,"price":68}]`;
  await expectRows("own-stop limits seeded: 3 stops, 4 hours at stops, 90 min of extra driving", "anon",
    "select 1 from public.pricing_settings where custom_stop_max = 3 and custom_stop_max_wait_min = 240 and custom_stop_max_detour_min = 90", 1);
  await expectBlocked("visitor cannot change the own-stop limits", "anon", "update public.pricing_settings set custom_stop_max = 5", { affected: 0 });
  await expectBlocked("client cannot change the own-stop limits", "client", "update public.pricing_settings set custom_stop_max_detour_min = 480", { affected: 0 });
  await expectBlocked("driver cannot change the own-stop limits", "driver", "update public.pricing_settings set custom_stop_max_wait_min = 720", { affected: 0 });
  await expectBlocked("more than 5 own stops refused", "admin", "update public.pricing_settings set custom_stop_max = 6");
  await expectBlocked("a detour limit above 8 hours refused", "admin", "update public.pricing_settings set custom_stop_max_detour_min = 481");
  await expectOk("admin changes the limits", "admin", "update public.pricing_settings set custom_stop_max = 2, custom_stop_max_wait_min = 300, custom_stop_max_detour_min = 60");
  await expectRows("visitor reads the new limits (the booking page uses them)", "anon",
    "select 1 from public.pricing_settings where custom_stop_max = 2 and custom_stop_max_wait_min = 300 and custom_stop_max_detour_min = 60", 1);
  await expectOk("admin puts the limits back", "admin", "update public.pricing_settings set custom_stop_max = 3, custom_stop_max_wait_min = 240, custom_stop_max_detour_min = 90");

  // 235 min direct + 62 min of extra driving to the two own stops = 297 saved as the drive time.
  await expectOk("server saves a confirmed ride with a catalog stop and two own stops", "server", `
    insert into public.bookings (id, client_id, service_type, vehicle_class, total_price, driver_payout, platform_fee, status, assigned_driver_id, passenger_count, scheduled_at,
      origin, destination, origin_coords, destination_coords, drive_minutes, sightseeing_stops)
    values ('${CS}', '${U.client}', 'transfer', 'sedan', 400, 320, 80, 'confirmed', '${U.driver}', 2, now() + interval '9 days',
      'La Fortuna / Arenal', 'Manuel Antonio', '{"lat":10.47,"lng":-84.64,"place_id":"hub:Arenal","town":"Arenal"}',
      '{"lat":9.4,"lng":-84.15,"place_id":"hub:ManuelAntonio","town":"ManuelAntonio"}', 297, '${OWN}')`);
  await expectRows("the driver gets every stop in order, the own ones with name, minutes and map point", "driver",
    `select 1 from public.my_trips() where id = '${CS}' and jsonb_array_length(sightseeing_stops) = 3
        and sightseeing_stops->1->>'name' = 'La Fortuna Waterfall' and (sightseeing_stops->1->>'minutes')::int = 90
        and (sightseeing_stops->1->>'lat')::numeric = 10.4433 and sightseeing_stops->2->>'name' = 'Proyecto Asis'`, 1);
  await expectRows("…and never what the traveller paid for them", "driver",
    `select 1 from public.my_trips() where id = '${CS}' and (sightseeing_stops::text ~ 'price' or sightseeing_stops::text ~ '(44|68)[,}]')`, 0);
  // 297 drive (own detours inside) + Tárcoles 45 at the stop + 90 + 120 at the own stops = 552 min.
  await expectRows("arrival = pickup + drive time (with the own stops' extra driving) + time at every stop", "driver",
    `select 1 from public.my_trips() where id = '${CS}' and arrive_at - scheduled_at = interval '552 minutes'`, 1);
  await expectOk("server saves a broken own stop (minutes as text, a non-object entry)", "server",
    `update public.bookings set sightseeing_stops = '[{"id":"custom-1","custom":true,"name":"X","minutes":"ninety"}, "oops", {"id":"custom-2","custom":true,"name":"Y","minutes":30}]' where id = '${CS}'`);
  await expectRows("…the arrival estimate still works and counts only real minutes", "driver",
    `select 1 from public.my_trips() where id = '${CS}' and arrive_at - scheduled_at = interval '327 minutes'`, 1);
  await expectRows("the assigned driver still cannot read the booking row (price)", "driver", `select total_price from public.bookings where id = '${CS}'`, 0);
  await expectRows("the traveller reads their own booking with the stops and their prices", "client",
    `select 1 from public.bookings where id = '${CS}' and jsonb_array_length(sightseeing_stops) = 3`, 1);
  await expectRows("another traveller cannot", "client2", `select 1 from public.bookings where id = '${CS}'`, 0);

  // Job board: the same list without prices.
  await expectOk("server posts a ride with an own stop to the job board", "server", `
    update public.bookings set status = 'pending_bids', assigned_driver_id = null, posted_at = now(), posting_closes_at = now() + interval '1 hour', sightseeing_stops = '${OWN}' where id = '${CS}'`);
  const job = (await as("driver", `select sightseeing_stops::text as s, to_jsonb(j)::text as row from public.driver_jobs() j where id = '${CS}'`)).rows[0];
  const check = (name, got, want) => (got === want ? passed++ : failures.push(`${name}: expected ${want}, got ${got}`));
  check("job board lists the own stop by name with its time", Boolean(job) && /La Fortuna Waterfall/.test(job.s) && /"minutes": ?90/.test(job.s), true);
  check("job board never shows a stop's price", Boolean(job) && !/price/.test(job.row), true);
  check("job board never shows the client's price (400)", Boolean(job) && !/\b400\b/.test(job.row), true);
  await expectRows("my_trips() keeps its columns (pickup_place last) and no price or contact columns", "admin",
    "select 1 from pg_proc where proname = 'my_trips' and pg_get_function_result(oid) ~ 'carry_on_count smallint, sign_text text, pickup_place text\\)$' and pg_get_function_result(oid) !~ '(guest_|email|phone|total_price|platform_fee|amount_paid|client_notes|company_costs|pricing_mode|sign_hide_name)'", 1);
  await expectRows("a visitor and another driver get nothing from my_trips()", "anon", "select * from public.my_trips()", 0);
  await expectRows("…nor does a driver it isn't assigned to", "pending", `select * from public.my_trips() where id = '${CS}'`, 0);
  await expectOk("server cleans up", "server", `delete from public.bookings where id = '${CS}'`);
}

// --- Report -----------------------------------------------------------------------------------
console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
