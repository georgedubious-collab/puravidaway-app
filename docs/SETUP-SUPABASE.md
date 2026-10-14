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

## 4. Make yourself the admin
1. Open the site → **/login** → enter your email → type the 6-digit code from the email.
2. Supabase → **SQL Editor** → run (with your email):
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
3. Reload the site → **/admin** now opens.

Every later admin or driver is promoted from inside `/admin`; this SQL step is only for the first one.

## 5. Login emails
Supabase → **Authentication → Email Templates → Magic Link**: make sure the template shows the
code, e.g. `Your PuraVidaWay code: {{ .Token }}`. Supabase's built-in email sender is limited to a
few emails per hour; before launch, add your own SMTP (Authentication → SMTP Settings), for example
a PuraVidaWay mailbox on your email provider or Resend.

## Checking the security rules
`npm run test:db` replays the migrations in a throwaway in-memory Postgres and runs 56 checks
(clients can't see each other's bookings, drivers can't approve themselves, nobody but the server
can record payments, and so on).
