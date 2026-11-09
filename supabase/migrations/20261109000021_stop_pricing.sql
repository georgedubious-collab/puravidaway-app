-- Stops priced by waiting time + detour (docs/PRICING.md §5, build step 5; Jorge, 2026-11-09).
--
--   stop price = waiting time × wait rate ($20/hour)
--              + detour km × the ride formula's per-km rate + detour minutes × its per-hour rate
--              + guide fee (0 unless the stop is guided)
--   rounded to whole dollars; the season multiplier applies as before; park entrance is
--   shown separately (free / included / paid at the gate).
--
-- The flat `price` per stop is retired; the three inputs are edited at /admin/pricing.
-- Run after 0020. Safe to run more than once (re-running resets the detours below).

alter table public.pricing_settings
  add column if not exists wait_per_hour numeric(10,2) not null default 20 check (wait_per_hour >= 0);
comment on column public.pricing_settings.wait_per_hour is
  'USD per hour the driver waits at a sightseeing stop (Jorge, 2026-11-09: $20).';

alter table public.sightseeing_stops
  add column if not exists detour_km  numeric(6,1) not null default 0 check (detour_km >= 0),
  add column if not exists detour_min integer      not null default 0 check (detour_min >= 0),
  add column if not exists guide_fee  numeric(10,2) not null default 0 check (guide_fee >= 0);
alter table public.sightseeing_stops alter column price drop not null;
comment on column public.sightseeing_stops.price is
  'Retired 2026-11-09 (flat price). The stop price is wait time × wait rate + detour × ride rates + guide fee.';
comment on column public.sightseeing_stops.detour_km is
  'Extra road km the stop adds to the ride, there and back (0 when it sits on the road).';
comment on column public.sightseeing_stops.detour_min is
  'Extra driving minutes the stop adds, there and back (not the time spent at the stop).';
comment on column public.sightseeing_stops.guide_fee is
  'USD added when the stop includes a guide (0 otherwise).';

-- Starting detours (road estimates; edit at /admin/pricing):
-- Tárcoles bridge and the sloth trail are on the way; Carara's entrance is just off Route 34;
-- Poás is ~12 km each way off the Vara Blanca road; Río Celeste ~9 km each way from Bijagua.
update public.sightseeing_stops set detour_km = 0,  detour_min = 0  where id = 'tarcoles';
update public.sightseeing_stops set detour_km = 2,  detour_min = 5  where id = 'carara';
update public.sightseeing_stops set detour_km = 24, detour_min = 40 where id = 'poas';
update public.sightseeing_stops set detour_km = 18, detour_min = 35 where id = 'rioceleste';
update public.sightseeing_stops set detour_km = 0,  detour_min = 0  where id = 'sloth';
