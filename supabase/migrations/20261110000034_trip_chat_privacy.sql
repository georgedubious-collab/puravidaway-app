-- Trip chat, privacy round (Jorge, 2026-11-10): drivers never get the traveller's
-- phone or email, and contact details in the chat are hidden instead of refused.
--
-- 1. hide_contact_details(): the database's copy of the "hide and flag" filter
--    (the server's fuller version is src/lib/contactFilter.ts). A backstop only.
-- 2. contact_flags: the original text of anything that was hidden, admins only.
-- 3. trip_chats: nobody writes directly any more (not travellers, drivers or admins);
--    the server posts every message through post_chat_message(), after its filter.
-- 4. Booking notes the assigned driver can read (traveller's notes, flight / hotel
--    notes, message for the driver) get the same treatment on every write.
-- 5. Unread counts for the driver app and the batched "unread message" email.
-- 6. profiles.app_lang: the language a driver last used, so pushes follow it.
--
-- Safe to run once, in order: every statement is create-or-replace / if-not-exists,
-- and the one data update only touches rows that still hold contact details.

-- ---------------------------------------------------------------------------
-- 1. The backstop filter: emails, links / domains, @handles and phone numbers
--    (8+ digits once spaces, dots and dashes are removed; dates are kept).
-- ---------------------------------------------------------------------------
create or replace function public.hide_contact_details(t text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := t;
  run text;
begin
  if v is null then
    return null;
  end if;
  v := regexp_replace(v, '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}', '[hidden]', 'gi');
  v := regexp_replace(v, '(https?://|www\.)[^[:space:]]+', '[hidden]', 'gi');
  v := regexp_replace(v, '\m(wa|t|m)\.me/?[^[:space:]]*', '[hidden]', 'gi');
  v := regexp_replace(v, '\m[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|net|org|cr|io|me|co|info|biz|app)\M(/[^[:space:]]*)?', '[hidden]', 'gi');
  v := regexp_replace(v, '(^|[[:space:](])@[a-z0-9_.]{2,}', '\1[hidden]', 'gi');
  for run in
    select m[1] from regexp_matches(v, '(\+?\(?[0-9](?:[[:space:]().+_/,-]*[0-9])+)', 'g') as m
  loop
    if length(regexp_replace(run, '[^0-9]', '', 'g')) >= 8
       and run !~ '^[0-9]{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2}$'
       and run !~ '^[0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4}$'
       and run !~ '^(19|20)[0-9]{2}[[:space:]]*[-–][[:space:]]*(19|20)[0-9]{2}$' then
      v := replace(v, run, '[hidden]');
    end if;
  end loop;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Originals of hidden contact details: admins read them in the CRM
--    ("Mensajes marcados", /admin/flagged) and mark them reviewed.
-- ---------------------------------------------------------------------------
create table if not exists public.contact_flags (
  id           uuid primary key default gen_random_uuid(),
  -- Deferred, so a booking's own insert trigger can flag its notes before the row exists.
  booking_id   uuid not null references public.bookings (id) on delete cascade deferrable initially deferred,
  chat_id      uuid references public.trip_chats (id) on delete cascade,
  source       text not null check (source in ('chat', 'booking_notes')),
  field        text check (field is null or field in ('client_notes', 'flight_or_hotel_notes', 'driver_notes')),
  sender_role  text check (sender_role in ('client', 'driver', 'admin')),
  sender_id    uuid references public.profiles (id) on delete set null,
  original     text not null,
  shown        text,
  kinds        text[] not null default '{}',
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references public.profiles (id) on delete set null
);
create index if not exists contact_flags_open_idx on public.contact_flags (reviewed_at, created_at desc);
create index if not exists contact_flags_booking_idx on public.contact_flags (booking_id);
comment on table public.contact_flags is
  'Original text of contact details hidden from the trip chat and booking notes. Admins only.';

alter table public.contact_flags enable row level security;
revoke all on public.contact_flags from anon;
grant select, update on public.contact_flags to authenticated;
grant select, insert, update, delete on public.contact_flags to service_role;
drop policy if exists contact_flags_admin_read on public.contact_flags;
create policy contact_flags_admin_read on public.contact_flags
  for select to authenticated using (public.is_admin());
drop policy if exists contact_flags_admin_review on public.contact_flags;
create policy contact_flags_admin_review on public.contact_flags
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. Trip chat: server-only writes. Participants (the booking's client, its
--    currently assigned driver) and admins keep reading through trip_chats_select.
-- ---------------------------------------------------------------------------
alter table public.trip_chats add column if not exists flagged boolean not null default false;

drop policy if exists trip_chats_insert on public.trip_chats;
revoke insert, update, delete on public.trip_chats from anon, authenticated;

-- Hide instead of refuse: a message is never lost because of a phone number.
create or replace function public.guard_chat_message()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.sender_role in ('client', 'driver') then
    new.message := public.hide_contact_details(new.message);
  end if;
  new.sent_at := now();
  return new;
end;
$$;

-- The server's way in: flood guard (8 a minute per side), the backstop filter, the
-- message and, when something was hidden, the admin-only original, in one step.
create or replace function public.post_chat_message(
  p_booking uuid, p_sender uuid, p_role text, p_message text, p_original text, p_kinds text[]
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  new_id uuid;
  v_msg text := p_message;
begin
  perform pg_advisory_xact_lock(hashtext(p_booking::text || p_role));
  if (select count(*) from public.trip_chats
       where booking_id = p_booking and sender_role = p_role and sent_at > now() - interval '1 minute') >= 8 then
    raise exception 'Too many messages, please wait a moment';
  end if;
  if p_role in ('client', 'driver') then
    v_msg := public.hide_contact_details(p_message);
  end if;
  insert into public.trip_chats (booking_id, sender_id, sender_role, message, flagged)
  values (p_booking, p_sender, p_role, v_msg, p_original is not null or v_msg is distinct from p_message)
  returning id into new_id;
  if p_original is not null or v_msg is distinct from p_message then
    insert into public.contact_flags (booking_id, chat_id, source, sender_role, sender_id, original, shown, kinds)
    values (p_booking, new_id, 'chat', p_role, p_sender, coalesce(p_original, p_message), v_msg, coalesce(p_kinds, '{}'));
  end if;
  return new_id;
end;
$$;
revoke all on function public.post_chat_message(uuid, uuid, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.post_chat_message(uuid, uuid, text, text, text, text[]) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Booking notes: the assigned driver can read their booking row, so the
--    traveller's notes, flight / hotel notes and message for the driver never
--    keep contact details there. The original goes to contact_flags.
-- ---------------------------------------------------------------------------
create or replace function public.guard_booking_notes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v text;
begin
  v := public.hide_contact_details(new.client_notes);
  if v is distinct from new.client_notes then
    insert into public.contact_flags (booking_id, source, field, sender_role, original, shown)
    values (new.id, 'booking_notes', 'client_notes', 'client', new.client_notes, v);
    new.client_notes := v;
  end if;
  v := public.hide_contact_details(new.flight_or_hotel_notes);
  if v is distinct from new.flight_or_hotel_notes then
    insert into public.contact_flags (booking_id, source, field, sender_role, original, shown)
    values (new.id, 'booking_notes', 'flight_or_hotel_notes', 'client', new.flight_or_hotel_notes, v);
    new.flight_or_hotel_notes := v;
  end if;
  v := public.hide_contact_details(new.driver_notes);
  if v is distinct from new.driver_notes then
    insert into public.contact_flags (booking_id, source, field, sender_role, original, shown)
    values (new.id, 'booking_notes', 'driver_notes', 'client', new.driver_notes, left(v, 500));
    new.driver_notes := left(v, 500);
  end if;
  return new;
end;
$$;
revoke all on function public.guard_booking_notes() from public, anon, authenticated;

drop trigger if exists bookings_guard_notes on public.bookings;
create trigger bookings_guard_notes
  before insert or update of client_notes, flight_or_hotel_notes, driver_notes on public.bookings
  for each row execute function public.guard_booking_notes();

-- Bookings saved before this file (none on 2026-11-10; kept for safety). The trigger
-- above does the hiding and flagging; a second run finds nothing left to change.
update public.bookings
   set client_notes = client_notes,
       flight_or_hotel_notes = flight_or_hotel_notes,
       driver_notes = driver_notes
 where public.hide_contact_details(client_notes) is distinct from client_notes
    or public.hide_contact_details(flight_or_hotel_notes) is distinct from flight_or_hotel_notes
    or public.hide_contact_details(driver_notes) is distinct from driver_notes;

-- ---------------------------------------------------------------------------
-- 5a. Unread messages per trip, for the driver app's badges (own trips only).
-- ---------------------------------------------------------------------------
create or replace function public.my_chat_unread()
returns table (booking_id uuid, unread int)
language sql
stable
security definer
set search_path = public
as $$
  select c.booking_id, count(*)::int
    from public.trip_chats c
    join public.bookings b on b.id = c.booking_id
    left join public.chat_reads r on r.booking_id = c.booking_id and r.party = 'driver'
   where b.assigned_driver_id = auth.uid()
     and c.sender_role <> 'driver'
     and (r.last_read_at is null or c.sent_at > r.last_read_at)
   group by c.booking_id;
$$;
revoke all on function public.my_chat_unread() from public, anon;
grant execute on function public.my_chat_unread() to authenticated;

-- ---------------------------------------------------------------------------
-- 5b. Travellers without the app: one email when messages to them have stayed
--     unread for p_delay (10 minutes), then nothing more until they read the chat.
--     Claims the bookings (sets last_emailed_at) and returns what to email.
-- ---------------------------------------------------------------------------
create or replace function public.claim_unread_chat_emails(p_delay interval)
returns table (booking_id uuid, unread int, last_message text, last_role text)
language sql
set search_path = public
as $$
  with pending as (
    select c.booking_id, count(*)::int as unread, min(c.sent_at) as first_at
      from public.trip_chats c
      left join public.chat_reads r on r.booking_id = c.booking_id and r.party = 'client'
     where c.sender_role <> 'client'
       and c.sent_at > now() - interval '3 days'
       and (r.last_read_at is null or c.sent_at > r.last_read_at)
     group by c.booking_id
    having min(c.sent_at) < now() - p_delay
  ),
  claimable as (
    select p.*
      from pending p
      left join public.chat_reads r on r.booking_id = p.booking_id and r.party = 'client'
     where r.last_emailed_at is null or r.last_emailed_at < p.first_at
  ),
  claimed as (
    insert into public.chat_reads as r (booking_id, party, last_emailed_at)
    select booking_id, 'client', now() from claimable
    on conflict (booking_id, party) do update set last_emailed_at = now()
    returning r.booking_id
  )
  select k.booking_id, k.unread, last.message, last.sender_role
    from claimable k
    join claimed using (booking_id)
    cross join lateral (
      select c.message, c.sender_role from public.trip_chats c
       where c.booking_id = k.booking_id and c.sender_role <> 'client'
       order by c.sent_at desc limit 1
    ) last;
$$;
revoke all on function public.claim_unread_chat_emails(interval) from public, anon, authenticated;
grant execute on function public.claim_unread_chat_emails(interval) to service_role;

-- ---------------------------------------------------------------------------
-- 6. The language a person last used in our apps or team pages ('es' | 'en'),
--    saved by the server, so pushes to drivers follow it (Spanish when unknown).
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists app_lang text;
alter table public.profiles drop constraint if exists profiles_app_lang_check;
alter table public.profiles add constraint profiles_app_lang_check check (app_lang is null or app_lang in ('es', 'en'));
