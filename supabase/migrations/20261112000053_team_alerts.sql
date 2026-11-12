-- Team alerts on the team's phones (CRM part 6, Jorge 2026-11-12; docs/PROJECT.md §4.7, §7.7).
-- The admin site can be added to a phone's home screen and receive Web Push notifications, so the
-- night team hears about a late driver, a trip without a driver, a booking for tonight, a driver
-- who dropped out or a low rating without watching email. Email keeps going as before.
--
-- What this file does:
--   1. admin_push_subscriptions: one row per phone / browser an admin switched alerts on. An admin
--      can add and remove their own rows (through register_admin_push / unregister_admin_push, or
--      directly); nobody can read them through the API, not even admins. The server sends with
--      the service role and deletes rows the push service says are gone (404 / 410).
--   2. admin_alert_prefs: which kinds of alert each admin wants and optional quiet hours (Costa
--      Rica time). No row = everything on, no quiet hours. Own row only, admins only.
--   3. team_alerts: one row per alert sent, keyed by kind + key, so each alert goes out once
--      (two cron runs at the same minute can't both send it). Admins can read it; only the
--      server writes.
--   4. bookings.no_driver_alert_at: when the team was told a trip within 12 hours has no driver
--      (once per booking).
-- It changes no existing row, price or policy.
-- Run after 0052 (promo codes). Safe to run once, in order.

-- 1. Phones that receive alerts ----------------------------------------------------------------
create table if not exists public.admin_push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  admin_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint         text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh           text not null check (char_length(p256dh) between 80 and 100),
  auth             text not null check (char_length(auth) between 16 and 50),
  label            text not null default '' check (char_length(label) <= 80),
  created_at       timestamptz not null default now(),
  last_success_at  timestamptz,
  failures         integer not null default 0 check (failures >= 0)
);
create index if not exists admin_push_subscriptions_admin_idx on public.admin_push_subscriptions (admin_id);
comment on table public.admin_push_subscriptions is
  'Web Push subscriptions of admin phones (team alerts). Admins add / remove their own; nobody reads them through the API; the server sends with the service role.';

alter table public.admin_push_subscriptions enable row level security;
drop policy if exists admin_push_subscriptions_insert_own on public.admin_push_subscriptions;
create policy admin_push_subscriptions_insert_own on public.admin_push_subscriptions
  for insert to authenticated with check (admin_id = auth.uid() and public.is_admin());
drop policy if exists admin_push_subscriptions_delete_own on public.admin_push_subscriptions;
create policy admin_push_subscriptions_delete_own on public.admin_push_subscriptions
  for delete to authenticated using (admin_id = auth.uid());
revoke all on public.admin_push_subscriptions from anon, authenticated;
grant insert, delete on public.admin_push_subscriptions to authenticated;
grant all on public.admin_push_subscriptions to service_role;

-- Switch alerts on for this phone. A phone used before by another admin is handed over (the old
-- owner stops getting its alerts); switching on again refreshes the keys.
create or replace function public.register_admin_push(p_endpoint text, p_p256dh text, p_auth text, p_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the team can receive team alerts.';
  end if;
  insert into public.admin_push_subscriptions (admin_id, endpoint, p256dh, auth, label)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(coalesce(p_label, ''), 80))
  on conflict (endpoint) do update
     set admin_id = excluded.admin_id, p256dh = excluded.p256dh, auth = excluded.auth,
         label = excluded.label, failures = 0;
end;
$$;
revoke all on function public.register_admin_push(text, text, text, text) from public, anon;
grant execute on function public.register_admin_push(text, text, text, text) to authenticated;

-- Switch alerts off for this phone (only the admin's own row).
create or replace function public.unregister_admin_push(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.admin_push_subscriptions where endpoint = p_endpoint and admin_id = auth.uid();
$$;
revoke all on function public.unregister_admin_push(text) from public, anon;
grant execute on function public.unregister_admin_push(text) to authenticated;

-- How many phones the signed-in admin has switched on (for the settings page; no endpoints).
create or replace function public.my_admin_push_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.admin_push_subscriptions where admin_id = auth.uid() and public.is_admin();
$$;
revoke all on function public.my_admin_push_count() from public, anon;
grant execute on function public.my_admin_push_count() to authenticated;

-- 2. What each admin wants ---------------------------------------------------------------------
create table if not exists public.admin_alert_prefs (
  admin_id     uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  muted_kinds  text[] not null default '{}'::text[]
               check (muted_kinds <@ array['late_driver', 'no_location', 'no_driver', 'tonight', 'driver_removed', 'low_rating', 'new_request']::text[]),
  quiet_start  smallint check (quiet_start between 0 and 23),
  quiet_end    smallint check (quiet_end between 0 and 23),
  updated_at   timestamptz not null default now(),
  check ((quiet_start is null) = (quiet_end is null))
);
comment on table public.admin_alert_prefs is
  'Per admin: alert kinds switched off on their phones, and quiet hours (Costa Rica time). No row = all on.';

alter table public.admin_alert_prefs enable row level security;
drop policy if exists admin_alert_prefs_own on public.admin_alert_prefs;
create policy admin_alert_prefs_own on public.admin_alert_prefs
  for all to authenticated
  using (admin_id = auth.uid() and public.is_admin())
  with check (admin_id = auth.uid() and public.is_admin());
revoke all on public.admin_alert_prefs from anon, authenticated;
grant select, insert, update, delete on public.admin_alert_prefs to authenticated;
grant all on public.admin_alert_prefs to service_role;

-- 3. Alerts sent (once each) -------------------------------------------------------------------
create table if not exists public.team_alerts (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('late_driver', 'no_location', 'no_driver', 'tonight', 'driver_removed', 'low_rating', 'new_request', 'test')),
  dedupe_key  text not null check (char_length(dedupe_key) between 1 and 200),
  title       text not null default '' check (char_length(title) <= 120),
  body        text not null default '' check (char_length(body) <= 300),
  url         text not null default '' check (char_length(url) <= 300),
  created_at  timestamptz not null default now(),
  unique (kind, dedupe_key)
);
create index if not exists team_alerts_created_idx on public.team_alerts (created_at desc);
comment on table public.team_alerts is
  'One row per team alert sent (kind + key are unique, so each goes out once). No traveller phone or email. Admins read; the server writes.';

alter table public.team_alerts enable row level security;
drop policy if exists team_alerts_admin_read on public.team_alerts;
create policy team_alerts_admin_read on public.team_alerts
  for select to authenticated using (public.is_admin());
revoke all on public.team_alerts from anon, authenticated;
grant select on public.team_alerts to authenticated;
grant all on public.team_alerts to service_role;

-- 4. "Trip without a driver" once per booking --------------------------------------------------
alter table public.bookings
  add column if not exists no_driver_alert_at timestamptz;
comment on column public.bookings.no_driver_alert_at is
  'When the team was alerted that this pickup is within 12 hours and has no driver (once per booking).';
create index if not exists bookings_no_driver_alert_idx on public.bookings (scheduled_at)
  where assigned_driver_id is null and no_driver_alert_at is null;
