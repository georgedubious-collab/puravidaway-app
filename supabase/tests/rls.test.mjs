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
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
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
  insert into public.drivers (id, kyc_status) values ('${U.driver}', 'approved'), ('${U.pending}', 'pending');
`);

// --- Catalog ------------------------------------------------------------------
await expectRows("visitor reads active vehicles", "anon", "select * from public.vehicle_classes", 4);
await expectRows("visitor reads stops", "anon", "select * from public.sightseeing_stops", 5);
await expectBlocked("visitor cannot change prices", "anon", "update public.vehicle_classes set base_rate = 1", { affected: 0 });
await expectBlocked("client cannot change prices", "client", "update public.vehicle_classes set base_rate = 1", { affected: 0 });
await expectOk("admin changes a price", "admin", "update public.vehicle_classes set base_rate = 180 where id = 'suv'");
await expectOk("admin hides a stop", "admin", "update public.sightseeing_stops set active = false where id = 'sloth'");
await expectRows("visitor no longer sees hidden stop", "anon", "select * from public.sightseeing_stops", 4);
await expectRows("admin still sees hidden stop", "admin", "select * from public.sightseeing_stops", 5);

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
await expectOk("approved driver renews a document", "driver",
  `update public.drivers set license_expiry = '2030-01-01' where id = '${U.driver}'`);
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
await expectRows("approved driver sees open request", "driver", "select * from public.bookings", 1);
await expectRows("pending driver sees no requests", "pending", "select * from public.bookings", 0);
await expectRows("visitor sees no bookings", "anon", "select * from public.bookings", 0);
await expectBlocked("client cannot change own price", "client", "update public.bookings set total_price = 1", { affected: 0 });
await expectRows("booking ref generated", "admin", "select * from public.bookings where booking_ref like 'PVW-1000%'", 2);

// --- Bids -----------------------------------------------------------------------------
await expectOk("approved driver bids on open request", "driver", `
  insert into public.bids (id, booking_id, driver_id, bid_amount) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '${U.driver}', 185)`);
await expectBlocked("pending driver cannot bid", "pending", `
  insert into public.bids (booking_id, driver_id, bid_amount) values ('10000000-0000-0000-0000-000000000001', '${U.pending}', 150)`);
await expectBlocked("driver cannot bid on closed booking", "driver", `
  insert into public.bids (booking_id, driver_id, bid_amount) values ('10000000-0000-0000-0000-000000000002', '${U.driver}', 150)`);
await expectBlocked("driver cannot accept own bid", "driver",
  `update public.bids set status = 'accepted' where id = '20000000-0000-0000-0000-000000000001'`);
await expectRows("client sees bids on own booking", "client", "select * from public.bids", 1);
await expectRows("other client sees no bids", "client2", "select * from public.bids", 0);
await expectOk("driver withdraws own bid", "driver",
  `update public.bids set status = 'withdrawn' where id = '20000000-0000-0000-0000-000000000001'`);

// --- Trip chat --------------------------------------------------------------------------
await expectOk("client messages on own trip", "client", `
  insert into public.trip_chats (booking_id, sender_id, sender_role, message)
  values ('10000000-0000-0000-0000-000000000001', '${U.client}', 'client', 'Hola!')`);
await expectBlocked("client cannot post as admin", "client", `
  insert into public.trip_chats (booking_id, sender_id, sender_role, message)
  values ('10000000-0000-0000-0000-000000000001', '${U.client}', 'admin', 'x')`);
await expectBlocked("stranger cannot post", "client2", `
  insert into public.trip_chats (booking_id, sender_id, sender_role, message)
  values ('10000000-0000-0000-0000-000000000001', '${U.client2}', 'client', 'x')`);
await expectRows("unassigned driver cannot read chat", "driver", "select * from public.trip_chats", 0);
await expectRows("admin reads chat", "admin", "select * from public.trip_chats", 1);

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

// --- Report -----------------------------------------------------------------------------------
console.log(`${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
