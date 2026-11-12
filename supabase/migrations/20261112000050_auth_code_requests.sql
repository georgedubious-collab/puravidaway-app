-- Sign-in codes are sent by our own server only (2026-11-12, after bot sign-ups).
--
-- Until now the website and both apps asked Supabase directly to email a sign-in code, with
-- "create the account if it doesn't exist". Anyone (or a bot) could do that for any address,
-- which created junk accounts and sent unwanted emails to strangers. Now one server endpoint
-- (src/app/api/auth/send-code, rules in src/lib/authCode.ts) decides who may get a code and
-- whether an account may be created, and Supabase's public sign-up switch is turned off.
--
-- What this file does:
--   1. public.auth_code_requests: one row per code we agreed to send (email, network address,
--      time), kept for a day. Row-level security on and NO policies: browsers and apps can't
--      read or write it; only the server (service role) uses it.
--   2. public.allow_auth_code(): the rate limit, checked and recorded in one step so two
--      requests at the same moment can't both slip through. The limits themselves are named
--      constants in src/lib/authCode.ts and passed in.
--   3. public.auth_email_status(): for one email, whether an account exists (and is confirmed)
--      and whether any trip was booked with it. Server only.
--
-- Run after 0049. Safe to run once, in order. It changes no existing rows.

create table if not exists public.auth_code_requests (
  id     bigserial primary key,
  ip     text not null,
  email  text not null,
  at     timestamptz not null default now()
);
create index if not exists auth_code_requests_email_idx on public.auth_code_requests (email, at);
create index if not exists auth_code_requests_ip_idx on public.auth_code_requests (ip, at);
comment on table public.auth_code_requests is
  'Sign-in codes sent, for rate limits (migration 0050). Server only; rows older than a day are removed.';

alter table public.auth_code_requests enable row level security;
revoke all on public.auth_code_requests from anon, authenticated;
grant select, insert, delete on public.auth_code_requests to service_role;
grant usage on sequence public.auth_code_requests_id_seq to service_role;

-- 'ok' (and the request is recorded), or which limit was hit: 'email_hour', 'email_day', 'ip_hour'.
create or replace function public.allow_auth_code(
  p_ip text, p_email text, p_email_per_hour int, p_email_per_day int, p_ip_per_hour int
)
returns text
language plpgsql
set search_path = public
as $$
declare
  e text := lower(trim(p_email));
begin
  perform pg_advisory_xact_lock(hashtext('auth_code'));
  delete from public.auth_code_requests where at < now() - interval '1 day';
  if (select count(*) from public.auth_code_requests where email = e and at > now() - interval '1 hour') >= p_email_per_hour then
    return 'email_hour';
  end if;
  if (select count(*) from public.auth_code_requests where email = e) >= p_email_per_day then
    return 'email_day';
  end if;
  if (select count(*) from public.auth_code_requests where ip = p_ip and at > now() - interval '1 hour') >= p_ip_per_hour then
    return 'ip_hour';
  end if;
  insert into public.auth_code_requests (ip, email) values (p_ip, e);
  return 'ok';
end;
$$;

-- Reads auth.users and trips, so it runs with the owner's rights; only the server may call it.
create or replace function public.auth_email_status(p_email text)
returns table (user_id uuid, confirmed boolean, has_trip boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email_confirmed_at is not null,
         exists (select 1 from public.trips t where lower(t.guest_email) = lower(trim(p_email)))
    from (select 1) one
    left join auth.users u on lower(u.email) = lower(trim(p_email))
   limit 1;
$$;

revoke all on function public.allow_auth_code(text, text, int, int, int) from public, anon, authenticated;
revoke all on function public.auth_email_status(text) from public, anon, authenticated;
grant execute on function public.allow_auth_code(text, text, int, int, int) to service_role;
grant execute on function public.auth_email_status(text) to service_role;
