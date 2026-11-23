-- New-request messages wait for the card (Jorge, 2026-11-22): when a traveller pays online by card
-- (Stripe), the team's "new trip request" email + push and the traveller's "we got your request"
-- email go out once the card is held, not when the request is saved. If the card isn't held within
-- 30 minutes, the team gets one "unpaid request" alert instead and the traveller their request email
-- (it says how to pay from the trip page). Code: src/lib/requestNotices.ts.
--
-- The messages are prepared when the request is saved and kept here until sent. They hold the
-- traveller's contact details and the team's internal notes, so only the server reads this table:
-- RLS on, no policies (the service role skips RLS). Run after 0061. Safe to run once, in order.

create table if not exists public.trip_request_notices (
  trip_id            uuid primary key references public.trips (id) on delete cascade,
  payload            jsonb not null,
  created_at         timestamptz not null default now(),
  team_sent_at       timestamptz,
  traveller_sent_at  timestamptz,
  unpaid_alert_at    timestamptz
);

alter table public.trip_request_notices enable row level security;
revoke all on public.trip_request_notices from anon, authenticated;

create index if not exists trip_request_notices_waiting_idx
  on public.trip_request_notices (created_at)
  where team_sent_at is null and unpaid_alert_at is null;

comment on table public.trip_request_notices is
  'New-request messages held until the card is held (Stripe) or 30 minutes pass unpaid. Server only.';
