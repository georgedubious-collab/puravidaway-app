-- Drivers never see the client's price, only their own payout (PROJECT.md §6.3, §7.7).
-- The one exception is the cash to collect on cash trips (my_trips().cash_to_collect).
--
-- A review (2026-11-10) flagged that the assigned driver could read their own booking row
-- (total price, and on custom-offer rides client_notes = "Offer; fixed price was $X").
-- That policy was already removed by migration 0017 and the live database confirms it
-- (bookings_select = own client or admin). This file:
--   1. states the rule again, so the policy can't drift back unnoticed (same policy as 0017);
--   2. closes the last trace of the client's price in the driver functions: each stop in
--      bookings.sightseeing_stops carries a snapshot of what the traveller paid for it
--      ({"id": "poas", "price": 123}). driver_jobs() and my_trips() now return the stop ids
--      (and any other field) without "price".
-- Run after 0035 (it redefines my_trips() with 0035's columns). Safe to run once, in order.

-- 1. Bookings: travellers read their own, admins all. Drivers read only through
--    driver_jobs() / my_trips() / is_trip_participant(), never the row.
drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings
  for select to authenticated using (client_id = auth.uid() or public.is_admin());

-- 2. The stop list as drivers see it: same order, every "price" removed.
create or replace function public.stops_for_driver(p_stops jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(jsonb_agg(case when jsonb_typeof(x.e) = 'object' then x.e - 'price' else x.e end order by x.i), '[]'::jsonb)
    from jsonb_array_elements(case when jsonb_typeof(p_stops) = 'array' then p_stops else '[]'::jsonb end)
         with ordinality as x(e, i);
$$;
revoke all on function public.stops_for_driver(jsonb) from public, anon;

-- Open jobs (same as migration 0032, stops without prices).
create or replace function public.driver_jobs()
returns table (
  id uuid, booking_ref text, service_type text, catalog_item_id text,
  origin_town text, destination_town text, sightseeing_stops jsonb, vehicle_class text,
  scheduled_at timestamptz, passenger_count int, preferences jsonb, driver_notes text,
  driver_payout numeric, created_at timestamptz,
  my_offer numeric, my_offer_status text, my_offer_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.booking_ref, b.service_type, b.catalog_item_id,
         coalesce(b.origin_coords->>'town', b.origin), coalesce(b.destination_coords->>'town', b.destination),
         public.stops_for_driver(b.sightseeing_stops), b.vehicle_class, b.scheduled_at, b.passenger_count,
         b.preferences, b.driver_notes, b.driver_payout, b.created_at,
         o.bid_amount, o.status, o.id
    from public.bookings b
    left join public.bids o on o.booking_id = b.id and o.driver_id = auth.uid()
   where b.status = 'pending_bids'
     and b.driver_payout is not null
     and b.scheduled_at > now()
     and public.is_approved_driver()
     and not exists (select 1 from public.driver_unavailable u
                      where u.driver_id = auth.uid()
                        and u.day = (b.scheduled_at at time zone 'America/Costa_Rica')::date)
   order by b.scheduled_at;
$$;
revoke all on function public.driver_jobs() from public, anon;
grant execute on function public.driver_jobs() to authenticated;

-- The driver's own trips (same as migration 0035, stops without prices).
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
  passenger_name text, luggage_count smallint, arrive_at timestamptz
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
             ), 0))::int)
         end
    from public.bookings b
    left join public.trips t on t.id = b.trip_id
   where b.assigned_driver_id = auth.uid()
   order by b.scheduled_at;
$$;
revoke all on function public.my_trips() from public, anon;
grant execute on function public.my_trips() to authenticated;
