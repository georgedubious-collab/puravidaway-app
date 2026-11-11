-- Bags split in two (Jorge, 2026-11-10): the traveller says how many LARGE suitcases and how
-- many CARRY-ONS they bring, so the driver knows what has to fit in the boot.
--
--   bookings.luggage_count   stays, and now means large suitcases only (it was "bags");
--   bookings.carry_on_count  new: carry-ons, 0-20, null when not given (bookings made before
--                            this file, or by an older app build that sends one number).
--
-- my_trips() is the definition from migration 0036 (stops without the traveller's prices, no
-- price columns, cash to collect as the one exception) plus carry_on_count as a new last column.
-- No new access for drivers. Run after 0036. Safe to run once, in order.

alter table public.bookings
  add column if not exists carry_on_count smallint
    check (carry_on_count is null or carry_on_count between 0 and 20);
comment on column public.bookings.carry_on_count is
  'Carry-on bags the traveller said they bring (0-20); null when not given. Shown to the assigned driver.';
comment on column public.bookings.luggage_count is
  'LARGE suitcases the traveller said they bring (0-20); null when not given. Carry-ons are in carry_on_count. Shown to the assigned driver.';

-- The return columns change, so the function is dropped and created again (as in 0035).
drop function if exists public.my_trips();
create function public.my_trips()
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
  carry_on_count smallint
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
         end,
         b.carry_on_count
    from public.bookings b
    left join public.trips t on t.id = b.trip_id
   where b.assigned_driver_id = auth.uid()
   order by b.scheduled_at;
$$;
revoke all on function public.my_trips() from public, anon;
grant execute on function public.my_trips() to authenticated;
