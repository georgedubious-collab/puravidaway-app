-- Puerto Jiménez becomes one of our towns (Jorge, 2026-11-12). Run after 0054. Safe to run
-- once, in order (and harmless if run again).
--
-- Puerto Jiménez (Osa Peninsula, the road gateway to Corcovado; small PJM airstrip) joins the
-- town list next to Sierpe and Drake Bay. Its drive times and road km per town pair live in
-- src/lib/catalog.ts (ROUTE_MINUTES / ROUTE_KM), like every other town; the database only needs:
--
--   1. hub_pricing: the new id is allowed, with the Osa area factor (1.15, the same as Sierpe and
--      Drake Bay: drivers are scarce down there). Editable at /admin/pricing like the others.
--   2. drivers.home_hub: a driver can say they are based in Puerto Jiménez, so its jobs show
--      "Starts in your area" and its return trips are matched.
--
-- No new table and no new policy: hub_pricing keeps "public read, admin write", drivers keeps
-- its policies. Season multipliers are untouched (they stay in the seasons table).

-- 1. Area factor ------------------------------------------------------------------------------
alter table public.hub_pricing drop constraint if exists hub_pricing_hub_id_check;
alter table public.hub_pricing add constraint hub_pricing_hub_id_check
  check (hub_id in ('SJO','LIR','Arenal','ManuelAntonio','Monteverde','Sierpe','DrakeBay','PuertoViejo','Tamarindo',
                    'PuertoJimenez','SouthNicoya'));

insert into public.hub_pricing (hub_id, area_factor) values ('PuertoJimenez', 1.15)
on conflict (hub_id) do nothing;

-- 2. Driver home base -------------------------------------------------------------------------
-- The check was written inline in migration 0018, so Postgres named it itself (normally
-- drivers_home_hub_check). Drop whichever check constraint on drivers mentions home_hub, then
-- add it back under a fixed name with the new town.
do $$
declare
  c record;
begin
  for c in
    select con.conname
      from pg_constraint con
     where con.conrelid = 'public.drivers'::regclass
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) like '%home_hub%'
  loop
    execute format('alter table public.drivers drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.drivers add constraint drivers_home_hub_check
  check (home_hub is null or home_hub in ('SJO','LIR','Arenal','ManuelAntonio','Monteverde','Sierpe','DrakeBay',
                                          'PuertoViejo','Tamarindo','PuertoJimenez','SouthNicoya'));
