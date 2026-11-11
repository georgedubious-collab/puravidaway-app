# CLAUDE.md — Costa Rica Private Transfers

## First, read
- `docs/PROJECT.md` — the single source of truth (product, stack, schema, pricing, roadmap).
- `docs/changelog/` (newest notes, one file per PR) and the top of `docs/CHANGELOG.md` — to see what
  changed since your training of this repo.
- `docs/SEO.md` — the website and organic-traffic plan (site map, content order, schema rules).
- `docs/COMPETITORS.md` — Daytrip, GetTransfer and Welcome Pickups are the benchmark for every
  decision. Run its §5 checklist on any UI or pricing change.

## Who you work for
Jorge Li, founder of Costa Rica Travel Planner. Solo operator, non-engineer: explain decisions
plainly, avoid jargon, and never assume a dev-team workflow (no "ask your backend engineer").

## Workflow rules
- **Never commit or push directly to `main`.** `main` auto-deploys to production on Vercel.
  Branch → pull request → Vercel preview → Gemini Code Assist review → Jorge merges.
- Keep PRs small and focused; one concern per PR.
- If a change affects anything stated in `docs/PROJECT.md`, update that doc in the same PR.
- Add a changelog note in every PR as its **own new file** `docs/changelog/YYYY-MM-DD-<topic>.md`
  containing `- YYYY-MM-DD — Claude — <what changed>`. Don't edit the top of `docs/CHANGELOG.md`
  in feature PRs (it caused merge conflicts); notes are folded into it in a separate PR
  (`docs/changelog/README.md`).
- Database migrations run automatically after a merge to `main`
  (`.github/workflows/db-migrations.yml`, `docs/SETUP-SUPABASE.md` Option C). Every new migration
  gets a timestamp later than all existing files and must be safe to run exactly once, in order.
  Never tell Jorge to paste a migration into the SQL editor; after a merge with a migration,
  check the Action's run and verify the live database with a read-only query.
- Open decisions live in `docs/PROJECT.md` §9. Don't silently decide them; ask Jorge or flag
  the assumption in the PR description.

## Engineering rules
- Next.js App Router + TypeScript strict + Tailwind. No new frameworks without discussion.
- Supabase: every table gets RLS (policies in `docs/PROJECT.md` §7.7). Never expose the service
  role key to the client; server-only code goes in route handlers / server actions.
- Payments (Green Pay) are server-side only. Never log or store card data.
- Driver KYC data (Cédula, license, insurance) is sensitive: admin + owning driver only.
- Prices are USD `numeric(10,2)`; apply season multipliers from the DB, not hardcoded.
- Mobile-first responsive; the design reference is the original prototype (emerald/amber,
  Plus Jakarta Sans) — see `docs/PROJECT.md` §3.
- Customer-facing text never names the owner, Costa Rica Travel Planner or La Familia Mágica
  (brand separation, `docs/PROJECT.md` §10). Say "Costa Rica Private Transfers" or "our team".
- ICT permits are a per-driver badge, not a site-wide promise; see `docs/PROJECT.md` §10.
- No secrets in the repo. Env vars live in Vercel and `.env.local` (gitignored).
- Mobile apps receive over-the-air updates (EAS Update, channel `main`): after a merge that only
  changes app screens, wording or logic, run `scripts/app-update.sh client|driver|both "<what>"`
  from an up-to-date `main`. A change that adds or upgrades a native library needs a new build and a
  higher `version` in that app's `app.json` first (the version decides which phones get an update).

## Domain context (Costa Rica)
- Drivers must hold ICT tourism permits; vehicles need current Marchamo, INS commercial
  insurance and Dekra (RTV) inspection.
- Corcovado requires SINAC permits booked in advance; Sirena Station overnights are capacity-limited.
- Poás Volcano uses timed-entry tickets.
- Drive times are mountain-road realistic, never straight-line estimates.
- Client communication is WhatsApp-first.
