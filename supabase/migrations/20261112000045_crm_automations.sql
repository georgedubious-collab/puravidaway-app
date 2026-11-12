-- Three automatic messages (Jorge, 2026-11-12; docs/PROJECT.md §4.7):
--   1. The day-before reminder, ~24 hours before each confirmed pickup: one to the traveller,
--      one to the assigned driver (src/lib/dayBeforeReminders.ts, /api/cron/trip-reminders).
--   2. An email to our team when a traveller gives 3 stars or less (src/lib/lowRatingAlert.ts).
--   3. One "book your return / a day tour" email the morning after a completed ride
--      (src/lib/tripFollowup.ts, /api/cron/trip-followups). It is promotional, so it carries
--      an unsubscribe link, and anyone who unsubscribes is listed in email_optouts.
--
-- What this file does:
--   1. bookings: four new timestamps, all empty to start with:
--        confirmed_at           when the booking last became "confirmed" (set by a trigger below);
--        reminder_traveller_at  when the traveller's day-before reminder was sent (once);
--        reminder_driver_at     when the driver's day-before reminder was sent (once per driver:
--                               cleared when the team assigns another driver);
--        followup_sent_at       when the "book your return" email was sent or skipped (once).
--   2. driver_reviews.team_alerted_at: when the team was emailed about a low rating (once).
--   3. email_optouts: the email addresses that asked for no promotional emails. Only the server
--      writes it (the unsubscribe page). Admins can read it; travellers, drivers and logged-out
--      visitors cannot see it at all.
-- It changes no existing column, price, policy or function.
-- Run after 0044 (booking_events, in feat/admin-redesign) or, if that is not merged yet, after 0043.
-- Safe to run once, in order.

alter table public.bookings
  add column if not exists confirmed_at          timestamptz,
  add column if not exists reminder_traveller_at timestamptz,
  add column if not exists reminder_driver_at    timestamptz,
  add column if not exists followup_sent_at      timestamptz;

comment on column public.bookings.confirmed_at is
  'When the booking last became confirmed (trigger bookings_stamp_confirmed). Null on bookings confirmed before 2026-11-12.';
comment on column public.bookings.reminder_traveller_at is
  'When the traveller''s day-before reminder was sent (or skipped). Set before sending, so it goes out once.';
comment on column public.bookings.reminder_driver_at is
  'When the assigned driver''s day-before reminder was sent (or skipped). Cleared when another driver is assigned.';
comment on column public.bookings.followup_sent_at is
  'When the "book your return / a day tour" email was sent, or the booking was checked and skipped. Once per booking.';

-- confirmed_at: stamped whenever the status becomes "confirmed". A new driver means a new
-- day-before reminder for that driver (the previous one may have gone to someone else).
create or replace function public.bookings_stamp_confirmed()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    new.confirmed_at := now();
  end if;
  if tg_op = 'UPDATE' and new.assigned_driver_id is distinct from old.assigned_driver_id then
    new.reminder_driver_at := null;
    if new.status = 'confirmed' then
      new.confirmed_at := now();
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_stamp_confirmed on public.bookings;
create trigger bookings_stamp_confirmed
  before insert or update of status, assigned_driver_id on public.bookings
  for each row execute function public.bookings_stamp_confirmed();

alter table public.driver_reviews
  add column if not exists team_alerted_at timestamptz;
comment on column public.driver_reviews.team_alerted_at is
  'When our team was emailed about this rating (3 stars or less). Set before sending, so it goes out once.';

create table if not exists public.email_optouts (
  email       text primary key check (email = lower(btrim(email)) and char_length(email) between 3 and 320),
  -- Only promotional emails can be switched off; booking emails (confirmations, reminders,
  -- rating requests, chat) always go out.
  scope       text not null default 'promotional' check (scope = 'promotional'),
  -- "link": the unsubscribe page; "one_click": the mail app's unsubscribe button; "team": by hand.
  source      text not null default 'link' check (source in ('link', 'one_click', 'team')),
  created_at  timestamptz not null default now()
);
comment on table public.email_optouts is
  'Email addresses that unsubscribed from promotional emails. Written only by the server; readable by admins only.';

alter table public.email_optouts enable row level security;
drop policy if exists email_optouts_admin_read on public.email_optouts;
create policy email_optouts_admin_read on public.email_optouts
  for select to authenticated using (public.is_admin());
revoke all on public.email_optouts from anon, authenticated;
grant select on public.email_optouts to authenticated;
grant select, insert, update, delete on public.email_optouts to service_role;
