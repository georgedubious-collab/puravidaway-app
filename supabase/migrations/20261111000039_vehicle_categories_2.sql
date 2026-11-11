-- Vehicle categories, part 2 (Jorge, 2026-11-11). Three things, on top of migration 0038:
--
--   A. The job board hides jobs that are too big for every one of the driver's vehicles.
--      Until now offer_job() refused the offer, but driver_jobs() still listed the job.
--   B. A van that is also a 4x4 can be tagged "van_4x4" and receives both van jobs and
--      4x4 / Sierpe-combo jobs.
--   C. Every category sold to travellers carries example models ("Toyota Prado"), shown as
--      "Toyota Prado or similar". The examples move out of the category name.
--
-- No new access for drivers: bookings stay unreadable to them, driver_jobs() returns the same
-- columns as migrations 0036 / 0038 and offer_job() is not touched. Prices, price factors,
-- max travellers and luggage text are untouched. Run after 0038. Safe to run once, in order.

-- ---------------------------------------------------------------------------
-- B. One more category: van_4x4 (a van that is also a 4x4)
-- ---------------------------------------------------------------------------
-- The check from migration 0038 was written inline, so Postgres named it
-- driver_vehicles_vehicle_class_check.
alter table public.driver_vehicles drop constraint if exists driver_vehicles_vehicle_class_check;
alter table public.driver_vehicles
  add constraint driver_vehicles_vehicle_class_check
  check (vehicle_class is null or vehicle_class in ('economy', 'sedan', 'suv', '4x4', 'van', 'van_4x4'));
comment on column public.driver_vehicles.vehicle_class is
  'Category our team gave this vehicle (economy, sedan, suv = minivan/MPV, 4x4, van, van_4x4 = a van that is also a 4x4); null = not tagged yet, not filtered by category. Decides which jobs the driver gets: vehicle_can_serve().';

-- The rule, still in one place. Same as migration 0038 plus the van_4x4 line:
--
--   vehicle tagged   receives jobs booked as
--   economy          economy
--   sedan            economy, sedan
--   suv (MPV)        economy, sedan, suv
--   4x4              economy, sedan, suv, 4x4, sierpe_combo
--   van              economy, sedan, suv, van
--   van_4x4          economy, sedan, suv, van, 4x4, sierpe_combo   (van + 4x4 together)
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
        when 'van_4x4' then array['economy', 'sedan', 'suv', 'van', '4x4', 'sierpe_combo']
        else array[]::text[]
      end)
  end;
$$;
revoke all on function public.vehicle_can_serve(text, text) from public, anon;
grant execute on function public.vehicle_can_serve(text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- A. Job board: only jobs ONE of the driver's approved vehicles can take, by category AND seats
-- ---------------------------------------------------------------------------
-- Same as migration 0038 (same columns, stops without prices, blocked days hidden). The last
-- condition now asks for one approved vehicle that passes both checks offer_job() makes:
--
--   category:  vehicle_can_serve(vehicle category, booked class)   (untagged vehicle or a job
--              without a class, e.g. a day tour: not filtered, as before)
--   seats:     the job has no traveller count, or the vehicle's seats >= travellers.
--              A vehicle with no seat number counts as 0 seats, exactly as in offer_job()
--              ("coalesce(v.passenger_capacity, 0) < b.passenger_count" refuses the offer),
--              so it cannot make a job with travellers visible.
--
-- Both checks must pass on the SAME vehicle: a 4-seat 4x4 plus an 8-seat van does not show a
-- 6-traveller 4x4 job. Day tours and expeditions carry travellers but no class, so only the
-- seat check applies to them. A job with neither class nor traveller count is listed as before.
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
     and ((b.vehicle_class is null and b.passenger_count is null)
          or exists (select 1 from public.driver_vehicles v
                      where v.driver_id = auth.uid()
                        and v.status = 'approved'
                        and public.vehicle_can_serve(v.vehicle_class, b.vehicle_class)
                        and (b.passenger_count is null
                             or coalesce(v.passenger_capacity, 0) >= b.passenger_count)))
   order by b.scheduled_at;
$$;
revoke all on function public.driver_jobs() from public, anon;
grant execute on function public.driver_jobs() to authenticated;

-- ---------------------------------------------------------------------------
-- C. Example models for every category travellers can book
-- ---------------------------------------------------------------------------
-- Shown next to the category name as "<examples> or similar" / "<examples> o similar"; the
-- words "or similar" are added by the site and the app, never stored here. Read and written
-- like the table's other display columns (name, badge, luggage): the table-level grants and
-- the RLS policies from migrations 0002 / 0004 already cover a new column (everyone reads
-- active rows, only admins write).
alter table public.vehicle_classes
  add column if not exists example_models text
    check (example_models is null or char_length(example_models) <= 80);
comment on column public.vehicle_classes.example_models is
  'Example models for this category, e.g. "Toyota Prado". Travellers see it followed by "or similar"; never a promise of a specific model. Null or empty = no example line.';

-- A first proposal (common models in Costa Rica), only where nothing is set yet. Editable in
-- /admin/pricing.
update public.vehicle_classes set example_models = 'Toyota Yaris'       where id = 'economy'      and example_models is null;
update public.vehicle_classes set example_models = 'Toyota Corolla'     where id = 'sedan'        and example_models is null;
update public.vehicle_classes set example_models = 'Mitsubishi Xpander' where id = 'suv'          and example_models is null;
update public.vehicle_classes set example_models = 'Toyota Prado'       where id = '4x4'          and example_models is null;
update public.vehicle_classes set example_models = 'Toyota HiAce'       where id = 'van'          and example_models is null;
update public.vehicle_classes set example_models = 'Toyota Prado'       where id = 'sierpe_combo' and example_models is null;

-- The examples leave the category names. Each line only touches a row that still holds the
-- original text, so a name already edited in /admin/pricing is left alone.
update public.vehicle_classes set name = 'Executive 4x4'
 where id = '4x4' and name = 'Executive 4x4 (Prado / Fortuner)';
update public.vehicle_classes set name = 'Private Van'
 where id = 'van' and name = 'Private Toyota HiAce / Hyundai Staria';
