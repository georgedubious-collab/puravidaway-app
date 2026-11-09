-- The brand was renamed from PuraVidaWay to Costa Rica Private Transfers (Jorge, 2026-11-09).
-- New booking references start with CRPT- instead of PVW-. Existing bookings keep theirs.
-- Run after 0026. Safe to run more than once.

alter table public.bookings
  alter column booking_ref set default ('CRPT-' || nextval('public.booking_ref_seq'));
