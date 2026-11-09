-- Stops priced by waiting time + detour (docs/PRICING.md §5, build step 5; Jorge, 2026-11-09).
--
--   stop price = waiting time × wait rate ($20/hour)
--              + detour km × the ride formula's per-km rate + detour minutes × its per-hour rate
--              + tour price per person × travellers   (guide, entrance, activity; 0 for a plain stop)
--   rounded to whole dollars; the season multiplier applies as before. Stops that are really
--   tours (a guided park walk, Poás + a coffee tour) are priced per person like Jorge's tours
--   on costaricatravelplanner.com (2026-11-09); the driver's time is the wait + detour part.
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
  add column if not exists tour_price_pp numeric(10,2) not null default 0 check (tour_price_pp >= 0);
alter table public.sightseeing_stops alter column price drop not null;
comment on column public.sightseeing_stops.price is
  'Retired 2026-11-09 (flat price). The stop price is wait time × wait rate + detour × ride rates + tour_price_pp × travellers.';
comment on column public.sightseeing_stops.detour_km is
  'Extra road km the stop adds to the ride, there and back (0 when it sits on the road).';
comment on column public.sightseeing_stops.detour_min is
  'Extra driving minutes the stop adds, there and back (not the time spent at the stop).';
comment on column public.sightseeing_stops.tour_price_pp is
  'USD per traveller for the tour part of the stop (guide, entrance, activity); 0 for a plain stop.';

-- Starting detours (road estimates; edit at /admin/pricing):
-- Tárcoles bridge and the sloth trail are on the way; Carara's entrance is just off Route 34;
-- Poás is ~12 km each way off the Vara Blanca road; Río Celeste ~9 km each way from Bijagua.
-- Tour part per person: starting guesses from Jorge's tour prices (guide + entrance + activity),
-- to confirm at /admin/pricing. Tárcoles is a free roadside stop.
update public.sightseeing_stops set detour_km = 0,  detour_min = 0,  tour_price_pp = 0  where id = 'tarcoles';
update public.sightseeing_stops set detour_km = 2,  detour_min = 5,  tour_price_pp = 45 where id = 'carara';
update public.sightseeing_stops set detour_km = 24, detour_min = 40, tour_price_pp = 55 where id = 'poas';
update public.sightseeing_stops set detour_km = 18, detour_min = 35, tour_price_pp = 35 where id = 'rioceleste';
update public.sightseeing_stops set detour_km = 0,  detour_min = 0,  tour_price_pp = 30 where id = 'sloth';
