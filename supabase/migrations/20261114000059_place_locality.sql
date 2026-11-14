-- Real town names for typed places on the drivers' job board (Jorge, 2026-11-14;
-- docs/PROJECT.md §4.1, §7.3). Run after 0058. Safe to run once, in order.
--
-- The bug: a typed pickup or drop-off (a hotel, an address) is saved with origin_coords.town /
-- destination_coords.town = its NEAREST pricing town. That is right for pricing and matching but
-- wrong as a label: CRPT-10002, Puntarenas (Paseo de los Turistas) → a hotel in Santa Elena, had
-- Monteverde as the nearest town at both ends, and the job board showed "Monteverde → Monteverde".
--
-- What this file does:
--   1. public.address_locality(text): the town in a Costa Rican address as Google writes it
--      ("…, Provincia de Puntarenas, Puntarenas, Costa Rica" → 'Puntarenas'), or null. Same rules
--      as addressLocality() in src/lib/placeLabel.ts.
--   2. Backfill: every booking end that is a typed place (a Google place id, not 'hub:…') and has
--      no `locality` yet gets one read from its saved address text. `town` is not touched (prices,
--      matching and payouts stay as they are). New bookings get `locality` from the website
--      (Google's address components) from now on.
--   3. driver_jobs() gets two more columns, origin_locality and destination_locality: the typed
--      place's town (null for one of our towns, whose name the apps already show from
--      origin_town). Only a town name, never the address: drivers see no more before they are
--      assigned than a town, as before. my_trips() is unchanged (the assigned driver already gets
--      the full place text and the coords, which now include `locality`).
--
-- No new table, no RLS change. Changing driver_jobs()' columns needs a drop and re-create; its
-- grants are set again below.

-- ---------------------------------------------------------------------------
-- 1. Town from an address
-- ---------------------------------------------------------------------------
create or replace function public.address_locality(p_text text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  parts text[] := '{}';
  p text;
  n int;
  pick text;
begin
  if p_text is null then
    return null;
  end if;
  -- The parts of the address, without the country, postal codes and plus codes ("X5C9+HMQ").
  foreach p in array string_to_array(p_text, ',') loop
    p := btrim(regexp_replace(p, '\s+', ' ', 'g'));
    if p <> '' and p !~* '^costa rica$' and p !~ '^\d{4,6}$'
       and p !~* '^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3}$' then
      parts := parts || p;
    end if;
  end loop;
  n := coalesce(array_length(parts, 1), 0);
  pick := null;
  -- Spanish addresses: the town right after "Provincia de X"; English: right before "X Province".
  for i in reverse n..1 loop
    if parts[i] ~* '^provincia de\s' then
      pick := case when i < n then parts[i + 1] end;
      exit;
    elsif parts[i] ~* '\sprovince$' then
      pick := case when i > 1 then parts[i - 1] end;
      exit;
    elsif i = 1 then
      -- No province: the last part, only when there are two or more (a bare name is not a town).
      pick := case when n >= 2 then parts[n] end;
    end if;
  end loop;
  if pick is null or length(pick) > 40 or pick ~ '\d' or pick ~* '^provincia de\s' or pick ~* '\sprovince$'
     or pick ~* '^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3}$' then
    return null;
  end if;
  return pick;
end;
$$;
comment on function public.address_locality(text) is
  'Town in a Costa Rican address as Google writes it, or null. Mirrors addressLocality() in src/lib/placeLabel.ts. Migration 0059.';

-- ---------------------------------------------------------------------------
-- 2. Backfill (typed places only; `town` unchanged)
-- ---------------------------------------------------------------------------
-- backfill:start
update public.bookings
   set origin_coords = origin_coords || jsonb_build_object('locality', public.address_locality(origin))
 where jsonb_typeof(origin_coords) = 'object'
   and origin_coords ? 'place_id'
   and origin_coords->>'place_id' not like 'hub:%'
   and coalesce(origin_coords->>'locality', '') = ''
   and public.address_locality(origin) is not null;
update public.bookings
   set destination_coords = destination_coords || jsonb_build_object('locality', public.address_locality(destination))
 where jsonb_typeof(destination_coords) = 'object'
   and destination_coords ? 'place_id'
   and destination_coords->>'place_id' not like 'hub:%'
   and coalesce(destination_coords->>'locality', '') = ''
   and public.address_locality(destination) is not null;
-- backfill:end

-- ---------------------------------------------------------------------------
-- 3. Job board: the typed place's town
-- ---------------------------------------------------------------------------
-- Same as migration 0054 plus origin_locality / destination_locality (last two columns). The
-- saved locality, else read from the address (a booking saved by the website just before this
-- change reached it).
drop function if exists public.driver_jobs();
create function public.driver_jobs()
returns table (
  id uuid, booking_ref text, service_type text, catalog_item_id text,
  origin_town text, destination_town text, sightseeing_stops jsonb, vehicle_class text,
  scheduled_at timestamptz, passenger_count int, preferences jsonb, driver_notes text,
  driver_payout numeric, created_at timestamptz,
  my_offer numeric, my_offer_status text, my_offer_id uuid,
  origin_locality text, destination_locality text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.booking_ref, b.service_type, b.catalog_item_id,
         coalesce(b.origin_coords->>'town', b.origin), coalesce(b.destination_coords->>'town', b.destination),
         public.stops_for_driver(b.sightseeing_stops), b.vehicle_class, b.scheduled_at, b.passenger_count,
         b.preferences, b.driver_notes, b.driver_payout, b.created_at,
         o.bid_amount, o.status, o.id,
         case when jsonb_typeof(b.origin_coords) = 'object' and b.origin_coords->>'place_id' not like 'hub:%'
              then coalesce(nullif(btrim(b.origin_coords->>'locality'), ''), public.address_locality(b.origin)) end,
         case when jsonb_typeof(b.destination_coords) = 'object' and b.destination_coords->>'place_id' not like 'hub:%'
              then coalesce(nullif(btrim(b.destination_coords->>'locality'), ''), public.address_locality(b.destination)) end
    from public.bookings b
    left join public.bids o on o.booking_id = b.id and o.driver_id = auth.uid()
   where b.status = 'pending_bids'
     and b.posting_closes_at > now()
     and b.driver_payout is not null
     and b.scheduled_at > now()
     and public.is_approved_driver()
     and not exists (select 1 from public.driver_unavailable u
                      where u.driver_id = auth.uid()
                        and u.day = (b.scheduled_at at time zone 'America/Costa_Rica')::date)
     and ((b.vehicle_class is null and b.passenger_count is null)
          or exists (select 1 from public.driver_vehicles v
                      where v.driver_id = auth.uid()
                        and v.status = 'approved'
                        and public.vehicle_can_serve(v.vehicle_class, b.vehicle_class)
                        and (b.passenger_count is null
                             or coalesce(v.passenger_capacity, 0) >= b.passenger_count)))
   order by b.scheduled_at;
$$;
revoke all on function public.driver_jobs() from public, anon;
grant execute on function public.driver_jobs() to authenticated;
