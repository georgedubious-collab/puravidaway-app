---
name: verify
description: Prove a change works before committing or opening a pull request in this repo. Runs the checks, exercises the changed flow in the running app, and walks the security checklist for the kind of change made. Use before every commit, and whenever asked to "verify", "check" or "test" a change.
---

# Verify a change (Costa Rica Private Transfers)

Travellers pay through this app and drivers upload identity documents to it. A change is done
when there is evidence it works, not when the code looks right. Do all four steps, in order.

## 1. Run the checks (about a minute)

```
npm run verify
```

That is the code-style check, the type check and every `test:*` suite (`scripts/test-all.mjs`).
The same command runs on every pull request (`.github/workflows/checks.yml`).

- A new rule gets a test in the same pull request. Pick the suite by what changed:
  database rules and permissions → `supabase/tests/rls.test.mjs`; prices → `test:fixed`,
  `test:night`, `test:pinned`, `test:stops`; job board and offers → `test:dispatch`,
  `test:eligibility`; money between company and driver → `test:money`; sign-in codes →
  `test:auth-code`. A new suite is a new `test:<name>` script in `package.json`.
- For a bug fix, write the test first and watch it fail, then fix. A test that never failed
  proves nothing.
- Never make a check pass by weakening it: no deleting or skipping a failing test, no retry
  loops, no added waits, no loosening an assertion. If a test is wrong, say why in the pull
  request and change it there in plain sight.

If the change touches the public site (anything under `src/components`, the booking flow,
prices shown to travellers, public pages), also run the browser tests:

```
npm run e2e
```

A phone-sized browser picks a ride, checks the price stays the same from the vehicle card to
the final total, sends the request and opens every main public page (`e2e/`, a minute or two;
first time on a new computer: `npx playwright install chromium`). They run with no database
keys, so they cannot touch real bookings. A change to the booking flow gets a browser test in
the same pull request.

If the change touches sign-in, the trip page, the team's booking page, the job board, offers,
trip status, ratings or payouts, also run the full-trip tests (needs Docker running):

```
npm run e2e:full
```

They start a throwaway local database from `supabase/migrations`, then walk one trip through
real browsers: traveller books, team posts the job, driver offers, team accepts, driver drives,
traveller rates (`e2e/full/trip.spec.ts`). They also check what each person must not see. On a
computer without Docker, push the branch and read the `e2e-full` result on the pull request.

## 2. Run the change itself

Tests cover rules; they do not show that the screen works.

- Website and admin: `npm run dev`, open the page that changed and use it the way the person
  would (traveller, driver or team). Without Supabase keys the storefront runs on the built-in
  catalog; `/login`, `/admin` and `/driver` need `.env.local` (`docs/SETUP-SUPABASE.md`).
- Check the phone width first (the site is mobile-first) and both languages if text changed.
- Mobile apps (`apps/client`, `apps/driver`): start the app's web preview
  (`EXPO_PUBLIC_PREVIEW=1`, see each app's README) and open the changed screen.
- Database migration: it must run exactly once, in order, on top of all earlier files.
  `npm run test:db` builds a fresh database from every migration, so a broken one fails there.
  After the merge, check the "Database migrations" Action and confirm the live database with a
  read-only query. Never run a migration by hand against the live project.

Say in the pull request what was actually exercised. If something could not be run, say so.

## 3. Security checklist: only the lines your change triggers

| If the change… | Then check |
| :- | :- |
| adds a table | RLS is on, policies are written, and `rls.test.mjs` acts as visitor, client, another driver and admin against it |
| adds a column to `profiles`, `drivers`, `driver_vehicles` or `bids` | Who may write it? Drivers can update their own rows, so anything the team decides (status, rating, category, holds, review fields) needs a guard trigger and a test that a driver's own attempt is ignored or refused (see migrations 0038, 0042, 0060) |
| adds or changes a `security definer` function | It checks who is calling inside the function (`is_admin()`, `is_approved_driver()`, `auth.uid()`), sets `search_path`, and returns only what that caller may see. Functions only the server calls have `execute` revoked from `anon` and `authenticated` |
| adds an API route | It starts with `signedIn()` or a secret check (cron routes), anything public has a rate limit, and it never trusts an id, price or role sent by the app |
| touches prices, promo codes, payouts or payments | The amount is computed on the server from the database. Money is `numeric(10,2)`; no float arithmetic on prices |
| uses `createSupabaseAdminClient()` | The file is server-only, and the code checks that the signed-in person owns the trip or booking before reading or writing it |
| shows data to a driver | No traveller full name, phone, email, address or client price (`driver_jobs()`, `my_trips()` only) |
| shows data to a traveller | No driver identity documents, licence or insurance numbers, and no payout or commission |
| changes customer-facing text | It never names the owner, Costa Rica Travel Planner or La Familia Mágica |
| adds an environment variable | Secret values have no `NEXT_PUBLIC_` or `EXPO_PUBLIC_` prefix and are added to `.env.example` with a comment, never with a real value |
| adds a dependency | Say why in the pull request; run `npm audit --omit=dev` |

## 4. Three tries, then stop

If a check still fails after three real attempts at the cause, stop. Tell Jorge in plain words
what fails, what was tried and what the options are. Do not keep changing things until it turns
green, and do not commit with a failing check.

## What to write in the pull request

End the description with a "Verified" section: the result of `npm run verify`, what was
exercised in the running app, which checklist lines applied, and anything not verified. Write
"Verified: none" if nothing was, rather than leaving it out.

## Keeping this file useful

When a bug reaches `main`, add one line here or to `REVIEW.md` that would have caught it, with
the date and pull request. Remove lines that no longer apply; a long checklist stops being read.
