-- One-time cleanup of the junk accounts bots created on 10–12 Nov 2026 (2026-11-12).
--
-- Before the sign-in fix (migration 0049, src/app/api/auth/send-code), anyone could make
-- Supabase create an account by asking for a sign-in code. About a dozen accounts were made
-- that way: never confirmed, never signed in, nothing booked.
--
-- An account is deleted only when ALL of these are true:
--   - its profile role is 'client' (never an admin or a driver);
--   - the email was never confirmed (email_confirmed_at is null);
--   - it never signed in (last_sign_in_at is null);
--   - it was created before 13 Nov 2026 (accounts made after the fix are left alone);
--   - no trip was booked with that email (public.trips.guest_email, any upper/lower case);
--   - it has no row in public.drivers (so no driver application either);
--   - nothing else in the database points at it: every table in the public schema with a
--     link to the account (bookings, offers, reviews, chat messages, push tokens, change
--     history, admin "reviewed by" columns, and any table added later) is checked by
--     looking up the links in the database itself, plus files it uploaded (storage).
-- Its profile row goes too (deleted here, and it would also follow the account automatically).
-- A notice reports how many accounts were removed.
--
-- Run after 0049. Safe to run once, in order; running it again finds nothing new to delete
-- that the rules above don't allow.

do $$
declare
  fk record;
  n int;
begin
  create temporary table junk_signups on commit drop as
    select u.id
      from auth.users u
      join public.profiles p on p.id = u.id
     where p.role = 'client'
       and u.email_confirmed_at is null
       and u.last_sign_in_at is null
       and u.created_at < timestamptz '2026-11-13 00:00:00+00'
       and not exists (select 1 from public.drivers d where d.id = u.id)
       and not exists (
         select 1 from public.trips t
          where u.email is not null and lower(t.guest_email) = lower(u.email)
       )
       and not exists (select 1 from storage.objects o where o.owner = u.id);

  -- Every single-column link in the public schema to an account, its profile or a driver row.
  for fk in
    select c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and array_length(c.conkey, 1) = 1
       and c.connamespace = 'public'::regnamespace
       and c.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass, 'public.drivers'::regclass)
       and c.conrelid <> 'public.profiles'::regclass
  loop
    execute format('delete from junk_signups j where exists (select 1 from %s x where x.%I = j.id)', fk.tbl, fk.col);
  end loop;

  delete from public.profiles where id in (select id from junk_signups);
  delete from auth.users where id in (select id from junk_signups);
  get diagnostics n = row_count;
  raise notice 'Removed % junk sign-up account(s) (never confirmed, never signed in, nothing booked).', n;
end;
$$;
