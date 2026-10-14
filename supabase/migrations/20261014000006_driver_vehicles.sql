-- Phase 2c, part 2: a driver can register several vehicles.
-- Run after file 5.
--
-- Driver (person) documents stay on public.drivers:
--   photo, ID front + back, driver's licence, criminal record certificate, ICT permit (optional).
-- Each vehicle gets its own row with its own documents and photos, and is
-- approved by the admin separately:
--   INS insurance, Dekra / RTV, Marchamo, registration (optional), photos (at least 2).
--
-- A driver gets trips only while: the driver is approved, the licence is current,
-- and at least one approved vehicle has current insurance (15-day grace),
-- Dekra (no grace) and Marchamo (no grace).

-- ---------------------------------------------------------------------------
-- 1. Vehicles
-- ---------------------------------------------------------------------------
create table if not exists public.driver_vehicles (
  id                       uuid primary key default gen_random_uuid(),
  driver_id                uuid not null references public.drivers (id) on delete cascade,
  plate                    text,
  make_model               text,
  year                     int check (year is null or year between 1990 and 2100),
  color                    text,
  passenger_capacity       int check (passenger_capacity is null or passenger_capacity between 1 and 60),
  ins_policy_number        text,
  ins_insurance_expiry     date,
  dekra_inspection_expiry  date,
  marchamo_year            int,
  documents                jsonb not null default '{}'::jsonb,  -- {"insurance": "<path>", ...}
  photos                   jsonb not null default '[]'::jsonb,  -- ["<path>", ...]
  status                   text not null default 'pending'
                             check (status in ('pending', 'approved', 'rejected', 'suspended')),
  note                     text,
  needs_review             boolean not null default false,
  reviewed_at              timestamptz,
  reviewed_by              uuid references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now()
);
create index if not exists driver_vehicles_driver_idx on public.driver_vehicles (driver_id);

-- Vehicles that existed as columns on drivers move to their own rows.
insert into public.driver_vehicles
  (driver_id, make_model, year, passenger_capacity, ins_policy_number, ins_insurance_expiry,
   dekra_inspection_expiry, marchamo_year, documents, status)
select d.id, d.vehicle_model, d.vehicle_year, d.passenger_capacity, d.ins_policy_number,
       d.ins_insurance_expiry, d.dekra_inspection_expiry, d.marchamo_year,
       coalesce((select jsonb_object_agg(k, v) from jsonb_each(d.documents) as e(k, v)
                  where k in ('insurance', 'dekra', 'marchamo', 'vehicle_registration')), '{}'::jsonb),
       case when d.kyc_status = 'approved' then 'approved' else 'pending' end
  from public.drivers d
 where d.vehicle_model is not null
   and not exists (select 1 from public.driver_vehicles v where v.driver_id = d.id);

-- ---------------------------------------------------------------------------
-- 2. Validity rules (Costa Rica dates)
-- ---------------------------------------------------------------------------
create or replace function public.vehicle_documents_current(v public.driver_vehicles)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    v.ins_insurance_expiry + 15 >= public.cr_today()
    and v.dekra_inspection_expiry >= public.cr_today()
    and v.marchamo_year >= extract(year from public.cr_today())::int,
    false);
$$;

-- The old version also checked vehicle columns on drivers; those move to vehicles.
create or replace function public.driver_documents_current(d public.drivers)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(d.license_expiry >= public.cr_today(), false)
     and exists (
       select 1 from public.driver_vehicles v
        where v.driver_id = d.id and v.status = 'approved'
          and public.vehicle_documents_current(v));
$$;

-- is_approved_driver() (file 4) already requires driver_documents_current(d);
-- it now means "licence current and at least one approved, road-legal vehicle".

-- ---------------------------------------------------------------------------
-- 3. Driver record: only person-level fields remain the driver's to edit.
-- ---------------------------------------------------------------------------
create or replace function public.guard_driver_kyc()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Document links must point into the driver's own folder of the private bucket.
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
      if (new.cedula_number, new.ict_permit_number, new.license_number, new.license_expiry,
          new.criminal_record_date, new.documents)
         is distinct from
         (old.cedula_number, old.ict_permit_number, old.license_number, old.license_expiry,
          old.criminal_record_date, old.documents) then
        new.needs_review := old.kyc_status <> 'pending';
      else
        new.needs_review := old.needs_review;
      end if;
      -- After the first review, a new licence date counts only with the new licence uploaded.
      if old.kyc_status <> 'pending'
         and new.license_expiry is distinct from old.license_expiry
         and new.documents ->> 'license' is not distinct from old.documents ->> 'license' then
        raise exception 'Upload the renewed licence to change its expiry date';
      end if;
      if new.is_on_duty and not old.is_on_duty
         and (old.kyc_status <> 'approved' or not public.driver_documents_current(new)) then
        raise exception 'Only approved drivers with current documents can go on duty';
      end if;
    end if;
  end if;
  if new.kyc_status <> 'approved' then
    new.is_on_duty := false;
  end if;
  return new;
