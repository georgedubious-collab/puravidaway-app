# PuraVidaWay — Master Project Specification

> **This is the single source of truth for PuraVidaWay.** It merges and replaces
> `Architecture.md`, `Database-Schema.md`, `Route-Pricing.md` and the Gemini-drafted
> master spec (October 2026). If code and this document disagree, fix one of them in
> the same pull request and log it in a changelog note (`docs/changelog/`).

| | |
| :--- | :--- |
| **Owner & founder** | Jorge Li — Costa Rica Travel Planner (Flores, Heredia, Costa Rica) |
| **Repository** | `georgedubious-collab/puravidaway-app` (connected to Vercel; `main` deploys to production) |
| **Vercel project** | `puravidaway-app` — team "Jorge Li's projects" |
| **Production URL** | https://puravidaway-app.vercel.app |
| **Spec last reviewed** | 2026-11-08 |

---

## 1. What PuraVidaWay is

An all-in-one Costa Rica travel platform that combines four
revenue engines in one booking flow and one cart:

1. **Daytrip-style sightseeing transfers.** Private point-to-point transfers where travelers add
   curated 45–120 minute stops (wildlife, volcano, waterfall) along the corridor while the
   driver stays with the luggage in the locked vehicle.
2. **GetTransfer-style driver bidding.** Travelers choose instant **Fixed Price** or **Driver
   Bids**: they name an offer in USD and compare bids from verified local drivers.
3. **1-day private eco-tours** with an optional **Smart En-Route Transfer (+$65)** that turns a
   day tour into a city-to-city hotel transfer.
4. **Signature multi-day expeditions** (Corcovado / Osa, Classic Trifecta) with selectable lodging
   tiers, SINAC permits, Sierpe boat logistics and certified naturalist guides.

Target market: travelers from the US, Canada and Europe. Sales are high-touch, with WhatsApp as
the primary conversation channel.

**Competitive benchmark (standing rule):** PuraVidaWay competes with **Daytrip**, **GetTransfer**
and **Welcome Pickups**. Every pricing, product and UX decision is checked against them — see
`docs/COMPETITORS.md` for the analysis and the per-PR checklist.

---

## 2. Tech stack (decided 2026-10-13)

| Layer | Choice |
| :--- | :--- |
| Framework | **Next.js (App Router) + React + TypeScript (strict)** |
| Styling | Tailwind CSS; lucide-react icons; Plus Jakarta Sans |
| Hosting / CI | Vercel, deployed from GitHub. Every PR gets a preview URL; merging to `main` deploys production |
| Database / Auth / Files | Supabase — PostgreSQL, Auth (roles: `client`, `driver`, `admin`), Storage, Realtime |
| Payments | Green Pay S.A. (Costa Rica), called server-side only |
| Maps | Leaflet + OpenStreetMap (admin fleet map) |
| CRM | HubSpot (lead pipeline sync, Phase 4) |
| Messaging | WhatsApp deep links now; WhatsApp Business API in Phase 4 |
| Mobile (Phase 5) | **Expo (React Native + TypeScript)** (decided 2026-10-14). Two apps: driver app first, then client app, sharing the pricing code with the website. Full plan in §11 |

---

## 3. Current state of the code (2026-11-09)

- **Next.js 16 (App Router) + TypeScript strict + Tailwind 4**, in `src/`.
- `src/lib/catalog.ts` — the §5 catalog as typed data (prices in integer cents). Since Phase 2b this is the
  **built-in fallback**: the live catalog comes from Supabase via `getCatalog()`
  (`src/lib/catalogSource.ts`) and is edited at `/admin/pricing`.
- `src/lib/pricing.ts` — the §6 pricing engine (season multipliers in basis points, cents math).
- `src/lib/cart.ts` — Trip Cart model, payment options (online in full / cash to the driver +
  cash booking fee, `cartTotals()`), WhatsApp deep-link builder.
- `src/components/` — storefront UI: `Header`, `TransfersView`, `DayToursView`,
  `ExpeditionsView`, `CartDrawer`, `Toast`, `Storefront` (state + localStorage cart).
- Legal pages (2026-11-08, **draft pending review by a Costa Rican lawyer**): `/terms`,
  `/privacy`, `/cancellation`, sharing `src/components/legal/LegalPage.tsx`. The operator's legal
  name, cédula jurídica and address are a placeholder (`LEGAL_ENTITY_PLACEHOLDER`) until filled
  in. Footers link to all three; the trip request form says sending it accepts them.
- `legacy/index.html` — the original static prototype, kept as the **design reference**.
- Logins: `/login` (email + 6-digit code), `src/proxy.ts` (session refresh on account pages),
  `src/lib/auth.ts` (`requireRole`). `/admin` (dashboard) and `/admin/users` (roles) are live
  once Supabase is connected.
- `supabase/migrations/` — database schema, row-level security and catalog seed (Phase 2b);
  `supabase/tests/rls.test.mjs` checks the security rules (`npm run test:db`). Setup steps for
  Jorge: `docs/SETUP-SUPABASE.md`.
- Built and connected to Supabase: logins, `/admin` (dashboard, users, pricing, drivers,
  bookings), `/driver` portal (KYC vault, vehicles, assigned trips with "Open in Waze" / "Google Maps"
  buttons for the pickup and drop-off, `src/lib/navigation.ts`; Drake Bay ends go to the Sierpe dock), trip requests saved online,
  private trip page `/trip/<code>`, tri-party trip chat with Resend email notifications.
