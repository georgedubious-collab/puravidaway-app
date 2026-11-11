-- Vehicle categories (Jorge, 2026-11-11): every driver vehicle is tagged with ONE category by
-- our team, and a driver only gets the jobs their vehicle can serve.
--
-- Why: nothing tied a driver's car to the category the traveller booked. The 4-traveller
-- category promises 4 travellers + 4 suitcases, but a compact SUV (Aion V, RAV4) has a
-- sedan-size boot. So, as on Daytrip: compact SUVs count as sedans, and the 4-traveller
-- category (id 'suv', kept so bookings, quotes and saved prices still match) is now sold as
-- "Minivan (MPV)".
--
-- Which jobs each vehicle category receives (the rule lives ONLY in vehicle_can_serve() below;
-- src/lib/vehicleEligibility.ts mirrors it for the website and apps/driver/src/vehicleCategory.ts
-- for the driver app):
--
--   vehicle tagged   receives jobs booked as
--   economy          economy
--   sedan            economy, sedan
--   suv (MPV)        economy, sedan, suv
--   4x4              economy, sedan, suv, 4x4, sierpe_combo
--   van              economy, sedan, suv, van      (NOT 4x4 / sierpe_combo: those are about
--                                                  rough roads, not size)
--
-- Not tagged yet (vehicle_class is null): behaves as before this file, the driver sees every
-- job. So nobody is locked out on deploy; the team tags vehicles in /admin/drivers.
-- Jobs without a vehicle class (day tours and expeditions: bookings.vehicle_class is null) are
-- not filtered by category.
--
-- No new access for drivers: bookings stay unreadable to them, driver_jobs() returns the same
-- columns as migration 0036 and offer_job() is the one from migration 0032 plus one check.
-- Prices and price factors are untouched. Run after 0037. Safe to run once, in order.

-- ---------------------------------------------------------------------------
-- 1. The vehicle's category, set by the team only
-- ---------------------------------------------------------------------------
alter table public.driver_vehicles
  add column if not exists vehicle_class text
    check (vehicle_class is null or vehicle_class in ('economy', 'sedan', 'suv', '4x4', 'van'));
comment on column public.driver_vehicles.vehicle_class is
  'Category our team gave this vehicle (economy, sedan, suv = minivan/MPV, 4x4, van); null = not tagged yet, receives every job. Decides which jobs the driver gets: vehicle_can_serve().';

-- A driver can never set or change the category of their own vehicle (same idea as the
-- status and the team's note in guard_driver_vehicle, migration 0006). Admins and the
-- server can.
create or replace function public.guard_vehicle_class()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.vehicle_class := null;
    else
      new.vehicle_class := old.vehicle_class;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_vehicle_class() from public, anon, authenticated;

drop trigger if exists driver_vehicles_guard_class on public.driver_vehicles;
create trigger driver_vehicles_guard_class
  before insert or update on public.driver_vehicles
  for each row execute function public.guard_vehicle_class();

-- ---------------------------------------------------------------------------
-- 2. The rule, in one place
-- ---------------------------------------------------------------------------
-- True when a vehicle of category p_vehicle_class may take a job booked as p_job_class.
-- Null on either side = no restriction (vehicle not tagged yet / job without a class, e.g. a
-- day tour). A job class this list doesn't know (one added later in /admin/pricing) is not
-- restricted either, so a new class is never hidden from every driver by accident.
create or replace function public.vehicle_can_serve(p_vehicle_class text, p_job_class text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_vehicle_class is null or p_job_class is null then true
    when p_job_class not in ('economy', 'sedan', 'suv', '4x4', 'van', 'sierpe_combo') then true
    else p_job_class = any (
      case p_vehicle_class
        when 'economy' then array['economy']
        when 'sedan'   then array['economy', 'sedan']
        when 'suv'     then array['economy', 'sedan', 'suv']
        when '4x4'     then array['economy', 'sedan', 'suv', '4x4', 'sierpe_combo']
        when 'van'     then array['economy', 'sedan', 'suv', 'van']
        else array[]::text[]
      end)
  end;
$$;
revoke all on function public.vehicle_can_serve(text, text) from public, anon;
grant execute on function public.vehicle_can_serve(text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Job board: only jobs one of the driver's approved vehicles can serve
-- ---------------------------------------------------------------------------
-- Same as migration 0036 (same columns, stops without prices, blocked days hidden) plus the
-- category rule.
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
     and (b.vehicle_class is null
          or exists (select 1 from public.driver_vehicles v
                      where v.driver_id = auth.uid()
                        and v.status = 'approved'
                        and public.vehicle_can_serve(v.vehicle_class, b.vehicle_class)))
   order by b.scheduled_at;
$$;
revoke all on function public.driver_jobs() from public, anon;
grant execute on function public.driver_jobs() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Offers: the chosen vehicle must be able to serve the job
-- ---------------------------------------------------------------------------
-- Same as migration 0032 plus the category check (after the seats check).
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
  if exists (select 1 from public.drivers d where d.id = auth.uid() and d.review_hold) then
    raise exception 'Your new documents are being checked. You can send offers again once our team approves them.';
  end if;
  select * into v from public.driver_vehicles
   where id = p_vehicle and driver_id = auth.uid() and status = 'approved';
  if not found or not public.vehicle_documents_current(v) then
    raise exception 'Pick one of your approved vehicles with current documents.';
  end if;
  if v.review_hold then
    raise exception 'That vehicle''s new documents are being checked. Pick another vehicle, or wait for our team to approve them.';
  end if;
  select * into b from public.bookings where id = p_booking;
  if not found or b.status <> 'pending_bids' or b.driver_payout is null then
    raise exception 'This job is no longer open.';
  end if;
  if b.scheduled_at <= now() then
    raise exception 'This job is in the past.';
  end if;
  if exists (select 1 from public.driver_unavailable u
              where u.driver_id = auth.uid() and u.day = (b.scheduled_at at time zone 'America/Costa_Rica')::date) then
    raise exception 'You marked that day as unavailable. Unblock it in your calendar to offer on this job.';
  end if;
  if b.passenger_count is not null and coalesce(v.passenger_capacity, 0) < b.passenger_count then
    raise exception 'That vehicle has % seats; this group needs %.', coalesce(v.passenger_capacity, 0), b.passenger_count;
  end if;
  if not public.vehicle_can_serve(v.vehicle_class, b.vehicle_class) then
    raise exception 'That vehicle''s category can''t take this job. Pick another of your vehicles.';
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
revoke all on function public.offer_job(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.offer_job(uuid, uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The 4-traveller category is sold as a minivan (MPV), not an SUV
-- ---------------------------------------------------------------------------
-- Only the wording travellers see; id, price factor, 4 travellers and 4 suitcases stay.
-- Each line only touches a row that still holds the original text, so anything already
-- edited in /admin/pricing is left alone.
update public.vehicle_classes set name = 'Minivan (MPV)'
 where id = 'suv' and name = 'Standard Comfort SUV';
update public.vehicle_classes set badge = 'Roomy for 4 + bags'
 where id = 'suv' and badge = 'Most popular';
comment on column public.vehicle_classes.price_factor is
  'Multiplies the Standard ride price: Economy 0.90, Standard 1.00, Minivan/MPV (id suv) 1.20, 4x4 1.30, Van 1.35.';
