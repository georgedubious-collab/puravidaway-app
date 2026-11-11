-- Pickups at any hour, with a night premium (Jorge, 2026-11-11: "24/7 arrivals. Trips that
-- start from 10pm/4am should charge a 20% premium.").
--
-- The three numbers live next to the other pricing settings and are edited at /admin/pricing:
--   pricing_settings.night_premium_bps   how much more a night ride costs, in basis points
--                                        (2000 = 20%; 0 = no premium; at most 100%);
--   pricing_settings.night_start_hour    first hour of the night window, Costa Rica time (22 = 10 PM);
--   pricing_settings.night_end_hour      first hour that is day again (4 = 4 AM). The window runs
--                                        from the start hour up to, but not including, the end hour
--                                        and may cross midnight; equal hours switch the premium off.
--
-- The price itself is computed by the server (src/lib/pricing.ts, quoteTransfer): the premium is
-- added to the ride only, after the vehicle, area and season; stops, ferries, the Drake Bay
-- boat fee and entrances are not marked up. Each booking keeps what it was charged:
--   bookings.night_premium               USD part of total_price that is the night premium (0 by day,
--                                        on tours, expeditions and custom offers).
--
-- Nothing changes for drivers' access: pricing_settings stays public read / admin write, and
-- the new booking column is a price, so it is not returned by driver_jobs() or my_trips().
-- Run after 0040. Safe to run once, in order.

alter table public.pricing_settings
  add column if not exists night_premium_bps integer not null default 2000
    check (night_premium_bps between 0 and 10000),
  add column if not exists night_start_hour smallint not null default 22
    check (night_start_hour between 0 and 23),
  add column if not exists night_end_hour smallint not null default 4
    check (night_end_hour between 0 and 23);

comment on column public.pricing_settings.night_premium_bps is
  'Night-pickup premium on the ride price in basis points (2000 = 20%, 0 = off). Applied after the season; stops, ferries, boat fees and entrances are not marked up.';
comment on column public.pricing_settings.night_start_hour is
  'First hour (0-23, Costa Rica time) of the night-pickup window. 22 = pickups from 10:00 PM.';
comment on column public.pricing_settings.night_end_hour is
  'First hour (0-23, Costa Rica time) that is day again: the night window ends just before it. 4 = pickups at 4:00 AM are no longer night. Same as the start hour = no night window.';

alter table public.bookings
  add column if not exists night_premium numeric(10,2) not null default 0
    check (night_premium >= 0);
comment on column public.bookings.night_premium is
  'USD part of total_price that is the night-pickup premium (0 when the pickup is by day, and on tours, expeditions and custom offers). Snapshot from the day of booking.';
