-- "Add your own stop" on a ride (Jorge, 2026-11-12; docs/PRICING.md §5.1, src/lib/customStops.ts).
--
-- A traveller can add any place found with the place search as a stop and say how long they
-- stay. It is priced like the driver's part of a catalog stop (waiting time × wait_per_hour +
-- extra km and extra driving minutes at the ride formula's rates, whole dollars, then the season).
--
-- Storage: no new table. An own stop is one more entry in bookings.sightseeing_stops, after the
-- catalog stops, in the traveller's order:
--   { "id": "custom-1", "custom": true, "name": "La Fortuna Waterfall", "address": "...",
--     "place_id": "<Google place id>", "lat": 10.44, "lng": -84.67,
--     "minutes": 90, "detour_km": 11.4, "detour_min": 24, "price": 45.00 }
-- "price" (USD, before the season) is the only money in it, and stops_for_driver() (migration
-- 0036) already removes every "price" before a driver sees the list, so drivers get the name,
-- the place and the time only. bookings.drive_minutes now includes the extra driving to own stops.
-- RLS is unchanged: bookings are read by their traveller and admins, drivers only through
-- driver_jobs() / my_trips(); pricing_settings stays public read / admin write.
--
-- This file:
--   1. adds the three limits to pricing_settings (edited at /admin/pricing; assumed values,
--      docs/PROJECT.md §9);
--   2. redefines my_trips() so the driver's "Arrives approx." also counts the minutes at own
--      stops (same columns and rules as migration 0045, one more term in arrive_at).
-- Run after 0056. Safe to run once, in order.

-- 1. Limits
alter table public.pricing_settings
  add column if not exists custom_stop_max            smallint not null default 3   check (custom_stop_max between 0 and 5),
  add column if not exists custom_stop_max_wait_min   smallint not null default 240 check (custom_stop_max_wait_min between 30 and 720),
  add column if not exists custom_stop_max_detour_min smallint not null default 90  check (custom_stop_max_detour_min between 0 and 480);
comment on column public.pricing_settings.custom_stop_max is
  'Most own stops ("add your own stop") a traveller can add to one ride; 0 switches the feature off.';
comment on column public.pricing_settings.custom_stop_max_wait_min is
  'Most minutes at stops in total on a ride that has an own stop (own + catalog stops together).';
comment on column public.pricing_settings.custom_stop_max_detour_min is
  'Most extra driving minutes all own stops may add to a ride; more is refused and quoted by the team.';

-- 2. The driver's trips: arrival = pickup (or the actual pickup once started) + drive time
--    (which includes the extra driving to own stops) + catalog stops (time there + detour)
--    + minutes at own stops.
create or replace function public.my_trips()
returns table (
  id uuid, booking_ref text, trip_id uuid, service_type text, catalog_item_id text,
  origin text, destination text, origin_coords jsonb, destination_coords jsonb,
  sightseeing_stops jsonb, vehicle_class text, scheduled_at timestamptz, passenger_count int,
  flight_or_hotel_notes text, preferences jsonb, driver_notes text, status text,
  driver_payout numeric, payment_mode text, cash_fee numeric, assigned_vehicle_id uuid,
  claimed_at timestamptz, created_at timestamptz,
  cash_to_collect numeric, driver_settled_at timestamptz, completed_at timestamptz,
  en_route_at timestamptz,
  passenger_name text, luggage_count smallint, arrive_at timestamptz,
  carry_on_count smallint,
  sign_text text,
  pickup_place text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.booking_ref, b.trip_id, b.service_type, b.catalog_item_id,
         b.origin, b.destination, b.origin_coords, b.destination_coords,
         public.stops_for_driver(b.sightseeing_stops), b.vehicle_class, b.scheduled_at, b.passenger_count,
         b.flight_or_hotel_notes, b.preferences, b.driver_notes, b.status,
         b.driver_payout, b.payment_mode, b.cash_fee, b.assigned_vehicle_id,
         b.claimed_at, b.created_at,
         case when b.payment_mode = 'cash_driver' then b.total_price + coalesce(b.cash_fee, 0) - coalesce(b.amount_paid, 0) end,
         b.driver_settled_at, b.completed_at, b.en_route_at,
         public.passenger_short_name(t.guest_name),
         b.luggage_count,
         case
           when b.service_type = 'transfer' and b.drive_minutes is not null and b.scheduled_at is not null then
             coalesce(b.started_at, b.scheduled_at) + make_interval(mins => (b.drive_minutes + coalesce((
               select sum(s.duration_min + s.detour_min)
                 from jsonb_array_elements(case when jsonb_typeof(b.sightseeing_stops) = 'array' then b.sightseeing_stops else '[]'::jsonb end) e
                 join public.sightseeing_stops s on s.id = e ->> 'id'
             ), 0) + coalesce((
               select sum(least(1440, greatest(0, (e ->> 'minutes')::numeric)))
                 from jsonb_array_elements(case when jsonb_typeof(b.sightseeing_stops) = 'array' then b.sightseeing_stops else '[]'::jsonb end) e
                where jsonb_typeof(e) = 'object'
                  and e -> 'custom' = 'true'::jsonb
                  and jsonb_typeof(e -> 'minutes') = 'number'
             ), 0))::int)
         end,
         b.carry_on_count,
         public.pickup_sign(b.sign_text, b.sign_hide_name, t.guest_name),
         b.pickup_place
    from public.bookings b
    left join public.trips t on t.id = b.trip_id
   where b.assigned_driver_id = auth.uid()
   order by b.scheduled_at;
$$;
revoke all on function public.my_trips() from public, anon;
grant execute on function public.my_trips() to authenticated;
