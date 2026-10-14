# Changelog

Every merged change gets one line: `YYYY-MM-DD — <AI or Jorge> — <what changed>`.
Newest entries first. AIs: read the top of this file before starting work.

- 2026-10-14 — Claude — Phase 2b, part 2 (logins + admin): email-code sign-in at `/login`
  (Supabase Auth via `@supabase/ssr`), `src/proxy.ts` keeps sessions fresh on `/admin`, `/account`
  and `/login` only, `requireRole()` re-checks the role on every admin page and action. `/admin`
  dashboard (bookings by status, drivers waiting for approval, licence / INS / Dekra / Marchamo
  expiring in 30 days) and `/admin/users` to make people drivers or admins. Works without Supabase
  keys (shows a setup notice).

- 2026-10-14 — Claude — Phase 2b, part 1 (database): Supabase migrations for every PROJECT.md §7
  table, row-level security per §7.7, guards so only admins change roles/KYC status and drivers can
  only withdraw bids, private `driver-kyc-docs` bucket, `season_for_date()` with season date ranges
  (2026–2031, incl. Semana Santa), and a catalog seed generated from `catalog.ts`.
  `npm run test:db` runs 56 security checks in an in-memory Postgres. Setup guide:
  `docs/SETUP-SUPABASE.md`.

- 2026-10-14 — Claude — Review fixes for PR #2 (applied on top of the app-first redesign): page
  is server-rendered per request (was a blank loading shell with no SEO content); `today` is
  computed server-side in Costa Rica time and passed down, no `new Date()` in client render;
  stored trip validated before use; trip drawer closes on Escape; WhatsApp number validated with
  a build-time warning; Semana Santa added to peak season; deposit uses integer math; form
  controls labelled; bid offer minimum is consistently $50 and messages say the offer covers
  ride + stops; `.env.example` now committed; COMPETITORS.md per-person price derivation
  corrected. Fixes to the app-first redesign: removed customer-facing claims for features that
  don't exist yet (rating drivers after every ride; ICT badge on driver profiles), replaced the
  leftover blanket "ICT-certified naturalist guides" with "Local naturalist guides", route page
  season note now states peak weeks (+25%) not just Dec–Apr (+15%), builder switcher uses
  pressed toggle buttons instead of incomplete ARIA tabs, route page content wrapped in `<main>`.

- 2026-10-14 — Claude — App-first storefront: the trip is a persistent sidebar on desktop (legs
  in date order, 20%/full payment, WhatsApp booking, trust panel) and a bottom bar + drawer on
  phones; numbered module tabs replaced by "Add to your trip: Ride / Day tour / Expedition".
  New `/transfers/[slug]` route landing pages (first: SJO Airport → Manuel Antonio) that pre-fill
  the builder via `?from=&to=`. Trust content in `src/lib/trust.ts`: driver checks (Daytrip-style
  wording), marketplace carrier note (GetTransfer-style), guarantees; reviews and ratings render
  only once real ones are added. Cancellation terms left out until PROJECT.md §9 #7 is decided.

- 2026-10-14 — Claude — Brand separation: removed Costa Rica Travel Planner and "Jorge" from
  every customer-facing string (header badge, footer, page description, WhatsApp messages,
  expeditions heading); driver copy changed from blanket "ICT-certified" to local partner
  drivers. Rule added to PROJECT.md §10 and CLAUDE.md.

- 2026-10-14 — Claude — COMPETITORS.md §2c GetTransfer "from" prices for 9 Costa Rica routes vs
  Daytrip; §2d exact pick-up/drop-off analysis (map place search, zone + distance pricing) with
  requirements for our transfer form; Sierpe road drop-off added to the Daytrip grid.
- 2026-10-14 — Claude — COMPETITORS.md §2b: Daytrip per-vehicle price grid for 12 Costa Rica
  routes (Nov 2026 quote), stop pricing, pricing behaviour (distance from SJO, supply elsewhere),
  plus SJO→Drake Bay and SJO→Puerto Jiménez (Daytrip sells both; it does not sell the Sierpe
  boat connection, permits or Corcovado logistics).
- 2026-10-14 — Claude — COMPETITORS.md §1b: driver economics from real Daytrip statements (~30%
  cut) and GetTransfer's carrier commission tiers (13–25%); corrected the outdated 5% claim.
- 2026-10-14 — Claude — Added `docs/COMPETITORS.md` (Daytrip, GetTransfer, Welcome Pickups
  business models, Costa Rica price points, openings, per-PR checklist) and linked it from
  PROJECT.md, CLAUDE.md and GEMINI.md as the standing benchmark.
- 2026-10-14 — Claude — Phase 2a: rebuilt the storefront on Next.js 16 + TypeScript + Tailwind.
  Typed catalog and cents-based pricing engine with season multipliers; working Transfers
  (corridor-filtered stops, vehicle classes, live route summary, fixed/bid toggle), Day Tours
  (Smart En-Route upgrade), Expeditions (lodging tiers, itineraries); Trip Cart with 100% / 20%
  deposit and WhatsApp booking link. Old prototype moved to `legacy/index.html`. Added
  `.env.example`. Needs `NEXT_PUBLIC_WHATSAPP_NUMBER` in Vercel. Bid mode prices the cart
  item at the client's offer (fixed price shown for reference; warning below 70%).
- 2026-10-13 — Claude — Merged Architecture.md, Database-Schema.md, Route-Pricing.md and the
  Gemini master spec into `docs/PROJECT.md` as the single source of truth; corrected it to the
  real repo state (no admin.html; index.html JS truncated; Phase 1 is a design mock, not
  completed). Added `CLAUDE.md` (builder rules), `GEMINI.md` + `.gemini/styleguide.md` (reviewer
  rules) and this changelog. Decision recorded: rebuild on Next.js + TypeScript + Supabase
  (PROJECT.md §2), Claude as primary builder with Gemini as PR reviewer (§10).
