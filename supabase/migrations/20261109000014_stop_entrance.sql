-- Stop entrance: three choices instead of yes/no (Jorge, 2026-11-09).
--   free     = no ticket at all (e.g. the Tárcoles crocodile bridge, a roadside stop)
--   included = a paid entrance that is part of our stop price
--   gate     = the customer pays the entrance at the gate
-- Cards say "Free stop, no entrance fee" / "Park entrance included" /
-- "Park entrance paid at the gate". Chosen per stop at /admin/pricing.
--
-- Run after 0013. Safe to run more than once. park_fee_included stays and is
-- kept in step by the admin (included = true) so nothing that reads it breaks.

alter table public.sightseeing_stops
  add column if not exists entrance text not null default 'gate'
    check (entrance in ('free', 'included', 'gate'));

-- Carry over anything already ticked "Park fee included".
update public.sightseeing_stops set entrance = 'included'
  where park_fee_included and entrance = 'gate';

-- Tárcoles: a public bridge, nothing to pay.
update public.sightseeing_stops set entrance = 'free', park_fee_included = false
  where id = 'tarcoles';

comment on column public.sightseeing_stops.entrance is
  'free (no ticket) | included (in our stop price) | gate (customer pays there). Replaces park_fee_included.';
