-- CRM part 3 (Jorge, 2026-11-12; docs/PROJECT.md §4.2, §7.3, §7.7):
--   customer profiles, cancellations and refunds by the policy, and a few new kinds of entries
--   in the change history. Team only: travellers, drivers and visitors read none of it.
--
-- What this file does:
--   1. customer_key(email, phone, trip): how bookings are grouped into one customer. Travellers
--      have no accounts, so a customer is their email (lower-case, trimmed); with no email, their
--      phone digits ("tel:50688881234"); with neither, the single trip ("trip:<id>").
--   2. customer_notes: the team's tags (e.g. "VIP") and private note about one customer, keyed by
--      customer_key; who changed it last and when are set by the database, and every change is
--      kept in customer_note_events. Admins read and write; nobody else sees either table.
--   3. admin_customers(): the customers list (search, sort, pages of 25, or everything for the
--      CSV) computed from trips + bookings + ratings, so nothing is copied. admin_customer_trips()
--      returns one customer's trips. Both return nothing unless the caller is an admin.
--   4. booking_refunds: one row per cancelled booking: who cancelled (traveller / us / the driver /
--      weather, road or park closure), when the traveller asked, the amount received, the refund
--      the policy gives and the rule that applied, the refund owed (the team may change it, with a
--      reason), and "refund paid" (amount, date, method: card / SINPE / transfer / cash).
--      It is its own admin-only table and NOT columns on bookings: a traveller who is signed in can
--      read their own booking rows, and the team's reason must stay internal (the same reason
--      booking_admin_notes is separate, migration 0007). Drivers read no booking rows either way.
--   5. cancel_booking(): cancels a booking and records its refund row in one step (admins only).
--   6. booking_events: new kinds of entries: 'cancellation' and 'refund' / 'refund_paid' (written
--      by a trigger on booking_refunds), 'driver_removed' (the team removed or replaced the
--      assigned driver, and why), 'whatsapp_opened' (a one-tap WhatsApp message was opened) and
--      'notified' (who was emailed about a cancellation). The last three are written by the server.
-- It changes no existing row, price or policy.
-- Run after 0048 (vehicle_photo_minimum). Safe to run once, in order.

-- 1. Customer key ------------------------------------------------------------------------------
create or replace function public.customer_key(p_email text, p_phone text, p_trip uuid)
returns text
language sql
immutable
set search_path = public
as $$
  select case
           when nullif(btrim(coalesce(p_email, '')), '') is not null then lower(btrim(p_email))
           when nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '') is not null
             then 'tel:' || regexp_replace(p_phone, '\D', '', 'g')
           else 'trip:' || coalesce(p_trip::text, '')
         end;
$$;
revoke all on function public.customer_key(text, text, uuid) from public, anon;
grant execute on function public.customer_key(text, text, uuid) to authenticated, service_role;

-- 2. Team tags and notes -----------------------------------------------------------------------
create table if not exists public.customer_notes (
  customer_key  text primary key
                check (customer_key = lower(btrim(customer_key)) and char_length(customer_key) between 3 and 340),
  tags          text[] not null default '{}'::text[] check (cardinality(tags) <= 12),
  note          text not null default '' check (char_length(note) <= 4000),
  updated_by    uuid references public.profiles (id) on delete set null,
  updated_at    timestamptz not null default now()
);
comment on table public.customer_notes is
  'Team-only tags and private note per customer (customer_key). Admins read and write; never shown to travellers or drivers.';

create table if not exists public.customer_note_events (
  id            uuid primary key default gen_random_uuid(),
  customer_key  text not null,
  at            timestamptz not null default now(),
  actor_id      uuid references public.profiles (id) on delete set null,
  before        jsonb not null default '{}'::jsonb,
  after         jsonb not null default '{}'::jsonb
);
create index if not exists customer_note_events_key_idx on public.customer_note_events (customer_key, at desc);

