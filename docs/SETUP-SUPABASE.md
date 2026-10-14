# Setting up Supabase (one time, ~15 minutes)

Supabase is the database, login system and file storage for PuraVidaWay. The app keeps
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

Later files are added as the app grows; each pull request says when there's a new one to run.

**Option B — Supabase CLI.** `npx supabase link --project-ref <your ref>` then `npx supabase db push`.

## 3. Connect it to Vercel
Supabase → **Project Settings → API**. Copy three values into Vercel → **Settings →
Environment Variables** (tick Production and Preview), then redeploy:

| Vercel variable | Supabase value |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key — **secret**, never share or put in the code |

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

## 6. Login emails
Without your own email server, Supabase sends its default email: a **sign-in link** (handled by
`/auth/callback`), limited to a few emails per hour. Before launch, add SMTP (Authentication →
Emails → SMTP Settings) with a PuraVidaWay mailbox or a service like Resend. That also lets you
brand the email and add a 6-digit code (`{{ .Token }}`), which the login page already accepts.

## Checking the security rules
`npm run test:db` replays the migrations in a throwaway in-memory Postgres and runs 111 checks
(clients can't see each other's bookings, drivers can't approve themselves, nobody but the server
can record payments, and so on).
