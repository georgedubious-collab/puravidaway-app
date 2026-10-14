-- PuraVidaWay core schema — source: docs/PROJECT.md §7.
-- Money is USD numeric(10,2). Catalog tables use short text ids ("suv", "tarcoles")
-- so they match src/lib/catalog.ts and stay readable in bookings.


-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'client' check (role in ('client', 'driver', 'admin')),
  full_name   text,
  phone       text,
  email       text,
  created_at  timestamptz not null default now()
);

-- Every new login gets a profile. Role always starts as 'client';
-- admins promote drivers/admins from the admin area (or SQL for the first admin).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role helpers. SECURITY DEFINER so policies can call them without recursing
-- into the profiles policies.
create function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- Drivers (KYC & fleet vault)
-- ---------------------------------------------------------------------------

create table public.drivers (
  id                       uuid primary key references public.profiles (id) on delete cascade,
  cedula_number            text,
  ict_permit_number        text,
  license_number           text,
  license_expiry           date,
  marchamo_year            int,
  ins_policy_number        text,
  ins_insurance_expiry     date,
  dekra_inspection_expiry  date,
  criminal_record_date     date,  -- date on the "hoja de delincuencia" (PROJECT.md §10 driver checks)
  vehicle_model            text,
  vehicle_year             int,
  passenger_capacity       int check (passenger_capacity is null or passenger_capacity > 0),
  kyc_status               text not null default 'pending'
                             check (kyc_status in ('pending', 'approved', 'rejected', 'suspended')),
  documents                jsonb not null default '{}'::jsonb,  -- Storage paths in bucket driver-kyc-docs
  is_on_duty               boolean not null default false,
  last_lat                 double precision,
  last_lng                 double precision,
  last_seen_at             timestamptz,
  created_at               timestamptz not null default now()
);

create function public.is_approved_driver()
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
  );
$$;

-- ---------------------------------------------------------------------------
-- Catalog & pricing (edited from the admin pricing manager)
-- ---------------------------------------------------------------------------

create table public.vehicle_classes (
  id             text primary key,
  name           text not null,
  base_rate      numeric(10,2) not null check (base_rate >= 0),
  max_pax        int not null check (max_pax > 0),
  luggage        text not null default '',
  badge          text not null default '',
  only_for_hubs  text[] not null default '{}',  -- empty = offered on every route
  sort_order     int not null default 0,
  active         boolean not null default true,
  updated_at     timestamptz not null default now()
);

create table public.sightseeing_stops (
  id                 text primary key,
  name               text not null,
  description        text not null default '',
  duration_min       int not null check (duration_min > 0),
  price              numeric(10,2) not null check (price >= 0),
  park_fee_included  boolean not null default false,
  corridors          text[] not null default '{}',
  sort_order         int not null default 0,
  active             boolean not null default true,
  updated_at         timestamptz not null default now()
);

create table public.day_tours (
  id                      text primary key,
  region                  text not null check (region in ('Arenal', 'ManuelAntonio', 'Osa', 'Monteverde')),
  name                    text not null,
  description             text not null default '',
  highlights              text[] not null default '{}',
  duration_hours          numeric(4,1) not null check (duration_hours > 0),
  price                   numeric(10,2) not null check (price >= 0),
  en_route_upgrade_price  numeric(10,2) not null default 65.00 check (en_route_upgrade_price >= 0),
  sort_order              int not null default 0,
  active                  boolean not null default true,
  updated_at              timestamptz not null default now()
);

create table public.expeditions (
  id          text primary key,
  name        text not null,
  days        int not null check (days > 0),
  nights      int not null check (nights >= 0),
  base_price  numeric(10,2) not null check (base_price >= 0),
  includes    text[] not null default '{}',
  itinerary   jsonb not null default '[]'::jsonb,  -- [{ "day": 1, "title": "…" }]
  sort_order  int not null default 0,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

create table public.lodging_tiers (
  id             text primary key,
  expedition_id  text references public.expeditions (id) on delete cascade,  -- null = all expeditions
  name           text not null,
  surcharge      numeric(10,2) not null default 0 check (surcharge >= 0),
  sort_order     int not null default 0,
  active         boolean not null default true,
  updated_at     timestamptz not null default now()
);

-- Season multipliers. A travel date takes the highest-priority season whose
-- date range contains it; dates outside every range use the season marked is_default.
create table public.seasons (
  id          text primary key,
  name        text not null,
  multiplier  numeric(4,2) not null check (multiplier > 0),
  priority    int not null default 0,
  is_default  boolean not null default false,
  updated_at  timestamptz not null default now()
);

create unique index seasons_one_default on public.seasons (is_default) where is_default;

create table public.season_ranges (
  id         uuid primary key default gen_random_uuid(),
  season_id  text not null references public.seasons (id) on delete cascade,
  starts_on  date not null,
  ends_on    date not null,
  note       text,
  check (ends_on >= starts_on)
);

create function public.season_for_date(d date)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select s.id from public.season_ranges r join public.seasons s on s.id = r.season_id
      where d between r.starts_on and r.ends_on
      order by s.priority desc limit 1),
    (select id from public.seasons where is_default limit 1)
  );
