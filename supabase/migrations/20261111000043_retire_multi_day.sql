-- Retire multi-day trips (Jorge, 2026-11-11: "just keep it for transfers and single day tours").
--
-- The product is now private transfers + 1-day tours only. Nothing is deleted:
-- the expeditions and lodging_tiers tables, their rows, and the bookings columns
-- (service_type 'expedition', lodging_tier, catalog_item_id) all stay, so any earlier
-- booking, payment or accounting record keeps everything it points to.
--
-- What this file does:
--   1. Marks every multi-day trip (public.expeditions) inactive.
--   2. Marks every lodging tier (public.lodging_tiers) inactive. They only ever applied to
--      multi-day trips (expedition_id null = "all multi-day trips").
--   3. Replaces the "everyone reads active rows" policy on both tables with "admins only",
--      so a logged-out visitor, a traveller or a driver can never read them again, even if a
--      row were switched back on by mistake. Admins still read them (/admin/pricing shows them
--      as "Retired", read-only).
--   4. Removes the logged-out visitor's (anon) read grant on both tables.
-- It does not touch bookings, payments, prices of rides or tours, or any other table.
-- Run after 0042. Safe to run once, in order.

update public.expeditions set active = false where active;
update public.lodging_tiers set active = false where active;

drop policy if exists expeditions_public_read on public.expeditions;
drop policy if exists lodging_tiers_public_read on public.lodging_tiers;

create policy expeditions_admin_read on public.expeditions
  for select to authenticated using (public.is_admin());
create policy lodging_tiers_admin_read on public.lodging_tiers
  for select to authenticated using (public.is_admin());

revoke select on public.expeditions, public.lodging_tiers from anon;

comment on table public.expeditions is
  'Retired 2026-11-11: multi-day trips are no longer sold (migration 0043). Rows kept, inactive, for earlier bookings; readable by admins only.';
comment on table public.lodging_tiers is
  'Retired 2026-11-11 with the multi-day trips (migration 0043). Rows kept, inactive, for earlier bookings; readable by admins only.';
