-- Weekly settlements with drivers (docs/PRICING.md §8; Jorge, 2026-11-09).
--   Paid online: we owe the driver their payout.
--   Cash to the driver: the driver collected the price + cash booking fee from the traveller,
--     so they owe us what they collected minus their payout.
-- The team marks completed trips settled at /admin/payouts; drivers see their balance at
-- /driver/earnings. For cash trips the driver must know how much to collect, so my_trips()
-- now returns cash_to_collect (cash trips only; online prices stay hidden from drivers).
--
-- Run after 0024. Safe to run more than once.

alter table public.bookings
  add column if not exists driver_settled_at timestamptz;
comment on column public.bookings.driver_settled_at is
  'When the team settled this trip with the driver (paid their payout, or received what they owed on a cash trip).';

drop function if exists public.my_trips();
create function public.my_trips()
returns table (
  id uuid, booking_ref text, trip_id uuid, service_type text, catalog_item_id text,
  origin text, destination text, origin_coords jsonb, destination_coords jsonb,
  sightseeing_stops jsonb, vehicle_class text, scheduled_at timestamptz, passenger_count int,
  flight_or_hotel_notes text, preferences jsonb, driver_notes text, status text,
  driver_payout numeric, payment_mode text, cash_fee numeric, assigned_vehicle_id uuid,
  claimed_at timestamptz, created_at timestamptz,
  cash_to_collect numeric, driver_settled_at timestamptz, completed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.booking_ref, b.trip_id, b.service_type, b.catalog_item_id,
         b.origin, b.destination, b.origin_coords, b.destination_coords,
         b.sightseeing_stops, b.vehicle_class, b.scheduled_at, b.passenger_count,
         b.flight_or_hotel_notes, b.preferences, b.driver_notes, b.status,
         b.driver_payout, b.payment_mode, b.cash_fee, b.assigned_vehicle_id,
         b.claimed_at, b.created_at,
         case when b.payment_mode = 'cash_driver' then b.total_price + coalesce(b.cash_fee, 0) - coalesce(b.amount_paid, 0) end,
         b.driver_settled_at, b.completed_at
    from public.bookings b
   where b.assigned_driver_id = auth.uid()
   order by b.scheduled_at;
$$;
revoke all on function public.my_trips() from public, anon;
grant execute on function public.my_trips() to authenticated;
