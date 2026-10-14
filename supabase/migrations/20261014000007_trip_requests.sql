-- Phase 2d, part 1: travellers send their trip online (before card payment exists).
-- Run after file 6.
--
-- A trip request is one or more bookings (one per ride / tour / expedition) that
-- share a trip_id. The server re-prices every item from the catalog before saving,
-- so a price can never come from the browser. Bookings are written only by the
-- server (service role); travellers don't need an account to send a request.

alter table public.bookings
  add column if not exists trip_id       uuid,
  add column if not exists guest_name    text,
  add column if not exists guest_email   text,
  add column if not exists guest_phone   text,
  add column if not exists client_notes  text,   -- what the traveller wrote
  add column if not exists assigned_vehicle_id uuid references public.driver_vehicles (id) on delete set null,
  add column if not exists updated_at    timestamptz not null default now();

create index if not exists bookings_trip_idx on public.bookings (trip_id);

-- Internal notes live in their own admin-only table: the assigned driver can
-- read their booking row, so notes there would not stay internal.
create table if not exists public.booking_admin_notes (
  booking_id  uuid primary key references public.bookings (id) on delete cascade,
  notes       text not null default '',
  updated_at  timestamptz not null default now()
);
alter table public.booking_admin_notes enable row level security;
grant select, insert, update, delete on public.booking_admin_notes to authenticated, service_role;
drop policy if exists booking_admin_notes_admin on public.booking_admin_notes;
create policy booking_admin_notes_admin on public.booking_admin_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- The traveller's notes and contact details stay out of the drivers' view of
-- open requests (open_trip_requests only lists safe columns, file 5).

create or replace function public.touch_booking()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_booking();

-- An assigned vehicle must belong to the assigned driver.
create or replace function public.guard_booking_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.assigned_vehicle_id is not null and not exists (
    select 1 from public.driver_vehicles v
     where v.id = new.assigned_vehicle_id and v.driver_id = new.assigned_driver_id
  ) then
    raise exception 'The vehicle must belong to the assigned driver';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_guard_assignment on public.bookings;
create trigger bookings_guard_assignment before insert or update on public.bookings
  for each row execute function public.guard_booking_assignment();
