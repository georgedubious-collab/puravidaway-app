# Changelog

Every merged change gets one line: `YYYY-MM-DD — <AI or Jorge> — <what changed>`.
Newest entries first. AIs: read the top of this file before starting work.

- 2026-11-08 — Claude — Competitor gaps (COMPETITORS.md §5). Vehicle cards and route pages show the
  price per car **and** "from $X per person (N travellers)" (car price ÷ the class's max
  passengers, rounded up to whole dollars). "Every ride includes" list from one place
  (`RIDE_PROMISES` in `src/lib/trust.ts`): flight tracking (airport pickups only), 60 min free
  waiting, child seats free on request, free cancellation up to 24 h; luggage stays on each card.
  No blanket "English-speaking driver" claim. After a ride is added, an inline, dismissible
  "While you're in …" suggestion offers 1–2 day tours / expeditions in the drop-off's region
  (`HUB_REGION`, `EXPEDITION_REGIONS`; otherwise the first ones in catalog order); one click opens
  that tab with the item highlighted and the date set to the day after the ride. Shareable ride
  links: from, to, date, time, passengers, vehicle and stops live in the address (debounced
  `replaceState`, validated against the catalog on load, old `?from=&to=` links still work, no
  personal details), plus a "Copy a link to this ride" button. Stop cards show "Park entrance
  included" / "Park entrance paid at the gate" from `sightseeing_stops.park_fee_included`. The per-person price splits a car between at most 7 travellers (vans seat 10), as Daytrip does.

- 2026-11-08 — Claude — Payment options (migration 0012), replacing the 20% deposit: pay online in
  full (secure payment link sent once the trip is confirmed; online payment isn't live yet), or pay
  the driver in cash + a 10% cash booking fee on rides and 1-day tours; expeditions are online in
  full only. The fee lives in the new `pricing_settings` table (public read, admin write), is
  edited at `/admin/pricing` → Payment, re-priced on the server and saved per booking
  (`bookings.cash_fee`). Trip summary shows "Cash booking fee (10%) +$X", cash vs online amounts
  and a per-item label when an expedition is mixed in; WhatsApp message, emails, admin bookings
  and trip page updated. Old carts / open tabs with `deposit_20` load as "online in full".
  Guarantees: "Price confirmed before you pay" (was "Price locked when you book"), new "Free
  cancellation up to 24 h before pickup" (links to /cancellation), ICT note no longer says "coming
  soon". 184 database checks.

- 2026-11-08 — Claude — Ride builder fixes (migration 0011). Drive times for all 36 hub pairs
  (Daytrip times where known, Drake Bay = road to Sierpe + 75 min boat; a type check makes every
  pair required). Stops are now "optional extras" offered only when both pickup and drop-off are on
  the stop's corridor list (one-town stops on any ride to/from that town; none on the Sierpe ↔
  Drake Bay boat); corridor lists reviewed (Tárcoles/Carara add Monteverde, Río Celeste drops
  Tamarindo). Pickup time (04:00–22:00, 15 min, default 9:00) in the ride builder, stored in
  `scheduled_at` (Costa Rica time) and shown in the cart, emails, admin, driver and trip pages
  (old carts load with 9:00; tours 7:00, expeditions 6:00). Vehicle and stop cards show the
  season-adjusted price with a "High season +15%" note, matching the total. 170 database checks.

- 2026-11-08 — Claude — Launch prep: the site stays hidden from search engines (noindex +
  `robots.txt` block) until `NEXT_PUBLIC_SITE_INDEXABLE=true`; `robots.txt` then hides the
  private areas and lists `sitemap.xml`. Site address from `NEXT_PUBLIC_SITE_URL`, link previews
  (Open Graph/X card + branded preview image), custom 404/error pages with a WhatsApp help link,
  Vercel Web Analytics, and eight new route landing pages (SJO → La Fortuna, Monteverde,
  Tamarindo, Puerto Viejo, Sierpe; LIR → Tamarindo; La Fortuna → Monteverde, Manuel Antonio)
  whose "Other rides" links now go to landing pages where they exist. Privacy policy now mentions the cookie-free Vercel visit statistics.

