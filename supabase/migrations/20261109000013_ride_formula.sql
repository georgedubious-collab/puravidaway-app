-- Ride price formula (Jorge, 2026-11-09; docs/PRICING.md §4, build step 1).
-- Replaces the flat rate per vehicle class with:
--
--   ride = max(minimum fare, base + per km × road km + per hour × drive hours)
--          × vehicle factor × area factor (pickup town) + vehicle extra fee
--   total = (ride + stops) × season multiplier
--
-- Road km and drive times per town pair live in src/lib/catalog.ts for now
-- (step 3 replaces them with Google Routes). Every price number here is edited
-- at /admin/pricing.
--
-- Run after 0012. Safe to run more than once (re-running resets the vehicle factors
-- below to these starting values).

-- 1. Formula numbers on the existing single settings row.
alter table public.pricing_settings
  add column if not exists ride_base_fare    numeric(10,2) not null default 35   check (ride_base_fare >= 0),
  add column if not exists ride_per_km       numeric(10,2) not null default 0.70 check (ride_per_km >= 0),
  add column if not exists ride_per_hour     numeric(10,2) not null default 12   check (ride_per_hour >= 0),
  add column if not exists ride_minimum_fare numeric(10,2) not null default 110  check (ride_minimum_fare >= 0);

-- 2. Vehicle classes: a price factor instead of a flat rate.
alter table public.vehicle_classes
  add column if not exists price_factor numeric(4,2) not null default 1.00
    check (price_factor between 0.50 and 3.00),
  add column if not exists extra_fee numeric(10,2) not null default 0 check (extra_fee >= 0),
  add column if not exists allows_stops boolean not null default true,
  add column if not exists spanish_speaking_driver boolean not null default false;

-- The flat rate is no longer used for pricing; kept so old data stays readable.
alter table public.vehicle_classes alter column base_rate drop not null;
comment on column public.vehicle_classes.base_rate is
  'Retired 2026-11-09 (flat rate per class). Prices come from the ride formula × price_factor.';
comment on column public.vehicle_classes.price_factor is
  'Multiplies the Standard ride price: Economy 0.90, Standard 1.00, SUV 1.20, 4x4 1.30, Van 1.35.';
comment on column public.vehicle_classes.extra_fee is
  'Fixed USD added per ride for this class, e.g. the Sierpe river boat in the 4x4 + boat combo.';

update public.vehicle_classes set price_factor = 1.20, sort_order = 3 where id = 'suv';
update public.vehicle_classes set price_factor = 1.30, sort_order = 4 where id = '4x4';
update public.vehicle_classes set price_factor = 1.35, sort_order = 5 where id = 'van';
-- Combo = 4x4 price + the boat. $75 keeps today's gap between the combo ($290) and the 4x4 ($215).
update public.vehicle_classes set price_factor = 1.30, extra_fee = 75, sort_order = 6 where id = 'sierpe_combo';

-- New classes, matching Daytrip's Sedan Lite / Sedan so travellers compare like with like.
insert into public.vehicle_classes
  (id, name, base_rate, max_pax, luggage, badge, only_for_hubs, sort_order,
   price_factor, extra_fee, allows_stops, spanish_speaking_driver)
values
  ('economy', 'Economy Sedan', null, 3, '3 suitcases', 'Spanish-speaking driver · direct ride', '{}', 1,
   0.90, 0, false, true),
  ('sedan', 'Standard Sedan', null, 3, '3 suitcases', 'Best value', '{}', 2,
   1.00, 0, true, false)
on conflict (id) do nothing;

-- Set the new classes' pricing explicitly too, in case a regenerated seed created them earlier.
update public.vehicle_classes set price_factor = 0.90, allows_stops = false, spanish_speaking_driver = true where id = 'economy';
update public.vehicle_classes set price_factor = 1.00 where id = 'sedan';

-- 3. Area factor per pickup town: scarce drivers cost more to bring in.
create table if not exists public.hub_pricing (
  hub_id      text primary key
    check (hub_id in ('SJO','LIR','Arenal','ManuelAntonio','Monteverde','Sierpe','DrakeBay','PuertoViejo','Tamarindo')),
  area_factor numeric(4,2) not null default 1.00 check (area_factor between 0.50 and 2.00),
  updated_at  timestamptz not null default now()
);

insert into public.hub_pricing (hub_id, area_factor) values
  ('SJO', 1.00), ('Arenal', 1.00), ('ManuelAntonio', 1.00), ('Monteverde', 1.00),
  ('PuertoViejo', 1.00),
  ('LIR', 1.10), ('Tamarindo', 1.10),     -- Guanacaste
  ('Sierpe', 1.15), ('DrakeBay', 1.15)    -- Osa / Southern Pacific
on conflict (hub_id) do nothing;

drop trigger if exists hub_pricing_touch on public.hub_pricing;
create trigger hub_pricing_touch before update on public.hub_pricing
  for each row execute function public.touch_pricing_settings();

alter table public.hub_pricing enable row level security;

drop policy if exists hub_pricing_public_read on public.hub_pricing;
create policy hub_pricing_public_read on public.hub_pricing
  for select to anon, authenticated using (true);

drop policy if exists hub_pricing_admin_write on public.hub_pricing;
create policy hub_pricing_admin_write on public.hub_pricing
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.hub_pricing to anon;
grant select, insert, update, delete on public.hub_pricing to authenticated, service_role;
