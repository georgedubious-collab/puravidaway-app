-- Driver ratings (Jorge, 2026-11-09). When a trip is completed the traveller is asked
-- to rate the driver (1–5 stars, optional comment) from their private trip page.
-- A rating with a written comment counts double: weight 2 instead of 1, in both the
-- average and the count. Better-rated drivers get priority on the job board.
--
-- Run after 0018. Safe to run more than once.

create table if not exists public.driver_reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null unique references public.bookings (id) on delete cascade,
  driver_id   uuid not null references public.drivers (id) on delete cascade,
  trip_id     uuid references public.trips (id) on delete set null,
  stars       int not null check (stars between 1 and 5),
  comment     text check (comment is null or (length(comment) between 1 and 1000)),
  -- 2 when the traveller wrote something, 1 for stars only.
  weight      int generated always as (case when comment is null then 1 else 2 end) stored,
  created_at  timestamptz not null default now()
);
create index if not exists driver_reviews_driver_idx on public.driver_reviews (driver_id);
comment on table public.driver_reviews is
  'Travellers'' ratings of their driver, one per booking. weight: 2 with a comment, 1 without.';

-- Running totals on the driver, kept by trigger: weighted average and weighted count.
alter table public.drivers
  add column if not exists rating_avg   numeric(3,2) check (rating_avg is null or rating_avg between 1 and 5),
  add column if not exists rating_count int not null default 0 check (rating_count >= 0);
comment on column public.drivers.rating_avg   is 'Weighted average of driver_reviews (a review with a comment counts twice).';
comment on column public.drivers.rating_count is 'Weighted number of ratings (a review with a comment counts as 2).';

alter table public.bookings
  add column if not exists review_requested_at timestamptz;
comment on column public.bookings.review_requested_at is 'When the traveller was emailed to rate the driver (once per booking).';

create or replace function public.refresh_driver_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d uuid := coalesce(new.driver_id, old.driver_id);
begin
  update public.drivers
     set rating_avg = (select round(sum(stars * weight)::numeric / nullif(sum(weight), 0), 2) from public.driver_reviews where driver_id = d),
         rating_count = (select coalesce(sum(weight), 0) from public.driver_reviews where driver_id = d)
   where id = d;
  return null;
end;
$$;

drop trigger if exists driver_reviews_refresh on public.driver_reviews;
create trigger driver_reviews_refresh
  after insert or update or delete on public.driver_reviews
  for each row execute function public.refresh_driver_rating();

-- Comments must not carry contact details (same rule as chat and bios).
create or replace function public.guard_review_comment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.comment := nullif(trim(new.comment), '');
  if new.comment is not null and not public.no_contact_details(new.comment) then
    raise exception 'Please keep phone numbers, emails and links out of the review.';
  end if;
  return new;
end;
$$;
drop trigger if exists driver_reviews_guard on public.driver_reviews;
create trigger driver_reviews_guard
  before insert or update on public.driver_reviews
  for each row execute function public.guard_review_comment();

-- Only the review can be written by the server (travellers have no account; the trip
-- page checks the private link, see src/app/trip/[token]/actions.ts). The driver reads
-- their own reviews, the team reads all.
alter table public.driver_reviews enable row level security;
drop policy if exists driver_reviews_select on public.driver_reviews;
create policy driver_reviews_select on public.driver_reviews
  for select to authenticated using (driver_id = auth.uid() or public.is_admin());
drop policy if exists driver_reviews_admin_write on public.driver_reviews;
create policy driver_reviews_admin_write on public.driver_reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.driver_reviews from anon;
grant select on public.driver_reviews to authenticated;
grant insert, update, delete on public.driver_reviews to authenticated, service_role;
