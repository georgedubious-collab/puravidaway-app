-- Changes to key documents pause new jobs until the team checks them (Jorge, 2026-11-09;
-- settles PROJECT.md §9 #9 with the "middle option").
--
-- When an APPROVED driver replaces an identity or licence document or changes the licence
-- date, or replaces a vehicle's insurance / Dekra / Marchamo / registration, changes their
-- dates or its plate, the record is put on hold (review_hold):
--   * a driver on hold cannot send new offers;
--   * a vehicle on hold cannot be offered (other vehicles still can).
-- Trips already assigned are NOT affected: the driver can still start and complete them.
-- Small edits (bio, phone, photos, extras, where they are based) only raise the existing
-- "changed since last review" flag. The hold clears when an admin reviews the record.
--
-- Run after 0030. Safe to run more than once.

alter table public.drivers         add column if not exists review_hold boolean not null default false;
alter table public.driver_vehicles add column if not exists review_hold boolean not null default false;
comment on column public.drivers.review_hold is
  'True while a replaced key document / licence date waits for the team''s check: no new offers. Cleared when an admin reviews.';
comment on column public.driver_vehicles.review_hold is
  'True while a replaced vehicle document, date or plate waits for the team''s check: the vehicle cannot be offered.';

create or replace function public.hold_driver_on_document_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    -- A driver can never clear or set the hold themselves.
    new.review_hold := old.review_hold;
    if old.kyc_status = 'approved' and (
         new.license_expiry is distinct from old.license_expiry
      or (new.documents ->> 'license')         is distinct from (old.documents ->> 'license')
      or (new.documents ->> 'id_front')        is distinct from (old.documents ->> 'id_front')
      or (new.documents ->> 'id_back')         is distinct from (old.documents ->> 'id_back')
      or (new.documents ->> 'criminal_record') is distinct from (old.documents ->> 'criminal_record')
    ) then
      new.review_hold := true;
    end if;
  elsif new.needs_review = false or new.kyc_status is distinct from old.kyc_status then
    -- The team has looked at it (any review decision).
    new.review_hold := false;
  end if;
  return new;
end;
$$;

-- Named to run after the existing guard trigger (triggers fire in name order).
drop trigger if exists drivers_hold_on_docs on public.drivers;
create trigger drivers_hold_on_docs
  before update on public.drivers
  for each row execute function public.hold_driver_on_document_change();

create or replace function public.hold_vehicle_on_document_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.review_hold := old.review_hold;
    if old.status = 'approved' and (
         new.ins_insurance_expiry    is distinct from old.ins_insurance_expiry
      or new.dekra_inspection_expiry is distinct from old.dekra_inspection_expiry
      or new.marchamo_year           is distinct from old.marchamo_year
      or new.plate                   is distinct from old.plate
      or (new.documents ->> 'insurance')            is distinct from (old.documents ->> 'insurance')
      or (new.documents ->> 'dekra')                is distinct from (old.documents ->> 'dekra')
      or (new.documents ->> 'marchamo')             is distinct from (old.documents ->> 'marchamo')
      or (new.documents ->> 'vehicle_registration') is distinct from (old.documents ->> 'vehicle_registration')
    ) then
      new.review_hold := true;
    end if;
  elsif new.needs_review = false or new.status is distinct from old.status then
    new.review_hold := false;
  end if;
  return new;
end;
$$;

drop trigger if exists driver_vehicles_hold_on_docs on public.driver_vehicles;
create trigger driver_vehicles_hold_on_docs
  before update on public.driver_vehicles
  for each row execute function public.hold_vehicle_on_document_change();

-- Offers: refuse while the driver or the chosen vehicle is on hold.
create or replace function public.offer_job(p_booking uuid, p_vehicle uuid, p_amount numeric, p_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings%rowtype;
  v public.driver_vehicles%rowtype;
begin
  if not public.is_approved_driver() then
    raise exception 'Your driver account is not approved for trips yet.';
  end if;
  if exists (select 1 from public.drivers d where d.id = auth.uid() and d.review_hold) then
    raise exception 'Your new documents are being checked. You can send offers again once our team approves them.';
  end if;
  select * into v from public.driver_vehicles
   where id = p_vehicle and driver_id = auth.uid() and status = 'approved';
  if not found or not public.vehicle_documents_current(v) then
    raise exception 'Pick one of your approved vehicles with current documents.';
  end if;
  if v.review_hold then
    raise exception 'That vehicle''s new documents are being checked. Pick another vehicle, or wait for our team to approve them.';
  end if;
  select * into b from public.bookings where id = p_booking;
  if not found or b.status <> 'pending_bids' or b.driver_payout is null then
    raise exception 'This job is no longer open.';
  end if;
  if b.scheduled_at <= now() then
    raise exception 'This job is in the past.';
  end if;
  if b.passenger_count is not null and coalesce(v.passenger_capacity, 0) < b.passenger_count then
    raise exception 'That vehicle has % seats; this group needs %.', coalesce(v.passenger_capacity, 0), b.passenger_count;
  end if;
  if p_amount is null or p_amount < round(b.driver_payout * 0.70) or p_amount > round(b.driver_payout * 1.30) then
    raise exception 'Offers must be between $% and $%.', round(b.driver_payout * 0.70), round(b.driver_payout * 1.30);
  end if;
  if p_note is not null and not public.no_contact_details(p_note) then
    raise exception 'Please keep phone numbers, emails and links out of the note.';
  end if;

  insert into public.bids (booking_id, driver_id, bid_amount, vehicle_id, note, status, vehicle_snapshot)
  values (b.id, auth.uid(), round(p_amount, 2), v.id, nullif(trim(p_note), ''), 'submitted',
          jsonb_build_object('make_model', v.make_model, 'plate', v.plate, 'seats', v.passenger_capacity))
  on conflict (booking_id, driver_id) do update
     set bid_amount = excluded.bid_amount, vehicle_id = excluded.vehicle_id, note = excluded.note,
         status = 'submitted', vehicle_snapshot = excluded.vehicle_snapshot, updated_at = now();
  return b.booking_ref;
end;
$$;

revoke all on function public.offer_job(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.offer_job(uuid, uuid, numeric, text) to authenticated;
