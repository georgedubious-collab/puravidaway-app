-- What the driver needs at the pickup (Jorge, 2026-11-10):
--   1. the passenger's name for an airport name sign, as first name + last initial only
--      ("Emily R."), never the full name, phone or email;
--   2. how many bags the travellers bring (asked in the booking flow, optional);
--   3. an estimated arrival time at the drop-off.
--
-- All three reach the driver only through my_trips() (drivers never read booking rows or
-- trips directly; migration 0017). Run after 0034. Safe to run once, in order.

-- 1. Bags: suitcases and large backpacks, as the traveller told us. Optional (null = not asked / not said).
alter table public.bookings
  add column if not exists luggage_count smallint
    check (luggage_count is null or luggage_count between 0 and 20);
comment on column public.bookings.luggage_count is
  'Suitcases and large backpacks the traveller said they bring (0–20); null when not given. Shown to the assigned driver.';

-- 2. Drive time door to door, in minutes, saved by the server with the request: Google''s road
--    route for typed places (incl. the Drake Bay boat), or the per-corridor table between two of
--    our towns (ROUTE_MINUTES in src/lib/catalog.ts). Never a straight-line guess; null = unknown.
alter table public.bookings
  add column if not exists drive_minutes smallint
    check (drive_minutes is null or drive_minutes between 1 and 1440);
comment on column public.bookings.drive_minutes is
  'Door-to-door drive time in minutes the ride was priced with (Google route or our corridor table, incl. the Drake Bay boat). Null = unknown: no arrival estimate is shown.';

-- Rides already saved with a Google route keep its time (rides between two of our towns get
-- theirs from the server from now on; none were waiting on 2026-11-10).
update public.bookings
   set drive_minutes = least(1440, greatest(1, round((origin_coords -> 'route' ->> 'totalMinutes')::numeric)))::smallint
 where drive_minutes is null
   and service_type = 'transfer'
   and jsonb_typeof(origin_coords -> 'route' -> 'totalMinutes') = 'number';

-- 3. "Emily Rose Smith" → "Emily S."; "emily" → "Emily". Letters only, so a phone number or an
--    email typed into the name field never reaches the driver.
create or replace function public.passenger_short_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  with w as (
    select array_remove(regexp_split_to_array(btrim(coalesce(p_name, '')), '\s+'), '') as a
  ),
  clean as (
    select regexp_replace(a[1], '[^[:alpha:]''-]', '', 'g') as first_name,
           case when coalesce(array_length(a, 1), 0) > 1
                then left(regexp_replace(a[array_length(a, 1)], '[^[:alpha:]]', '', 'g'), 1) end as initial
      from w
  )
  select case
           when coalesce(first_name, '') = '' then null
           else upper(left(first_name, 1)) || left(substr(first_name, 2), 29)
                || case when coalesce(initial, '') <> '' then ' ' || upper(initial) || '.' else '' end
         end
    from clean;
$$;
revoke all on function public.passenger_short_name(text) from public, anon;

-- 4. my_trips(): the same columns as before (migration 0029) plus the three above. Still never
--    the client's price, name, phone or email; the cash to collect stays the one exception.
--    Arrival = pickup (or the actual pickup once the trip started) + drive time + each stop's
--    time there and its detour. Only for rides with a known drive time.
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
  passenger_name text, luggage_count smallint, arrive_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.booking_ref, b.trip_id, b.service_type, b.catalog_item_id,
         b.origin, b.destination, b.origin_coords, b.destination_coords,
         b.sightseeing_stops, b.vehicle_class, b.scheduled_at, b.passenger_count,
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
