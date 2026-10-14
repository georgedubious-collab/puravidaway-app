-- Row Level Security — source: docs/PROJECT.md §7.7.
-- Rule of thumb: the browser only ever uses the anon key, so every table is
-- locked down here. Prices, payments and bid acceptance are written by the
-- server (service role), which bypasses RLS.

alter table public.profiles          enable row level security;
alter table public.drivers           enable row level security;
alter table public.vehicle_classes   enable row level security;
alter table public.sightseeing_stops enable row level security;
alter table public.day_tours         enable row level security;
alter table public.expeditions       enable row level security;
alter table public.lodging_tiers     enable row level security;
alter table public.seasons           enable row level security;
alter table public.season_ranges     enable row level security;
alter table public.bookings          enable row level security;
alter table public.bids              enable row level security;
alter table public.trip_chats        enable row level security;
alter table public.payments          enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: users read/update their own row; admins read/write all.
-- ---------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy profiles_admin_insert on public.profiles
  for insert to authenticated with check (public.is_admin());
create policy profiles_admin_delete on public.profiles
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- drivers: a driver reads/updates their own KYC row; admins all.
-- Clients and other drivers never see Cédula, license or insurance numbers.
-- kyc_status changes are blocked for non-admins by the drivers_guard_kyc trigger.
-- ---------------------------------------------------------------------------
create policy drivers_select_own on public.drivers
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy drivers_insert_own on public.drivers
  for insert to authenticated
  with check ((id = auth.uid() and public.current_role_name() = 'driver') or public.is_admin());
create policy drivers_update_own on public.drivers
  for update to authenticated using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy drivers_admin_delete on public.drivers
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Catalog: everyone (including logged-out visitors) reads active items;
-- admins read inactive items too and do all writes.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['vehicle_classes', 'sightseeing_stops', 'day_tours', 'expeditions', 'lodging_tiers'] loop
    execute format(
      'create policy %1$s_public_read on public.%1$s for select to anon, authenticated using (active or public.is_admin())', t);
    execute format(
      'create policy %1$s_admin_write on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
  foreach t in array array['seasons', 'season_ranges'] loop
    execute format(
      'create policy %1$s_public_read on public.%1$s for select to anon, authenticated using (true)', t);
    execute format(
      'create policy %1$s_admin_write on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- bookings: clients see their own; the assigned driver sees assigned trips;
-- approved drivers see open bid requests; admins see all.
-- Bookings are created by the server (prices must never come from the browser).
-- Client contact details live in profiles, which drivers can't read, so open
-- requests don't expose them.
-- ---------------------------------------------------------------------------
create policy bookings_select on public.bookings
  for select to authenticated using (
    client_id = auth.uid()
    or assigned_driver_id = auth.uid()
    or (status = 'pending_bids' and public.is_approved_driver())
    or public.is_admin()
  );
create policy bookings_admin_write on public.bookings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- bids: approved drivers create/manage their own on open requests; the
-- booking's client reads bids on their booking; admins all.
-- ---------------------------------------------------------------------------
create policy bids_select on public.bids
  for select to authenticated using (
    driver_id = auth.uid()
    or exists (select 1 from public.bookings b where b.id = booking_id and b.client_id = auth.uid())
    or public.is_admin()
  );
create policy bids_driver_insert on public.bids
  for insert to authenticated with check (
    (driver_id = auth.uid()
      and status = 'submitted'
      and public.is_approved_driver()
      and exists (select 1 from public.bookings b where b.id = booking_id and b.status = 'pending_bids'))
    or public.is_admin()
  );
create policy bids_driver_update on public.bids
  for update to authenticated using (driver_id = auth.uid() or public.is_admin())
  with check (driver_id = auth.uid() or public.is_admin());
create policy bids_admin_delete on public.bids
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- trip_chats: only the booking's client, its assigned driver and admins.
-- ---------------------------------------------------------------------------
create function public.is_trip_participant(b_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.bookings b
    where b.id = b_id and (b.client_id = auth.uid() or b.assigned_driver_id = auth.uid())
  );
$$;

create policy trip_chats_select on public.trip_chats
  for select to authenticated using (public.is_trip_participant(booking_id));
create policy trip_chats_insert on public.trip_chats
  for insert to authenticated with check (
    sender_id = auth.uid()
    and public.is_trip_participant(booking_id)
    and sender_role = public.current_role_name()
  );

-- ---------------------------------------------------------------------------
-- payments: written only by the server; clients read their own; admins all.
-- ---------------------------------------------------------------------------
create policy payments_select on public.payments
  for select to authenticated using (
    public.is_admin()
    or exists (select 1 from public.bookings b where b.id = booking_id and b.client_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Driver KYC documents (private Storage bucket). Each driver uploads into a
-- folder named after their user id: driver-kyc-docs/<user id>/<file>.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('driver-kyc-docs', 'driver-kyc-docs', false)
on conflict (id) do nothing;

create policy kyc_docs_driver_read on storage.objects
  for select to authenticated using (
    bucket_id = 'driver-kyc-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
create policy kyc_docs_driver_upload on storage.objects
  for insert to authenticated with check (
    bucket_id = 'driver-kyc-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_role_name() = 'driver'
  );
create policy kyc_docs_driver_replace on storage.objects
  for update to authenticated using (
    bucket_id = 'driver-kyc-docs' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy kyc_docs_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'driver-kyc-docs' and public.is_admin());
