# PuraVidaWay — Master Project Specification

> **This is the single source of truth for PuraVidaWay.** It merges and replaces
> `Architecture.md`, `Database-Schema.md`, `Route-Pricing.md` and the Gemini-drafted
> master spec (October 2026). If code and this document disagree, fix one of them in
> the same pull request and log it in `docs/CHANGELOG.md`.

| | |
| :--- | :--- |
| **Owner & founder** | Jorge Li — Costa Rica Travel Planner (Flores, Heredia, Costa Rica) |
| **Repository** | `georgedubious-collab/puravidaway-app` (connected to Vercel; `main` deploys to production) |
| **Vercel project** | `puravidaway-app` — team "Jorge Li's projects" |
| **Production URL** | https://puravidaway-app.vercel.app |
| **Spec last reviewed** | 2026-10-14 |

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
| Styling | Tailwind CSS; Font Awesome icons; Plus Jakarta Sans |
| Hosting / CI | Vercel, deployed from GitHub. Every PR gets a preview URL; merging to `main` deploys production |
| Database / Auth / Files | Supabase — PostgreSQL, Auth (roles: `client`, `driver`, `admin`), Storage, Realtime |
| Payments | Green Pay S.A. (Costa Rica), called server-side only |
| Maps | Leaflet + OpenStreetMap (admin fleet map) |
| CRM | HubSpot (lead pipeline sync, Phase 4) |
| Messaging | WhatsApp deep links now; WhatsApp Business API in Phase 4 |
| Mobile (Phase 5) | Client and Driver apps via Capacitor or React Native, reusing the web codebase where possible |

---

## 3. Current state of the code (2026-10-14)

- **Next.js 16 (App Router) + TypeScript strict + Tailwind 4**, in `src/`.
- `src/lib/catalog.ts` — the §5 catalog as typed data (prices in integer cents).
- `src/lib/pricing.ts` — the §6 pricing engine (season multipliers in basis points, cents math).
- `src/lib/cart.ts` — Trip Cart model, 100% / 20% deposit rule, WhatsApp deep-link builder.
- `src/components/` — storefront UI: `Header`, `TransfersView`, `DayToursView`,
  `ExpeditionsView`, `CartDrawer`, `Toast`, `Storefront` (state + localStorage cart).
- `legacy/index.html` — the original static prototype, kept as the **design reference**.
- Logins: `/login` (email + 6-digit code), `src/proxy.ts` (session refresh on account pages),
  `src/lib/auth.ts` (`requireRole`). `/admin` (dashboard) and `/admin/users` (roles) are live
  once Supabase is connected.
- `supabase/migrations/` — database schema, row-level security and catalog seed (Phase 2b);
  `supabase/tests/rls.test.mjs` checks the security rules (`npm run test:db`). Setup steps for
  Jorge: `docs/SETUP-SUPABASE.md`.
- Not yet built: Supabase, logins, `/admin`, driver portal, Green Pay checkout (the cart's
  "Pay online" button is disabled), live bidding (bid mode adds a request to the cart for Jorge to
  handle over WhatsApp), GPS map, chat.
- Env: `NEXT_PUBLIC_WHATSAPP_NUMBER` (see `.env.example`) **must be set in Vercel before
  launch**; until then WhatsApp buttons open a placeholder number and the build logs a warning.
- Rendered per request (`connection()` in `page.tsx`): full HTML for search engines; "today" is
  computed server-side in `America/Costa_Rica`.
- Season rule in code: peak = Dec 20–Jan 5 + Semana Santa (Palm Sunday → Easter); high = Dec–Apr;
  else green. Moves to the `seasons` table in Phase 2b.

## 4. Product modules

### 4.1 Customer storefront (public)
Layout (decided 2026-10-14): a booking **app first**, not a marketing site. The home page opens
on the trip builder; the trip is a persistent sidebar on desktop and a bottom bar + drawer on
phones. Marketing lives on separate route/tour landing pages (`/transfers/[slug]`) that rank on
Google and pre-fill the builder via `?from=<hub>&to=<hub>`. Trust content (driver checks,
guarantees, real reviews only) lives in `src/lib/trust.ts`.

1. **Transfers & Sightseeing** — exact pick-up/drop-off by map place search (hotel, dock,
   restaurant, address; see COMPETITORS.md §2d — *target; Phase 2a ships hub dropdowns*), date,
   passengers, Fixed Price vs Driver Bids
   toggle, sightseeing stop cards, live route timeline with total duration, flight number or hotel
   field, price breakdown.
