-- Driver location during trips (Jorge, 2026-11-09): with the driver's consent, the driver app
-- shares the phone's location from 3 hours before a pickup until the trip is completed, so the
-- team can follow active trips on /admin/live. Nothing is shared outside that window: the
-- database itself refuses positions when the driver has no trip in the window or has not
-- agreed, so the rule holds even if an app misbehaves.
-- Only the latest position per driver is kept (no history).
--
-- Run after 0027. Safe to run more than once.

alter table public.drivers
  add column if not exists location_consent_at timestamptz;
comment on column public.drivers.location_consent_at is
  'When the driver agreed in the app to share their location around trips (null = not agreed / withdrawn).';

create table if not exists public.driver_locations (
  driver_id    uuid primary key references public.drivers (id) on delete cascade,
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180),
  accuracy_m   real,
  speed_mps    real,
  heading      real,
  booking_id   uuid references public.bookings (id) on delete set null,
  recorded_at  timestamptz not null default now()
);
comment on table public.driver_locations is
  'Latest known position of each driver, written only through report_location() inside a trip window. Team reads all; a driver reads their own.';

alter table public.driver_locations enable row level security;
drop policy if exists driver_locations_select on public.driver_locations;
create policy driver_locations_select on public.driver_locations
  for select to authenticated using (driver_id = auth.uid() or public.is_admin());
drop policy if exists driver_locations_admin_delete on public.driver_locations;
create policy driver_locations_admin_delete on public.driver_locations
  for delete to authenticated using (public.is_admin());
revoke all on public.driver_locations from anon;
grant select, delete on public.driver_locations to authenticated;
grant select, insert, update, delete on public.driver_locations to service_role;

-- The trip that allows tracking right now for the signed-in driver, if any:
-- on the road, or confirmed with the pickup between 3 hours ahead and 12 hours ago.
create or replace function public.tracking_window()
returns table (booking_id uuid, booking_ref text, scheduled_at timestamptz, status text)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.booking_ref, b.scheduled_at, b.status
    from public.bookings b
   where b.assigned_driver_id = auth.uid()
     and (
       b.status = 'in_progress'
       or (b.status = 'confirmed'
           and b.scheduled_at <= now() + interval '3 hours'
           and b.scheduled_at >= now() - interval '12 hours')
     )
   order by (b.status = 'in_progress') desc, b.scheduled_at
   limit 1;
$$;

-- The driver agrees (or withdraws) in the app. Withdrawing also erases their last position.
create or replace function public.set_location_consent(p_agree boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.drivers
     set location_consent_at = case when p_agree then coalesce(location_consent_at, now()) else null end
   where id = auth.uid();
  if not p_agree then
    delete from public.driver_locations where driver_id = auth.uid();
  end if;
end;
$$;

-- The app reports a position. Returns false (and stores nothing) when sharing is not allowed
-- right now, which tells the app to stop.
create or replace function public.report_location(
  p_lat double precision, p_lng double precision,
  p_accuracy real default null, p_speed real default null, p_heading real default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w record;
begin
  if not exists (select 1 from public.drivers d where d.id = auth.uid() and d.location_consent_at is not null) then
    return false;
  end if;
  select * into w from public.tracking_window();
  if not found then
    delete from public.driver_locations where driver_id = auth.uid();
    return false;
  end if;
  insert into public.driver_locations (driver_id, lat, lng, accuracy_m, speed_mps, heading, booking_id, recorded_at)
  values (auth.uid(), p_lat, p_lng, p_accuracy, p_speed, p_heading, w.booking_id, now())
  on conflict (driver_id) do update
     set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m, speed_mps = excluded.speed_mps,
         heading = excluded.heading, booking_id = excluded.booking_id, recorded_at = now();
  return true;
end;
$$;

revoke all on function public.tracking_window() from public, anon;
revoke all on function public.set_location_consent(boolean) from public, anon;
revoke all on function public.report_location(double precision, double precision, real, real, real) from public, anon;
grant execute on function public.tracking_window() to authenticated;
grant execute on function public.set_location_consent(boolean) to authenticated;
grant execute on function public.report_location(double precision, double precision, real, real, real) to authenticated;
