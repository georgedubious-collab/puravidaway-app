-- Fixes for Supabase's security advisor (2026-10-21). Run after file 9.

-- 1. The drivers' list of open requests becomes a function instead of a view.
--    Supabase flags views that run with their owner's rights; a function makes
--    the same rule explicit: approved drivers (and admins) get safe columns only.
drop view if exists public.open_trip_requests;

create or replace function public.open_trip_requests()
returns table (
  id uuid, booking_ref text, service_type text, catalog_item_id text, origin text,
  destination text, sightseeing_stops jsonb, vehicle_class text, lodging_tier text,
  scheduled_at timestamptz, passenger_count int, pricing_mode text, total_price numeric,
  currency text, created_at timestamptz, preferences jsonb, driver_notes text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.booking_ref, b.service_type, b.catalog_item_id, b.origin, b.destination,
         b.sightseeing_stops, b.vehicle_class, b.lodging_tier, b.scheduled_at, b.passenger_count,
         b.pricing_mode, b.total_price, b.currency, b.created_at, b.preferences, b.driver_notes
    from public.bookings b
   where b.status = 'pending_bids'
     and (public.is_approved_driver() or public.is_admin());
$$;

revoke all on function public.open_trip_requests() from public, anon;
grant execute on function public.open_trip_requests() to authenticated;

-- 2. Pin search_path on the remaining helper functions.
alter function public.cr_today() set search_path = public;
alter function public.no_contact_details(text) set search_path = public;
alter function public.touch_updated_at() set search_path = public;
alter function public.touch_booking() set search_path = public;