2. **1-Day Private Tours** — region filter, Smart En-Route Transfer upgrade (+$65).
3. **Multi-Day Expeditions** — lodging tier selector, day-by-day itinerary.
4. **Trip Cart & checkout** — combines transfers, stops, day tours and expeditions. Payment choice:
   **100% full payment** or **20% deposit** (to lock SINAC permits and drivers). Checkout via
   Green Pay.
5. **WhatsApp concierge** — context-aware buttons (`route`, `cart`, `general`) that pre-fill the
   route or cart contents into a WhatsApp message to the PuraVidaWay team.

### 4.2 Admin command center (`/admin`, admin role only — never public)
1. **Bookings & dispatch** — incoming bookings, assign drivers, status changes.
2. **CRM pipeline** — `New HubSpot Inquiry` → `WhatsApp Discovery` → `Quote Sent` →
   `20% Deposit Paid` → `Trip Active`, with one-click WhatsApp script generation.
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

### 4.4 Client account (`/account`, client role)
Bookings, payment status and balance due, trip chat (Phase 4).

---

## 5. Catalog data (USD)

All base prices are in **USD**. CRC is a display conversion only.

### 5.1 Transfer hubs
SJO Airport / San José · Liberia Airport (LIR) · La Fortuna / Arenal · Manuel Antonio ·
Monteverde Cloud Forest · Sierpe Boat Dock (Osa) · Drake Bay (via Sierpe boat) ·
Puerto Viejo (Caribbean) · Tamarindo / Guanacaste

### 5.2 Sightseeing stops
| ID | Name | Duration | Price |
| :--- | :--- | :--- | :--- |
| `tarcoles` | Tárcoles Crocodile Bridge | 45 min | +$25 |
| `carara` | Carara National Park Scarlet Macaw Walk | 90 min | +$55 |
| `poas` | Poás Volcano Crater & Doka Coffee Estate | 120 min | +$68 |
| `rioceleste` | Río Celeste Waterfall Hike (Tenorio Volcano NP) | 120 min | +$65 |
| `sloth` | La Fortuna Sloth & Wildlife Sanctuary Trail | 75 min | +$48 |

Notes:
- Each stop belongs to one or more corridors; only show stops that sit on (or near) the selected
  route. The corridor mapping still needs to be defined (see §9).
- Park entrance fees: decide per stop whether they are bundled in the stop price or billed
  separately, and say so on the card.
- **Poás + Doka at 120 min is tight.** Poás requires advance timed-entry tickets, and adding Doka
  makes it two separate visits. Consider splitting it into two stops or extending the time.

### 5.3 Vehicle classes
| ID | Class | Base rate | Pax | Luggage | Use case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `suv` | Standard Comfort SUV | $175 | 1–4 | 4 suitcases | Most popular |
| `4x4` | Executive 4x4 (Prado / Fortuner) | $215 | 1–4 | 4 suitcases | Osa / Monteverde roads |
| `van` | Private Toyota HiAce / Hyundai Staria | $245 | 1–10 | 10 suitcases | Families & groups |
| `sierpe_combo` | 4x4 transfer + Sierpe river boat | $290 | 1–4 | Wet/dry assist | Drake Bay / Corcovado |

### 5.4 1-day private tours
| ID | Region | Tour | Length | Price |
| :--- | :--- | :--- | :--- | :--- |
| `dt1` | Arenal | Arenal Volcano 1968 Lava Trails, La Fortuna Waterfall & Hot Springs | 8 h | $145 |
| `dt2` | Manuel Antonio | Manuel Antonio NP private wildlife walk + catamaran snorkel | 7.5 h | $155 |
| `dt3` | Osa | Sierpe mangrove boat safari & Caño Island snorkeling | 7 h | $165 |
| `dt4` | Monteverde | Hanging bridges, zipline & night walk | 7 h | $140 |

Upgrade: **Smart En-Route Transfer** (+$65) — picked up in one town, dropped at the next hotel.

### 5.5 Multi-day expeditions
| ID | Package | Base price | Includes |
| :--- | :--- | :--- | :--- |
| `md1` | Corcovado NP 3D/2N, overnight at Sirena Station (via Sierpe) | $695 | Sierpe–Drake Bay–Sirena boats, SINAC overnight permits, Sirena meals, certified Osa naturalist guide |
| `md2` | Classic Trifecta: Arenal, Monteverde & Manuel Antonio (7D/6N) | $1,290 | Door-to-door sightseeing transfers, Lake Arenal boat crossing, hanging bridges, Manuel Antonio guided tour, 24/7 WhatsApp concierge |

