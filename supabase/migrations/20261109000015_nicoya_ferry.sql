-- Southern Nicoya area + Gulf of Nicoya car ferries (Jorge, 2026-11-09; docs/PRICING.md step 4).
--
-- 1. Ferry fares per crossing (Puntarenas ↔ Paquera / Playa Naranjo): about ₡15,000 for the
--    vehicle with its driver and ₡1,500 per passenger, entered in USD (~₡500 = $1).
--    Added on top of the ride price for every ferry on Google's route, not season-adjusted.
-- 2. "SouthNicoya" area factor 1.25 (Santa Teresa, Montezuma, Paquera…), applied when the
--    pickup OR the drop-off is there: ferry queues and the driver's crossing back. Keeps
--    SJO → Santa Teresa about 15% below Daytrip. Lives in hub_pricing next to the towns.
--
-- Run after 0014. Safe to run more than once (never overwrites values edited in /admin).

alter table public.pricing_settings
  add column if not exists ferry_vehicle_fare   numeric(10,2) not null default 30 check (ferry_vehicle_fare >= 0),
  add column if not exists ferry_passenger_fare numeric(10,2) not null default 3  check (ferry_passenger_fare >= 0);

comment on column public.pricing_settings.ferry_vehicle_fare is
  'USD per ferry crossing for the vehicle incl. its driver (Gulf of Nicoya).';
comment on column public.pricing_settings.ferry_passenger_fare is
  'USD per passenger per ferry crossing.';

-- hub_pricing now holds extra pricing areas as well as our towns.
alter table public.hub_pricing drop constraint if exists hub_pricing_hub_id_check;
alter table public.hub_pricing add constraint hub_pricing_hub_id_check
  check (hub_id in ('SJO','LIR','Arenal','ManuelAntonio','Monteverde','Sierpe','DrakeBay','PuertoViejo','Tamarindo',
                    'SouthNicoya'));
comment on table public.hub_pricing is
  'Area factor per town (applies to rides starting there) and per extra area such as SouthNicoya (applies at either end).';

insert into public.hub_pricing (hub_id, area_factor) values ('SouthNicoya', 1.25)
on conflict (hub_id) do nothing;
