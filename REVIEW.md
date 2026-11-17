# Review instructions

Rules for whoever reviews a pull request in this repo (Gemini Code Assist today; Claude Code
Review reads this file too). The builder's side of the same rules is the `verify` skill
(`.claude/skills/verify/SKILL.md`). Project context is in `CLAUDE.md` and `docs/PROJECT.md`.

## What Important means here

Mark a finding Important (blocking) only if it could:

- charge, refund or pay out the wrong amount;
- show one person's data to another (traveller contact details, driver identity documents,
  the client's price or the commission to a driver, chat between other people);
- let someone do what only the team may do (approve a driver or vehicle, change a role, accept
  an offer, edit a booking);
- lose or corrupt bookings, or break a migration that has to run once on the live database;
- name the owner, Costa Rica Travel Planner or La Familia Mágica in anything a customer or
  driver sees.

Everything else is a suggestion. Report at most five suggestions per review.

## Always check

- **Tests came with the change.** A new rule or a bug fix without a test that fails without it
  is Important. So is a pull request that deletes, skips or loosens an existing test without
  saying why.
- **Who can write each new column.** Drivers may update their own rows in `drivers` and
  `driver_vehicles`; users their own row in `profiles`. A new column there that the team is
  meant to control needs a guard trigger and a test (history: rating and seat count, migration
  0060, 2026-11-16).
- **New tables** have RLS on, policies, and checks in `supabase/tests/rls.test.mjs` for visitor,
  client, another driver and admin.
- **`security definer` functions** check the caller inside the function and set `search_path`.
- **New API routes** start with `signedIn()` or a secret check, and rate-limit anything public.
- **Service-role code** (`createSupabaseAdminClient()`) confirms the signed-in person owns the
  trip or booking before touching it, and is never imported by a client component.
- **Prices and payments** are computed on the server from the database; nothing trusts an
  amount, id or role sent by the browser or the apps.
- **Migrations** have a timestamp later than every existing file and are safe to run exactly once.
- **The pull request says how it was verified.** No "Verified" section, or "Verified: none" on
  a change to money, permissions or sign-in, is Important.

## Do not report

- Anything the "Checks" Action already enforces: code style, type errors, failing tests.
- `package-lock.json`, generated files, and `legacy/`.
- Wording preferences in Spanish or English copy, unless the text is wrong or breaks the
  brand-separation rule above.

## Evidence

A claim that something is exploitable or broken needs a `file:line` reference and the steps or
the query that shows it, not a guess from a name.

## Changes to the checks themselves

A pull request that edits this file, `.github/workflows/checks.yml`, `scripts/test-all.mjs` or
the `verify` skill should change nothing else, so a change is never reviewed by rules it rewrote.
