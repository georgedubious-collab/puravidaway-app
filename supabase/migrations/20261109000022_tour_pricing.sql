-- Day tours priced per person, tiered by group size (docs/PRICING.md §7 step 5b; Jorge, 2026-11-09:
-- "tours are not just a drive", priced like his tours on costaricatravelplanner.com, which include
-- the private vehicle, an ICT guide, entrances and lunch, per person: solo / 2–3 / 4–6 travellers).
-- Groups of 7+ pay the 4–6 rate per person. The flat per-group `price` is retired.
-- Starting amounts are guesses from that reference; edit at /admin/pricing.
--
-- Run after 0021. Safe to run more than once (re-running resets the tiers below).

alter table public.day_tours
  add column if not exists price_pp_solo  numeric(10,2) not null default 0 check (price_pp_solo >= 0),
  add column if not exists price_pp_small numeric(10,2) not null default 0 check (price_pp_small >= 0),
  add column if not exists price_pp_group numeric(10,2) not null default 0 check (price_pp_group >= 0);
alter table public.day_tours alter column price drop not null;
comment on column public.day_tours.price is
  'Retired 2026-11-09 (flat price per group). Tours are per person: price_pp_solo / _small (2–3) / _group (4+).';
comment on column public.day_tours.price_pp_solo  is 'USD per person for 1 traveller.';
comment on column public.day_tours.price_pp_small is 'USD per person for 2–3 travellers.';
comment on column public.day_tours.price_pp_group is 'USD per person for 4 or more travellers.';

update public.day_tours set price_pp_solo = 350, price_pp_small = 295, price_pp_group = 275 where id = 'dt1';
update public.day_tours set price_pp_solo = 330, price_pp_small = 280, price_pp_group = 260 where id = 'dt2';
update public.day_tours set price_pp_solo = 375, price_pp_small = 300, price_pp_group = 275 where id = 'dt3';
update public.day_tours set price_pp_solo = 280, price_pp_small = 230, price_pp_group = 210 where id = 'dt4';
