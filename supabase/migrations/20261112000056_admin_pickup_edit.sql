-- The team edits where a trip starts and ends (Jorge, 2026-11-12; docs/PROJECT.md §4.2, §7.3).
--
-- What this file does:
--   1. booking_events gets one new kind of entry, 'places': the pickup or drop-off changed
--      (place name + address, the Google place id), the day-tour pickup place, the flight / hotel
--      notes, the message for the driver or the door-to-door drive time. The list of allowed
--      kinds is rebuilt from the one already in the database plus 'places', so a kind added by
--      another migration that ran just before this one is kept.
--   2. A second history trigger on public.bookings writes that entry (who did it = the signed-in
--      person, as for the other entries; only the fields that changed, old → new). It is separate
--      from log_booking_changes() (migration 0044), which is not touched. The pickup time, the
--      price and the driver's payout keep their own entries ('schedule', 'price', 'payout').
--
-- No new table, no new column, no RLS change (admins already edit bookings; drivers and
-- travellers cannot read the history). Changes no existing rows.
-- Run after 0054 (and 0055 if present). Safe to run once, in order.

-- ---------------------------------------------------------------------------
-- 1. Allow the new kind of history entry
-- ---------------------------------------------------------------------------
do $$
declare
  def   text;
  kinds text[];
begin
  select pg_get_constraintdef(c.oid) into def
    from pg_constraint c
   where c.conrelid = 'public.booking_events'::regclass
     and c.conname = 'booking_events_action_check';
  -- Every quoted word in the current check, e.g. 'status', 'assignment', … 'auto_reposted'.
  select coalesce(array_agg(distinct m[1]), '{}') into kinds
    from regexp_matches(coalesce(def, ''), '''([a-z_]+)''', 'g') as m;
  if not ('places' = any (kinds)) then
    kinds := kinds || array['places'];
    alter table public.booking_events drop constraint if exists booking_events_action_check;
    execute format(
      'alter table public.booking_events add constraint booking_events_action_check check (action in (%s))',
      (select string_agg(quote_literal(k), ', ' order by k) from unnest(kinds) as k));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. History entry when a trip's places or details change
-- ---------------------------------------------------------------------------
create or replace function public.log_booking_place_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b jsonb := '{}'::jsonb;
  a jsonb := '{}'::jsonb;
begin
  if new.origin is distinct from old.origin
     or (new.origin_coords ->> 'place_id') is distinct from (old.origin_coords ->> 'place_id') then
    b := b || jsonb_build_object('origin', old.origin, 'origin_place_id', old.origin_coords ->> 'place_id');
    a := a || jsonb_build_object('origin', new.origin, 'origin_place_id', new.origin_coords ->> 'place_id');
  end if;
  if new.destination is distinct from old.destination
     or (new.destination_coords ->> 'place_id') is distinct from (old.destination_coords ->> 'place_id') then
    b := b || jsonb_build_object('destination', old.destination, 'destination_place_id', old.destination_coords ->> 'place_id');
    a := a || jsonb_build_object('destination', new.destination, 'destination_place_id', new.destination_coords ->> 'place_id');
  end if;
  if new.pickup_place is distinct from old.pickup_place then
    b := b || jsonb_build_object('pickup_place', old.pickup_place);
    a := a || jsonb_build_object('pickup_place', new.pickup_place);
  end if;
  if new.flight_or_hotel_notes is distinct from old.flight_or_hotel_notes then
    b := b || jsonb_build_object('flight_or_hotel_notes', left(old.flight_or_hotel_notes, 300));
    a := a || jsonb_build_object('flight_or_hotel_notes', left(new.flight_or_hotel_notes, 300));
  end if;
  if new.driver_notes is distinct from old.driver_notes then
    b := b || jsonb_build_object('driver_notes', left(old.driver_notes, 300));
    a := a || jsonb_build_object('driver_notes', left(new.driver_notes, 300));
  end if;
  if new.drive_minutes is distinct from old.drive_minutes then
    b := b || jsonb_build_object('drive_minutes', old.drive_minutes);
    a := a || jsonb_build_object('drive_minutes', new.drive_minutes);
  end if;
  if a <> '{}'::jsonb or b <> '{}'::jsonb then
    insert into public.booking_events (booking_id, actor_id, action, before, after)
    values (new.id, public.booking_event_actor(), 'places', b, a);
  end if;
  return null;
end;
$$;
revoke execute on function public.log_booking_place_changes() from public, anon, authenticated;

drop trigger if exists bookings_log_place_changes on public.bookings;
create trigger bookings_log_place_changes
  after update of origin, destination, origin_coords, destination_coords, pickup_place,
                  flight_or_hotel_notes, driver_notes, drive_minutes
  on public.bookings
  for each row execute function public.log_booking_place_changes();
