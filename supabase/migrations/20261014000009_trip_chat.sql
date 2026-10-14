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