Lodging tiers: Base (+$0) · 4-star boutique eco-resort (+$280) · 5-star luxury lodge (+$650).
Decide whether tier prices are per person or per booking (see §9).

---

## 6. Pricing logic

### 6.1 Fixed-price transfers
```
transfer_price = vehicle_base_rate (or route rate, see §9)
               + Σ selected stop prices
               × season_multiplier
```

### 6.2 Season multipliers
| Season | Multiplier |
| :--- | :--- |
| Green season | 1.00× |
| High season (Dec–Apr) | 1.15× |
| Peak holiday (Christmas / New Year / Easter weeks) | 1.25× |

Multipliers live in the database and are edited from the admin pricing manager.

### 6.3 Driver bidding (marketplace)
1. Client enters route, date, passengers and stops; the system shows a **reference price**
   (the fixed price from §6.1).
2. Client can broadcast their own offer.
3. Approved drivers see open requests and bid within a **floor/ceiling** relative to the
   reference price.
4. Client accepts one bid; the others are declined automatically.
5. PuraVidaWay keeps a **platform commission** (% of the accepted bid), collected through Green Pay.

### 6.4 Payments
- `full_100`: charge 100% at checkout.
- `deposit_20`: charge 20% at checkout; the balance is due before the trip. Store
  `total_price` and `amount_paid`; balance = difference.
- Green Pay calls and webhook verification happen **only on the server** (Next.js route handlers).
  Card data never touches our servers or database.

### 6.5 Driving-time realism
Durations must reflect real Costa Rican conditions (mountain roads, single-lane highways,
rainy-season delays). Route durations are stored per corridor, not computed as straight-line
distance.

---

## 7. Database (Supabase / PostgreSQL)

Conventions: `uuid` primary keys, `timestamptz` for times, `numeric(10,2)` for money, text
check-constraints (or Postgres enums) for status fields. **RLS is enabled on every table.**

### 7.1 `profiles` (extends `auth.users`)
`id` uuid PK → `auth.users.id` · `role` (`client` | `driver` | `admin`) · `full_name` · `phone` ·
`email` · `created_at`

### 7.2 `drivers` (KYC & fleet vault)
`id` uuid PK → `profiles.id` · `cedula_number` · `ict_permit_number` · `license_number` ·
`license_expiry` date · `marchamo_year` int · `ins_policy_number` · `ins_insurance_expiry` date ·
`dekra_inspection_expiry` date · `vehicle_model` · `vehicle_year` int · `passenger_capacity` int ·
`kyc_status` (`pending` | `approved` | `rejected` | `suspended`) · `documents` jsonb (Storage
paths in bucket `driver-kyc-docs`) · `is_on_duty` bool · `last_lat` float · `last_lng` float ·
`last_seen_at` timestamptz · `created_at`

The 30-day expiry warning checks `license_expiry`, `ins_insurance_expiry`,
`dekra_inspection_expiry` and the Marchamo year.

### 7.3 `bookings`
`id` uuid PK · `booking_ref` text unique (e.g. `PVW-10492`) · `client_id` → `profiles.id` ·
`service_type` (`transfer` | `day_tour` | `expedition`) · `catalog_item_id` (nullable; day tour or
expedition) · `origin` text · `origin_coords` jsonb · `destination` text · `destination_coords`
jsonb · `sightseeing_stops` jsonb (array of stop IDs + snapshot prices) · `vehicle_class` ·
`lodging_tier` · `scheduled_at` timestamptz · `passenger_count` int · `flight_or_hotel_notes` ·
`pricing_mode` (`fixed` | `bid`) · `total_price` numeric · `currency` (`USD` | `CRC`) ·
`amount_paid` numeric · `payment_mode` (`full_100` | `deposit_20`) · `assigned_driver_id` →
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
- `sightseeing_stops` — id, name, description, duration_min, price, park_fee_included, corridors, active
- `vehicle_classes` — id, name, base_rate, max_pax, luggage, badge, active
- `day_tours` — id, region, name, description, duration_hours, price, en_route_upgrade_price, active
- `expeditions` — id, name, days, nights, base_price, itinerary jsonb, active
- `lodging_tiers` — id, expedition_id (nullable = applies to all), name, surcharge
- `seasons` — id, name, multiplier, date ranges
- `payments` — id, booking_id, provider (`greenpay`), provider_ref, amount, type (`deposit` | `balance` | `full`), status, raw_payload jsonb, created_at

