-- Driver availability calendar (Jorge, 2026-11-09): drivers block the days they can't work.
-- On a blocked day the driver is not shown jobs, cannot offer, is not emailed or pushed about
-- new jobs, and the team sees "unavailable that day" when assigning by hand.
-- Days are Costa Rica calendar days. A day with a confirmed trip can't be blocked: the driver
-- has to ask the team to reassign it first.
--
-- Run after 0031. Safe to run more than once.

create table if not exists public.driver_unavailable (
  driver_id   uuid not null references public.drivers (id) on delete cascade,
  day         date not null,
  created_at  timestamptz not null default now(),
  primary key (driver_id, day)
);
comment on table public.driver_unavailable is
  'Costa Rica calendar days a driver has blocked. Written through set_unavailable(); the driver reads their own, the team all.';

alter table public.driver_unavailable enable row level security;
drop policy if exists driver_unavailable_select on public.driver_unavailable;
create policy driver_unavailable_select on public.driver_unavailable
  for select to authenticated using (driver_id = auth.uid() or public.is_admin());
drop policy if exists driver_unavailable_admin_write on public.driver_unavailable;
create policy driver_unavailable_admin_write on public.driver_unavailable
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.driver_unavailable from anon;
grant select on public.driver_unavailable to authenticated;
grant insert, update, delete on public.driver_unavailable to authenticated, service_role;

-- Block or unblock one day. Withdraws the driver's open offers on jobs that day.
create or replace function public.set_unavailable(p_day date, p_blocked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.drivers d where d.id = auth.uid()) then
    raise exception 'Only drivers have a calendar.';
  end if;
  if p_day is null or p_day < public.cr_today() or p_day > public.cr_today() + 365 then
    raise exception 'Pick a day from today up to a year ahead.';
  end if;
  if not p_blocked then
    delete from public.driver_unavailable where driver_id = auth.uid() and day = p_day;
    return;
  end if;
  if exists (select 1 from public.bookings b
              where b.assigned_driver_id = auth.uid()
                and b.status in ('confirmed', 'in_progress')
                and (b.scheduled_at at time zone 'America/Costa_Rica')::date = p_day) then
    raise exception 'You have a trip that day. Contact support to reassign it before blocking the day.';
  end if;
  insert into public.driver_unavailable (driver_id, day) values (auth.uid(), p_day) on conflict do nothing;
  update public.bids o
     set status = 'withdrawn', updated_at = now()
    from public.bookings b
   where o.booking_id = b.id and o.driver_id = auth.uid() and o.status = 'submitted'
     and (b.scheduled_at at time zone 'America/Costa_Rica')::date = p_day;
end;
$$;
revoke all on function public.set_unavailable(date, boolean) from public, anon;
grant execute on function public.set_unavailable(date, boolean) to authenticated;

-- Open jobs: not on days the driver has blocked.
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
         b.sightseeing_stops, b.vehicle_class, b.scheduled_at, b.passenger_count,
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
   order by b.scheduled_at;
$$;

-- Offers: also refused on a blocked day.
create or replace function public.offer_job(p_booking uuid, p_vehicle uuid, p_amount numeric, p_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings%rowtype;
  v public.driver_vehicles%rowtype;
begin
  if not public.is_approved_driver() then
    raise exception 'Your driver account is not approved for trips yet.';
  end if;
  if exists (select 1 from public.drivers d where d.id = auth.uid() and d.review_hold) then
    raise exception 'Your new documents are being checked. You can send offers again once our team approves them.';
  end if;
  select * into v from public.driver_vehicles
   where id = p_vehicle and driver_id = auth.uid() and status = 'approved';
  if not found or not public.vehicle_documents_current(v) then
    raise exception 'Pick one of your approved vehicles with current documents.';
  end if;
  if v.review_hold then
    raise exception 'That vehicle''s new documents are being checked. Pick another vehicle, or wait for our team to approve them.';
  end if;
  select * into b from public.bookings where id = p_booking;
  if not found or b.status <> 'pending_bids' or b.driver_payout is null then
    raise exception 'This job is no longer open.';
  end if;
  if b.scheduled_at <= now() then
    raise exception 'This job is in the past.';
  end if;
  if exists (select 1 from public.driver_unavailable u
              where u.driver_id = auth.uid() and u.day = (b.scheduled_at at time zone 'America/Costa_Rica')::date) then
    raise exception 'You marked that day as unavailable. Unblock it in your calendar to offer on this job.';
  end if;
  if b.passenger_count is not null and coalesce(v.passenger_capacity, 0) < b.passenger_count then
    raise exception 'That vehicle has % seats; this group needs %.', coalesce(v.passenger_capacity, 0), b.passenger_count;
  end if;
  if p_amount is null or p_amount < round(b.driver_payout * 0.70) or p_amount > round(b.driver_payout * 1.30) then
    raise exception 'Offers must be between $% and $%.', round(b.driver_payout * 0.70), round(b.driver_payout * 1.30);
  end if;
  if p_note is not null and not public.no_contact_details(p_note) then
    raise exception 'Please keep phone numbers, emails and links out of the note.';
  end if;

  insert into public.bids (booking_id, driver_id, bid_amount, vehicle_id, note, status, vehicle_snapshot)
  values (b.id, auth.uid(), round(p_amount, 2), v.id, nullif(trim(p_note), ''), 'submitted',
          jsonb_build_object('make_model', v.make_model, 'plate', v.plate, 'seats', v.passenger_capacity))
  on conflict (booking_id, driver_id) do update
     set bid_amount = excluded.bid_amount, vehicle_id = excluded.vehicle_id, note = excluded.note,
         status = 'submitted', vehicle_snapshot = excluded.vehicle_snapshot, updated_at = now();
  return b.booking_ref;
end;
$$;

revoke all on function public.offer_job(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.offer_job(uuid, uuid, numeric, text) to authenticated;
