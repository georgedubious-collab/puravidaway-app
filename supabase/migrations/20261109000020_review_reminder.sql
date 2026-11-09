-- One follow-up email when a traveller hasn't rated their driver a few days after
-- the first request (Jorge, 2026-11-09). Sent by the daily job
-- /api/cron/review-reminders (vercel.json). Run after 0019. Safe to run more than once.

alter table public.bookings
  add column if not exists review_reminded_at timestamptz;
comment on column public.bookings.review_reminded_at is
  'When the one follow-up "please rate your driver" email was sent (3+ days after the first, if still unrated).';
