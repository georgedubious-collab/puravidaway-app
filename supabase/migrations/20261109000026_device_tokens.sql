-- Push notifications for the mobile apps (docs/PROJECT.md §11.4; Jorge, 2026-11-09: the apps
-- must work before launch). Each signed-in phone registers its Expo push token here; the
-- server sends through the Expo push service (src/lib/push.ts). Email stays as the backup.
--
-- Run after 0025. Safe to run more than once.

create table if not exists public.device_tokens (
  token       text primary key check (char_length(token) between 10 and 300),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  platform    text not null check (platform in ('ios', 'android')),
  app         text not null check (app in ('driver', 'client')),
  updated_at  timestamptz not null default now()
);
create index if not exists device_tokens_user_idx on public.device_tokens (user_id);
comment on table public.device_tokens is
  'Expo push tokens, one row per installed app per phone. Own rows only; the server reads them to send pushes.';

alter table public.device_tokens enable row level security;
drop policy if exists device_tokens_own on public.device_tokens;
create policy device_tokens_own on public.device_tokens
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.device_tokens from anon;
grant select, insert, update, delete on public.device_tokens to authenticated, service_role;

-- A phone that signs in as someone else hands its token over (the old owner stops getting its pushes).
create or replace function public.register_device(p_token text, p_platform text, p_app text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  insert into public.device_tokens (token, user_id, platform, app)
  values (p_token, auth.uid(), p_platform, p_app)
  on conflict (token) do update
     set user_id = excluded.user_id, platform = excluded.platform, app = excluded.app, updated_at = now();
end;
$$;
revoke all on function public.register_device(text, text, text) from public, anon;
grant execute on function public.register_device(text, text, text) to authenticated;
