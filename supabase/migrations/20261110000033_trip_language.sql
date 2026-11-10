-- Language of each trip request (Jorge, 2026-11-10: "Spanish bookings must receive
-- Spanish info for confirmation").
--
-- trips.language is the language the traveller sent the request in: 'en' (website /,
-- customer app in English) or 'es' (website /es, customer app in Spanish). Every
-- email and push notification to the traveller and their private trip page follow it.
-- Trips sent before this file keep 'en', which is what they received.
--
-- The column lives on trips (one row per request; each booking reaches it through
-- bookings.trip_id). Not sensitive, and no policy changes: trips stays readable by
-- admins and the server only. Safe to run once, in order.

alter table public.trips
  add column if not exists language text not null default 'en';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trips_language_check') then
    alter table public.trips
      add constraint trips_language_check check (language in ('en', 'es'));
  end if;
end $$;

comment on column public.trips.language is
  'Language the traveller sent the request in (en | es). Emails, push notifications and the trip page follow it.';
