-- Change history for bookings ("Historial de cambios" on /admin/bookings/[id]), 2026-11-12.
--
-- What this file does:
--   1. Creates public.booking_events: one row per change to a booking (who, when, what, the
--      value before and after). Admins read it; nobody writes it from a browser or an app.
--   2. Adds a trigger on public.bookings that writes an event whenever one of these changes:
--      status, driver / vehicle assignment, amount received, price (total, cash fee, night
--      premium), driver payout, payment mode, pickup time, driver settlement, name sign.
--      It runs for every path that changes a booking (the admin pages, accepting a driver's
--      offer, the driver app moving a trip along, the traveller editing the sign), so the
--      history cannot be skipped by mistake. Columns that are not listed (chat, review
--      reminders, live-location stamps) are never logged.
--   3. Adds a trigger on public.booking_admin_notes that logs changes to the internal notes.
--   The server (service role) also writes two events itself: "created_by_team" (a booking
--   entered by the team at /admin/bookings/new) and "trip_link_emailed".
--
-- Who did it: auth.uid() of the session that made the change (an admin, a driver, a signed-in
-- traveller); empty for the website's server and scheduled jobs. Never card data (bookings
-- hold none) and never chat messages.
--
-- Run after 0043. Safe to run once, in order. It changes no existing rows.

create table if not exists public.booking_events (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  at          timestamptz not null default now(),
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null check (action in (
                'status', 'assignment', 'amount_paid', 'price', 'payout', 'payment_mode',
                'schedule', 'settled', 'sign', 'notes', 'created_by_team', 'trip_link_emailed')),
  before      jsonb not null default '{}'::jsonb,
  after       jsonb not null default '{}'::jsonb
);
create index if not exists booking_events_booking_idx on public.booking_events (booking_id, at desc);
comment on table public.booking_events is
  'Change history of each booking (migration 0044). Admins read; written only by triggers and the server. No card data, no chat.';

alter table public.booking_events enable row level security;
revoke all on public.booking_events from anon, authenticated;
grant select on public.booking_events to authenticated;
grant select, insert on public.booking_events to service_role;
drop policy if exists booking_events_admin_read on public.booking_events;
create policy booking_events_admin_read on public.booking_events
  for select to authenticated using (public.is_admin());

-- Who made the change, only if that person has a profile (never breaks the booking update).
create or replace function public.booking_event_actor()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where id = auth.uid();
$$;
revoke execute on function public.booking_event_actor() from public, anon, authenticated;

create or replace function public.log_booking_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who uuid := public.booking_event_actor();
begin
  if new.status is distinct from old.status then
    insert into public.booking_events (booking_id, actor_id, action, before, after)
    values (new.id, who, 'status', jsonb_build_object('status', old.status), jsonb_build_object('status', new.status));
  end if;
  if new.assigned_driver_id is distinct from old.assigned_driver_id
     or new.assigned_vehicle_id is distinct from old.assigned_vehicle_id then
    insert into public.booking_events (booking_id, actor_id, action, before, after)
    values (new.id, who, 'assignment',
            jsonb_build_object('driver_id', old.assigned_driver_id, 'vehicle_id', old.assigned_vehicle_id),
            jsonb_build_object('driver_id', new.assigned_driver_id, 'vehicle_id', new.assigned_vehicle_id));
  end if;
  if new.amount_paid is distinct from old.amount_paid then
    insert into public.booking_events (booking_id, actor_id, action, before, after)
    values (new.id, who, 'amount_paid', jsonb_build_object('amount_paid', old.amount_paid), jsonb_build_object('amount_paid', new.amount_paid));
  end if;
  if new.total_price is distinct from old.total_price
     or new.cash_fee is distinct from old.cash_fee
     or new.night_premium is distinct from old.night_premium then
    insert into public.booking_events (booking_id, actor_id, action, before, after)
    values (new.id, who, 'price',
            jsonb_build_object('total_price', old.total_price, 'cash_fee', old.cash_fee, 'night_premium', old.night_premium),
            jsonb_build_object('total_price', new.total_price, 'cash_fee', new.cash_fee, 'night_premium', new.night_premium));
  end if;
  if new.driver_payout is distinct from old.driver_payout then
    insert into public.booking_events (booking_id, actor_id, action, before, after)
    values (new.id, who, 'payout', jsonb_build_object('driver_payout', old.driver_payout), jsonb_build_object('driver_payout', new.driver_payout));
  end if;
  if new.payment_mode is distinct from old.payment_mode then
    insert into public.booking_events (booking_id, actor_id, action, before, after)
    values (new.id, who, 'payment_mode', jsonb_build_object('payment_mode', old.payment_mode), jsonb_build_object('payment_mode', new.payment_mode));
  end if;
  if new.scheduled_at is distinct from old.scheduled_at then
    insert into public.booking_events (booking_id, actor_id, action, before, after)
    values (new.id, who, 'schedule', jsonb_build_object('scheduled_at', old.scheduled_at), jsonb_build_object('scheduled_at', new.scheduled_at));
  end if;
  if new.driver_settled_at is distinct from old.driver_settled_at then
    insert into public.booking_events (booking_id, actor_id, action, before, after)
    values (new.id, who, 'settled', jsonb_build_object('driver_settled_at', old.driver_settled_at), jsonb_build_object('driver_settled_at', new.driver_settled_at));
  end if;
  if new.sign_text is distinct from old.sign_text or new.sign_hide_name is distinct from old.sign_hide_name then
    insert into public.booking_events (booking_id, actor_id, action, before, after)
    values (new.id, who, 'sign',
            jsonb_build_object('sign_text', old.sign_text, 'sign_hide_name', old.sign_hide_name),
            jsonb_build_object('sign_text', new.sign_text, 'sign_hide_name', new.sign_hide_name));
  end if;
  return null;
end;
$$;
revoke execute on function public.log_booking_changes() from public, anon, authenticated;

drop trigger if exists bookings_log_changes on public.bookings;
create trigger bookings_log_changes
  after update on public.bookings
  for each row execute function public.log_booking_changes();

-- Internal notes (admins only). The text is kept short in the history.
create or replace function public.log_booking_note_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_notes text := case when tg_op = 'UPDATE' then coalesce(old.notes, '') else '' end;
begin
  if coalesce(new.notes, '') is distinct from old_notes then
    insert into public.booking_events (booking_id, actor_id, action, before, after)
    values (new.booking_id, public.booking_event_actor(), 'notes',
            jsonb_build_object('notes', left(old_notes, 300)),
            jsonb_build_object('notes', left(coalesce(new.notes, ''), 300)));
  end if;
  return null;
end;
$$;
revoke execute on function public.log_booking_note_changes() from public, anon, authenticated;

drop trigger if exists booking_admin_notes_log_changes on public.booking_admin_notes;
create trigger booking_admin_notes_log_changes
  after insert or update on public.booking_admin_notes
  for each row execute function public.log_booking_note_changes();
