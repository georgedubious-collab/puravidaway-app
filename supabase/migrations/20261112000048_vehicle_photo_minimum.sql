-- Vehicle photos: an approved vehicle never drops below 2 photos, and the licence plate photo
-- (team only) follows the vehicle-document review rule (Jorge, 2026-11-12).
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
-- Run after 0045. Safe to run more than once.

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

-- ---------------------------------------------------------------------------------------------
-- Licence plate photo (Jorge, 2026-11-12): one photo per vehicle where the plate is easy to read,
-- for the team only. It is a vehicle DOCUMENT (documents ->> 'plate_photo'), not one of the
-- vehicle's `photos`, so it has the same access as the insurance or Dekra files (the team and the
-- owning driver; storage policies of 0002/0004) and is never signed for travellers.
-- Review rule, same as the other vehicle documents (0031): REPLACING it on an approved vehicle
-- pauses new jobs for that vehicle until the team checks it. Adding it the FIRST time does not
-- pause anything, so vehicles approved before this rule keep working while drivers add it.
-- Same function as 0031, with the plate photo added.
-- ---------------------------------------------------------------------------------------------
create or replace function public.hold_vehicle_on_document_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.review_hold := old.review_hold;
    if old.status = 'approved' and (
         new.ins_insurance_expiry    is distinct from old.ins_insurance_expiry
      or new.dekra_inspection_expiry is distinct from old.dekra_inspection_expiry
      or new.marchamo_year           is distinct from old.marchamo_year
      or new.plate                   is distinct from old.plate
      or (new.documents ->> 'insurance')            is distinct from (old.documents ->> 'insurance')
      or (new.documents ->> 'dekra')                is distinct from (old.documents ->> 'dekra')
      or (new.documents ->> 'marchamo')             is distinct from (old.documents ->> 'marchamo')
      or (new.documents ->> 'vehicle_registration') is distinct from (old.documents ->> 'vehicle_registration')
      or ((old.documents ->> 'plate_photo') is not null
          and (new.documents ->> 'plate_photo') is distinct from (old.documents ->> 'plate_photo'))
    ) then
      new.review_hold := true;
    end if;
  elsif new.needs_review = false or new.status is distinct from old.status then
    new.review_hold := false;
  end if;
  return new;
end;
$$;
