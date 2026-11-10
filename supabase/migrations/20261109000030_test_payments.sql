-- Test checkout for the traveller app (Jorge, 2026-11-09: "dummy checkout for now").
-- Payment rows may be marked provider = 'test': no card, no money, recorded only while the
-- site is in its pre-launch state (src/lib/testCheckout.ts). Real payments stay 'greenpay'.
-- Run after 0029. Safe to run more than once.

alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('greenpay', 'test'));
comment on column public.payments.provider is
  'greenpay = a real card payment. test = the pre-launch test checkout; no money was charged.';
