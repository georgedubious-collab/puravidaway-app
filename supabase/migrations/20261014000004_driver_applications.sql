-- Phase 2c: driver applications & KYC vault.
-- Run after files 1–3. Safe to run once; every statement is idempotent or new.

-- ---------------------------------------------------------------------------
-- 1. Explicit Data API privileges. Supabase grants these automatically when
--    "Automatically expose new tables" is on; spelling them out keeps the app
--    working if that setting is ever turned off. Row-level security still
--    decides which ROWS anyone can see or change.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select on public.vehicle_classes, public.sightseeing_stops, public.day_tours,
  public.expeditions, public.lodging_tiers, public.seasons, public.season_ranges to anon;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Review fields on the KYC record.
-- ---------------------------------------------------------------------------
alter table public.drivers
  add column if not exists kyc_note      text,          -- admin's message to the driver (e.g. why rejected)
  add column if not exists needs_review  boolean not null default false,
  add column if not exists submitted_at  timestamptz,
  add column if not exists reviewed_at   timestamptz,
  add column if not exists reviewed_by   uuid references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Document validity. An approved driver only gets trips while:
--   * the driver's licence has not expired (no grace period),
--   * the INS insurance expired no more than 15 days ago (grace period),
--   * the Marchamo is paid for the current year (no grace period),
--   * the Dekra / RTV inspection has not expired (no grace period).
-- Dates are Costa Rica dates.
-- ---------------------------------------------------------------------------
create or replace function public.cr_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Costa_Rica')::date;
$$;

create or replace function public.driver_documents_current(d public.drivers)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    d.license_expiry >= public.cr_today()
    and d.ins_insurance_expiry + 15 >= public.cr_today()
    and d.marchamo_year >= extract(year from public.cr_today())::int
    and d.dekra_inspection_expiry >= public.cr_today(),
    false);
$$;

-- "Approved driver" now also means "documents current": an expired licence or
-- Dekra, insurance past its grace period or an unpaid Marchamo stops bids and open
-- requests automatically, without the admin having to suspend anyone.
create or replace function public.is_approved_driver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.drivers d
    join public.profiles p on p.id = d.id
    where d.id = auth.uid() and p.role = 'driver' and d.kyc_status = 'approved'
      and public.driver_documents_current(d)
  );
$$;

-- Non-admins (applicants and drivers) can edit their own details and documents,
-- but never the review fields. Any change they make to an approved record flags
-- it for the admin to look at again (e.g. a renewed licence uploaded).
create or replace function public.guard_driver_kyc()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Document links must point into the driver's own folder of the private bucket,
  -- so nobody can attach someone else's file to their record.
  if exists (
    select 1 from jsonb_each_text(coalesce(new.documents, '{}'::jsonb)) as doc(key, path)
    where doc.path not like new.id::text || '/%'
  ) then
    raise exception 'Documents must be in the driver''s own folder';
  end if;

  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.kyc_status <> 'pending' then
        raise exception 'New drivers start as pending';
      end if;
      new.kyc_note := null;
      new.needs_review := false;
      new.reviewed_at := null;
      new.reviewed_by := null;
      new.submitted_at := now();
      new.is_on_duty := false;
    else
      if new.kyc_status is distinct from old.kyc_status then
        raise exception 'Only an admin can change KYC status';
      end if;
      new.kyc_note := old.kyc_note;
      new.reviewed_at := old.reviewed_at;
      new.reviewed_by := old.reviewed_by;
      new.submitted_at := old.submitted_at;
      -- Location/on-duty pings are not document changes.
      if (new.cedula_number, new.ict_permit_number, new.license_number, new.license_expiry,
          new.marchamo_year, new.ins_policy_number, new.ins_insurance_expiry,
          new.dekra_inspection_expiry, new.criminal_record_date, new.vehicle_model,
          new.vehicle_year, new.passenger_capacity, new.documents)
         is distinct from
         (old.cedula_number, old.ict_permit_number, old.license_number, old.license_expiry,
          old.marchamo_year, old.ins_policy_number, old.ins_insurance_expiry,
          old.dekra_inspection_expiry, old.criminal_record_date, old.vehicle_model,
          old.vehicle_year, old.passenger_capacity, old.documents) then
        new.needs_review := old.kyc_status <> 'pending';
      else
        new.needs_review := old.needs_review;
      end if;
      -- After the first review, a new expiry date only counts with the renewed
      -- document uploaded in the same change.
      if old.kyc_status <> 'pending' then
        if new.license_expiry is distinct from old.license_expiry
           and new.documents ->> 'license' is not distinct from old.documents ->> 'license' then
          raise exception 'Upload the renewed licence to change its expiry date';
        end if;
        if new.ins_insurance_expiry is distinct from old.ins_insurance_expiry
           and new.documents ->> 'insurance' is not distinct from old.documents ->> 'insurance' then
          raise exception 'Upload the renewed insurance policy to change its expiry date';
        end if;
        if new.dekra_inspection_expiry is distinct from old.dekra_inspection_expiry
           and new.documents ->> 'dekra' is not distinct from old.documents ->> 'dekra' then
          raise exception 'Upload the new Dekra certificate to change its expiry date';
        end if;
        if new.marchamo_year is distinct from old.marchamo_year
           and new.documents ->> 'marchamo' is not distinct from old.documents ->> 'marchamo' then
          raise exception 'Upload the new Marchamo to change its year';
        end if;
      end if;
      -- Only approved drivers with current documents can show up as available.
      if new.is_on_duty and not old.is_on_duty
         and (old.kyc_status <> 'approved' or not public.driver_documents_current(new)) then
        raise exception 'Only approved drivers with current documents can go on duty';
      end if;
    end if;
  end if;
  -- Anyone who is no longer approved goes off duty (covers admin suspensions too).
  if new.kyc_status <> 'approved' then
    new.is_on_duty := false;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Anyone signed in can APPLY: create their own KYC record (always pending)
--    without already having the driver role. The admin grants the role on approval.
-- ---------------------------------------------------------------------------
drop policy if exists drivers_insert_own on public.drivers;
create policy drivers_insert_own on public.drivers
  for insert to authenticated
  with check (id = auth.uid() or public.is_admin());

-- An applicant has a KYC record; used by the storage rules below.
create or replace function public.has_driver_record()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.drivers where id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- 4. Document uploads: applicants (not only approved drivers) upload into
--    their own folder. Files are limited to images and PDFs up to 10 MB.
-- ---------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
 where id = 'driver-kyc-docs';

drop policy if exists kyc_docs_driver_upload on storage.objects;
create policy kyc_docs_driver_upload on storage.objects
  for insert to authenticated with check (
    bucket_id = 'driver-kyc-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.has_driver_record()
  );

drop policy if exists kyc_docs_driver_replace on storage.objects;
create policy kyc_docs_driver_replace on storage.objects
  for update to authenticated
  using (bucket_id = 'driver-kyc-docs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'driver-kyc-docs' and (storage.foldername(name))[1] = auth.uid()::text);
