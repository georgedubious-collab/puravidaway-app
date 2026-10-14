-- Traveller preferences, driver profiles and vehicle features. Run after file 7.

-- ---------------------------------------------------------------------------
-- 1. Driver profile shown to travellers: a short bio and English level.
--    The bio must not contain contact details (phone, email, links), so trips
--    stay on the platform. Changes after approval are flagged for review.
-- ---------------------------------------------------------------------------
alter table public.drivers
  add column if not exists bio           text check (bio is null or char_length(bio) <= 600),
  add column if not exists english_level text check (english_level is null or english_level in ('fluent', 'basic'));

-- ---------------------------------------------------------------------------
-- 2. What each vehicle offers.
-- ---------------------------------------------------------------------------
alter table public.driver_vehicles
  add column if not exists has_wifi       boolean not null default false,
  add column if not exists child_seats    int not null default 0 check (child_seats between 0 and 6),
  add column if not exists stroller_space boolean not null default false,
  add column if not exists pet_friendly   boolean not null default false;

-- ---------------------------------------------------------------------------
-- 3. What the traveller asked for, and their message for the driver.
--    preferences: {"language": "english"|"spanish_ok", "wifi": bool,
--                  "stroller": bool, "childSeats": int, "pets": bool}
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists preferences  jsonb not null default '{}'::jsonb,
  add column if not exists driver_notes text check (driver_notes is null or char_length(driver_notes) <= 500);

-- Drivers deciding whether to offer on a request need to see these too
-- (still no client name, contact details or exact addresses).
create or replace view public.open_trip_requests
with (security_barrier = true) as
  select id, booking_ref, service_type, catalog_item_id, origin, destination,
         sightseeing_stops, vehicle_class, lodging_tier, scheduled_at, passenger_count,
         pricing_mode, total_price, currency, created_at, preferences, driver_notes
    from public.bookings
   where status = 'pending_bids'
     and (public.is_approved_driver() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. Guards. They run after the existing guards (trigger names sort later).
-- ---------------------------------------------------------------------------
create or replace function public.no_contact_details(t text)
returns boolean
language sql
immutable
as $$
  select t is null or not (
    t ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'               -- email
    or t ~* '(https?://|www\.|\.com\y|\.cr\y|wa\.me)'         -- links
    -- phone numbers: 8+ digits once spaces, dots, dashes and brackets are
    -- removed (year ranges like "2010-2024" are ignored first)
    or regexp_replace(
         regexp_replace(t, '(19|20)[0-9]{2}\s*[-–]\s*(19|20)[0-9]{2}', '', 'g'),
         '(?<=[0-9])[ ().+-]+(?=[0-9])', '', 'g') ~ '[0-9]{8,}'
  );
$$;

create or replace function public.guard_driver_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.no_contact_details(new.bio) then
    raise exception 'Please keep phone numbers, emails and links out of your bio';
  end if;
  if auth.uid() is not null and not public.is_admin() and tg_op = 'UPDATE'
     and old.kyc_status <> 'pending'
     and (new.bio, new.english_level) is distinct from (old.bio, old.english_level) then
    new.needs_review := true;
  end if;
  return new;
end;
$$;

drop trigger if exists drivers_guard_profile on public.drivers;
create trigger drivers_guard_profile
  before insert or update on public.drivers
  for each row execute function public.guard_driver_profile();

create or replace function public.guard_vehicle_features()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() and tg_op = 'UPDATE'
     and old.status <> 'pending'
     and (new.has_wifi, new.child_seats, new.stroller_space, new.pet_friendly)
         is distinct from (old.has_wifi, old.child_seats, old.stroller_space, old.pet_friendly) then
    new.needs_review := true;
  end if;
  return new;
end;
$$;

drop trigger if exists driver_vehicles_guard_features on public.driver_vehicles;
create trigger driver_vehicles_guard_features
  before update on public.driver_vehicles
  for each row execute function public.guard_vehicle_features();
