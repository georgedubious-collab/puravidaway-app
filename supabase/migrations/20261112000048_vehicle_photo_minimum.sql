-- Vehicle photos: an approved vehicle never drops below 2 photos (Jorge, 2026-11-12).
--
-- Drivers can now remove and reorder their vehicle photos from the app. The server already
-- refuses a removal that would leave an approved vehicle with fewer than 2 photos; this rule
-- makes the database refuse it too, so it holds whichever way the change is sent.
--   * Only a driver's own change is checked (admins and the server are not limited).
--   * Only a change that REMOVES photos is refused: a vehicle that already has fewer than 2
--     (from before this rule) can still add photos, and reordering never changes the count.
--   * Photo changes still do not pause jobs (migration 0031): they only mark the vehicle as
--     "changed since last review".
--
-- Run after 0044. Safe to run more than once.

create or replace function public.keep_vehicle_photo_minimum()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  before_n int := jsonb_array_length(coalesce(old.photos, '[]'::jsonb));
  after_n  int := jsonb_array_length(coalesce(new.photos, '[]'::jsonb));
begin
  if auth.uid() is not null and not public.is_admin()
     and old.status = 'approved' and after_n < 2 and after_n < before_n then
    raise exception 'An approved vehicle needs at least 2 photos. Add a new photo before removing this one.';
  end if;
  return new;
end;
$$;

drop trigger if exists driver_vehicles_photo_minimum on public.driver_vehicles;
create trigger driver_vehicles_photo_minimum
  before update of photos on public.driver_vehicles
  for each row execute function public.keep_vehicle_photo_minimum();
