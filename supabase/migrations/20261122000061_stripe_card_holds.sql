-- Card payments with Stripe (Jorge, 2026-11-22; replaces Green Pay, PROJECT.md §6.4).
-- The traveller pays on the last booking step. The card is only HELD (authorised), then charged
-- when every ride on the payment has a driver, or 6 days after booking at the latest (a hold
-- lasts 7 days). Cancelled before the charge = the hold is released and nothing is taken.
-- Code: src/lib/stripePayments.ts. Run after 0060. Safe to run once, in order.

-- 1. Providers: 'stripe' = a real card payment. Stripe TEST-mode payments are stored as 'test',
--    like the pre-launch test checkout: no real money, "PRUEBA" chip, left out of the reports.
alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('greenpay', 'stripe', 'test'));
comment on column public.payments.provider is
  'stripe = a real card payment. test = no money moved (pre-launch test checkout, or Stripe test mode). greenpay = never used.';

-- 2. Statuses: 'authorized' = the card is held, not charged yet; 'released' = the hold was let go
--    (cancelled before the charge, or it expired). 'succeeded' = charged.
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('pending', 'authorized', 'succeeded', 'released', 'failed', 'refunded'));

-- 3. One row per booking per Stripe payment: recording the same payment twice (the return page and
--    Stripe's webhook both report it) adds nothing.
create unique index if not exists payments_stripe_once
  on public.payments (booking_id, provider_ref)
  where provider_ref like 'pi\_%';

-- 4. How much of the booking's price is held on the traveller's card right now (not charged yet).
--    amount_paid stays what was really received. Travellers read their own row; drivers can't read
--    booking rows at all (migration 0036).
alter table public.bookings add column if not exists amount_held numeric(10,2) not null default 0
  check (amount_held >= 0);
comment on column public.bookings.amount_held is
  'USD held on the traveller''s card by Stripe and not charged yet (src/lib/stripePayments.ts). Moves to amount_paid when charged; back to 0 when released.';
