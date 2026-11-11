-- Name sign at the pickup (Jorge, 2026-11-11): the driver waits with a sign, and the traveller
-- may choose what it says.
--
--   bookings.sign_text       what the traveller asked us to write (up to 40 characters, one line,
--                            no phone numbers, emails or links). NULL = they wrote nothing.
--   bookings.sign_hide_name  true = "Don't show my name": the sign shows our brand name instead.
--                            Never true together with a sign_text.
--
-- What the driver's sign says (one rule, in pickup_sign()):
--   1. the traveller's own text, if they wrote one;
--   2. else, if they chose "Don't show my name": "Costa Rica Private Transfers";
--   3. else their first name + last initial ("Emily R.", passenger_short_name(), migration 0035),
--      or the brand name when the name they gave has no letters.
--
-- Drivers get that ONE computed value as the new LAST column of my_trips() (`sign_text`), so
-- driver app builds from before this file keep working. They still never get the traveller's
-- full name, phone or email, and still read 0 rows from bookings.
-- Run after 0039. Safe to run once, in order.

alter table public.bookings
  add column if not exists sign_text text,
  add column if not exists sign_hide_name boolean not null default false;

alter table public.bookings
  add constraint bookings_sign_text_shape check (
    sign_text is null
    or (char_length(sign_text) between 1 and 40 and sign_text = btrim(sign_text) and sign_text !~ '[[:cntrl:]]')
  ),
  add constraint bookings_sign_one_choice check (not (sign_hide_name and sign_text is not null));

comment on column public.bookings.sign_text is
  'What the traveller asked us to write on the driver''s name sign (max 40 characters, no contact details). Null = nothing written: see pickup_sign().';
comment on column public.bookings.sign_hide_name is
  'True = the traveller chose "Don''t show my name": the sign shows the brand name. Never true together with sign_text.';

-- The sign is held up in public: a phone number, email or link is refused (not hidden, as in
-- notes: "[hidden]" on a sign would help nobody). Same rule as driver notes and reviews.
create or replace function public.bookings_guard_sign()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.sign_text is not null and not public.no_contact_details(new.sign_text) then
    raise exception 'The name sign cannot show phone numbers, emails or links.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_guard_sign on public.bookings;
create trigger bookings_guard_sign
  before insert or update of sign_text on public.bookings
  for each row execute function public.bookings_guard_sign();

-- The one rule for what the sign says.
create or replace function public.pickup_sign(p_sign_text text, p_hide_name boolean, p_guest_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
           when nullif(btrim(coalesce(p_sign_text, '')), '') is not null then btrim(p_sign_text)
           when coalesce(p_hide_name, false) then 'Costa Rica Private Transfers'
           else coalesce(public.passenger_short_name(p_guest_name), 'Costa Rica Private Transfers')
         end;
$$;
revoke all on function public.pickup_sign(text, boolean, text) from public, anon;

-- my_trips(): the definition from migration 0037 (the newest) plus `sign_text` as a new last
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
  sign_text text
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
         public.pickup_sign(b.sign_text, b.sign_hide_name, t.guest_name)
    from public.bookings b
    left join public.trips t on t.id = b.trip_id
   where b.assigned_driver_id = auth.uid()
   order by b.scheduled_at;
$$;
revoke all on function public.my_trips() from public, anon;
grant execute on function public.my_trips() to authenticated;
