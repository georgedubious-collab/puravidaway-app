-- Driver job board with fixed payouts (docs/PRICING.md §6, build step 7; Jorge, 2026-11-09).
--
-- Travellers pay a fixed price. The team posts a booking to the board (status
-- 'pending_bids', shown as "Open for drivers"); approved drivers see the job with
-- THEIR PAYOUT ONLY, never the client's price, and the first qualified driver to
-- claim it gets it (assigned + confirmed in one step). The team can still reassign.
--
--   payout = (price − pass-through costs such as ferry tickets) × (1 − commission)
--            + pass-through costs            commission: pricing_settings.driver_commission_bps (20%)
--
-- Run after 0016. Safe to run more than once.

-- 1. Commission setting + payout on every booking.
alter table public.pricing_settings
  add column if not exists driver_commission_bps integer not null default 2000
    check (driver_commission_bps between 0 and 5000);
comment on column public.pricing_settings.driver_commission_bps is
  'Platform share of a ride / day tour in basis points (2000 = 20%). Pass-through costs (ferries) go to the driver in full.';

alter table public.bookings
  add column if not exists driver_payout numeric(10,2) check (driver_payout is null or driver_payout >= 0),
  add column if not exists platform_fee  numeric(10,2) check (platform_fee is null or platform_fee >= 0),
  add column if not exists claimed_at    timestamptz;
comment on column public.bookings.driver_payout is 'What the assigned driver is paid (USD). Null for expeditions (arranged by the team).';
comment on column public.bookings.platform_fee  is 'What PuraVidaWay keeps (USD). driver_payout + platform_fee = total_price.';
comment on column public.bookings.claimed_at    is 'When a driver claimed the job from the board (null when the team assigned it).';

-- Existing rides and day tours: 80% to the driver (no pass-through costs recorded on old rows).
update public.bookings
   set driver_payout = round(total_price * 0.80, 2),
       platform_fee  = total_price - round(total_price * 0.80, 2)
 where driver_payout is null and service_type in ('transfer', 'day_tour');

-- 2. Drivers no longer read booking rows directly (they contain the client's price).
--    They read through the two functions below, which return only what a driver needs.
drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings
  for select to authenticated using (client_id = auth.uid() or public.is_admin());

drop function if exists public.open_trip_requests();

-- Open jobs: town-level route only (the exact address comes with the claim), payout, requests.
create or replace function public.driver_jobs()
returns table (
  id uuid, booking_ref text, service_type text, catalog_item_id text,
  origin_town text, destination_town text, sightseeing_stops jsonb, vehicle_class text,
  scheduled_at timestamptz, passenger_count int, preferences jsonb, driver_notes text,
  driver_payout numeric, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.booking_ref, b.service_type, b.catalog_item_id,
         coalesce(b.origin_coords->>'town', b.origin), coalesce(b.destination_coords->>'town', b.destination),
         b.sightseeing_stops, b.vehicle_class, b.scheduled_at, b.passenger_count,
         b.preferences, b.driver_notes, b.driver_payout, b.created_at
    from public.bookings b
   where b.status = 'pending_bids'
     and b.driver_payout is not null
     and b.scheduled_at > now()
     and public.is_approved_driver()
   order by b.scheduled_at;
$$;

-- The driver's own trips: everything needed to drive them, still without the client's price.
create or replace function public.my_trips()
returns table (
  id uuid, booking_ref text, trip_id uuid, service_type text, catalog_item_id text,
  origin text, destination text, origin_coords jsonb, destination_coords jsonb,
  sightseeing_stops jsonb, vehicle_class text, scheduled_at timestamptz, passenger_count int,
  flight_or_hotel_notes text, preferences jsonb, driver_notes text, status text,
  driver_payout numeric, payment_mode text, cash_fee numeric, assigned_vehicle_id uuid,
  claimed_at timestamptz, created_at timestamptz
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
         b.claimed_at, b.created_at
    from public.bookings b
   where b.assigned_driver_id = auth.uid()
   order by b.scheduled_at;
$$;

-- Claim a job: first qualified driver wins. Locks the row so two drivers can't both get it.
create or replace function public.claim_job(p_booking uuid, p_vehicle uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings%rowtype;
  v public.driver_vehicles%rowtype;
begin
  if not public.is_approved_driver() then
    raise exception 'Your driver account is not approved for trips yet.';
  end if;
  select * into v from public.driver_vehicles
   where id = p_vehicle and driver_id = auth.uid() and status = 'approved';
  if not found or not public.vehicle_documents_current(v) then
    raise exception 'Pick one of your approved vehicles with current documents.';
  end if;

  select * into b from public.bookings where id = p_booking for update;
  if not found or b.status <> 'pending_bids' or b.driver_payout is null then
    raise exception 'This job has just been taken.';
  end if;
  if b.scheduled_at <= now() then
    raise exception 'This job is in the past.';
  end if;
  if b.passenger_count is not null and coalesce(v.passenger_capacity, 0) < b.passenger_count then
    raise exception 'That vehicle has % seats; this group needs %.', coalesce(v.passenger_capacity, 0), b.passenger_count;
  end if;

  update public.bookings
     set assigned_driver_id = auth.uid(),
         assigned_vehicle_id = v.id,
         status = 'confirmed',
         claimed_at = now()
   where id = b.id;
  return b.booking_ref;
end;
$$;

revoke all on function public.driver_jobs() from public, anon;
revoke all on function public.my_trips() from public, anon;
revoke all on function public.claim_job(uuid, uuid) from public, anon;
grant execute on function public.driver_jobs() to authenticated;
grant execute on function public.my_trips() to authenticated;
grant execute on function public.claim_job(uuid, uuid) to authenticated;
