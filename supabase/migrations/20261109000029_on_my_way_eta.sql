-- "On my way" and lateness checks (Jorge, 2026-11-09).
--
-- Driver steps on a trip:  I'm on my way  →  Client picked up  →  Trip ended.
--   * "On my way" (bookings.en_route_at) is allowed from 6 hours before the pickup and
--     starts location sharing straight away, even before the usual 3-hour window.
--   * "Client picked up" is the existing confirmed → in_progress step.
--   * "Trip ended" is in_progress → completed, which closes the tracking window.
-- While the driver is heading to the pickup, the server compares their position with the
-- pickup point using live traffic (src/lib/eta.ts) and stores the estimated arrival; if
-- they would be more than 20 minutes late the team is alerted once (bookings.late_alert_at).
--
-- Run after 0028. Safe to run more than once.

alter table public.bookings
  add column if not exists en_route_at   timestamptz,
  add column if not exists late_alert_at timestamptz;
comment on column public.bookings.en_route_at   is 'When the driver tapped "I''m on my way" to the pickup.';
comment on column public.bookings.late_alert_at is 'When the team was alerted that the driver would be more than 20 minutes late (once per booking).';

alter table public.driver_locations
  add column if not exists eta_at         timestamptz,
  add column if not exists eta_checked_at timestamptz,
  add column if not exists late_min       integer;
comment on column public.driver_locations.eta_at   is 'Estimated arrival at the pickup with live traffic (null after pickup or when unknown).';
comment on column public.driver_locations.late_min is 'Minutes after the pickup time the driver is expected to arrive (negative = early).';

-- Tracking window: on the road; or confirmed and either within 3 hours of the pickup or
-- already "on my way"; never more than 12 hours after the pickup time.
create or replace function public.tracking_window()
returns table (booking_id uuid, booking_ref text, scheduled_at timestamptz, status text)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.booking_ref, b.scheduled_at, b.status
    from public.bookings b
   where b.assigned_driver_id = auth.uid()
     and (
       b.status = 'in_progress'
       or (b.status = 'confirmed'
           and (b.scheduled_at <= now() + interval '3 hours' or b.en_route_at is not null)
           and b.scheduled_at >= now() - interval '12 hours')
     )
   order by (b.status = 'in_progress') desc, b.scheduled_at
   limit 1;
$$;

create or replace function public.driver_set_trip_status(p_booking uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings%rowtype;
begin
  if not public.is_approved_driver() then
    raise exception 'Your driver account is not approved for trips.';
  end if;
  select * into b from public.bookings where id = p_booking and assigned_driver_id = auth.uid() for update;
  if not found then
    raise exception 'This trip is not assigned to you.';
  end if;
  if p_status = 'en_route' then
    if b.status <> 'confirmed' then
      raise exception 'This trip can''t be started (it is %).', replace(b.status, '_', ' ');
    end if;
    if b.scheduled_at is null or b.scheduled_at > now() + interval '6 hours' then
      raise exception 'You can start heading to the pickup from 6 hours before the pickup time.';
    end if;
    update public.bookings set en_route_at = coalesce(en_route_at, now()) where id = b.id;
  elsif p_status = 'in_progress' then
    if b.status <> 'confirmed' then
      raise exception 'This trip can''t be started (it is %).', replace(b.status, '_', ' ');
    end if;
    if b.scheduled_at is null or b.scheduled_at > now() + interval '3 hours' then
      raise exception 'You can start the trip from 3 hours before the pickup time.';
    end if;
    update public.bookings set status = 'in_progress', started_at = now() where id = b.id;
    -- The pickup has happened: the arrival estimate no longer applies.
    update public.driver_locations set eta_at = null, late_min = null where driver_id = auth.uid();
  elsif p_status = 'completed' then
    if b.status <> 'in_progress' then
      raise exception 'Start the trip before completing it.';
    end if;
    update public.bookings set status = 'completed', completed_at = now() where id = b.id;
    -- Trip ended: stop showing where the driver is.
    delete from public.driver_locations where driver_id = auth.uid() and booking_id = b.id;
  else
    raise exception 'Unknown step.';
  end if;
  return b.booking_ref;
end;
$$;

-- my_trips() also returns en_route_at, so the driver's screens know which step comes next.
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
  en_route_at timestamptz
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
         b.driver_settled_at, b.completed_at, b.en_route_at
    from public.bookings b
   where b.assigned_driver_id = auth.uid()
   order by b.scheduled_at;
$$;
revoke all on function public.my_trips() from public, anon;
grant execute on function public.my_trips() to authenticated;
