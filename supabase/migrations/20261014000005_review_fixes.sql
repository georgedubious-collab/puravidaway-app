-- Fixes from the independent security review of Phase 2b. Run after file 4.

-- ---------------------------------------------------------------------------
-- 1. Profiles: users may edit their name and phone, but not their email (admins
--    use it to recognise people) or role. The email is kept in sync from the
--    login system by the server, which is allowed.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only an admin can change a role';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Email is changed through sign-in, not here';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Open trip requests: drivers see a safe summary only. Exact pickup
--    coordinates, flight/hotel notes and the client's id stay hidden until a
--    bid is accepted and the driver is assigned (PROJECT.md §7.7).
-- ---------------------------------------------------------------------------
create or replace function public.is_open_request(b_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.bookings where id = b_id and status = 'pending_bids');
$$;

drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings
  for select to authenticated using (
    client_id = auth.uid()
    or assigned_driver_id = auth.uid()
    or public.is_admin()
  );

-- Runs with the owner's rights, so the WHERE clause is the security rule.
create or replace view public.open_trip_requests
with (security_barrier = true) as
  select id, booking_ref, service_type, catalog_item_id, origin, destination,
         sightseeing_stops, vehicle_class, lodging_tier, scheduled_at, passenger_count,
         pricing_mode, total_price, currency, created_at
    from public.bookings
   where status = 'pending_bids'
     and (public.is_approved_driver() or public.is_admin());

revoke all on public.open_trip_requests from anon, public;
grant select on public.open_trip_requests to authenticated;

drop policy if exists bids_driver_insert on public.bids;
create policy bids_driver_insert on public.bids
  for insert to authenticated with check (
    (driver_id = auth.uid()
      and status = 'submitted'
      and public.is_approved_driver()
      and public.is_open_request(booking_id))
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 3. Bids: a driver can change the amount only while the request is still open
--    and they are still approved. Withdrawing is always allowed.
-- ---------------------------------------------------------------------------
create or replace function public.guard_bid_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.booking_id <> old.booking_id or new.driver_id <> old.driver_id then
      raise exception 'A bid cannot be moved to another booking or driver';
    end if;
    if new.status is distinct from old.status and new.status <> 'withdrawn' then
      raise exception 'Drivers can only withdraw a bid';
    end if;
    if old.status <> 'submitted' then
      raise exception 'This bid can no longer be changed';
    end if;
    if new.status = 'submitted'
       and (not public.is_approved_driver() or not public.is_open_request(new.booking_id)) then
      raise exception 'This request is closed';
    end if;
  end if;
  return new;
end;
$$;
