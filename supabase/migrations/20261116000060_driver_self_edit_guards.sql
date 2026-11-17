-- 0060 — Two things a driver could change on their own record that only the team should decide.
--
-- Found in the security review of 2026-11-16 by acting as a driver against the test database
-- (supabase/tests/rls.test.mjs). Both went through the normal "a driver edits their own row" rule:
--
-- 1. Rating. A driver could write their own `rating_avg` / `rating_count`, and a brand-new driver
--    record could be created with a rating already on it. Travellers see that rating on their trip
--    page (src/lib/travellerTrips.ts), so it has to come only from real reviews
--    (refresh_driver_rating(), migration 0019).
--
-- 2. Seats. A driver could raise `passenger_capacity` on an approved vehicle and offer on a larger
--    group straight away: the edit was flagged for review (`needs_review`) but nothing paused it.
--    Now a seat change on an approved vehicle pauses new offers for that vehicle (`review_hold`,
--    migration 0031) until the team checks it, exactly like replacing its insurance or plate.
--
-- Nothing changes for the team (admins) or the server, and no existing data is touched.

-- 1. Rating: only reviews set it ----------------------------------------------------------------
create or replace function public.guard_driver_rating()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- pg_trigger_depth() = 1: the driver's own statement. The refresh after a review runs inside
  -- another trigger (depth 2) and must keep working.
  if auth.uid() is not null and not public.is_admin() and pg_trigger_depth() = 1 then
    if tg_op = 'INSERT' then
      new.rating_avg := null;
      new.rating_count := 0;
    else
      new.rating_avg := old.rating_avg;
      new.rating_count := old.rating_count;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists drivers_guard_rating on public.drivers;
create trigger drivers_guard_rating
  before insert or update on public.drivers
  for each row execute function public.guard_driver_rating();

-- 2. Seats: a change on an approved vehicle waits for the team -----------------------------------
-- Named to run after driver_vehicles_hold_on_docs (triggers run in name order), which is the one
-- that stops a driver from setting or clearing the hold themselves.
create or replace function public.hold_vehicle_on_seat_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and old.status = 'approved'
     and new.passenger_capacity is distinct from old.passenger_capacity then
    new.review_hold := true;
  end if;
  return new;
end;
$$;

drop trigger if exists driver_vehicles_hold_on_seats on public.driver_vehicles;
create trigger driver_vehicles_hold_on_seats
  before update on public.driver_vehicles
  for each row execute function public.hold_vehicle_on_seat_change();