- Not yet built: online payment (Green Pay, §6.4), live bidding (bid mode saves a request with the
  traveller's offer; the team handles it), GPS fleet map, `/account` for signed-in travellers
  (travellers use their private trip page instead), an in-page map (the summary links to the
  route on Google Maps instead), automatic airport / dock / 4x4 / ferry handling for typed places
  (pricing build step 4).
- Pickup / drop-off search (2026-11-09, pricing build step 3): type a town, airport, hotel, dock,
  restaurant or address (Google Places, Costa Rica only); typed places are priced from Google
  Routes road km + driving time (`src/lib/googleMaps.ts`, server-only, cached 30 days) and linked to
  their nearest town for the area factor, stops and suggestions (`src/lib/places.ts`). Rides
  between two of our towns still use the built-in tables at no cost. Drake Bay places (within
  15 km) are reached by road to the Sierpe dock + the boat.
- Env: `GOOGLE_MAPS_API_KEY` (server-only, Places API (New) + Routes API; without it only our
  towns are offered). `NEXT_PUBLIC_WHATSAPP_NUMBER` (see `.env.example`) **must be set in Vercel before
  launch**; until then WhatsApp buttons open a placeholder number and the build logs a warning.
- Route landing pages (`/transfers/[slug]`, content in `src/lib/routePages.ts`): SJO → Manuel
  Antonio, La Fortuna/Arenal, Monteverde, Tamarindo, Puerto Viejo and Sierpe (Drake Bay boat);
  LIR → Tamarindo; La Fortuna → Monteverde and Manuel Antonio. "Other rides" links open the
  matching landing page when one exists, otherwise the trip builder.
- Search engines (2026-11-08): **the whole site is `noindex` and `robots.txt` blocks all
  crawlers until `NEXT_PUBLIC_SITE_INDEXABLE=true` is set** (Vercel, Production only). Then
  `robots.txt` blocks only `/admin`, `/driver`, `/trip`, `/login`, `/auth`, `/api` and points to
  `sitemap.xml` (home, route pages, `/terms`, `/privacy`, `/cancellation`).
  `NEXT_PUBLIC_SITE_URL` (default `https://puravidaway-app.vercel.app`) sets canonical and
  link-preview URLs; the preview image is `src/app/opengraph-image.tsx`. Custom 404 and error
  pages (`not-found.tsx`, `error.tsx`, `global-error.tsx`). Vercel Web Analytics
  (`@vercel/analytics`) is in the root layout and must be enabled in the Vercel dashboard.
- Rendered per request (`connection()` in `page.tsx`): full HTML for search engines; "today" is
  computed server-side in `America/Costa_Rica`.
- Ride builder (2026-11-08): pickup time picker (Costa Rica time, 04:00–22:00 in 15 min, default
  9:00) saved in `bookings.scheduled_at` (UTC−6); day tours default to 7:00 and expeditions to
  6:00 until confirmed. Dates and times are shown in Costa Rica time everywhere
  (`formatScheduledAt()` in `src/lib/dates.ts`). Vehicle and stop cards show season-adjusted
  prices for the chosen date.
- Competitor gaps (2026-11-08): per car + "from $X per person (N travellers)" on vehicle cards and
  route pages; "Every ride includes" list (`RIDE_PROMISES`, `src/lib/trust.ts`); stop cards show
  the entrance: free stop / included / paid at the gate (`entrance`, migration 0014); after a ride is added, an inline
  suggestion of 1–2 tours / expeditions in the drop-off region; the ride builder's choices are
  kept in the address so rides can be shared (`src/lib/shareLink.ts`).
- Seasons: peak = Dec 20–Jan 5 + Semana Santa (Palm Sunday → Easter); high = Dec–Apr; else green.
  Live from the `seasons` / `season_ranges` tables (edited at `/admin/pricing`); the same rule is
  the built-in fallback in code.

## 4. Product modules

### 4.1 Customer storefront (public)
Layout (decided 2026-10-14): a booking **app first**, not a marketing site. The home page opens
on the trip builder; the trip is a persistent sidebar on desktop and a bottom bar + drawer on
phones. Marketing lives on separate route/tour landing pages (`/transfers/[slug]`) that rank on
Google and pre-fill the builder via `?from=<hub>&to=<hub>`. Shareable ride links (2026-11-08) add
`&date=YYYY-MM-DD&time=HH:MM&pax=N&vehicle=<id>&stops=<id>,<id>`, all checked against the catalog
on load; no personal details ever go in the address. Trust content (driver checks,
guarantees, real reviews only) lives in `src/lib/trust.ts`.
Legal pages (`/terms`, `/privacy`, `/cancellation`) are linked from every footer and under the
"Send trip request" button, so the cancellation policy is visible before anyone pays.

1. **Transfers & Sightseeing** — exact pick-up/drop-off by map place search (hotel, dock,
   restaurant, address; see COMPETITORS.md §2d — *built 2026-11-09: our towns plus Google place search*), date,
   passengers, Fixed Price vs Driver Bids
   toggle, sightseeing stop cards (duration, price, whether there is an entrance fee: free, included or paid at the gate), vehicle
   cards with the price per car and "from $X per person (N travellers)", the "Every ride includes"
   list (flight tracking on airport pickups, 60 min free waiting, child seats free on request, free
   cancellation up to 24 h), live route timeline with total duration, flight number or hotel
   field, price breakdown. After a ride is added, an inline, dismissible suggestion of 1–2 day
   tours / expeditions in the drop-off region (Welcome Pickups-style).
2. **1-Day Private Tours** — region filter, Smart En-Route Transfer upgrade (+$65).
3. **Multi-Day Expeditions** — lodging tier selector, day-by-day itinerary.
4. **Trip Cart & checkout** — combines transfers, stops, day tours and expeditions. Payment choice
   (decided 2026-11-08, built): **pay online in full** (we send a secure Green Pay link once the
   team confirms the trip; online payment isn't live yet, so the site never says "pay now"), or
   **pay the driver in cash + a 10% cash booking fee** (rides and 1-day tours only). Expeditions
   are **online in full only** (SINAC permits, boats and lodges are prepaid); in a mixed cart the
   rides/tours are cash and the expedition is online, labelled per item. The trip summary shows
   "Cash booking fee (10%) +$X" and the cash vs online amounts. The 20% deposit is retired.
5. **WhatsApp concierge** — context-aware buttons (`route`, `cart`, `general`) that pre-fill the
   route or cart contents into a WhatsApp message to the PuraVidaWay team.

### 4.2 Admin command center (`/admin`, admin role only — never public)
1. **Bookings & dispatch** — incoming bookings, assign drivers, status changes.
2. **CRM pipeline** — `New HubSpot Inquiry` → `WhatsApp Discovery` → `Quote Sent` →
   `Payment Confirmed` (paid online, or cash on the day) → `Trip Active`, with one-click WhatsApp script generation.
3. **Inventory & seasonal pricing manager** — edit catalog items and season multipliers without
   code changes.
4. **Driver KYC & ICT compliance vault** — Cédula, ICT tourism permit, driver's license, Marchamo,
   INS commercial insurance, Dekra (RTV) inspection; **30-day expiry warnings**;
   Approve / Reject / Suspend.
5. **Live GPS fleet map** (Phase 3) — on-duty drivers on a Leaflet map.
6. **Tri-party chat oversight** (Phase 4) — client ↔ driver ↔ admin per booking, with the option
   to bridge to WhatsApp.

### 4.3 Driver portal (`/driver`, driver role)
KYC document upload, view open booking requests, submit and manage bids, assigned trips,
on-duty toggle (Phase 3), trip chat (Phase 4).

### 4.4 Client account (`/account`, client role) — not built yet
Today travellers don't need an account: each trip request gets a private trip page
(`/trip/<code>`, linked in the confirmation email) with bookings, status, driver and chat.
`/account` is planned for repeat travellers; `src/proxy.ts` already keeps its session fresh.
Bookings, payment status and balance due, trip chat (Phase 4).

---

## 5. Catalog data (USD)

All base prices are in **USD**. CRC is a display conversion only.

### 5.1 Transfer hubs
SJO Airport / San José · Liberia Airport (LIR) · La Fortuna / Arenal · Manuel Antonio ·
Monteverde Cloud Forest · Sierpe Boat Dock (Osa) · Drake Bay (via Sierpe boat) ·
Puerto Viejo (Caribbean) · Tamarindo / Guanacaste

### 5.2 Sightseeing stops
Since 2026-11-09 (pricing build step 5, migration 0021) a stop's price is **computed**, not typed.
Two parts (Jorge: "tours are not just a drive"):
- **Driver's part** = `minutes at the stop × waiting rate ($20/h) + detour km × per-km + detour minutes × per-hour`,
  rounded to whole dollars (`stopPriceCents()` in `src/lib/catalog.ts`).
- **Tour part, per person** (`tour_price_pp`): guide, entrance, activity, priced like the tours on
  costaricatravelplanner.com (internal reference only; never named on the site). 0 for a plain stop.
  Group price = `stopTotalCents(stop, pax)`. Rates and inputs at `/admin/pricing`. At today's rates:

| ID | Name | At the stop | Detour (there and back) | Driver part | Tour part / person |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `tarcoles` | Tárcoles Crocodile Bridge | 45 min | on the way | +$15 | — |
| `carara` | Carara National Park Scarlet Macaw Walk | 90 min | 2 km / 5 min | +$33 | $45 (to confirm) |
| `poas` | Poás Volcano Crater & Doka Coffee Estate | 120 min | 24 km / 40 min | +$68 | $55 (to confirm) |
| `rioceleste` | Río Celeste Waterfall Hike (Tenorio Volcano NP) | 120 min | 18 km / 35 min | +$62 | $35 (to confirm) |
| `sloth` | La Fortuna Sloth & Wildlife Sanctuary Trail | 75 min | in town | +$25 | $30 (to confirm) |

Notes:
- Stops are **optional paid extras** ("Add a stop (optional extra)", each card "+$X · adds N min",
  season-adjusted). Each stop lists the hubs it sits between (`sightseeing_stops.corridors`,
  edited at `/admin/pricing`). **Rule (built 2026-11-08, pending Jorge's confirmation, §9 #4):** a
  stop is offered only when **both** pickup and drop-off are on its list; a stop with a single hub
  is in that town and is offered on any ride to or from it; no stops on the Sierpe ↔ Drake Bay
  boat (`stopFitsRoute()` in `src/lib/catalog.ts`). Current lists (migration 0011): Tárcoles &
  Carara — SJO, Monteverde, Manuel Antonio, Sierpe, Drake Bay; Poás — SJO, Arenal; Río Celeste —
  Arenal, LIR; Sloth trail — Arenal. Known gap of a flat list: Tárcoles/Carara also show on
  Manuel Antonio ↔ Sierpe/Drake Bay and SJO ↔ Monteverde, which need a detour.
- Park entrance fees: chosen per stop in /admin/pricing as free (no ticket, e.g. Tárcoles),
  included in our stop price, or paid at the gate; the card says which.
- **Poás + Doka at 120 min is tight.** Poás requires advance timed-entry tickets, and adding Doka
  makes it two separate visits. Consider splitting it into two stops or extending the time.

### 5.3 Vehicle classes
Priced by the ride formula (§6.1) × the class factor; flat base rates retired 2026-11-09.

| ID | Class | Factor | Pax | Luggage | Use case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `economy` | Economy Sedan | 0.90 | 1–3 | 3 suitcases | Spanish-speaking driver, direct ride (no stops) |
| `sedan` | Standard Sedan | 1.00 | 1–3 | 3 suitcases | Best value; default choice |
| `suv` | Standard Comfort SUV | 1.20 | 1–4 | 4 suitcases | Most popular |
| `4x4` | Executive 4x4 (Prado / Fortuner) | 1.30 | 1–4 | 4 suitcases | Osa / Monteverde roads |
| `van` | Private Toyota HiAce / Hyundai Staria | 1.35 | 1–10 | 10 suitcases | Families & groups |
| `sierpe_combo` | 4x4 transfer + Sierpe river boat | 1.30 + $75 boat | 1–4 | Wet/dry assist | Drake Bay / Corcovado |

### 5.4 1-day private tours
Since 2026-11-09 (migration 0022; Jorge: "tours are not just a drive") tours are priced **per
person, tiered by group size** like his tours on costaricatravelplanner.com (internal reference
only): private vehicle, guide, entrances and lunch included; 7+ travellers pay the 4+ rate.
Starting amounts (guesses to confirm; edited at `/admin/pricing`):

| ID | Region | Tour | Length | 1 traveller | 2–3 each | 4+ each |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `dt1` | Arenal | Arenal Volcano 1968 Lava Trails, La Fortuna Waterfall & Hot Springs | 8 h | $350 | $295 | $275 |
| `dt2` | Manuel Antonio | Manuel Antonio NP private wildlife walk + catamaran snorkel | 7.5 h | $330 | $280 | $260 |
| `dt3` | Osa | Sierpe mangrove boat safari & Caño Island snorkeling | 7 h | $375 | $300 | $275 |
| `dt4` | Monteverde | Hanging bridges, zipline & night walk | 7 h | $280 | $230 | $210 |

Driver payout on a tour = 80% of the net: `cost_pp × pax` (entrances, lunch, activities the
company pays; migration 0023) comes off first (`splitPayout()` in `src/lib/payout.ts`).
`day tour = per-person tier(pax) × pax (+ en-route upgrade) × season` (`dayTourCents()` in
`src/lib/catalog.ts`, `quoteDayTour()`). Upgrade: **Smart En-Route Transfer** (+$65 per group) —
picked up in one town, dropped at the next hotel.

### 5.5 Multi-day expeditions
| ID | Package | Base price | Includes |
| :--- | :--- | :--- | :--- |
| `md1` | Corcovado NP 3D/2N, overnight at Sirena Station (via Sierpe) | $695 | Sierpe–Drake Bay–Sirena boats, SINAC overnight permits, Sirena meals, certified Osa naturalist guide |
| `md2` | Classic Trifecta: Arenal, Monteverde & Manuel Antonio (7D/6N) | $1,290 | Door-to-door sightseeing transfers, Lake Arenal boat crossing, hanging bridges, Manuel Antonio guided tour, 24/7 WhatsApp concierge |

Lodging tiers: Base (+$0) · 4-star boutique eco-resort (+$280) · 5-star luxury lodge (+$650).
Decide whether tier prices are per person or per booking (see §9).

---

## 6. Pricing logic

### 6.1 Fixed-price transfers (built 2026-11-09, `docs/PRICING.md` §4)
```
standard   = max(minimum fare, base + per km × road km + per hour × driving hours)
ride       = round_to_dollar(standard × vehicle factor × area factor)
             + vehicle extra fee
stop       = round_to_dollar(minutes at stop × wait rate/60 + detour km × per km + detour min × per hour/60)
             + tour price per person × travellers
transfer   = (ride + Σ selected stop prices) × season multiplier
             + ferries × (car-and-driver fare + passengers × passenger fare)
```
Area factor = the pickup town's, or an extra area's when the pickup OR drop-off is in it and
the route takes the ferry (Southern Nicoya), whichever is higher. Ferry fares (Gulf of Nicoya, per crossing on Google's
route) are added after the season multiplier and never season-adjusted.
Numbers (Jorge, 2026-11-09, on par with Daytrip's lowest prices): base $30, $0.90/km, $10/hour,
minimum $120; area factors Guanacaste (LIR, Tamarindo) 1.10, Osa (Sierpe, Drake Bay) 1.15,
Southern Nicoya 1.35, elsewhere 1.00; ferry ₡15,000 car + driver and ₡1,500 per passenger per
crossing, converted at `crc_per_usd` (₡452; checked weekly). All edited at `/admin/pricing`. Road km and drive times per town pair are in `src/lib/catalog.ts`
(`ROUTE_KM`, `ROUTE_MINUTES`); the Drake Bay boat (75 min) is excluded from driving hours.
`rideCents()` in `src/lib/pricing.ts` is the one implementation used by the ride builder,
route pages, the bid reference price and the server re-check.

### 6.2 Season multipliers
| Season | Multiplier |
| :--- | :--- |
| Green season | 1.00× |
| High season (Dec–Apr) | 1.15× |
| Peak holiday (Christmas / New Year / Easter weeks) | 1.25× |

Multipliers live in the database and are edited from the admin pricing manager.

### 6.3 Driver bidding (marketplace)
> **Changing (Jorge, 2026-11-09):** travellers will always get a fixed price, and drivers
> claim jobs at a fixed payout behind the scenes; public bidding becomes "request a custom
> quote" (`docs/PRICING.md` §6). The steps below describe what is built today.

1. Client enters route, date, passengers and stops; the system shows a **reference price**
   (the fixed price from §6.1).
2. Client can broadcast their own offer.
3. Approved drivers see open requests and bid within a **floor/ceiling** relative to the
   reference price.
4. Client accepts one bid; the others are declined automatically.
5. PuraVidaWay keeps a **platform commission** (% of the accepted bid), collected through Green Pay.

### 6.4 Payments
Decided by Jorge 2026-11-08 (replaces the 100% / 20% deposit rule):
- `full_100` — **pay online in full.** Green Pay isn't live yet: the team confirms the trip,
  then sends a secure payment link.
- `cash_driver` — **pay the driver in cash + a cash booking fee** of 10% of the ride / day-tour
  price (after the season multiplier, rounded to the cent). Rides and 1-day tours only.
  The fee is `pricing_settings.cash_fee_bps` (1000 = 10%, allowed 0–50%), edited at
  `/admin/pricing` → Payment; built-in fallback 10% (`CASH_FEE_BPS_DEFAULT`).
- **Expeditions: online in full only** (SINAC permits, boats and lodges are prepaid). A mixed
  cart pays its rides/tours in cash and its expeditions online.
- The server re-prices every item and the fee from the live catalog before saving; each booking
  stores its own `payment_mode` and `cash_fee`. Owed = `total_price` + `cash_fee`; `amount_paid`
  records what was received.
- `deposit_20` is retired; old bookings keep it, and old carts / open tabs sending it are
  treated as `full_100`.
- Green Pay calls and webhook verification happen **only on the server** (Next.js route handlers).
  Card data never touches our servers or database.

### 6.5 Driving-time realism
Durations must reflect real Costa Rican conditions (mountain roads, single-lane highways,
rainy-season delays). Route durations are stored per corridor, not computed as straight-line
distance: `ROUTE_MINUTES` in `src/lib/catalog.ts` has door-to-door times for all 36 hub pairs
(a type check fails the build if one is missing; Drake Bay = road to Sierpe + 75 min boat).
Pending Jorge's confirmation.

---

## 7. Database (Supabase / PostgreSQL)

Conventions: `uuid` primary keys, `timestamptz` for times, `numeric(10,2)` for money, text
check-constraints (or Postgres enums) for status fields. **RLS is enabled on every table.**

### 7.1 `profiles` (extends `auth.users`)
`id` uuid PK → `auth.users.id` · `role` (`client` | `driver` | `admin`) · `full_name` · `phone` ·
`email` · `created_at`

### 7.2 `drivers` (the person) and `driver_vehicles` (KYC & fleet vault)
**`drivers`:** `id` uuid PK → `profiles.id` · `home_hub` (town / area the driver is based in, migration 0018) · `rating_avg` numeric(3,2) / `rating_count` (weighted, kept by trigger from `driver_reviews`, migration 0019) · `cedula_number` · `ict_permit_number` ·
`license_number` · `license_expiry` date · `criminal_record_date` date · `kyc_status` (`pending` |
`approved` | `rejected` | `suspended`) · `kyc_note` · `needs_review` · `submitted_at` ·
`reviewed_at` · `reviewed_by` · `documents` jsonb (`driver_photo`, `id_front`, `id_back`,
`license`, `criminal_record`, optional `ict_permit`; Storage paths in bucket `driver-kyc-docs`) ·
`is_on_duty` bool · `last_lat` · `last_lng` · `last_seen_at` · `created_at` · `bio` (≤ 600 chars,
no phone/email/links; shown to travellers) · `english_level` (`fluent` | `basic`)

**`driver_vehicles`** (a driver can register several; each approved separately): `id` uuid PK ·
`driver_id` → `drivers.id` · `plate` · `make_model` · `year` · `color` · `passenger_capacity` ·
`ins_policy_number` · `ins_insurance_expiry` date · `dekra_inspection_expiry` date ·
`marchamo_year` int · `has_wifi` · `child_seats` · `stroller_space` · `pet_friendly` · `documents` jsonb (`insurance`, `dekra`, `marchamo`,
`vehicle_registration`) · `photos` jsonb array (at least 2, one showing the plate; at most 12) · `status` · `note` ·
`needs_review` · `reviewed_at` · `reviewed_by` · `created_at`

The criminal record certificate must be issued ≤ 30 days before first approval (checked by the
approve button). Expiry warnings cover the licence, insurance, Dekra and Marchamo.

### 7.3 `bookings`
`id` uuid PK · `booking_ref` text unique (e.g. `PVW-10492`) · `client_id` → `profiles.id` ·
`service_type` (`transfer` | `day_tour` | `expedition`) · `catalog_item_id` (nullable; day tour or
expedition) · `origin` text (place name + address) · `origin_coords` jsonb (`lat`, `lng`,
`place_id`, `town`, and `route` = the Google road km / minutes the price was made from, null
between two of our towns) · `destination` text · `destination_coords` jsonb (same, without route) · `sightseeing_stops` jsonb (array of stop IDs + snapshot prices) · `vehicle_class` ·
`lodging_tier` · `scheduled_at` timestamptz · `passenger_count` int · `flight_or_hotel_notes` ·
`pricing_mode` (`fixed` | `bid`) · `total_price` numeric · `driver_payout` / `platform_fee` numeric
(migration 0017; null on expeditions) · `company_costs` (entrances / lunch / activities the company pays, deducted before the driver's share; part of `platform_fee`; 0023) · `claimed_at` (set when the team accepted an offer from the job board) · `currency` (`USD` | `CRC`) ·
`amount_paid` numeric · `payment_mode` (`full_100` | `cash_driver`; `deposit_20` on old rows
only) · `cash_fee` numeric(10,2) (cash booking fee snapshot, 0 unless `cash_driver`) · `assigned_driver_id` →
`drivers.id` (nullable) · `status` (`pending_payment` | `pending_bids` | `confirmed` |
`in_progress` | `completed` | `cancelled`) · `created_at`

### 7.4 `bids`
`id` uuid PK · `booking_id` → `bookings.id` · `driver_id` → `drivers.id` · `bid_amount` numeric ·
`vehicle_snapshot` jsonb · `status` (`submitted` | `accepted` | `declined` | `withdrawn`) ·
`created_at` · unique (`booking_id`, `driver_id`)

### 7.5 `trip_chats`
`id` uuid PK · `booking_id` → `bookings.id` · `sender_id` → `profiles.id` · `sender_role`
(`client` | `driver` | `admin`) · `message` text · `sent_at`

### 7.6 Catalog & pricing tables (new — needed for the admin pricing manager)
Implemented in `supabase/migrations/`. Catalog ids are short text slugs (`suv`, `tarcoles`)
matching `src/lib/catalog.ts`; seasons use `season_ranges` (start/end dates) plus a `priority`,
and `season_for_date(date)` returns the season for a travel date.
- `sightseeing_stops` — id, name, description, duration_min, detour_km, detour_min, tour_price_pp (migration 0021; `price` is retired, the stop price is computed from these), entrance (free | included | gate; replaces park_fee_included, which is kept in step), corridors, active
- `vehicle_classes` — id, name, price_factor, extra_fee, allows_stops, spanish_speaking_driver,
  max_pax, luggage, badge, only_for_hubs, active (`base_rate` retired 2026-11-09, kept for old data)
- `day_tours` — id, region, name, description, duration_hours, price_pp_solo / price_pp_small / price_pp_group (per person by group size, migration 0022; `price` retired), cost_pp (company-paid costs per person, 0023), en_route_upgrade_price, active
- `expeditions` — id, name, days, nights, base_price, itinerary jsonb, active
- `lodging_tiers` — id, expedition_id (nullable = applies to all), name, surcharge
- `seasons` — id, name, multiplier, date ranges
- `pricing_settings` — a single row (`id` = true): `cash_fee_bps` int (default 1000 = 10%, 0–5000),
  ride formula `ride_base_fare`, `ride_per_km`, `ride_per_hour`, `ride_minimum_fare` (USD),
  ferry fares `ferry_vehicle_fare_crc`, `ferry_passenger_fare_crc` (colones per crossing) and
  `crc_per_usd` (migration 0015), `driver_commission_bps` (0017), `wait_per_hour` (USD/h at a stop, 0021), `updated_at`. Public read, admin write. Loaded by `getCatalog()`
  as `cashFeeBps` / `rideFormula` / `ferryFares` / `crcPerUsd`.
- `driver_reviews` — id, booking_id (unique), driver_id, trip_id, stars 1–5, comment (no contact details),
  weight (generated: 2 with a comment, 1 without), created_at. Written by the server from the traveller's
  private trip page once the booking is completed; driver reads own, admin all. `bookings.review_requested_at`
  records the review-request email and `review_reminded_at` the single follow-up, sent 3+ days later by the
  daily Vercel Cron job `/api/cron/review-reminders` (`vercel.json`, 09:00 Costa Rica, protected by `CRON_SECRET`).
- `hub_pricing` — hub_id (one of the 9 hubs, or an extra pricing area: `SouthNicoya`), area_factor
  (0.50–2.00), updated_at. Public read, admin write. Loaded as `areaFactorBps`.
- `payments` — id, booking_id, provider (`greenpay`), provider_ref, amount, type (`deposit` | `balance` | `full`), status, raw_payload jsonb, created_at

### 7.7 Row Level Security
- **profiles:** users read their own row and update their name and phone (not role or email);
  admins read/write all.
- **drivers:** any signed-in user can apply (create their own record, always `pending`); drivers
  read/update their own KYC fields and upload to their own folder in `driver-kyc-docs` (images/PDF,
  10 MB). Only admins change `kyc_status`, `kyc_note` and the review fields. A driver's change to
  an approved record sets `needs_review` (they stay approved until the admin acts — flagged as an
  open choice in §9). Document links must point into the driver's own folder. Only approved
  drivers with current documents can be on duty; anyone not approved is forced off duty.
- **Document validity (Jorge, 2026-10-14):** an approved driver receives trips only while the
  driver's licence is unexpired (no grace) and at least one **approved vehicle** has INS insurance
  expired ≤ 15 days ago (15-day grace), a Marchamo for the current year (no grace) and an
  unexpired Dekra / RTV (no grace). `is_approved_driver()` checks this, so expired documents stop
  bids automatically. After the first review, these dates change only together with an upload
  of the renewed document.
- **driver_vehicles:** the driver and admins only; drivers add, edit and remove their own; new
  vehicles always start `pending`; only admins change `status`, `note` and review fields; file
  links must be in the driver's own folder. Clients never see Cédula,
  license or insurance numbers.
- **bookings:** clients see their own; the assigned driver sees their assigned bookings (so
  nothing private may live on the booking row); admins see all. Traveller contact details and
  the private trip-page code live in **`trips`**, readable only by admins and the server.
- **trip_chats:** per booking; readable and writable only by the booking's client, assigned
  driver and admins. Travellers post through the server after it checks their trip code; drivers and travellers can't send phone numbers, emails or links. `chat_reads`,
  `request_log` and the rate-limit functions are server-only. Approved drivers see **open** requests (`pending_bids`) only through the
  `open_trip_requests()` function: towns, date, vehicle, passengers and price, without the client's id,
  exact coordinates or flight/hotel notes, until a bid is accepted.
- **bids:** drivers create and manage their own; the amount can change only while the request is
  open and the driver is still approved (withdrawing is always allowed); the booking's client
  reads bids on their booking; admins see all.
- **catalog tables:** public read for active items; admin write. **pricing_settings** (cash fee, ride formula) and **hub_pricing** (area factors): public read, admin write.
- **payments:** written only by the server (service role); clients read their own; admins read all.

---

## 8. Roadmap

| Phase | Scope | Status |
| :--- | :--- | :--- |
| **1. Prototype** | Static `index.html` design for storefront + admin tab | Done as a design mock, but the JS is truncated and non-functional |
| **2a. Next.js foundation** | Next.js + TS + Tailwind scaffold; rebuild storefront from the prototype design with catalog data from §5; working cart and WhatsApp buttons | **Done (PR #2)** |
| **2b. Supabase core** | Schema + RLS from §7, Auth with roles, catalog served from DB, `/admin` behind login, inventory & season pricing manager | **Live** (PRs #7–#9; Supabase connected). All migrations through 0016 applied; since 2026-11-09 new ones run automatically after a merge (`.github/workflows/db-migrations.yml`) |
| **2c. Driver KYC vault** | Driver sign-up, document upload, admin approval, 30-day expiry alerts | **Built (PRs #12–#14): `/driver` portal with several vehicles, `/admin/drivers` vault** |
| **2d. Checkout** | Part 1: trip requests saved online (server re-prices every item, guest name/email/WhatsApp, booking refs) + `/admin/bookings` dispatch (status, driver + vehicle, amount received, internal notes). Part 2: Green Pay (online in full; cash to the driver + 10% fee is built, 2026-11-08), webhooks, confirmation emails | **Part 1 built (PR #15)**; payment options built; Green Pay needs credentials |
| **3. Job board & GPS** | Driver job board with fixed payouts (replaces public bidding); driver on-duty GPS broadcast to admin Leaflet map | **Job board built 2026-11-09** (`/driver/jobs`, migration 0017): the team posts a booking as "Open for drivers", drivers send offers (suggested payout or 70–130% of it), the team accepts one on the booking page, where offers are ranked (same-day return trip first, then the driver's rating — travellers are emailed to rate 1–5 stars from their trip page when a trip is marked completed, a comment counts double, `driver_reviews` + `drivers.rating_avg/rating_count`, migration 0019 — then drivers based near the pickup — `drivers.home_hub`, migration 0018 — then price, then fewer trips; `src/lib/matching.ts`) and refresh live; drivers never see the client's price. Drivers see "Return trip" / "Starts in your area" badges on the job board. Rides sent in "Driver bids" mode with an offer of 70%+ of the fixed price go to the board automatically; approved drivers are emailed each new job (`src/lib/jobAlerts.ts`) and the traveller is emailed when an offer is accepted. Push notifications come with the driver app (Phase 5); email today. GPS planned |
| **4. Chat & CRM** | Tri-party trip chat (traveller via private trip link, assigned driver, team) with Resend email notifications; HubSpot sync; SMS / WhatsApp Business API | **Chat built (PR #17)**, polling every 8 s; HubSpot and SMS planned |
| **5. Mobile apps** | Driver app (GPS, push notifications, camera) first, then Client app, for App Store / Google Play; plan in §11 | Planned — spec drafted; store accounts can be opened now (§11.6) |

---

## 9. Open decisions

1. **Transfer pricing model.** Research done (COMPETITORS.md §2b–2d): Daytrip Sedan SJO→La
   Fortuna $161, GetTransfer Comfort $106; both price by routed distance to the exact point.
   Recommendation: zone-to-zone price table per vehicle class + per-km surcharge outside zones. The original Route-Pricing doc describes *base fee + distance/time
   × vehicle multiplier* (1.0× / 1.4× / 1.8×). The prototype uses *flat rates per vehicle class*
   ($175–$290) regardless of route, which would make SJO→Manuel Antonio cost the same as
   SJO→Tamarindo. Recommended: a **route × vehicle price table** (each corridor has its own price
   per vehicle class), which matches how Costa Rica transfers are actually quoted.
   **Analysis 2026-11-08: `docs/PRICING.md`.** Recommended: exact place search + real road
   distance/time (Google Places + Routes) priced by a formula (base + per km + per hour, minimum
   fare) × vehicle factor × area factor × season, with optional fixed zone prices for the busiest
   pairs. **Decided (Jorge, 2026-11-09):** this model, priced on par with or a few dollars under
   Daytrip's lowest prices (revised from 10–20% below the same day, so drivers earn a proper
   rate; numbers in `docs/PRICING.md` §8), using Google Maps Platform. Build order in
   `docs/PRICING.md` §7.
2. **Platform commission %.** Benchmarks: Daytrip keeps ~30% (Jorge sees ~40% of the gross on
   his own Daytrip rides), GetTransfer 13–25% (see COMPETITORS.md §1b). **Decided (Jorge,
   2026-11-09): 20%** of the price after pass-through costs (ferry tickets go to the driver in
   full); drivers see only their payout. Built in migration 0017; editable at `/admin/pricing`.
3. **Bid floor/ceiling** relative to the reference price (e.g. 70%–130%).
   **Recommendation 2026-11-08 (`docs/PRICING.md` §6):** travellers always get a fixed price;
   drivers claim jobs at a fixed payout behind the scenes; "name your price" becomes "request a
   custom quote" for groups, charters and unusual routes. **Decided (Jorge, 2026-11-09).** A
   bid floor/ceiling only matters for custom quotes and drivers' offers; set it when that is
   built.
4. **Stop ↔ corridor mapping** (which stops are offered on which routes). Built 2026-11-08 as
   the "both ends" rule with reviewed lists (§5.2), **pending Jorge's confirmation**. If the
   detour cases in §5.2 matter, the next step is listing exact route pairs per stop. With exact
   routing (`docs/PRICING.md` §5) the detour decides it instead of a list.
5. **Lodging tier pricing**: per person or per booking? Still open for expeditions. **Day tours:
   decided (Jorge, 2026-11-09): per person**, see §5.4.
6. **Passenger-based pricing**: **day tours yes, per person with 1 / 2–3 / 4+ tiers (built,
   migration 0022)**; expeditions still open.
7. **Cancellation & refund policy:** decided (Jorge, 2026-11-08), published at `/cancellation`.
   Rides (transfers) and 1-day tours: free cancellation up to 24 h before pickup, full refund;
   within 24 h or no-show, no refund. Multi-day expeditions: 30+ days before start, full refund
   minus non-refundable SINAC permits and boat/lodging deposits already paid; 8–29 days, 50%;
   7 days or less, no refund. Date/time changes free if asked 24 h+ ahead, subject to
   availability. If we or the driver cancel: full refund. Weather / road / park closures: rebook
   or refund of the affected service. The cash-booking fee is non-refundable within 24 h.
8. **Custom domain** for the app (removes the Vercel login wall on previews and looks
   professional).
9. **Driver edits after approval.** (Expired licence / insurance / Dekra / Marchamo already block trips
   automatically, see §7.7; this is about other edits.) Built as: the driver stays approved and the record is flagged
   "changed since last review" for the admin. Stricter alternative: any change sends them back to
   *pending* (off the job board) until re-approved. Decide before drivers can receive trips (Phase 3).
10. **Ride extras pricing.** Travellers can ask for an English-speaking driver (vs Spanish / basic
    English), Wi-Fi, stroller, child seats and pets. Built as **free requests matched by the
    team**. Decide whether any cost extra (e.g. child seats) or whether "Spanish / basic English"
    is cheaper.
    **Jorge 2026-11-08:** no blanket "English-speaking" promise; add a cheaper **Economy** class
    with a Spanish-speaking driver (like Daytrip's Sedan Lite), see `docs/PRICING.md` §4.3.
    **Decided 2026-11-09: Economy is 10% cheaper than Standard.**
    Child seats stay free on request.
11. **In-app chat vs WhatsApp:** decided (Jorge, 2026-10-14): in-app trip chat with email
    notifications through Resend is the main channel; WhatsApp stays as an option. SMS later.
12. **Mobile framework:** decided (Jorge, 2026-10-14): **Expo (React Native)** for both apps
    (§11.2). Capacitor was rejected (weak background GPS, App Store risk as "just a website").
13. **One app or two:** decided (Jorge, 2026-10-14): **two store listings**, "PuraVidaWay" for
    travellers and "PuraVidaWay Partner" for drivers, built from one codebase (§11.1).
14. **Store publisher:** plan (Jorge, 2026-10-14): a **new Costa Rican S.A.** for PuraVidaWay
    (legal name to confirm, ideally "PuraVidaWay S.A."). The same company should hold the D-U-N-S
    number, Apple and Google accounts, Green Pay merchant account, bank account and domain. It must
    not be Jorge personally or Costa Rica Travel Planner, or the store would show that name as the
    seller (brand separation, §10). Check ICT / tax registration needs with the notary.
15. **Account deletion and data retention.** Both stores require users to be able to delete their
    account. Recommended rule (pending Jorge and his accountant):
    - **Blocked** while the person has an upcoming trip, an unpaid balance or an open dispute
      (they are told why and how to cancel first).
    - **Erased:** login, profile, phone, email, saved preferences, push tokens; chat messages
      are replaced by "deleted user".
    - **Kept, anonymised:** bookings and payments, as accounting records for as long as Costa Rican
      tax rules require (period to confirm with the accountant).
    - **Drivers:** KYC document files are deleted; a minimal record (name, permit number, dates
      checked and approved) is kept for the same period in case of an insurance or legal claim.
    - Done within 30 days; a confirmation email is sent. Available in the apps and on the website.

---

## 10. AI collaboration workflow

| AI | Role |
| :--- | :--- |
| **Claude** | Primary builder: writes code, migrations and docs. Works on branches and opens pull requests. |
| **Gemini** | Reviewer: Gemini Code Assist reviews every pull request on GitHub (rules in `.gemini/styleguide.md`). Gemini does not push code. |
| **Grok** | Research and second opinions; reads `docs/PROJECT.md`, `docs/changelog/` and `docs/CHANGELOG.md` for context. |

Rules for every AI:
- Read `docs/PROJECT.md`, the notes in `docs/changelog/` and the latest entries in `docs/CHANGELOG.md`
  before starting.
- Never push directly to `main`. Branch → pull request → Vercel preview → review → Jorge merges.
- When a change affects anything in this spec, update the spec in the same PR.
- Add a dated changelog note for every change as its own file in `docs/changelog/`
  (`YYYY-MM-DD — <AI> — <what changed>`); they are folded into `docs/CHANGELOG.md` in a separate
  PR (see `docs/changelog/README.md`).
- Address the founder as **Jorge Li**.
- **Brand separation (decided 2026-10-14):** PuraVidaWay is a separate public brand. Nothing a
  customer or driver can see (UI copy, page metadata, WhatsApp messages, emails, legal pages)
  may name the owner, Costa Rica Travel Planner, La Familia Mágica or Jorge's Daytrip profile.
  Use "PuraVidaWay" or "our team".
- **Driver wording:** describe partner drivers as hand-picked, independent local partners who are
  interviewed, background-checked (criminal and driving records) and submit vehicle information
  and proof of insurance. Show the ICT permit as a per-driver badge, never as a blanket claim.
- Reflect real Costa Rican operations: ICT permits, SINAC park permits and timed entries, Sierpe
  boat logistics, Marchamo / Dekra / INS compliance, realistic drive times, WhatsApp-first sales.
- Never commit secrets. Supabase service-role keys, the Google Maps key and Green Pay credentials
  live only in Vercel environment variables.

---

## 11. Mobile apps (Phase 5) — plan

> Drafted 2026-10-14. Decided by Jorge the same day: **Expo** and **two apps** (§9 #12–#13).
> Planned: a new S.A. as publisher (§9 #14). Account deletion rule recommended, pending Jorge (§9 #15). Nothing here changes the website.

### 11.1 Two apps, two jobs

| | **PuraVidaWay Partner** (driver app) | **PuraVidaWay** (client app) |
| :--- | :--- | :--- |
| Users | Approved partner drivers (`driver` role) | Travellers (`client` role and guests with a trip link) |
| Why an app at all | Things the website can't do reliably: **background GPS** while on duty (§4.2 #5), **push notifications** for new requests, bids and chat, **camera** for KYC documents and vehicle photos | **Push notifications** (driver assigned, pickup reminder, new chat message) and being findable in the stores |
| Priority | **First.** The bidding and GPS features of Phase 3 need it | **Second.** Booking already works well on the mobile website |
| First version | Email-code login · KYC documents and vehicles · open requests and bids (Phase 3) · assigned trips with exact pin and Waze / Google Maps link · on-duty toggle · trip chat | Email-code login · my trips, driver and vehicle · balance due (opens web checkout) · trip chat · WhatsApp button |

Booking a new trip stays on the website at first; the client app links to it. Rebuilding the
full trip builder natively comes later, only if store traffic justifies it.

Two listings rather than one: travellers and drivers are different audiences, and a driver
login screen inside the traveller app confuses both users and App Store reviewers. Both apps
come from one codebase.

### 11.2 Framework: Expo (decided 2026-10-14)

**Expo** (React Native + TypeScript, the same language as the website):
- Background location, push notifications and camera are standard, well-supported modules.
- **EAS Build** compiles the iOS app in the cloud, so no Mac is needed.
- **EAS Update** ships small fixes to installed apps without waiting for store review.

Not chosen:
- **Capacitor wrapping the website.** The website is rendered on the server for each request,
  so a wrapper would just load the live site. Apple regularly rejects apps that are mostly a
  website (guideline 4.2), and background GPS is weaker. Kept as a fallback for the client
  app only.
- **Lovable or other no-code builders.** They produce web apps, not store apps, and they work
  outside the branch → PR → Gemini review → Jorge merges workflow (§10).

### 11.3 Code layout

This repo becomes a small monorepo (npm workspaces):
- `src/` — the website, unchanged, still deployed by Vercel.
- `packages/core/` — the plain-TypeScript business logic moved out of `src/lib/`
  (`pricing.ts`, `catalogModel.ts`, `tripRequest.ts`, `dates.ts`, `preferences.ts`, cart math).
  Website and apps import the same code, so a quote is identical everywhere.
- `apps/driver/` and `apps/client/` — the two Expo apps.

The move to `packages/core/` is its own PR with **no behaviour change**, checked on the Vercel
preview before any app code is written. Vercel must keep building only the website.

### 11.4 How the apps talk to the backend

- **Supabase directly** for reading and writing the user's own data, with the public (anon) key
  and the user's session. The row-level security rules in §7.7 already protect every table.
  The service-role key never goes into an app.
- **New API routes for the rest.** Today the website uses Next.js server actions
  (`src/app/*/actions.ts`), which apps cannot call. Anything the server must do (re-price a
  trip request, write a booking, send and read trip chat, bid rules, Green Pay) gets a versioned route handler under
  `/api/v1/…`, sharing its logic with the server action. The server always re-prices; a price
  shown in an app is display only.
- **Login:** the same email + 6-digit code as the website. If Google sign-in is ever added to
  the apps, Apple requires Sign in with Apple as well.
- **Push notifications:** new table `device_tokens` (`user_id`, `token`, `platform`
  `ios|android`, `app` `driver|client`, `updated_at`; RLS: own rows only). The server sends
  through the Expo push service on new request, bid accepted, driver assigned, new chat
  message and pickup reminder. Email via Resend stays as the backup channel.
- **Chat:** chat goes through the server today (travellers use a private trip link, not an
  account). Push notifications replace most of the 8-second polling in the apps; moving signed-in
  users to Supabase Realtime is optional and needs its own security review.
- **GPS:** only while the driver is **on duty**; updates `last_lat`, `last_lng`,
  `last_seen_at` every 30–60 s or ~200 m, and stops when off duty. The app explains why it
  needs location before asking; Google Play also requires a background-location declaration
  with a short video.

### 11.5 Payments inside the apps

Transfers and tours are real-world services used outside the app, so Apple and Google do
**not** require their in-app purchase systems (no 15–30% store fee). The apps open the same
Green Pay checkout as the website in an in-app browser. Card data never touches the app, our
server or the database (§6.4).

### 11.6 Store accounts and requirements (Jorge's to-do)

These take weeks, so they can start before any app code:
1. **Legal entity and D-U-N-S number** for the publisher (§9 #14). Apple needs D-U-N-S for an
   organization account; it is free but can take a couple of weeks.
2. **Apple Developer Program**, organization account — US$99/year.
3. **Google Play Console**, organization account — US$25 once. (New personal accounts must run
   a two-week closed test with outside testers before publishing; verify the current rule.)
4. **Public privacy policy and terms pages** on the website — both stores require the link.
5. **Account deletion** inside the apps, plus a web link (§9 #15).
6. **Privacy forms**: Apple's privacy labels and Google's Data safety form (contact details,
   location for drivers, photos/documents for KYC).
7. **Reviewer test logins**: a demo traveller and a demo approved driver with sample trips, so
   store reviewers can get past the login screen.
8. Store names, icons and screenshots say **PuraVidaWay** only (brand separation, §10).

### 11.7 Order of work

1. This plan (docs only).
2. Jorge: decide §9 #14–#15 and start the accounts in §11.6.
3. PR: move shared logic to `packages/core/` (no behaviour change).
4. PR: `/api/v1` routes (including chat), `device_tokens` table + push sender.
5. PR: driver app MVP → TestFlight and Google Play internal testing with Jorge and 1–2 partner
   drivers.
6. Phase 3 (live bidding, GPS fleet map) ships through the driver app.
7. Client app, then store submission of both.
