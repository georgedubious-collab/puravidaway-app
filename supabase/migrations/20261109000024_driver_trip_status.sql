-- Drivers mark their own trips started and completed (Jorge, 2026-11-09: the traveller is
-- asked for a rating as soon as the trip ends, so the driver has to be able to end it).
-- Drivers can't update bookings directly; this function allows exactly two steps on a trip
-- assigned to them: confirmed → in_progress (from 3 hours before pickup) and
-- in_progress → completed. The team can still set any status in /admin.
--
-- Run after 0023. Safe to run more than once.

alter table public.bookings
  add column if not exists started_at   timestamptz,
  add column if not exists completed_at timestamptz;
comment on column public.bookings.started_at   is 'When the driver (or team) marked the trip on the road.';
comment on column public.bookings.completed_at is 'When the driver (or team) marked the trip completed.';

create or replace function public.driver_set_trip_status(p_booking uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings%rowtype;
begin
  if not public.is_approved_driver() then
    raise exception 'Your driver account is not approved for trips.';
  end if;
  select * into b from public.bookings where id = p_booking and assigned_driver_id = auth.uid() for update;
  if not found then
    raise exception 'This trip is not assigned to you.';
  end if;
  if p_status = 'in_progress' then
    if b.status <> 'confirmed' then
      raise exception 'This trip can''t be started (it is %).', replace(b.status, '_', ' ');
    end if;
    if b.scheduled_at is null or b.scheduled_at > now() + interval '3 hours' then
      raise exception 'You can start the trip from 3 hours before the pickup time.';
    end if;
    update public.bookings set status = 'in_progress', started_at = now() where id = b.id;
  elsif p_status = 'completed' then
    if b.status <> 'in_progress' then
      raise exception 'Start the trip before completing it.';
    end if;
    update public.bookings set status = 'completed', completed_at = now() where id = b.id;
  else
    raise exception 'Unknown step.';
  end if;
  return b.booking_ref;
end;
$$;

revoke all on function public.driver_set_trip_status(uuid, text) from public, anon;
grant execute on function public.driver_set_trip_status(uuid, text) to authenticated;
