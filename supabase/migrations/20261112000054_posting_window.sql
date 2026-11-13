-- Job board posting window (Jorge, 2026-11-12). Run after 0053. Safe to run once, in order.
--
-- Until now a booking posted to the drivers' job board (status 'pending_bids', "Open for
-- drivers") stayed on the board until the team accepted someone. New rules:
--
--   1. A posting is open for 1 hour. After that it leaves the job board (driver_jobs()) and
--      offer_job() refuses new offers ("This job is no longer open."). The status stays
--      'pending_bids', so the booking still counts as "needs a driver" everywhere in the admin
--      (lists, counters, dispatch calendar, "Necesita atención", the 12-hour "Sin conductor"
--      alert) and the offers that arrived during the hour can still be accepted
--      (accept_offer() only needs 'pending_bids', unchanged). No scheduled job flips the status:
--      open/closed is always "posting_closes_at > now()".
--   2. "Volver a publicar": repost_job() (admins) opens a new 1-hour window. The website then
--      re-sends the new-job alerts to drivers (src/lib/jobAlerts.ts).
--   3. Automatic repost 48 hours before pickup: auto_repost_jobs() (the 5-minute scheduled job,
--      service role) posts again, once per booking (auto_reposted_at is claimed first), every
--      booking still on the board without a driver whose pickup is within 48 hours, if it was
--      created and posted more than 48 hours before pickup and its window is closed.
--   4. Every way a booking reaches the board (the team choosing "Open for drivers", a driver
--      removed from a confirmed booking) gets the 1-hour window, from a trigger.
--
-- New columns on bookings: posted_at, posting_closes_at, auto_reposted_at. No new table, so no
-- new RLS policy: bookings keeps its policies (admins all, travellers their own rows, drivers
-- none; drivers only see jobs through driver_jobs()). booking_events gets two new kinds,
-- 'reposted' (by the team) and 'auto_reposted' (by the scheduled job).

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists posted_at timestamptz,
  add column if not exists posting_closes_at timestamptz,
  add column if not exists auto_reposted_at timestamptz;
comment on column public.bookings.posted_at is
  'When the booking was last posted to the drivers'' job board (status became pending_bids, or "Volver a publicar", or the automatic repost 48 h before pickup). Migration 0054.';
comment on column public.bookings.posting_closes_at is
  'End of the current 1-hour posting window. Drivers see the job and can offer only while now() < posting_closes_at; offers received stay and can still be accepted after it. Migration 0054.';
comment on column public.bookings.auto_reposted_at is
  'When the scheduled job posted this booking again 48 hours before pickup (once per booking; claimed before the alerts go out). Migration 0054.';

-- Postings already open when this runs: when they were posted (from the change history, else
-- when the booking arrived), and one more hour on the board from now, so nobody loses a job
-- mid-offer at deploy time.
update public.bookings b
   set posted_at = coalesce(
         (select max(e.at) from public.booking_events e
           where e.booking_id = b.id and e.action = 'status' and e.after->>'status' = 'pending_bids'),
         b.created_at),
       posting_closes_at = now() + interval '1 hour'
 where b.status = 'pending_bids' and b.posting_closes_at is null;

create index if not exists bookings_auto_repost_idx on public.bookings (scheduled_at)
  where status = 'pending_bids' and assigned_driver_id is null and auto_reposted_at is null;

-- ---------------------------------------------------------------------------
-- 2. Every arrival on the board opens a 1-hour window
-- ---------------------------------------------------------------------------
create or replace function public.open_posting_window()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'pending_bids' and (tg_op = 'INSERT' or old.status is distinct from 'pending_bids') then
    new.posted_at := now();
    new.posting_closes_at := now() + interval '1 hour';
  end if;
  return new;
end;
$$;
revoke execute on function public.open_posting_window() from public, anon, authenticated;

drop trigger if exists bookings_posting_window on public.bookings;
create trigger bookings_posting_window
  before insert or update of status on public.bookings
  for each row execute function public.open_posting_window();

-- ---------------------------------------------------------------------------
-- 3. New kinds of history entries
-- ---------------------------------------------------------------------------
alter table public.booking_events drop constraint if exists booking_events_action_check;
alter table public.booking_events add constraint booking_events_action_check check (action in (
  'status', 'assignment', 'amount_paid', 'price', 'payout', 'payment_mode',
  'schedule', 'settled', 'sign', 'notes', 'created_by_team', 'trip_link_emailed',
  'cancellation', 'refund', 'refund_paid', 'driver_removed', 'whatsapp_opened', 'notified',
  'reposted', 'auto_reposted'));

-- ---------------------------------------------------------------------------
-- 4. Job board: only postings inside their window
-- ---------------------------------------------------------------------------
-- Same as migration 0039 (same columns) plus "and b.posting_closes_at > now()".
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
         public.stops_for_driver(b.sightseeing_stops), b.vehicle_class, b.scheduled_at, b.passenger_count,
         b.preferences, b.driver_notes, b.driver_payout, b.created_at,
         o.bid_amount, o.status, o.id
    from public.bookings b
    left join public.bids o on o.booking_id = b.id and o.driver_id = auth.uid()
   where b.status = 'pending_bids'
     and b.posting_closes_at > now()
     and b.driver_payout is not null
     and b.scheduled_at > now()
     and public.is_approved_driver()
     and not exists (select 1 from public.driver_unavailable u
                      where u.driver_id = auth.uid()
                        and u.day = (b.scheduled_at at time zone 'America/Costa_Rica')::date)
     and ((b.vehicle_class is null and b.passenger_count is null)
          or exists (select 1 from public.driver_vehicles v
                      where v.driver_id = auth.uid()
                        and v.status = 'approved'
                        and public.vehicle_can_serve(v.vehicle_class, b.vehicle_class)
                        and (b.passenger_count is null
                             or coalesce(v.passenger_capacity, 0) >= b.passenger_count)))
   order by b.scheduled_at;