$$;

-- ---------------------------------------------------------------------------
-- Bookings, bids, chat, payments
-- ---------------------------------------------------------------------------

create sequence public.booking_ref_seq start 10001;

create table public.bookings (
  id                     uuid primary key default gen_random_uuid(),
  booking_ref            text not null unique default ('PVW-' || nextval('public.booking_ref_seq')),
  client_id              uuid references public.profiles (id) on delete set null,
  service_type           text not null check (service_type in ('transfer', 'day_tour', 'expedition')),
  catalog_item_id        text,
  origin                 text,
  origin_coords          jsonb,
  destination            text,
  destination_coords     jsonb,
  sightseeing_stops      jsonb not null default '[]'::jsonb,  -- [{ "id": "tarcoles", "price": 25.00 }]
  vehicle_class          text,
  lodging_tier           text,
  scheduled_at           timestamptz,
  passenger_count        int check (passenger_count is null or passenger_count > 0),
  flight_or_hotel_notes  text,
  pricing_mode           text not null default 'fixed' check (pricing_mode in ('fixed', 'bid')),
  total_price            numeric(10,2) not null check (total_price >= 0),
  currency               text not null default 'USD' check (currency in ('USD', 'CRC')),
  amount_paid            numeric(10,2) not null default 0 check (amount_paid >= 0),
  payment_mode           text check (payment_mode in ('full_100', 'deposit_20')),
  assigned_driver_id     uuid references public.drivers (id) on delete set null,
  status                 text not null default 'pending_payment'
                           check (status in ('pending_payment', 'pending_bids', 'confirmed',
                                             'in_progress', 'completed', 'cancelled')),
  created_at             timestamptz not null default now()
);

create index bookings_client_idx on public.bookings (client_id);
create index bookings_driver_idx on public.bookings (assigned_driver_id);
create index bookings_status_idx on public.bookings (status);

create table public.bids (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null references public.bookings (id) on delete cascade,
  driver_id         uuid not null references public.drivers (id) on delete cascade,
  bid_amount        numeric(10,2) not null check (bid_amount > 0),
  vehicle_snapshot  jsonb not null default '{}'::jsonb,
  status            text not null default 'submitted'
                      check (status in ('submitted', 'accepted', 'declined', 'withdrawn')),
  created_at        timestamptz not null default now(),
  unique (booking_id, driver_id)
);

create table public.trip_chats (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings (id) on delete cascade,
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  sender_role  text not null check (sender_role in ('client', 'driver', 'admin')),
  message      text not null check (length(message) between 1 and 4000),
  sent_at      timestamptz not null default now()
);

create index trip_chats_booking_idx on public.trip_chats (booking_id, sent_at);

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings (id) on delete cascade,
  provider      text not null default 'greenpay' check (provider in ('greenpay')),
  provider_ref  text,
  amount        numeric(10,2) not null check (amount > 0),
  type          text not null check (type in ('deposit', 'balance', 'full')),
  status        text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  raw_payload   jsonb,
  created_at    timestamptz not null default now()
);

create index payments_booking_idx on public.payments (booking_id);

-- ---------------------------------------------------------------------------
-- Guards that RLS alone can't express
-- ---------------------------------------------------------------------------

-- Only admins (or the server) may change a profile's role.
create function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an admin can change a role';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Only admins (or the server) may change KYC status; drivers can't approve themselves.
create function public.guard_driver_kyc()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' and new.kyc_status <> 'pending' then
      raise exception 'New drivers start as pending';
    end if;
    if tg_op = 'UPDATE' and new.kyc_status is distinct from old.kyc_status then
      raise exception 'Only an admin can change KYC status';
    end if;
  end if;
  return new;
end;
$$;

create trigger drivers_guard_kyc
  before insert or update on public.drivers
  for each row execute function public.guard_driver_kyc();

-- Drivers may only withdraw their own bids or lower/raise the amount while submitted;
-- accepting/declining happens server-side or by an admin.
create function public.guard_bid_status()
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
  end if;
  return new;
end;
$$;

create trigger bids_guard_status
  before update on public.bids
  for each row execute function public.guard_bid_status();

-- Keep catalog updated_at current.
create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger vehicle_classes_touch before update on public.vehicle_classes for each row execute function public.touch_updated_at();
create trigger sightseeing_stops_touch before update on public.sightseeing_stops for each row execute function public.touch_updated_at();
create trigger day_tours_touch before update on public.day_tours for each row execute function public.touch_updated_at();
create trigger expeditions_touch before update on public.expeditions for each row execute function public.touch_updated_at();
create trigger lodging_tiers_touch before update on public.lodging_tiers for each row execute function public.touch_updated_at();
create trigger seasons_touch before update on public.seasons for each row execute function public.touch_updated_at();