### 7.7 Row Level Security
- **profiles:** users read/update their own row; admins read/write all.
- **drivers:** drivers read/update their own KYC fields and upload to their own folder in
  `driver-kyc-docs`; only admins change `kyc_status`. Clients never see Cédula, license or
  insurance numbers.
- **bookings:** clients see their own; the assigned driver sees their assigned bookings; approved
  drivers see **open** requests (`pending_bids`) with client contact details hidden until a bid is
  accepted; admins see all.
- **bids:** drivers create and manage their own; the booking's client reads bids on their
  booking; admins see all.
- **trip_chats:** readable and writable only by the booking's client, assigned driver and admins.
- **catalog tables:** public read for active items; admin write.
- **payments:** written only by the server (service role); clients read their own; admins read all.

---

## 8. Roadmap

| Phase | Scope | Status |
| :--- | :--- | :--- |
| **1. Prototype** | Static `index.html` design for storefront + admin tab | Done as a design mock, but the JS is truncated and non-functional |
| **2a. Next.js foundation** | Next.js + TS + Tailwind scaffold; rebuild storefront from the prototype design with catalog data from §5; working cart and WhatsApp buttons | **Done (PR #2)** |
| **2b. Supabase core** | Schema + RLS from §7, Auth with roles, catalog served from DB, `/admin` behind login, inventory & season pricing manager | **Next** |
| **2c. Driver KYC vault** | Driver sign-up, document upload, admin approval, 30-day expiry alerts | Planned |
| **2d. Checkout** | Green Pay integration, 100% / 20% deposit, payment webhooks, booking confirmation emails | Planned (needs Green Pay credentials) |
| **3. Bidding & GPS** | Live driver bidding; driver on-duty GPS broadcast to admin Leaflet map | Planned |
| **4. Chat & CRM** | Tri-party chat via Supabase Realtime; HubSpot sync; WhatsApp Business API | Planned |
| **5. Mobile apps** | Client and Driver apps for App Store / Google Play | Planned |

---

## 9. Open decisions

1. **Transfer pricing model.** Research done (COMPETITORS.md §2b–2d): Daytrip Sedan SJO→La
   Fortuna $161, GetTransfer Comfort $106; both price by routed distance to the exact point.
   Recommendation: zone-to-zone price table per vehicle class + per-km surcharge outside zones. The original Route-Pricing doc describes *base fee + distance/time
   × vehicle multiplier* (1.0× / 1.4× / 1.8×). The prototype uses *flat rates per vehicle class*
   ($175–$290) regardless of route, which would make SJO→Manuel Antonio cost the same as
   SJO→Tamarindo. Recommended: a **route × vehicle price table** (each corridor has its own price
   per vehicle class), which matches how Costa Rica transfers are actually quoted.
2. **Platform commission %** on accepted bids. Benchmarks: Daytrip keeps ~30%, GetTransfer
   13–25% (see COMPETITORS.md §1b). Recommendation: flat 12–15%, weekly payouts.
3. **Bid floor/ceiling** relative to the reference price (e.g. 70%–130%).
4. **Stop ↔ corridor mapping** (which stops are offered on which routes).
5. **Lodging tier pricing**: per person or per booking? Same question for day tours.
6. **Passenger-based pricing**: do day tours and expeditions price per person?
7. **Cancellation & refund policy** for deposits and full payments.
8. **Custom domain** for the app (removes the Vercel login wall on previews and looks
   professional).

---

## 10. AI collaboration workflow

| AI | Role |
| :--- | :--- |
| **Claude** | Primary builder: writes code, migrations and docs. Works on branches and opens pull requests. |
| **Gemini** | Reviewer: Gemini Code Assist reviews every pull request on GitHub (rules in `.gemini/styleguide.md`). Gemini does not push code. |
| **Grok** | Research and second opinions; reads `docs/PROJECT.md` and `docs/CHANGELOG.md` for context. |

Rules for every AI:
- Read `docs/PROJECT.md` and the latest entries in `docs/CHANGELOG.md` before starting.
- Never push directly to `main`. Branch → pull request → Vercel preview → review → Jorge merges.
- When a change affects anything in this spec, update the spec in the same PR.
- Add a dated line to `docs/CHANGELOG.md` for every merged change: `YYYY-MM-DD — <AI> — <what changed>`.
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
- Never commit secrets. Supabase service-role keys and Green Pay credentials live only in Vercel
  environment variables.
