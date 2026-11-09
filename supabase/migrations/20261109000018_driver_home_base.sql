-- Where each driver is based (Jorge, 2026-11-09): to give priority to drivers near a
-- job's pickup (a La Fortuna → SJO ride goes to San Carlos drivers first) and to
-- spot return trips (a driver dropping off in La Fortuna at 11:00 is the natural
-- choice for a La Fortuna → SJO ride at 14:00). One of our towns / areas; the driver
-- picks it in their profile. Changing it never sends the driver back to review.
--
-- Run after 0017. Safe to run more than once.

alter table public.drivers
  add column if not exists home_hub text
    check (home_hub is null or home_hub in ('SJO','LIR','Arenal','ManuelAntonio','Monteverde','Sierpe','DrakeBay','PuertoViejo','Tamarindo','SouthNicoya'));
comment on column public.drivers.home_hub is
  'Town / area the driver is based in (hub id, or SouthNicoya). Used to rank offers and suggest return trips.';
