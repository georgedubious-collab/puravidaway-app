-- Payment options (Jorge, 2026-11-08; PROJECT.md §6.4). Replaces the 20% deposit:
--   * full_100     — pay online in full (secure link sent once the trip is confirmed)
--   * cash_driver  — pay the driver in cash, plus a cash booking fee (% of the ride price).
--                    Rides and 1-day tours only; expeditions are always paid online.
-- deposit_20 stays valid so requests saved before this change keep loading.
--
-- Run after 0011. Safe to run more than once.

-- 1. bookings: allow cash_driver, store the cash fee charged on each booking.
alter table public.bookings drop constraint if exists bookings_payment_mode_check;
alter table public.bookings
  add constraint bookings_payment_mode_check
  check (payment_mode in ('full_100', 'deposit_20', 'cash_driver'));

alter table public.bookings
  add column if not exists cash_fee numeric(10,2) not null default 0 check (cash_fee >= 0);

comment on column public.bookings.cash_fee is
  'Cash booking fee in USD charged on this booking (payment_mode = cash_driver), snapshotted when the request was sent.';

-- 2. pricing_settings: one row of site-wide pricing settings, edited at /admin/pricing.
create table if not exists public.pricing_settings (
  id            boolean primary key default true check (id),
  -- Basis points: 1000 = 10% of the ride price.
  cash_fee_bps  int not null default 1000 check (cash_fee_bps between 0 and 5000),
  updated_at    timestamptz not null default now()
);

insert into public.pricing_settings (id) values (true) on conflict (id) do nothing;

create or replace function public.touch_pricing_settings()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pricing_settings_touch on public.pricing_settings;
create trigger pricing_settings_touch before update on public.pricing_settings
  for each row execute function public.touch_pricing_settings();

-- 3. Row level security: everyone reads (the storefront shows the fee), only admins write.
alter table public.pricing_settings enable row level security;

drop policy if exists pricing_settings_public_read on public.pricing_settings;
create policy pricing_settings_public_read on public.pricing_settings
  for select to anon, authenticated using (true);

drop policy if exists pricing_settings_admin_write on public.pricing_settings;
create policy pricing_settings_admin_write on public.pricing_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 4. Explicit Data API privileges (same pattern as migration 0004).
grant select on public.pricing_settings to anon;
grant select, insert, update, delete on public.pricing_settings to authenticated, service_role;
