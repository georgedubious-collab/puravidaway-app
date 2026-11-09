-- Driver payout on tours is 80% of the NET (Jorge, 2026-11-09): the company pays the lunch,
-- park tickets, activities and the like, so those costs come off the price before the
-- driver's share is worked out.
--
--   payout = (price − ferry pass-throughs − company-paid costs) × (1 − commission) + ferry pass-throughs
--
-- Day tours: cost_pp = what the company pays per traveller (starting guesses to confirm at
-- /admin/pricing). Ride stops: the per-person tour part (tour_price_pp) is treated as
-- company-paid in full; the driver earns on the driving and waiting part.
-- Each booking records the costs deducted (company_costs).
--
-- Run after 0022. Safe to run more than once (re-running resets the costs below).

alter table public.day_tours
  add column if not exists cost_pp numeric(10,2) not null default 0 check (cost_pp >= 0);
comment on column public.day_tours.cost_pp is
  'USD per traveller the company pays for this tour (entrances, lunch, activities). Deducted before the driver''s share.';

update public.day_tours set cost_pp = 95  where id = 'dt1';  -- park + waterfall + hot springs + lunch
update public.day_tours set cost_pp = 110 where id = 'dt2';  -- park ticket + catamaran (lunch on board)
update public.day_tours set cost_pp = 140 where id = 'dt3';  -- boat, Caño Island fee, snorkel gear, lunch
update public.day_tours set cost_pp = 125 where id = 'dt4';  -- bridges + zipline + night walk + lunch

alter table public.bookings
  add column if not exists company_costs numeric(10,2) not null default 0 check (company_costs >= 0);
comment on column public.bookings.company_costs is
  'USD of entrances, lunch and activities the company pays on this booking; deducted before the driver''s share. platform_fee still includes it (total − driver_payout).';