$$;
revoke all on function public.driver_jobs() from public, anon;
grant execute on function public.driver_jobs() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Offers: refused once the window has closed (server-enforced)
-- ---------------------------------------------------------------------------
-- Same as migration 0038 plus the window check, with the existing "no longer open" message
-- (already translated for the driver portal and the driver app, src/lib/driverDbMessages.ts).
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
  if not found or b.status <> 'pending_bids' or b.driver_payout is null
     or b.posting_closes_at is null or b.posting_closes_at <= now() then
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
  if not public.vehicle_can_serve(v.vehicle_class, b.vehicle_class) then
    raise exception 'That vehicle''s category can''t take this job. Pick another of your vehicles.';
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

-- ---------------------------------------------------------------------------
-- 6. "Volver a publicar" (admins): a new 1-hour window on a closed posting
-- ---------------------------------------------------------------------------
-- Only a booking still on the board without a driver, with a payout and a pickup in the future,
-- whose window has closed. Offers already received stay. Written to the history as 'reposted'.
-- Returns when the new window closes. The website sends the drivers' alerts afterwards.
create or replace function public.repost_job(p_booking uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings%rowtype;
  closes timestamptz := now() + interval '1 hour';
  offers integer;
begin
  if not public.is_admin() then
    raise exception 'Only the team can post a job again.';
  end if;
  select * into b from public.bookings where id = p_booking for update;
  if not found then
    raise exception 'Booking not found.';
  end if;
  if b.status <> 'pending_bids' or b.assigned_driver_id is not null then
    raise exception 'Only a booking open for drivers and without a driver can be posted again.';
  end if;
  if b.driver_payout is null then
    raise exception 'This booking has no driver payout, so it cannot go on the job board.';
  end if;
  if b.scheduled_at is null or b.scheduled_at <= now() then
    raise exception 'The pickup time has passed.';
  end if;
  if b.posting_closes_at > now() then
    raise exception 'This posting is still open.';
  end if;
  select count(*) into offers from public.bids where booking_id = b.id and status = 'submitted';

  update public.bookings set posted_at = now(), posting_closes_at = closes where id = b.id;
  insert into public.booking_events (booking_id, actor_id, action, before, after)
  values (b.id, public.booking_event_actor(), 'reposted',
          jsonb_build_object('posting_closes_at', b.posting_closes_at),
          jsonb_build_object('posting_closes_at', closes, 'offers', offers));
  return closes;
end;
$$;
revoke all on function public.repost_job(uuid) from public, anon;
grant execute on function public.repost_job(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Automatic repost 48 hours before pickup (scheduled job, service role)
-- ---------------------------------------------------------------------------
-- Once per booking: the row is claimed (auto_reposted_at set) in the same statement that opens
-- the window, so two overlapping runs cannot both post it. Skipped: bookings created or posted
-- less than 48 hours before pickup (the team is already on them), bookings with a driver,
-- cancelled / completed / not on the board, multi-day trips (no payout), and postings whose
-- window is still open (picked up by the next run once it closes). Returns the booking ids
-- posted, for the drivers' alerts.
--
-- Runs with the caller's rights (security invoker): only the service role can update every
-- booking and write the history; a signed-in user is refused outright.
create or replace function public.auto_repost_jobs()
returns setof uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is not null then
    raise exception 'Only the scheduled job posts jobs again automatically.';
  end if;
  return query
  with due as (
    select b.id, b.posting_closes_at as old_closes
      from public.bookings b
     where b.status = 'pending_bids'
       and b.assigned_driver_id is null
       and b.auto_reposted_at is null
       and b.service_type in ('transfer', 'day_tour')
       and b.driver_payout is not null
       and b.scheduled_at > now()
       and b.scheduled_at <= now() + interval '48 hours'
       and b.created_at <= b.scheduled_at - interval '48 hours'
       and coalesce(b.posted_at, b.created_at) <= b.scheduled_at - interval '48 hours'
       and (b.posting_closes_at is null or b.posting_closes_at <= now())
     for update skip locked
  ), claimed as (
    update public.bookings u
       set auto_reposted_at = now(), posted_at = now(), posting_closes_at = now() + interval '1 hour'
      from due
     where u.id = due.id and u.auto_reposted_at is null
    returning u.id, due.old_closes
  ), logged as (
    insert into public.booking_events (booking_id, actor_id, action, before, after)
    select c.id, null, 'auto_reposted',
           jsonb_build_object('posting_closes_at', c.old_closes),
           jsonb_build_object('posting_closes_at', now() + interval '1 hour')
      from claimed c
    returning booking_id
  )
  select booking_id from logged;
end;
$$;
revoke all on function public.auto_repost_jobs() from public, anon, authenticated;
grant execute on function public.auto_repost_jobs() to service_role;