alter table public.customer_notes enable row level security;
alter table public.customer_note_events enable row level security;
revoke all on public.customer_notes from anon, authenticated;
revoke all on public.customer_note_events from anon, authenticated;
grant select, insert, update, delete on public.customer_notes to authenticated;
grant select on public.customer_note_events to authenticated;
grant select, insert, update, delete on public.customer_notes to service_role;
grant select, insert on public.customer_note_events to service_role;
drop policy if exists customer_notes_admin on public.customer_notes;
create policy customer_notes_admin on public.customer_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists customer_note_events_admin_read on public.customer_note_events;
create policy customer_note_events_admin_read on public.customer_note_events
  for select to authenticated using (public.is_admin());

-- Who changed it and when are set here, never taken from the page.
create or replace function public.customer_notes_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_by := public.booking_event_actor();
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.customer_notes_stamp() from public, anon, authenticated;
drop trigger if exists customer_notes_stamp on public.customer_notes;
create trigger customer_notes_stamp
  before insert or update on public.customer_notes
  for each row execute function public.customer_notes_stamp();

create or replace function public.customer_notes_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.tags is distinct from old.tags or new.note is distinct from old.note then
    insert into public.customer_note_events (customer_key, actor_id, before, after)
    values (new.customer_key, public.booking_event_actor(),
            case when tg_op = 'UPDATE' then jsonb_build_object('tags', old.tags, 'note', left(old.note, 300)) else '{}'::jsonb end,
            jsonb_build_object('tags', new.tags, 'note', left(new.note, 300)));
  end if;
  return null;
end;
$$;
revoke execute on function public.customer_notes_log() from public, anon, authenticated;
drop trigger if exists customer_notes_log on public.customer_notes;
create trigger customer_notes_log
  after insert or update on public.customer_notes
  for each row execute function public.customer_notes_log();

