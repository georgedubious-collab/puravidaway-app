-- Pinned (fixed) prices for a route (Jorge, 2026-11-12; docs/PRICING.md §4.5). Run after 0057.
-- Safe to run once, in order (and harmless if run again: nothing is overwritten).
--
-- The ride formula prices every town pair from road km and driving hours. For a few routes
-- Jorge wants to set the price himself (first one: SJO ↔ Puerto Jiménez, where the formula is
-- about 20% under Daytrip). A row here REPLACES the formula's ride price for that town pair and
-- vehicle class: the amount after the vehicle factor and the area factor, before the vehicle's
-- extra fee. Everything after it is unchanged: season multiplier, night premium, stops,
-- ferries / the Drake Bay boat, cash fee, promo codes, the commission and the driver's payout.
--
--   both_ways = true  : the price counts in both directions (the default).
--   both_ways = false : only origin_hub → destination_hub.
--   A row written in the ride's own direction wins over a both-ways row written the other way.
--
-- A class with no row on a route keeps the formula. The "4x4 + Sierpe boat" class uses the
-- 4x4 row (+ its boat fee), in the code (src/lib/pinnedPrices.ts).
--
-- Same access as the other pricing tables (pricing_settings, hub_pricing): everyone reads
-- (the website shows the price), only admins write. Edited at /admin/pricing.

create table if not exists public.pinned_route_prices (
  id               uuid primary key default gen_random_uuid(),
  origin_hub       text not null
    check (origin_hub in ('SJO','LIR','Arenal','ManuelAntonio','Monteverde','Sierpe','DrakeBay','PuertoViejo','Tamarindo','PuertoJimenez')),
  destination_hub  text not null
    check (destination_hub in ('SJO','LIR','Arenal','ManuelAntonio','Monteverde','Sierpe','DrakeBay','PuertoViejo','Tamarindo','PuertoJimenez')),
  vehicle_class_id text not null references public.vehicle_classes(id) on delete cascade,
  -- USD, green-season base for the whole vehicle.
  price            numeric(10,2) not null check (price >= 1 and price <= 5000),
  both_ways        boolean not null default true,
  updated_at       timestamptz not null default now(),
  constraint pinned_route_prices_two_towns check (origin_hub <> destination_hub),
  constraint pinned_route_prices_one_per_class unique (origin_hub, destination_hub, vehicle_class_id)
);

comment on table public.pinned_route_prices is
  'Fixed ride price per town pair and vehicle class; replaces the formula price (after vehicle and area factor). docs/PRICING.md §4.5.';

drop trigger if exists pinned_route_prices_touch on public.pinned_route_prices;
create trigger pinned_route_prices_touch before update on public.pinned_route_prices
  for each row execute function public.touch_pricing_settings();

alter table public.pinned_route_prices enable row level security;

drop policy if exists pinned_route_prices_public_read on public.pinned_route_prices;
create policy pinned_route_prices_public_read on public.pinned_route_prices
  for select to anon, authenticated using (true);

drop policy if exists pinned_route_prices_admin_write on public.pinned_route_prices;
create policy pinned_route_prices_admin_write on public.pinned_route_prices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.pinned_route_prices to anon;
grant select, insert, update, delete on public.pinned_route_prices to authenticated, service_role;

-- SJO ↔ Puerto Jiménez, the same both ways, about 5% under Daytrip's matching class
-- (checked 2026-10-14: Sedan Lite $518, Sedan $530, Compact MPV $582, Van $639).
-- The 4x4 sits between the Minivan and the Van as its factor does (1.20 / 1.30 / 1.35).
insert into public.pinned_route_prices (origin_hub, destination_hub, vehicle_class_id, price, both_ways)
select 'SJO', 'PuertoJimenez', p.class_id, p.price, true
  from (values ('economy', 489), ('sedan', 499), ('suv', 549), ('4x4', 585), ('van', 605)) as p(class_id, price)
 where exists (select 1 from public.vehicle_classes v where v.id = p.class_id)
on conflict (origin_hub, destination_hub, vehicle_class_id) do nothing;
