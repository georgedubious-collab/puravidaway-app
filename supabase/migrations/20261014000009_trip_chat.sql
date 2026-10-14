-- Trip chat between the traveller, the assigned driver and the PuraVidaWay team.
-- Run after file 8.
--
-- Travellers have no account: their messages are written by the server after it
-- checks the private trip link, so sender_id is empty for them. Drivers and admins
-- write as themselves. Messages are per booking (each ride can have its own driver).

alter table public.trip_chats alter column sender_id drop not null;
alter table public.trip_chats drop constraint if exists trip_chats_sender_check;
alter table public.trip_chats add constraint trip_chats_sender_check
  check (sender_id is not null or sender_role = 'client');

-- No phone numbers, emails or links between travellers and drivers, so trips stay
-- on the platform. The team can share contact details when needed.
create or replace function public.guard_chat_message()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.sender_role in ('client', 'driver') and not public.no_contact_details(new.message) then
    raise exception 'Please keep phone numbers, emails and links out of the chat';
  end if;
  new.sent_at := now();
  return new;
end;
$$;

drop trigger if exists trip_chats_guard on public.trip_chats;
create trigger trip_chats_guard before insert on public.trip_chats
  for each row execute function public.guard_chat_message();

-- When each party last read the chat and was last emailed about it, so new
-- messages send at most one email until they come back and read.
create table if not exists public.chat_reads (
  booking_id      uuid not null references public.bookings (id) on delete cascade,
  party           text not null check (party in ('client', 'driver', 'admin')),
  last_read_at    timestamptz,
  last_emailed_at timestamptz,
  primary key (booking_id, party)
);
alter table public.chat_reads enable row level security;
grant select, insert, update, delete on public.chat_reads to service_role;
-- No policies: only the server (service role) reads and writes this table.

-- ---------------------------------------------------------------------------
-- Traveller contact details and trip links live in their own server-only table.
-- The assigned driver can read their booking row, so anything there is visible
-- to them; the traveller's email, phone and private trip link must not be.
-- ---------------------------------------------------------------------------
create table if not exists public.trips (
  id            uuid primary key,
  access_token  text not null unique check (char_length(access_token) >= 48),
  guest_name    text,
  guest_email   text,
  guest_phone   text,
  created_at    timestamptz not null default now()
);
alter table public.trips enable row level security;
grant select, insert, update, delete on public.trips to service_role;
grant select on public.trips to authenticated;
drop policy if exists trips_admin_read on public.trips;
create policy trips_admin_read on public.trips for select to authenticated using (public.is_admin());

-- Move requests saved before this file (gen_random_uuid is cryptographically random).
insert into public.trips (id, access_token, guest_name, guest_email, guest_phone, created_at)
select distinct on (b.trip_id) b.trip_id,
       replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
       b.guest_name, b.guest_email, b.guest_phone, b.created_at
  from public.bookings b
 where b.trip_id is not null
   and not exists (select 1 from public.trips t where t.id = b.trip_id)
 order by b.trip_id, b.created_at;

alter table public.bookings drop constraint if exists bookings_trip_id_fkey;
alter table public.bookings add constraint bookings_trip_id_fkey
  foreign key (trip_id) references public.trips (id) on delete set null;
alter table public.bookings
  drop column if exists guest_name,
  drop column if exists guest_email,
  drop column if exists guest_phone;

-- ---------------------------------------------------------------------------
-- Abuse limits, applied atomically (two requests at once can't both slip through).
-- Only the server may call these.
-- ---------------------------------------------------------------------------
create table if not exists public.request_log (
  id     bigserial primary key,
  ip     text,
  email  text,
  at     timestamptz not null default now()
);
create index if not exists request_log_at_idx on public.request_log (at);
alter table public.request_log enable row level security;
grant select, insert, delete on public.request_log to service_role;
grant usage on sequence public.request_log_id_seq to service_role;

-- Trip requests: at most 5 an hour from one network and 3 an hour for one email address.
create or replace function public.allow_trip_request(p_ip text, p_email text)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('trip_request'));
  delete from public.request_log where at < now() - interval '1 day';
  if (select count(*) from public.request_log where ip = p_ip and at > now() - interval '1 hour') >= 5
     or (select count(*) from public.request_log where email = lower(p_email) and at > now() - interval '1 hour') >= 3 then
    return false;
  end if;
  insert into public.request_log (ip, email) values (p_ip, lower(p_email));
  return true;
end;
$$;

-- Chat: at most 8 messages a minute from one side of a booking's chat.
create or replace function public.post_chat_message(p_booking uuid, p_sender uuid, p_role text, p_message text)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_booking::text || p_role));
  if (select count(*) from public.trip_chats
       where booking_id = p_booking and sender_role = p_role and sent_at > now() - interval '1 minute') >= 8 then
    raise exception 'Too many messages, please wait a moment';
  end if;
  insert into public.trip_chats (booking_id, sender_id, sender_role, message)
  values (p_booking, p_sender, p_role, p_message)
  returning id into new_id;
  return new_id;
end;
$$;

-- Claim the right to email one party about new messages. True at most once until
-- they read the chat again (or after 30 minutes); never while they're reading it.
create or replace function public.claim_chat_email(p_booking uuid, p_party text)
returns boolean
language sql
set search_path = public
as $$
  insert into public.chat_reads as r (booking_id, party, last_emailed_at)
  values (p_booking, p_party, now())
  on conflict (booking_id, party) do update set last_emailed_at = now()
   where (r.last_read_at is null or r.last_read_at < now() - interval '1 minute')
     and (r.last_emailed_at is null
          or r.last_read_at >= r.last_emailed_at
          or r.last_emailed_at < now() - interval '30 minutes')
  returning true;
$$;

revoke all on function public.allow_trip_request(text, text) from public, anon, authenticated;
revoke all on function public.post_chat_message(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.claim_chat_email(uuid, text) from public, anon, authenticated;
grant execute on function public.allow_trip_request(text, text) to service_role;
grant execute on function public.post_chat_message(uuid, uuid, text, text) to service_role;
grant execute on function public.claim_chat_email(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Contact filter, round 2: allow written dates ("2026-10-20", "20.10.2026"),
-- catch "8888_1234", "8888/1234", "pepe at gmail dot com" and "@handles".
-- ---------------------------------------------------------------------------
create or replace function public.no_contact_details(t text)
returns boolean
language sql
immutable
as $$
  select t is null or not (
    t ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'                          -- email
    or t ~* '(https?://|www\.|\.com\y|\.cr\y|wa\.me|\ydot\s+com\y)'        -- links
    or t ~* '\y(gmail|hotmail|yahoo|outlook|icloud|proton)\y'              -- email providers
    or t ~* '(^|\s)@[a-z0-9_.]{3,}'                                        -- social handles
    or regexp_replace(
         regexp_replace(
           regexp_replace(t, '(19|20)[0-9]{2}\s*[-–]\s*(19|20)[0-9]{2}', '', 'g'),          -- year ranges
           '[0-9]{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2}|[0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4}', '', 'g'), -- dates
         '(?<=[0-9])[ ().+_/,-]+(?=[0-9])', '', 'g') ~ '[0-9]{8,}'           -- phone numbers
  );
$$;
