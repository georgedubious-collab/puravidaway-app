-- Electric vehicles: a mark on the driver's vehicle, set by the team only.
--
-- Electric cars are NOT a vehicle category and cost the same price. A vehicle (a sedan, a
-- minivan, a van...) can also be electric; travellers see an "Electric vehicle" badge on
-- their assigned vehicle and can ask for one for free, "if available", when they book
-- (bookings.preferences.electric, no schema change: preferences is jsonb).
--
-- This file only adds the mark. It does not touch prices, vehicle categories or
-- vehicle_can_serve() (migrations 0038/0039), seats, the night premium, driver_jobs() or
-- offer_job(). No new access for anyone: drivers still cannot read bookings, and they can
-- read (not change) the mark on their own vehicle through the existing row-level rules.
-- Run after 0041. Safe to run once, in order.

alter table public.driver_vehicles
  add column if not exists is_electric boolean not null default false;
comment on column public.driver_vehicles.is_electric is
  'True when our team marked this vehicle as electric. Not a category and no price change: shown to travellers as a badge and matched against the free "electric vehicle, if available" request. Set by the team only (guard_vehicle_electric).';

-- A driver can never set or change the mark on their own vehicle (same idea as the category
-- in guard_vehicle_class, migration 0038): their attempt is ignored, not refused, so the
-- driver app's normal vehicle saves keep working. Admins and the server can.
create or replace function public.guard_vehicle_electric()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.is_electric := false;
    else
      new.is_electric := old.is_electric;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_vehicle_electric() from public, anon, authenticated;

drop trigger if exists driver_vehicles_guard_electric on public.driver_vehicles;
create trigger driver_vehicles_guard_electric
  before insert or update on public.driver_vehicles
  for each row execute function public.guard_vehicle_electric();
