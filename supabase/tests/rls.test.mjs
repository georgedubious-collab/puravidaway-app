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
await expectRows("visitor reads the 9 town + 1 extra area factors", "anon", "select * from public.hub_pricing", 10);
await expectRows("Osa pickups cost 15% more", "anon", "select * from public.hub_pricing where hub_id in ('Sierpe','DrakeBay') and area_factor = 1.15", 2);
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
  // The change history (migration 0044) logs only its listed columns: the message stamps and the
  // pickup place never add history rows.
  await expectRows("message stamps and pickup place never add history rows", "admin",
    `select count(*) as n from public.booking_events where booking_id in ('${B}', '${T}') and (before::text || after::text) ~ '(reminder_|followup_|confirmed_at|pickup_place|team_alerted)'`, 0);
  await expectOk("server stamps the tour's reminders", "server",
    `update public.bookings set reminder_traveller_at = now(), reminder_driver_at = now(), followup_sent_at = now() where id = '${T}'`);
  await expectRows("…and the history stays empty for the tour", "admin", `select count(*) as n from public.booking_events where booking_id = '${T}'`, 0);
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
      ('${J(10)}', 'booker@example.com',    ${before}, null, null);               -- linked booking: kept
    update public.profiles set role = 'driver' where id = '${J(5)}';
    insert into public.drivers (id, kyc_status) values ('${J(5)}', 'pending');
    update public.profiles set role = 'admin' where id = '${J(6)}';
    insert into public.trips (id, access_token, guest_email) values ('${J(77)}', repeat('t', 48), 'traveller@example.COM');
    insert into public.device_tokens (user_id, token, platform, app) values ('${J(9)}', 'ExponentPushToken[cleanup-test]', 'android', 'client');
    update public.bookings set client_id = '${J(10)}' where id = (select id from public.bookings order by created_at limit 1);
  `);
  // auth.users is read as the database owner (the migration runner), not as an API role.
  const count = async (sql) => Number((await db.query(sql)).rows[0].n);
  const same = (name, got, w) => (got === w ? passed++ : failures.push(`${name}: expected ${w}, got ${got}`));
  const users = "select count(*) n from auth.users where id::text like '00000000-0000-0000-0000-00000000f%'";
  same("cleanup fixtures in place", await count(users), 10);
  await db.exec(readFileSync(join(dir, "20261112000051_cleanup_bot_signups.sql"), "utf8"));
  same("cleanup: only the two junk accounts are deleted", await count(users), 8);
  same("cleanup: junk accounts gone", await count(`select count(*) n from auth.users where id in ('${J(1)}', '${J(2)}')`), 0);
  await expectRows("cleanup: their profiles gone too", "server", `select * from public.profiles where id in ('${J(1)}', '${J(2)}')`, 0);
  for (const [k, what] of [[3, "confirmed client"], [4, "client who signed in"], [5, "driver"], [6, "admin"], [7, "client with a trip email"],
    [8, "unconfirmed account after the cutoff"], [9, "account with a push token"], [10, "account linked to a booking"]]) {
    await expectRows(`cleanup keeps the ${what}`, "server", `select * from public.profiles where id = '${J(k)}'`, 1);
  }
  for (const k of Object.keys(U)) await expectRows(`cleanup keeps test user ${k}`, "server", `select * from public.profiles where id = '${U[k]}'`, 1);
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

// --- Report -----------------------------------------------------------------------------------
console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