end;
$$;

alter table public.drivers
  drop column if exists vehicle_model,
  drop column if exists vehicle_year,
  drop column if exists passenger_capacity,
  drop column if exists ins_policy_number,
  drop column if exists ins_insurance_expiry,
  drop column if exists dekra_inspection_expiry,
  drop column if exists marchamo_year;

-- Vehicle documents no longer live on the driver record.
update public.drivers
   set documents = documents - 'insurance' - 'dekra' - 'marchamo' - 'vehicle_registration' - 'vehicle_photos'
 where documents ?| array['insurance', 'dekra', 'marchamo', 'vehicle_registration', 'vehicle_photos'];

-- ---------------------------------------------------------------------------
-- 4. Vehicle guard: same rules as the driver record.
-- ---------------------------------------------------------------------------
create or replace function public.guard_driver_vehicle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if jsonb_typeof(coalesce(new.photos, '[]'::jsonb)) <> 'array' then
    raise exception 'photos must be a list';
  end if;
  if jsonb_array_length(coalesce(new.photos, '[]'::jsonb)) > 12 then
    raise exception 'At most 12 photos per vehicle';
  end if;
  if exists (
    select 1 from jsonb_each_text(coalesce(new.documents, '{}'::jsonb)) as doc(key, path)
     where doc.path not like new.driver_id::text || '/%'
  ) or exists (
    select 1 from jsonb_array_elements_text(coalesce(new.photos, '[]'::jsonb)) as p(path)
     where p.path not like new.driver_id::text || '/%'
  ) then
    raise exception 'Files must be in the driver''s own folder';
  end if;

  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.status := 'pending';
      new.note := null;
      new.needs_review := false;
      new.reviewed_at := null;
      new.reviewed_by := null;
    else
      if new.driver_id <> old.driver_id then
        raise exception 'A vehicle cannot move to another driver';
      end if;
      if new.status is distinct from old.status then
        raise exception 'Only an admin can approve a vehicle';
      end if;
      new.note := old.note;
      new.reviewed_at := old.reviewed_at;
      new.reviewed_by := old.reviewed_by;
      if old.status <> 'pending' then
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
      if (new.plate, new.make_model, new.year, new.color, new.passenger_capacity,
          new.ins_policy_number, new.ins_insurance_expiry, new.dekra_inspection_expiry,
          new.marchamo_year, new.documents, new.photos)
         is distinct from
         (old.plate, old.make_model, old.year, old.color, old.passenger_capacity,
          old.ins_policy_number, old.ins_insurance_expiry, old.dekra_inspection_expiry,
          old.marchamo_year, old.documents, old.photos) then
        new.needs_review := old.status <> 'pending';
      else
        new.needs_review := old.needs_review;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists driver_vehicles_guard on public.driver_vehicles;
create trigger driver_vehicles_guard
  before insert or update on public.driver_vehicles
  for each row execute function public.guard_driver_vehicle();

-- ---------------------------------------------------------------------------
-- 5. Who can see and change vehicles: the driver (own) and admins.
-- ---------------------------------------------------------------------------
alter table public.driver_vehicles enable row level security;
grant select, insert, update, delete on public.driver_vehicles to authenticated, service_role;

drop policy if exists driver_vehicles_select on public.driver_vehicles;
create policy driver_vehicles_select on public.driver_vehicles
  for select to authenticated using (driver_id = auth.uid() or public.is_admin());
drop policy if exists driver_vehicles_insert on public.driver_vehicles;
create policy driver_vehicles_insert on public.driver_vehicles
  for insert to authenticated with check (driver_id = auth.uid() or public.is_admin());
drop policy if exists driver_vehicles_update on public.driver_vehicles;
create policy driver_vehicles_update on public.driver_vehicles
  for update to authenticated using (driver_id = auth.uid() or public.is_admin())
  with check (driver_id = auth.uid() or public.is_admin());
drop policy if exists driver_vehicles_delete on public.driver_vehicles;
create policy driver_vehicles_delete on public.driver_vehicles
  for delete to authenticated using (driver_id = auth.uid() or public.is_admin());
