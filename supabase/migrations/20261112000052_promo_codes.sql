-- Promo codes and the money report (CRM part 5, 2026-11-12).
--
-- Jorge's rule: a promo discount is split 50/50 between the platform's share and the driver's
-- payout ($20 off = the platform keeps $10 less and the driver is paid $10 less). Drivers still
-- see only their own payout, never the client's price or the code. The maths is in
-- src/lib/promo.ts; this file only stores it.
--
-- What this file does:
--   1. bookings: promo_code (the code used, upper-case), promo_discount (USD taken off this
--      booking's total_price; total_price is already the discounted price) and pass_through
--      (ferry tickets paid to the driver in full, recorded from now on so the money report can
--      show them; null on older bookings).
--   2. public.promo_codes: the codes the team creates at /admin/promos. Admins only.
--   3. public.promo_redemptions: one row per booking that used a code (discount, the platform's
--      part, the driver's part). Admins read; only the server writes.
--   4. public.promo_code_checks: failed code checks per network address, for the rate limit
--      (no policies: only the server). public.promo_check_allowed() / promo_check_failed().
--   5. public.promo_usage(): how many trips used a code, in total and by one email (cancelled
--      bookings don't count). Server only.
--
-- The public never reads these tables: codes are checked on the server (service role).
-- Run after 0051. Safe to run once, in order. It changes no existing rows.

-- 1. Bookings -----------------------------------------------------------------------------------
alter table public.bookings
  add column if not exists promo_code text,
  add column if not exists promo_discount numeric(10,2) not null default 0,
  add column if not exists pass_through numeric(10,2);
alter table public.bookings drop constraint if exists bookings_promo_discount_check;
alter table public.bookings add constraint bookings_promo_discount_check check (promo_discount >= 0);
alter table public.bookings drop constraint if exists bookings_pass_through_check;
alter table public.bookings add constraint bookings_pass_through_check check (pass_through is null or pass_through >= 0);
comment on column public.bookings.promo_code is
  'Promo code used on this booking (upper-case), or null. Never sent to drivers (my_trips / driver_jobs don''t return it).';
comment on column public.bookings.promo_discount is
  'USD the promo code took off this booking. total_price is already after the discount; the price before it is total_price + promo_discount.';
comment on column public.bookings.pass_through is
  'Ferry tickets inside total_price, paid to the driver in full (USD). Recorded from 2026-11-12; null on older bookings.';

-- 2. Promo codes --------------------------------------------------------------------------------
create table if not exists public.promo_codes (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,29}$'),
  description        text check (description is null or char_length(description) <= 200),
  discount_type      text not null check (discount_type in ('percent', 'fixed')),
  value              numeric(10,2) not null check (value > 0 and (discount_type = 'fixed' or value <= 100)),
  applies_to         text not null default 'both' check (applies_to in ('rides', 'tours', 'both')),
  min_order          numeric(10,2) not null default 0 check (min_order >= 0),
  valid_from         date,
  valid_to           date,
  max_uses           int check (max_uses is null or max_uses > 0),
  max_uses_per_email int check (max_uses_per_email is null or max_uses_per_email > 0),
  active             boolean not null default true,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint promo_codes_dates check (valid_from is null or valid_to is null or valid_to >= valid_from)
);
-- One code per spelling, whatever the case.
create unique index if not exists promo_codes_code_key on public.promo_codes (lower(code));
comment on table public.promo_codes is
  'Promo codes (admin-only, /admin/promos). value = percent (1–100) or USD. Checked on the server only.';

alter table public.promo_codes enable row level security;
revoke all on public.promo_codes from anon, authenticated;
grant select, insert, update on public.promo_codes to authenticated;
grant select, insert, update, delete on public.promo_codes to service_role;
drop policy if exists promo_codes_admin on public.promo_codes;
create policy promo_codes_admin on public.promo_codes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Who created it comes from the session, never from the form; updated_at on every change.
create or replace function public.promo_codes_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.code := upper(trim(new.code));
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
drop trigger if exists promo_codes_stamp on public.promo_codes;
create trigger promo_codes_stamp before insert or update on public.promo_codes
  for each row execute function public.promo_codes_stamp();

-- 3. Redemptions --------------------------------------------------------------------------------
create table if not exists public.promo_redemptions (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null unique references public.bookings (id) on delete cascade,
  trip_id        uuid not null,
  promo_code_id  uuid not null references public.promo_codes (id) on delete restrict,
  code           text not null,
  email          text not null,
  discount       numeric(10,2) not null check (discount > 0),
  platform_part  numeric(10,2) not null check (platform_part >= 0),
  driver_part    numeric(10,2) not null check (driver_part >= 0),
  created_at     timestamptz not null default now(),
  constraint promo_redemptions_split check (platform_part + driver_part = discount)
);
create index if not exists promo_redemptions_code_idx on public.promo_redemptions (promo_code_id);
create index if not exists promo_redemptions_email_idx on public.promo_redemptions (promo_code_id, email);
comment on table public.promo_redemptions is
  'One row per booking that used a promo code: discount = platform_part + driver_part (driver_part = half, rounded down to the cent). Admins read; the server writes.';

alter table public.promo_redemptions enable row level security;
revoke all on public.promo_redemptions from anon, authenticated;
grant select on public.promo_redemptions to authenticated;
grant select, insert, update, delete on public.promo_redemptions to service_role;
drop policy if exists promo_redemptions_admin_read on public.promo_redemptions;
create policy promo_redemptions_admin_read on public.promo_redemptions
  for select to authenticated using (public.is_admin());

-- 4. Rate limit on code checks ------------------------------------------------------------------
create table if not exists public.promo_code_checks (
  id  bigserial primary key,
  ip  text not null,
  at  timestamptz not null default now()
);
create index if not exists promo_code_checks_ip_idx on public.promo_code_checks (ip, at);
comment on table public.promo_code_checks is
  'Failed promo code checks per network address, for the rate limit (migration 0052). Server only; rows older than a day are removed.';

alter table public.promo_code_checks enable row level security;
revoke all on public.promo_code_checks from anon, authenticated;
grant select, insert, delete on public.promo_code_checks to service_role;
grant usage on sequence public.promo_code_checks_id_seq to service_role;

-- True while this network address has had fewer than p_limit failed checks in the last hour.
create or replace function public.promo_check_allowed(p_ip text, p_limit int)
returns boolean
language sql
stable
set search_path = public
as $$
  select (select count(*) from public.promo_code_checks where ip = p_ip and at > now() - interval '1 hour') < p_limit;
$$;

-- Record one failed check (and drop rows older than a day).
create or replace function public.promo_check_failed(p_ip text)
returns void
language sql
set search_path = public
as $$
  delete from public.promo_code_checks where at < now() - interval '1 day';
  insert into public.promo_code_checks (ip) values (p_ip);
$$;

-- 5. Usage counts -------------------------------------------------------------------------------
-- Trips (not bookings: one trip with two rides is one use) that used the code, cancelled bookings left out.
create or replace function public.promo_usage(p_code_id uuid, p_email text)
returns table (total int, by_email int)
language sql
stable
set search_path = public
as $$
  select count(distinct r.trip_id)::int,
         count(distinct r.trip_id) filter (where r.email = lower(trim(coalesce(p_email, ''))))::int
    from public.promo_redemptions r
    join public.bookings b on b.id = r.booking_id
   where r.promo_code_id = p_code_id
     and b.status <> 'cancelled';
$$;

revoke all on function public.promo_check_allowed(text, int) from public, anon, authenticated;
revoke all on function public.promo_check_failed(text) from public, anon, authenticated;
revoke all on function public.promo_usage(uuid, text) from public, anon, authenticated;
grant execute on function public.promo_check_allowed(text, int) to service_role;
grant execute on function public.promo_check_failed(text) to service_role;
grant execute on function public.promo_usage(uuid, text) to service_role;
