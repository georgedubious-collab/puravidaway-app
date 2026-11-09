-- Southern Nicoya area + Gulf of Nicoya car ferries (Jorge, 2026-11-09; docs/PRICING.md step 4).
--
-- 1. Ferry fares per crossing (Puntarenas ↔ Paquera / Playa Naranjo), in colones as the
--    ferry company charges them: about ₡15,000 for the vehicle with its driver and ₡1,500
--    per passenger. Converted at crc_per_usd (≈ ₡452, Jorge checks it weekly) when a ride is
--    priced, and added on top of the ride for every ferry on Google's route (not season-adjusted).
-- 2. "SouthNicoya" area factor 1.35 (Santa Teresa, Montezuma, Paquera…), applied when the
--    pickup OR the drop-off is there: ferry queues and the driver's crossing back. Puts
--    SJO → Santa Teresa a few dollars under Daytrip. Lives in hub_pricing next to the towns.
--
-- Run after 0014. Safe to run more than once (never overwrites values edited in /admin).

alter table public.pricing_settings
  add column if not exists ferry_vehicle_fare_crc   integer not null default 15000 check (ferry_vehicle_fare_crc >= 0),
  add column if not exists ferry_passenger_fare_crc integer not null default 1500  check (ferry_passenger_fare_crc >= 0),
  add column if not exists crc_per_usd numeric(8,2) not null default 452 check (crc_per_usd between 100 and 2000);

comment on column public.pricing_settings.ferry_vehicle_fare_crc is
  'Colones per ferry crossing for the vehicle incl. its driver (Gulf of Nicoya).';
comment on column public.pricing_settings.ferry_passenger_fare_crc is
  'Colones per passenger per ferry crossing.';
comment on column public.pricing_settings.crc_per_usd is
  'Colones per US dollar used to convert the ferry fares. Checked about weekly in /admin/pricing.';

-- hub_pricing now holds extra pricing areas as well as our towns.
alter table public.hub_pricing drop constraint if exists hub_pricing_hub_id_check;
alter table public.hub_pricing add constraint hub_pricing_hub_id_check
  check (hub_id in ('SJO','LIR','Arenal','ManuelAntonio','Monteverde','Sierpe','DrakeBay','PuertoViejo','Tamarindo',
                    'SouthNicoya'));
comment on table public.hub_pricing is
  'Area factor per town (applies to rides starting there) and per extra area such as SouthNicoya (applies at either end).';

insert into public.hub_pricing (hub_id, area_factor) values ('SouthNicoya', 1.35)
on conflict (hub_id) do nothing;
