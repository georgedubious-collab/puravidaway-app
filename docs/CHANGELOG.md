# Changelog

Every merged change gets one line: `YYYY-MM-DD — <AI or Jorge> — <what changed>`.
Newest entries first. AIs: read the top of this file before starting work.

- 2026-10-14 — Claude — Ride preferences, driver profiles, trip page (migration 0008). The ride
  builder asks for the driver's language (English-speaking / Spanish or basic English is fine),
  Wi-Fi, stroller, child seats (0–4), pets and a message for the driver (phone numbers, emails and
  links are refused so trips stay on the platform); saved on the booking and shown in the drivers'
  open-request view and admin dispatch, where each driver + vehicle option shows ✓ or what it
  doesn't cover. Drivers add a bio and English level; vehicles list Wi-Fi, child seats, stroller
  space and pets (changes after approval flagged for review). New private trip page
  `/trip/<trip id>` (linked after sending a request): bookings, status and, once confirmed, the
  driver's photo, first name, languages, bio, ICT badge, car, plate and car photos. Extras are free
  for now (§9 #10). 133 database checks.

- 2026-10-14 — Claude — Phase 2d part 1, trip requests: the trip panel now sends the trip online
  (name, email, WhatsApp, notes; spam trap). Cart items carry what was chosen (`spec`), and the
  server re-prices each one from the live catalog before saving (`src/lib/tripRequest.ts`,
  `src/app/trip/actions.ts`); changed prices are shown back for re-confirmation. Bookings are
  written with the server-only secret key (`SUPABASE_SERVICE_ROLE_KEY`); without it the panel says
  to use WhatsApp. New `/admin/bookings` (grouped by trip, status filter) and booking detail
  (status, approved driver + vehicle, amount received, internal notes in admin-only
  `booking_admin_notes`). Migration 0007. 121 database checks.

- 2026-10-14 — Claude — Drivers can register several vehicles (new `driver_vehicles` table,
  migration 0006). Each vehicle has its own plate, seats, registration (tarjeta de circulación),
  insurance / Dekra / Marchamo documents and dates, and 2–12 photos (one showing the plate), and is approved by the admin separately. Driver documents are now: photo,
  ID front, ID back, licence, criminal record certificate (must be ≤ 30 days old when first
  approved; the approve button checks), optional ICT permit. A driver gets trips only with a
  current licence and at least one approved vehicle with current documents. Vehicle columns moved
  off `drivers`. 111 database checks.

- 2026-10-14 — Claude — Fixes from the independent review of Phase 2b. Security: sign-in
  `next=` links can no longer send people to another website (`src/lib/safeNext.ts`); sign-out
  only accepts requests from our own pages; users can't change their profile email; drivers see
  open requests through `open_trip_requests` (no client id, coordinates or flight notes); bid
  amounts are frozen once a request closes or the driver isn't approved (migration 0005).
  Correctness: a failed catalog read is no longer cached for an hour; switching off every lodging
  tier no longer breaks the home page, and tiers tied to one expedition only show there; "from
  +$X" upgrade price follows the database; route pages survive no fitting vehicle and show the
  default season's name and price; pricing saves that change nothing now say so; the home page's
  `?code=` redirect keeps `next`. 96 database checks.

- 2026-10-14 — Claude — Phase 2c (driver KYC vault): `/driver` lets any signed-in user apply
  (name, WhatsApp, licence/insurance/Dekra/Marchamo/criminal-record details, vehicle), upload the
  9 required documents + optional ICT permit to the private bucket, and see status and the team's
  message. `/admin/drivers` lists applications by state; the detail page shows details next to
  10-minute document links and approves (also grants the driver role), rejects, suspends or marks
  changes checked. Migration 0004: review fields, `needs_review` on driver edits, own-folder
  document links, on-duty only when approved, bucket type/size limits, explicit API grants.
  Dashboard reuses `expiryIssues` and links to drivers; footer link "Drive with PuraVidaWay".
  Document validity: approved drivers stop receiving trips when the licence expires (no grace),
  INS insurance is more than 15 days past expiry, the Marchamo isn't for the current year (no
  grace) or the Dekra has expired (no grace); renewed dates are entered with the upload of the
  new document. Fixed: role change to driver now reports a failed KYC-row insert. 90 database checks.

- 2026-10-14 — Claude — Sign-in by email link: `/auth/callback` finishes the sign-in from
  Supabase's default email (which has a link, not a code, without custom SMTP); the home page
  forwards a stray `?code=` there; login page now says "click the link", keeps the code box as a
  fallback and explains expired links. SETUP-SUPABASE.md gains the Site URL / redirect URL step.

- 2026-10-14 — Claude — Phase 2b, part 3 (pricing manager): the storefront and route pages read
  the catalog through `getCatalog()` (`src/lib/catalogSource.ts`): database when Supabase is
  connected, built-in `catalog.ts` otherwise or if the database fails; cached 1 h and refreshed the
  moment an admin saves. Season lookup now uses date ranges (`seasonForYmd`; identical to the old
  rule on every day 2025–2040). `/admin/pricing` edits vehicles, stops (incl. corridors, park fee,
  add new), day tours (per-tour en-route price), expeditions, lodging tiers, season multipliers and
  season dates, with inline "Saved" / error messages. Ride builder blocks adding a ride when no
  live vehicle fits the group.

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