-- 3. The customers list ------------------------------------------------------------------------
-- total_spent = amount received on bookings that are not cancelled and were not paid through the
-- pre-launch test checkout. Trips = pickups of bookings that are not cancelled.
create or replace function public.admin_customers(
  p_q      text default null,
  p_key    text default null,
  p_sort   text default 'last',
  p_limit  int  default 25,
  p_offset int  default 0
)
returns table (
  customer_key text, name text, email text, phone text, language text,
  bookings int, completed int, cancelled int, total_spent numeric,
  first_trip timestamptz, last_trip timestamptz, avg_rating numeric, ratings int,
  tags text[], vip boolean, total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with tb as (
    select public.customer_key(t.guest_email, t.guest_phone, t.id) as k,
           t.guest_name, t.guest_email, t.guest_phone, t.language as lang, t.created_at as t_at,
           b.id as bid, b.status, b.amount_paid, b.scheduled_at,
           exists (select 1 from public.payments p where p.booking_id = b.id and p.provider = 'test') as is_test
      from public.trips t
      join public.bookings b on b.trip_id = t.id
     where public.is_admin()
  ),
  agg as (
    select tb.k,
           (array_agg(tb.guest_name order by tb.t_at desc) filter (where nullif(btrim(tb.guest_name), '') is not null))[1] as name,
           (array_agg(lower(btrim(tb.guest_email)) order by tb.t_at desc) filter (where nullif(btrim(tb.guest_email), '') is not null))[1] as email,
           (array_agg(tb.guest_phone order by tb.t_at desc) filter (where nullif(btrim(tb.guest_phone), '') is not null))[1] as phone,
           (array_agg(tb.lang order by tb.t_at desc))[1] as lang,
           count(*)::int as bookings,
           count(*) filter (where tb.status = 'completed')::int as completed,
           count(*) filter (where tb.status = 'cancelled')::int as cancelled,
           coalesce(sum(tb.amount_paid) filter (where tb.status <> 'cancelled' and not tb.is_test), 0)::numeric(12,2) as total_spent,
           min(tb.scheduled_at) filter (where tb.status <> 'cancelled') as first_trip,
           max(tb.scheduled_at) filter (where tb.status <> 'cancelled') as last_trip
      from tb
     group by tb.k
  ),
  rated as (
    select tb.k, round(avg(r.stars)::numeric, 2) as avg_rating, count(*)::int as ratings
      from tb join public.driver_reviews r on r.booking_id = tb.bid
     group by tb.k
  ),
  q as (
    select nullif(btrim(coalesce(p_q, '')), '') as text,
           nullif(regexp_replace(coalesce(p_q, ''), '\D', '', 'g'), '') as digits
  )
  select a.k, a.name, a.email, a.phone, a.lang,
         a.bookings, a.completed, a.cancelled, a.total_spent,
         a.first_trip, a.last_trip, r.avg_rating, coalesce(r.ratings, 0),
         coalesce(n.tags, '{}'::text[]),
         exists (select 1 from unnest(coalesce(n.tags, '{}'::text[])) x where lower(x) = 'vip'),
         count(*) over ()
    from agg a
    left join rated r on r.k = a.k
    left join public.customer_notes n on n.customer_key = a.k
    cross join q
   where (p_key is null or a.k = p_key)
     and (q.text is null
          or a.name ilike '%' || q.text || '%'
          or a.email ilike '%' || q.text || '%'
          or a.phone ilike '%' || q.text || '%'
          or (q.digits is not null and char_length(q.digits) >= 4
              and regexp_replace(coalesce(a.phone, ''), '\D', '', 'g') like '%' || q.digits || '%')
          or exists (select 1 from unnest(coalesce(n.tags, '{}'::text[])) x where lower(x) = lower(q.text)))
   order by case when p_sort = 'spent' then a.total_spent end desc nulls last,
            a.last_trip desc nulls last,
            a.k
   limit case when p_limit is null or p_limit <= 0 then null else least(p_limit, 20000) end
  offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke all on function public.admin_customers(text, text, text, int, int) from public, anon;
grant execute on function public.admin_customers(text, text, text, int, int) to authenticated, service_role;

create or replace function public.admin_customer_trips(p_key text)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id from public.trips t
   where public.is_admin() and public.customer_key(t.guest_email, t.guest_phone, t.id) = p_key;
$$;
revoke all on function public.admin_customer_trips(text) from public, anon;
grant execute on function public.admin_customer_trips(text) to authenticated, service_role;

-- 6 (first, the refund trigger writes these). New kinds of history entries --------------------
alter table public.booking_events drop constraint if exists booking_events_action_check;
alter table public.booking_events add constraint booking_events_action_check check (action in (
  'status', 'assignment', 'amount_paid', 'price', 'payout', 'payment_mode',
  'schedule', 'settled', 'sign', 'notes', 'created_by_team', 'trip_link_emailed',
  'cancellation', 'refund', 'refund_paid', 'driver_removed', 'whatsapp_opened', 'notified'));

-- 4. Refunds -----------------------------------------------------------------------------------
create table if not exists public.booking_refunds (
  booking_id      uuid primary key references public.bookings (id) on delete cascade,
  cancelled_by    text not null check (cancelled_by in ('traveller', 'team', 'driver', 'weather')),
  cancelled_at    timestamptz not null default now(),
  -- When the traveller's message arrived (their cancellations; the policy counts from it).
  asked_at        timestamptz,
  hours_before    numeric(8,2),
  amount_received numeric(10,2) not null default 0 check (amount_received >= 0),
  refund_policy   numeric(10,2) not null check (refund_policy >= 0),
  refund_rule     text not null check (refund_rule in ('free_24h', 'late_or_no_show', 'we_cancelled', 'weather')),
  refund_due      numeric(10,2) not null check (refund_due >= 0 and refund_due <= amount_received),
  refund_reason   text check (refund_reason is null or char_length(refund_reason) between 3 and 500),
  refund_paid_amount numeric(10,2) check (refund_paid_amount is null or refund_paid_amount > 0),
  refund_paid_on  date,
  refund_method   text check (refund_method is null or refund_method in ('card', 'sinpe', 'transfer', 'cash')),
  created_by      uuid references public.profiles (id) on delete set null,
  updated_at      timestamptz not null default now(),
  -- A refund that differs from the policy needs the team's reason.
  constraint booking_refunds_reason_when_changed check (refund_due = refund_policy or refund_reason is not null),
  -- "Refund paid" is all three or nothing.
  constraint booking_refunds_paid_complete check (
    (refund_paid_amount is null and refund_paid_on is null and refund_method is null)
    or (refund_paid_amount is not null and refund_paid_on is not null and refund_method is not null))
);
comment on table public.booking_refunds is
  'Cancellation and refund of one booking (who cancelled, the policy refund and rule, the refund owed, refund paid). Admins only.';

alter table public.booking_refunds enable row level security;
revoke all on public.booking_refunds from anon, authenticated;
grant select, insert, update on public.booking_refunds to authenticated;
grant select, insert, update, delete on public.booking_refunds to service_role;
drop policy if exists booking_refunds_admin on public.booking_refunds;
create policy booking_refunds_admin on public.booking_refunds
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.booking_refunds_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who uuid := public.booking_event_actor();
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := who;
    insert into public.booking_events (booking_id, actor_id, action, after)
    values (new.booking_id, who, 'cancellation', jsonb_build_object(
      'cancelled_by', new.cancelled_by, 'asked_at', new.asked_at, 'hours_before', new.hours_before,
      'amount_received', new.amount_received, 'refund_policy', new.refund_policy,
      'refund_rule', new.refund_rule, 'refund_due', new.refund_due, 'refund_reason', new.refund_reason));
    return new;
  end if;
  if new.refund_due is distinct from old.refund_due or new.refund_reason is distinct from old.refund_reason then
    insert into public.booking_events (booking_id, actor_id, action, before, after)
    values (new.booking_id, who, 'refund',
            jsonb_build_object('refund_due', old.refund_due, 'refund_reason', old.refund_reason),
            jsonb_build_object('refund_due', new.refund_due, 'refund_reason', new.refund_reason));
  end if;
  if new.refund_paid_amount is distinct from old.refund_paid_amount
     or new.refund_paid_on is distinct from old.refund_paid_on
     or new.refund_method is distinct from old.refund_method then
    insert into public.booking_events (booking_id, actor_id, action, before, after)
    values (new.booking_id, who, 'refund_paid',
            jsonb_build_object('amount', old.refund_paid_amount, 'on', old.refund_paid_on, 'method', old.refund_method),
            jsonb_build_object('amount', new.refund_paid_amount, 'on', new.refund_paid_on, 'method', new.refund_method));
  end if;
  return new;
end;
$$;
revoke execute on function public.booking_refunds_log() from public, anon, authenticated;
drop trigger if exists booking_refunds_log on public.booking_refunds;
create trigger booking_refunds_log
  before insert or update on public.booking_refunds
  for each row execute function public.booking_refunds_log();

-- 5. Cancel + refund row in one step. Runs as the caller, so the admin-only rules above apply.
create or replace function public.cancel_booking(
  p_booking      uuid,
  p_by           text,
  p_asked_at     timestamptz,
  p_hours_before numeric,
  p_policy       numeric,
  p_rule         text,
  p_due          numeric,
  p_reason       text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  received numeric;
begin
  if not public.is_admin() then
    raise exception 'Only the team can cancel a booking.' using errcode = '42501';
  end if;
  select coalesce(amount_paid, 0) into received
    from public.bookings where id = p_booking and status <> 'cancelled' for update;
  if not found then
    raise exception 'This booking is already cancelled or does not exist.';
  end if;
  update public.bookings set status = 'cancelled' where id = p_booking;
  insert into public.booking_refunds (booking_id, cancelled_by, asked_at, hours_before, amount_received,
                                      refund_policy, refund_rule, refund_due, refund_reason)
  values (p_booking, p_by, p_asked_at, p_hours_before, received,
          least(p_policy, received), p_rule, p_due, nullif(btrim(coalesce(p_reason, '')), ''))
  on conflict (booking_id) do update
     set cancelled_by = excluded.cancelled_by, cancelled_at = now(), asked_at = excluded.asked_at,
         hours_before = excluded.hours_before, amount_received = excluded.amount_received,
         refund_policy = excluded.refund_policy, refund_rule = excluded.refund_rule,
         refund_due = excluded.refund_due, refund_reason = excluded.refund_reason;
end;
$$;
revoke all on function public.cancel_booking(uuid, text, timestamptz, numeric, numeric, text, numeric, text) from public, anon;
grant execute on function public.cancel_booking(uuid, text, timestamptz, numeric, numeric, text, numeric, text) to authenticated;
