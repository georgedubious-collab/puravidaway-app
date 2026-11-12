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
--      writes it (the unsubscribe page, and the "Don't send me suggestions after my trip" tickbox
--      when booking: source 'booking'). Admins can read it; travellers, drivers and logged-out
--      visitors cannot see it at all.
--   4. bookings.pickup_place: where a DAY TOUR picks the travellers up (their hotel or address),
--      typed when booking. Up to 120 characters, one line, no phone numbers, emails or links.
--      Null on rides (they have origin) and on older tour bookings.
--   5. my_trips(): the definition from migration 0040 (the newest) plus `pickup_place` as a new
--      LAST column, so the assigned driver sees where to pick up a tour; older driver app builds
--      keep working. The job board (driver_jobs / open_trip_requests) does NOT get it: drivers
--      browsing open jobs see towns only, as before.
-- It changes no other column, price or policy.
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
  -- "link": the unsubscribe page; "one_click": the mail app's unsubscribe button; "team": by hand;
  -- "booking": the "Don't send me suggestions after my trip" tickbox when booking.
  source      text not null default 'link' check (source in ('link', 'one_click', 'team', 'booking')),
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

-- Day-tour pickup place (Jorge, 2026-11-12): the hotel or address the traveller types when
-- booking a tour. Refused (not hidden) when it has a phone number, email or link, like the
-- name sign; the server gives a readable message first (src/lib/tripRequest.ts).
alter table public.bookings
  add column if not exists pickup_place text;
alter table public.bookings
  add constraint bookings_pickup_place_shape check (
    pickup_place is null
    or (
      char_length(pickup_place) between 1 and 120
      and pickup_place = btrim(pickup_place)
      and pickup_place !~ '[[:cntrl:]]'
      and public.no_contact_details(pickup_place)
    )
  );
comment on column public.bookings.pickup_place is
  'Day tours: the hotel or address to pick the travellers up (max 120 characters, no contact details). Null on rides and older tours.';

-- my_trips(): the definition from migration 0040 (the newest) plus `pickup_place` as a new last
-- column. The return columns change, so the function is dropped and created again.
drop function if exists public.my_trips();
create function public.my_trips()
returns table (
  id uuid, booking_ref text, trip_id uuid, service_type text, catalog_item_id text,
  origin text, destination text, origin_coords jsonb, destination_coords jsonb,
  sightseeing_stops jsonb, vehicle_class text, scheduled_at timestamptz, passenger_count int,
  flight_or_hotel_notes text, preferences jsonb, driver_notes text, status text,
  driver_payout numeric, payment_mode text, cash_fee numeric, assigned_vehicle_id uuid,
  claimed_at timestamptz, created_at timestamptz,
  cash_to_collect numeric, driver_settled_at timestamptz, completed_at timestamptz,
  en_route_at timestamptz,
  passenger_name text, luggage_count smallint, arrive_at timestamptz,
  carry_on_count smallint,
  sign_text text,
  pickup_place text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.booking_ref, b.trip_id, b.service_type, b.catalog_item_id,
         b.origin, b.destination, b.origin_coords, b.destination_coords,
         public.stops_for_driver(b.sightseeing_stops), b.vehicle_class, b.scheduled_at, b.passenger_count,
         b.flight_or_hotel_notes, b.preferences, b.driver_notes, b.status,
         b.driver_payout, b.payment_mode, b.cash_fee, b.assigned_vehicle_id,
         b.claimed_at, b.created_at,
         case when b.payment_mode = 'cash_driver' then b.total_price + coalesce(b.cash_fee, 0) - coalesce(b.amount_paid, 0) end,
         b.driver_settled_at, b.completed_at, b.en_route_at,
         public.passenger_short_name(t.guest_name),
         b.luggage_count,
         case
           when b.service_type = 'transfer' and b.drive_minutes is not null and b.scheduled_at is not null then
             coalesce(b.started_at, b.scheduled_at) + make_interval(mins => (b.drive_minutes + coalesce((
               select sum(s.duration_min + s.detour_min)
                 from jsonb_array_elements(case when jsonb_typeof(b.sightseeing_stops) = 'array' then b.sightseeing_stops else '[]'::jsonb end) e
                 join public.sightseeing_stops s on s.id = e ->> 'id'
             ), 0))::int)
         end,
         b.carry_on_count,
         public.pickup_sign(b.sign_text, b.sign_hide_name, t.guest_name),
         b.pickup_place
    from public.bookings b
    left join public.trips t on t.id = b.trip_id
   where b.assigned_driver_id = auth.uid()
   order by b.scheduled_at;
$$;
revoke all on function public.my_trips() from public, anon;
grant execute on function public.my_trips() to authenticated;
