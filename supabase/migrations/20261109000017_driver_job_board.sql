-- Driver job board with offers (docs/PRICING.md §6, build step 7; Jorge, 2026-11-09).
--
-- Travellers pay a fixed price. The team posts a booking to the board (status
-- 'pending_bids', shown as "Open for drivers"); approved drivers see the job with
-- a SUGGESTED PAYOUT ONLY, never the client's price, and send an offer: the suggested
-- payout or their own amount (70–130% of it). The team compares the offers and
-- accepts one, which assigns the driver and confirms the booking; the accepted
-- amount becomes the driver's payout. This lets the team spread work across drivers.
--
--   suggested payout = (price − pass-through costs such as ferry tickets) × (1 − commission)
--                      + pass-through costs     commission: pricing_settings.driver_commission_bps (20%)
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
comment on column public.bookings.driver_payout is 'What the assigned driver is paid (USD): the suggested payout, or the offer the team accepted. Null for expeditions.';
comment on column public.bookings.platform_fee  is 'What PuraVidaWay keeps (USD). driver_payout + platform_fee = total_price.';
comment on column public.bookings.claimed_at    is 'When the team accepted a driver''s offer from the job board (null when assigned by hand).';

-- Existing rides and day tours: 80% to the driver (no pass-through costs recorded on old rows).
update public.bookings
   set driver_payout = round(total_price * 0.80, 2),
       platform_fee  = total_price - round(total_price * 0.80, 2)
 where driver_payout is null and service_type in ('transfer', 'day_tour');

-- 2. Drivers no longer read booking rows directly (they contain the client's price).
--    They read through the functions below, which return only what a driver needs.
drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings
  for select to authenticated using (client_id = auth.uid() or public.is_admin());

drop function if exists public.open_trip_requests();

-- 3. Offers reuse the bids table: one per driver per job, with the vehicle they'd drive.
alter table public.bids
  add column if not exists vehicle_id uuid references public.driver_vehicles (id) on delete set null,
  add column if not exists note text check (note is null or length(note) <= 300),
  add column if not exists updated_at timestamptz not null default now();
comment on table public.bids is 'Drivers'' offers on job-board bookings: bid_amount is the payout the driver asks for.';

-- Only the driver and the team see offers (clients never did need them).
drop policy if exists bids_select on public.bids;
create policy bids_select on public.bids
  for select to authenticated using (driver_id = auth.uid() or public.is_admin());
-- Offers are made through offer_job() (which checks vehicle, seats, amount), never by direct insert.
drop policy if exists bids_driver_insert on public.bids;
-- Drivers may only withdraw their own open offer; the team changes anything.
drop policy if exists bids_driver_update on public.bids;
create policy bids_driver_withdraw on public.bids
  for update to authenticated
  using (driver_id = auth.uid() and status = 'submitted')
  with check (driver_id = auth.uid() and status = 'withdrawn');
create policy bids_admin_write on public.bids
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Open jobs: town-level route only (the exact address comes with the assignment),
-- suggested payout, the traveller's requests, and this driver's own offer if any.
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
         b.sightseeing_stops, b.vehicle_class, b.scheduled_at, b.passenger_count,
         b.preferences, b.driver_notes, b.driver_payout, b.created_at,
         o.bid_amount, o.status, o.id
    from public.bookings b
    left join public.bids o on o.booking_id = b.id and o.driver_id = auth.uid()
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

-- A driver offers on a job (or changes their open offer). Amount: 70–130% of the suggested payout.
create or replace function public.offer_job(p_booking uuid, p_vehicle uuid, p_amount numeric, p_note text default null)
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
  select * into b from public.bookings where id = p_booking;
  if not found or b.status <> 'pending_bids' or b.driver_payout is null then
    raise exception 'This job is no longer open.';
  end if;
  if b.scheduled_at <= now() then
    raise exception 'This job is in the past.';
  end if;
  if b.passenger_count is not null and coalesce(v.passenger_capacity, 0) < b.passenger_count then
    raise exception 'That vehicle has % seats; this group needs %.', coalesce(v.passenger_capacity, 0), b.passenger_count;
  end if;
  if p_amount is null or p_amount < round(b.driver_payout * 0.70) or p_amount > round(b.driver_payout * 1.30) then
    raise exception 'Offers must be between $% and $%.', round(b.driver_payout * 0.70), round(b.driver_payout * 1.30);
  end if;
  if p_note is not null and not public.no_contact_details(p_note) then
    raise exception 'Please keep phone numbers, emails and links out of the note.';
  end if;

  insert into public.bids (booking_id, driver_id, bid_amount, vehicle_id, note, status, vehicle_snapshot)
  values (b.id, auth.uid(), round(p_amount, 2), v.id, nullif(trim(p_note), ''), 'submitted',
          jsonb_build_object('make_model', v.make_model, 'plate', v.plate, 'seats', v.passenger_capacity))
  on conflict (booking_id, driver_id) do update
     set bid_amount = excluded.bid_amount, vehicle_id = excluded.vehicle_id, note = excluded.note,
         status = 'submitted', vehicle_snapshot = excluded.vehicle_snapshot, updated_at = now();
  return b.booking_ref;
end;
$$;

-- The team accepts one offer: assigns the driver + vehicle, confirms the booking,
-- makes the offer the payout, and declines the other offers. Admin only.
create or replace function public.accept_offer(p_bid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.bids%rowtype;
  b public.bookings%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only the team can accept offers.';
  end if;
  select * into o from public.bids where id = p_bid for update;
  if not found or o.status <> 'submitted' then
    raise exception 'That offer is no longer open.';
  end if;
  select * into b from public.bookings where id = o.booking_id for update;
  if not found or b.status <> 'pending_bids' then
    raise exception 'This booking is no longer open for drivers.';
  end if;
  if o.bid_amount > b.total_price then
    raise exception 'The offer is higher than the client''s price.';
  end if;

  update public.bookings
     set assigned_driver_id = o.driver_id,
         assigned_vehicle_id = o.vehicle_id,
         status = 'confirmed',
         driver_payout = o.bid_amount,
         platform_fee = total_price - o.bid_amount,
         claimed_at = now()
   where id = b.id;
  update public.bids set status = 'accepted', updated_at = now() where id = o.id;
  update public.bids set status = 'declined', updated_at = now()
   where booking_id = b.id and id <> o.id and status = 'submitted';
  return b.booking_ref;
end;
$$;

revoke all on function public.driver_jobs() from public, anon;
revoke all on function public.my_trips() from public, anon;
revoke all on function public.offer_job(uuid, uuid, numeric, text) from public, anon;
revoke all on function public.accept_offer(uuid) from public, anon;
grant execute on function public.driver_jobs() to authenticated;
grant execute on function public.my_trips() to authenticated;
grant execute on function public.offer_job(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.accept_offer(uuid) to authenticated;