- 2026-11-08 — Claude — Legal pages (draft, pending lawyer review): `/terms`, `/privacy` and
  `/cancellation`, with "Last updated" date, a visible draft notice and a placeholder for the
  operator's legal name, cédula jurídica and address. The privacy policy lists only the data the
  app really stores. Cancellation rules as decided by Jorge (PROJECT.md §9 #7). Footer links on
  the home and route pages; consent line under "Send trip request".

- 2026-11-08 — Claude — COMPETITORS.md: corrected Welcome Pickups (it does operate at SJO); new
  §1a local alternatives (shared shuttles ~$64 pp, local private vans, Uber/DiDi, rental cars) and
  where we win; §5 checklist now shows today's status and which PR closes each gap.

- 2026-11-08 — Claude — New `docs/PRICING.md`: ride pricing analysis and recommendation. Exact
  place search + road distance/time, a per-km + per-hour formula with minimum fare, vehicle and
  area factors (incl. a new Economy class with a Spanish-speaking driver), stops priced as wait +
  detour, and fixed prices for travellers with drivers claiming jobs instead of public bidding.
  Linked from PROJECT.md §9 #1, #3 and #10. Nothing built yet.

- 2026-11-08 — Claude — Docs brought up to date: PROJECT.md §3 now matches what is built
  (logins, admin, driver portal, trip requests, chat) and what isn't (online payment, bidding,
  GPS, `/account`); icons are lucide-react; seasons live in the database; duplicate trip-chat RLS
  rule merged; §4.4 explains travellers use the private trip page. Recorded Jorge's payment
  decision (§6.4): pay online in full or pay the driver in cash + 10% cash booking fee, no 20%
  deposit (code change follows in its own PR). Brought in the mobile-apps plan from the unmerged
  Oct 14 branch (§2, §8, §9 #12–#15, §11: Expo, two apps, new S.A. as publisher, account
  deletion rule). `.env.example` gains the email and site settings; SETUP-SUPABASE.md gains
  "keep the project awake" and an advisor check. **Correction:** the 2026-10-21 entry below said
  migration 0010 was applied; on 2026-11-08 the live database still had the old view, so it has
  to be run in the SQL editor.

- 2026-11-08 — Claude — Security update: Next.js and eslint-config-next 16.4.0 → 16.4.5. Fixes
  the critical `npm audit` finding (GHSA-2464-fhr4-w9xw remote code execution via SVG image
  optimization, GHSA-673q-mjm6-r5xr remote code execution in `use cache`, GHSA-p3m5-59mp-jv5r
  Server Actions denial of service). Production dependencies now audit clean; 8 moderate findings
  remain in the lint tooling only (minimatch, dev-only, not shipped). Lockfile re-resolved so
  `npm ci` accepts it (npm 11 had dropped optional `@emnapi` wasm packages).

- 2026-10-21 — Claude — Supabase security-advisor fixes (migration 0010): the drivers' open-request
  list is now the function `open_trip_requests()` (same safe columns) instead of an owner-rights
  view, and four helper functions get a fixed `search_path`. Migrations can now be applied
  through the Supabase connection instead of the SQL editor. 168 database checks.

- 2026-10-14 — Claude — Trip chat (Phase 4, migration 0009). One thread per booking between the
  traveller (on their private trip page, no account), the assigned driver (new `/driver/trips`
  and trip detail) and the team (admin booking page). Server actions check the trip link or the
  sign-in, then read/write with the server key; travellers and drivers can't share phone
  numbers, emails or links (app + database), the team can. New messages refresh every 8 s and
  are emailed through Resend (`src/lib/email.ts`) at most once until the recipient reads (or
  after 30 min). Trip requests now email the traveller a confirmation with the trip-page link and
  the team a new-request alert. The trip panel now leads with email + chat; WhatsApp is optional.
  Drivers see the traveller's phone only from the day before the trip, and don't see the price.
  Security review fixes before merge: traveller contact details and the trip link moved to a
  server-only `trips` table (drivers could read them on their booking row); trip pages use a
  separate 64-character code (`/trip/<code>`), not the trip id; trip requests limited to 5 an
  hour per network and 3 per email (atomic `allow_trip_request`); chat flood guard and email
  "slots" are claimed in one database step (`post_chat_message`, `claim_chat_email`), and no
  email goes out while the recipient is reading; the contact filter now allows written dates and
  catches "8888_1234", "pepe at gmail dot com" and @handles; no posts on cancelled bookings;
  suspended drivers lose chat access. 168 database checks.

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
