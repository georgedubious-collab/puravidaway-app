# Setting up Supabase (one time, ~15 minutes)

Supabase is the database, login system and file storage for Costa Rica Private Transfers. The app keeps
working without it (it falls back to the built-in catalog), but logins, `/admin` and the
pricing manager need it.

## 1. Create the project
1. Go to [supabase.com](https://supabase.com) → sign in with GitHub → **New project**.
2. Name: `puravidaway`. Region: **East US (North Virginia)** — closest to Costa Rica and to
   Vercel's default region. Pick a strong database password and save it in your password manager.
3. Free plan is fine until launch.

## 2. Create the tables
Either way works; the first needs no installs.

**Option A — SQL editor (easiest).** In Supabase → **SQL Editor** → **New query**, paste and
**Run** each file from `supabase/migrations/` **in order**:
1. `20261014000001_core_schema.sql` — tables
2. `20261014000002_row_level_security.sql` — security rules + private bucket for driver documents
3. `20261014000003_seed_catalog.sql` — current vehicles, stops, tours, expeditions, seasons
4. `20261014000004_driver_applications.sql` — driver applications and the document vault (Phase 2c)
5. `20261014000005_review_fixes.sql` — security fixes from the Phase 2b review
6. `20261014000006_driver_vehicles.sql` — several vehicles per driver
7. `20261014000007_trip_requests.sql` — trip requests from the website, dispatch fields
8. `20261014000008_preferences_profiles.sql` — ride preferences, driver bios, vehicle features
9. `20261014000009_trip_chat.sql` — trip chat, server-only traveller contacts, abuse limits
10. `20261021000010_advisor_fixes.sql` — Supabase security-advisor fixes
11. `20261108000011_stop_corridors.sql` — sightseeing stop corridors for the "both ends" rule
12. `20261108000012_payment_options.sql` — pay online in full or cash to the driver; the cash
    booking fee setting (10%, edited at `/admin/pricing` → Payment)
13. `20261109000013_ride_formula.sql` — ride price formula (base + per km + per hour, minimum
    fare), vehicle factors incl. the new Economy and Standard sedans, area factors per town
14. `20261109000014_stop_entrance.sql` — stop entrance as free / included / paid at the gate;
    marks Tárcoles as a free stop
15. `20261109000015_nicoya_ferry.sql` — Gulf of Nicoya ferry fares and the Southern Nicoya
    area factor (Santa Teresa, Montezuma, Paquera), colones-per-dollar rate
16. `20261109000016_price_level.sql` — ride formula numbers on par with Daytrip (run once)
17. `20261109000017_driver_job_board.sql` — driver job board: payout + commission (20%), drivers read
    jobs and their trips through `driver_jobs()` / `my_trips()` (never the client's price), offers via
    `offer_job()`, the team accepts with `accept_offer()`
18. `20261109000018_driver_home_base.sql` — where each driver is based (`drivers.home_hub`), for ranking
    offers and spotting return trips
19. `20261109000019_driver_reviews.sql` — travellers' driver ratings (`driver_reviews`, weighted totals on
    `drivers`), review-request tracking on bookings
20. `20261109000020_review_reminder.sql` — tracks the one follow-up "please rate your driver" email
    (sent by the daily Vercel Cron job; needs `CRON_SECRET` in Vercel, see `.env.example`)
21. `20261109000021_stop_pricing.sql` — stops priced by waiting time ($20/h) + detour + guide fee;
    the flat stop price is retired
22. `20261109000022_tour_pricing.sql` — day tours per person, tiered by group size (1 / 2–3 / 4+);
    the flat tour price is retired
23. `20261109000023_tour_costs.sql` — company-paid tour costs per person (`day_tours.cost_pp`) and
    `bookings.company_costs`, deducted before the driver's share
24. `20261109000024_driver_trip_status.sql` — drivers start / complete their own trips
    (`driver_set_trip_status()`, `bookings.started_at` / `completed_at`)
25. `20261109000025_driver_settlements.sql` — weekly settlements: `bookings.driver_settled_at`,
    `my_trips()` returns `cash_to_collect` for cash trips
26. `20261109000026_device_tokens.sql` — push tokens for the mobile apps (`device_tokens`,
    `register_device()`)
27. `20261109000027_booking_ref_prefix.sql` — new booking references start with `CRPT-`
28. `20261109000028_driver_location.sql` — driver location around trips with consent
    (`driver_locations`, `tracking_window()`, `report_location()`, `set_location_consent()`)
29. `20261109000029_on_my_way_eta.sql` — "I'm on my way" step, arrival estimate columns, late alert
30. `20261109000030_test_payments.sql` — payments may be marked `provider = 'test'` (pre-launch test checkout)

Later files are added as the app grows. Since Option C is set up, they run by themselves
after a merge; each pull request still lists them.

**Option B — Supabase CLI.** `npx supabase link --project-ref <your ref>` then `npx supabase db push`.

**Option C — automatic on every merge (live project since 2026-11-09).** The GitHub Action
`.github/workflows/db-migrations.yml` runs `supabase db push` whenever a merge to `main`
changes `supabase/migrations/`, and can be started by hand (GitHub → Actions → Database
migrations → Run workflow). It runs only files the database hasn't recorded yet, in order, and
records each one, so a file never runs twice. If one fails, the run stops and GitHub emails
you; the site keeps working on its built-in numbers until it's fixed.

One-time setup:
1. Supabase → **Connect** (top of the project) → **Session pooler** → copy the URI. Replace
   `[YOUR-PASSWORD]` with the database password (reset it under Project Settings → Database
   if you don't have it). Use the session pooler: GitHub's machines can't reach the direct address.
2. GitHub → the repo → **Settings → Secrets and variables → Actions → New repository secret**:
   name `SUPABASE_DB_URL`, value the URI from step 1.
3. Before the first run, the database's list of already-run files must match this folder
   (files pasted into the SQL editor weren't recorded). Run this once in the SQL editor:

```sql
-- Record 0001–0014 as run (they were pasted by hand) and drop the 4 entries the dashboard
-- recorded under other names, so `db push` only runs 0015 onwards.
delete from supabase_migrations.schema_migrations
 where version not in (select v from (values
   ('20261014000001'),('20261014000002'),('20261014000003'),('20261014000004'),('20261014000005'),
   ('20261014000006'),('20261014000007'),('20261014000008'),('20261014000009'),('20261021000010'),
   ('20261108000011'),('20261108000012'),('20261109000013'),('20261109000014')) t(v));
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261014000001','core_schema'),('20261014000002','row_level_security'),
  ('20261014000003','seed_catalog'),('20261014000004','driver_applications'),
  ('20261014000005','review_fixes'),('20261014000006','driver_vehicles'),
  ('20261014000007','trip_requests'),('20261014000008','preferences_profiles'),
  ('20261014000009','trip_chat'),('20261021000010','advisor_fixes'),
  ('20261108000011','stop_corridors'),('20261108000012','payment_options'),
  ('20261109000013','ride_formula'),('20261109000014','stop_entrance')
on conflict (version) do nothing;
```

4. Optional but recommended, so new prices show at once instead of within the hour: make a
   random secret of at least 32 characters and save the **same value** twice: in Vercel →
   Settings → Environment Variables as `CATALOG_REVALIDATE_SECRET` (Production; redeploy), and
   in GitHub → Settings → Secrets and variables → Actions as `CATALOG_REVALIDATE_SECRET`. After
   each run the Action calls `/api/revalidate-catalog` with it, which clears the cached price
   list exactly like pressing Save in `/admin/pricing`.

Changes made directly in the database (SQL editor or this Action) don't clear the site's cached
price list by themselves; it refreshes within an hour, at once after any Save in
`/admin/pricing`, or at once via step 4.

From then on, **don't paste migration files into the SQL editor** (they'd run twice). New
migration files must be written so they're safe to run once in order, with a new, higher
timestamp than every file before them.

## 3. Connect it to Vercel
Supabase → **Project Settings → API**. Copy three values into Vercel → **Settings →
Environment Variables** (tick Production and Preview), then redeploy:

| Vercel variable | Supabase value |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | the **secret** key (`sb_secret_…`, or the legacy `service_role` key). Never share it or put it in the code; tick **Sensitive** in Vercel. Needed for trip requests from the website. |

(Alternative: Vercel → **Integrations → Supabase** sets these for you.)

## 4. Point sign-in emails at the site
Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://puravidaway-app.vercel.app` (later: your custom domain). The default
  `http://localhost:3000` makes sign-in links lead nowhere.
- **Redirect URLs → Add URL:** `https://puravidaway-app.vercel.app/**` (add the custom domain too
  when you have one).

## 5. Make yourself the admin
1. Open the site → **/login** → enter your email → click the **sign-in link** in the email, in the
   same browser. (You land on "this account doesn't have access" — expected.)
2. Supabase → **SQL Editor** → run (with your email):
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
3. Reload the site → **/admin** now opens.

Every later admin or driver is promoted from inside `/admin`; this SQL step is only for the first one.

## 6. Email with Resend (trip chat, request confirmations, login emails)
1. Sign up at [resend.com](https://resend.com) (free: 3,000 emails a month).
2. **Domains → Add domain** (the Costa Rica Private Transfers domain once bought) and add the DNS records it shows
   at your domain registrar. Until the domain is verified, Resend only delivers to the email
   address you signed up with, which is fine for testing.
3. **API Keys → Create API key** (permission "Sending access"). Copy it.
4. Vercel → **Settings → Environment Variables** (Production + Preview, tick **Sensitive** for the key), then redeploy:

| Vercel variable | Value |
| :--- | :--- |
| `RESEND_API_KEY` | the key from step 3 — **secret** |
| `EMAIL_FROM` | `Costa Rica Private Transfers <hello@your-domain>` (after step 2; leave unset until then) |
| `ADMIN_NOTIFY_EMAIL` | the team inbox that gets new requests and chat messages |
| `NEXT_PUBLIC_SITE_URL` | `https://puravidaway-app.vercel.app` (later: your domain) |

5. **Login emails through Resend too** (removes Supabase's few-per-hour limit): Supabase →
   Authentication → Emails → **SMTP Settings** → enable custom SMTP: host `smtp.resend.com`,
   port `465`, username `resend`, password = the Resend API key, sender = the `EMAIL_FROM` address.
   Then you can also brand the sign-in email and add the 6-digit code (`{{ .Token }}`), which the
   login page already accepts.

Without `RESEND_API_KEY` the app works the same; emails are simply not sent.

## 7. Keep the project awake
Free Supabase projects **pause after about 7 days without visits** (it happened in Oct–Nov 2026):
logins, `/admin`, trip requests and chat stop working until someone clicks **Restore** in the
Supabase dashboard (5–15 minutes). Before launch, move the project to the **Pro plan**
(about US$25/month, never pauses, daily backups). Until then, open the site and `/admin` at
least once a week.

## 8. Check the database matches the code
After running a new migration, open Supabase → **Advisors → Security Advisor**. It should show no
red "ERROR" items. If it lists "Security Definer View: open_trip_requests", file 10 hasn't been
run yet.

## Checking the security rules
`npm run test:db` replays the migrations in a throwaway in-memory Postgres and runs 184 checks
(clients can't see each other's bookings, drivers can't approve themselves, nobody but the server
can record payments, and so on).
