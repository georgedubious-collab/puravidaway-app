# Costa Rica Private Transfers — Master Project Specification

> **Renamed 2026-11-09 (Jorge):** the brand is **Costa Rica Private Transfers** (domain `costaricaprivatetransfers.com`), formerly PuraVidaWay. Internal names keep the old one: the GitHub repo and Vercel project (`puravidaway-app`), the Google Cloud project, browser storage keys and log tags. Booking references are `CRPT-…` (older ones `PVW-…`). The changelog keeps the old name where it was written.


> **This is the single source of truth for Costa Rica Private Transfers.** It merges and replaces
> `Architecture.md`, `Database-Schema.md`, `Route-Pricing.md` and the Gemini-drafted
> master spec (October 2026). If code and this document disagree, fix one of them in
> the same pull request and log it in a changelog note (`docs/changelog/`).

| | |
| :--- | :--- |
| **Owner & founder** | Jorge Li — Costa Rica Travel Planner (Flores, Heredia, Costa Rica) |
| **Repository** | `georgedubious-collab/puravidaway-app` (connected to Vercel; `main` deploys to production) |
| **Vercel project** | `puravidaway-app` — team "Jorge Li's projects" |
| **Production URL** | https://www.costaricaprivatetransfers.com (connected in Vercel since 2026-11-09; the bare domain and costaricatoursandtransfers.com redirect to it; `puravidaway-app.vercel.app` still works). Search engines stay blocked until `NEXT_PUBLIC_SITE_INDEXABLE=true` |
| **Spec last reviewed** | 2026-11-08 |

---

## 1. What Costa Rica Private Transfers is

An all-in-one Costa Rica travel platform that combines three
revenue engines in one booking flow and one cart:

1. **Daytrip-style sightseeing transfers.** Private point-to-point transfers where travelers add
   curated 45–120 minute stops (wildlife, volcano, waterfall) along the corridor while the
   driver stays with the luggage in the locked vehicle.
2. **Fixed prices, drivers compete behind the scenes.** Travellers always book at a **fixed
   price per vehicle** (Jorge, 2026-11-11: the "Driver offers" / "name your price" option was
   removed). Verified local drivers send offers on their payout on the job board and our team
   picks the driver (§6.3).
3. **1-day private eco-tours** with an optional **Smart En-Route Transfer (+$65)** that turns a
   day tour into a city-to-city hotel transfer.

**Scope (Jorge, 2026-11-11): private transfers and 1-day tours only.** Multi-day trips
("expeditions") were retired: no longer shown, priced or bookable on the website or in the apps.
The `expeditions` / `lodging_tiers` tables and any earlier booking stay as a record (migration
0043 switches the rows off and makes them admin-only). Customer-facing text never points to
another project or brand for multi-day travel (§10).

Target market: travelers from the US, Canada and Europe. Sales are high-touch, with WhatsApp as
the primary conversation channel.

**Competitive benchmark (standing rule):** Costa Rica Private Transfers competes with **Daytrip**, **GetTransfer**
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
| Maps | Leaflet + OpenStreetMap (admin fleet map). Traveller app: `react-native-maps` (Apple Maps on iPhone; Google Maps on Android once a key is set, else the app's own drawn map) |
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
- `src/components/` — storefront UI: `site/SiteHeader`, `site/SiteFooter`, `TransfersView`, `DayToursView`,
  `CartDrawer`, `Toast`, `Storefront` (state + localStorage cart).
- Legal pages (2026-11-08, **draft pending review by a Costa Rican lawyer**): `/terms`,
  `/privacy`, `/cancellation`, sharing `src/components/legal/LegalPage.tsx`. The operator's legal
  name, cédula jurídica and address are a placeholder (`LEGAL_ENTITY_PLACEHOLDER`) until filled
  in. The site footer links to all three; the trip request form says sending it accepts them.
  The Privacy Policy has its own "last updated" date (the `updated` prop) since its cookie and
  measurement paragraphs were added on 2026-11-11; those are part of the same pending review.
- `legacy/index.html` — the original static prototype, kept as the **design reference**.
- Logins: `/login` (email + 6-digit code), `src/proxy.ts` (session refresh on account pages),
  `src/lib/auth.ts` (`requireRole`). `/admin` (dashboard) and `/admin/users` (roles) are live
  once Supabase is connected.
- **Sign-in codes are sent only by our server (2026-11-12, after bot sign-ups):** the website
  (`POST /api/auth/send-code`) and both apps (`POST /api/v1/auth/send-code`, same handler,
  `src/lib/authCodeServer.ts`, rules in `src/lib/authCode.ts`) never call Supabase's
  `signInWithOtp` themselves. The server checks the email, a quiet Cloudflare Turnstile check on
  the website (only when `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are set; the
  script loads only on `/login`), rate limits (3 codes per email an hour, 6 a day, 10 requests
  per network an hour; table `auth_code_requests`, migration 0050), then the reason (`purpose`):
  `booking` (traveller app sending a trip request) and `driver` (driver app, or `/login?next=/driver`
  for a new driver applying on the website) may create the account; `trips` ("Already booked?")
  only if a trip was booked with that email; `login` (website `/login`) existing accounts only.
  Existing accounts always get a code. For `trips` and `login` the reply never says whether the
  email has trips or an account ("If this email has…, we've sent…"). Accounts are created with the
  admin API (service role, server only) and marked confirmed so Supabase emails the code with
  public sign-ups **off** (Supabase → Authentication → Sign In / Providers → "Allow new users to
  sign up" off; `docs/SETUP-SUPABASE.md` §4b). The code itself still proves the inbox is theirs.
  Migration 0051 deleted the junk accounts made on 10–12 Nov 2026 (13 on the live database).
- `supabase/migrations/` — database schema, row-level security and catalog seed (Phase 2b);
  `supabase/tests/rls.test.mjs` checks the security rules (`npm run test:db`). Setup steps for
  Jorge: `docs/SETUP-SUPABASE.md`.
- Built and connected to Supabase: logins, `/admin` (dashboard, users, pricing, drivers,
  bookings), `/driver` portal (KYC vault, vehicles, assigned trips with "Open in Waze" / "Google Maps"
  buttons for the pickup and drop-off, `src/lib/navigation.ts`; Drake Bay ends go to the Sierpe dock), trip requests saved online,
  private trip page `/trip/<code>`, tri-party trip chat with Resend email notifications.
- Not yet built: online payment (Green Pay, §6.4), GPS fleet map, `/account` for signed-in travellers
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
- Route landing pages (`/transfers/[slug]`, Spanish `/es/traslados/[slug]`, same slug; **40 pages
  since 2026-11-11**, 20 pairs of towns in both directions): SJO ↔ Manuel Antonio, La Fortuna,
  Monteverde, Tamarindo, Puerto Viejo, Sierpe and Drake Bay; LIR ↔ Tamarindo, La Fortuna,
  Monteverde and Manuel Antonio; La Fortuna ↔ Monteverde, Manuel Antonio, Tamarindo and Puerto
  Viejo; Monteverde ↔ Manuel Antonio and Tamarindo; Manuel Antonio ↔ Sierpe, Drake Bay and
  Tamarindo. The nine slugs that existed before keep working. Index of all routes, grouped by
  pickup town: `/transfers` and `/es/traslados`.
  Content is data in `src/lib/routes/` (English and Spanish side by side): `hubs.ts` has one block
  per town (names, pickup and arrival FAQ), `corridorsAirports.ts` and `corridorsTowns.ts` one
  block per pair (the road, bus / shuttle / flight / rental car, three FAQs, and a lead and one FAQ
  for each direction); `src/lib/routePages.ts` turns every pair into two pages. **To add a route,
  add one pair there**: title, slug, the dated direct answer, the price table, stops, links, the
  index, sitemap, footer and `llms.txt` follow. Numbers are never typed: drive time
  (`ROUTE_MINUTES`), distance (`ROUTE_KM`, the same km the price formula uses) and prices come
  from the catalog through the guide tokens (`{time:A>B}`, `{km:A>B}`, `{price:A>B}`…). A missing
  drive time, distance or a mistyped token fails the build, and `npm run test:routes` checks every
  page (price source, both languages, 5–8 FAQs, no intro or FAQ set shared by two pages, no stop
  named that the trip builder doesn't offer on that ride). Each page: dated direct answer, facts,
  a price table by vehicle class ("or similar" models, travellers, luggage; a Drake Bay page shows
  only the class that includes the boat, like the guides), the road, the stops the builder offers
  on that ride, other ways to get there (no timetables, fares or terminals; no boat times), 7 FAQs
  with FAQ data, links to the way back, the guides, other rides from and to the same towns and the
  day tours of the region. Structured data: WebPage + Service with an AggregateOffer (lowest and
  highest class price in USD from the live catalog; no ratings, no availability), FAQPage,
  BreadcrumbList. Both languages render `src/components/site/pages/RouteLandingPage.tsx`.
- Search engines (2026-11-08): **the whole site is `noindex` and `robots.txt` blocks all
  crawlers until `NEXT_PUBLIC_SITE_INDEXABLE=true` is set** (Vercel, Production only). Then
  `robots.txt` blocks only `/admin`, `/driver`, `/trip`, `/login`, `/auth`, `/api`, explicitly
  welcomes search and AI crawlers (Googlebot, Bingbot, GPTBot, OAI-SearchBot, PerplexityBot,
  ClaudeBot, Claude-SearchBot, Google-Extended) on everything else, and points to
  `sitemap.xml` (home, route pages, destination and airport guides, travel guides, day tour pages, info pages and legal pages, each in English and Spanish
  with hreflang).
  `NEXT_PUBLIC_SITE_URL` (default `https://www.costaricaprivatetransfers.com`) sets canonical and
  link-preview URLs; the preview image is `src/app/opengraph-image.tsx`. Custom 404 and error
  pages (`not-found.tsx`, `error.tsx`, `global-error.tsx`). Vercel Web Analytics
  (`@vercel/analytics`) is in the root layout and must be enabled in the Vercel dashboard.
- **Marketing measurement, cookie banner in Europe only (2026-11-11, `docs/SEO.md` §7).** Off unless
  its id is set in Vercel (Production only): `NEXT_PUBLIC_GA_ID` (Google Analytics 4),
  optional `NEXT_PUBLIC_CLARITY_ID`, and for later ads `NEXT_PUBLIC_GOOGLE_ADS_ID` and
  `NEXT_PUBLIC_META_PIXEL_ID`; `NEXT_PUBLIC_GSC_VERIFICATION` and
  `NEXT_PUBLIC_BING_VERIFICATION` add the Search Console / Bing ownership tags to every page.
  Ids are format-checked in `src/lib/analyticsConfig.ts`; a malformed one is ignored. With at
  least one tool set, the root layout mounts `src/components/site/ConsentManager.tsx`.
  **Region rule (Jorge, 2026-11-11):** the banner is shown only to visitors in the EEA (EU-27 +
  Iceland, Liechtenstein, Norway), the UK and Switzerland, plus EU areas with their own country
  code and Gibraltar / Jersey / Guernsey / Isle of Man (list in `src/lib/consentRegion.ts`,
  `npm run test:consent-region`); everyone else gets the tools on by default with no banner and
  can switch them off with "Cookie settings". `src/proxy.ts` reads Vercel's
  `x-vercel-ip-country` header and sets the first-party cookie `crpt-region` = `consent` or
  `open` (30 days, SameSite=Lax, Secure on Vercel, path `/`, only when missing or different,
  only when a tool is switched on), so the pages stay prerendered; a missing or unknown
  country counts as `consent`. A stored choice always wins in every region (outside Europe it
  does not expire). Where shown, the banner: English / Spanish by page, "Accept" and "Reject"
  alike, "Choose" for Analytics and Advertising separately, nothing pre-ticked; the choice kept
  in the browser's local storage (`crpt-consent-v1`) for six months, and a "Cookie settings"
  link in the footer (for every visitor) to change or withdraw it. Google Consent Mode v2 in
  its basic form: in Europe no third-party script is loaded until the visitor accepts;
  elsewhere the tag loads at once with analytics granted; switching off stops the tools and
  deletes their first-party cookies. Never a banner or a script on the private paths (`PRIVATE_PATHS` in
  `src/lib/site.ts`, plus `/account` and `/chat`); arriving on one with tools running reloads
  the page clean, and trip links are never sent, not even as the referrer. Events go through
  one browser-only helper, `src/lib/analytics.ts` (`page_view`, `view_item`, `select_item`,
  `add_to_cart`, `begin_checkout`, `generate_lead`, `click`); every call does nothing without
  consent or an id, and carries only town codes, vehicle class ids, prices and page addresses
  without their query string. No `purchase` event yet: the website takes no payment and the
  test checkout is app-only and server-side. Server code must not import `analytics.ts`
  (`client-only`). The Privacy Policy's cookie paragraphs
  (`src/components/legal/MeasurementText.tsx`, both languages) appear only for the tools that
  are switched on, so with nothing set the page still says no tracking cookies are used. The
  site sets no Content-Security-Policy header, so none was changed.
- Rendered per request (`connection()` in `page.tsx`): full HTML for search engines; "today" is
  computed server-side in `America/Costa_Rica`.
- Ride builder (2026-11-08): pickup time picker (Costa Rica time, **any hour of the day** in 15 min
  on the website and every half hour in the app since 2026-11-11, it was 04:00–22:00; default
  9:00; night hours are marked "+20%" and cost the night premium, §6.6) saved in
  `bookings.scheduled_at` (UTC−6); day tours default to 7:00 until confirmed. Dates and times are shown in Costa Rica time everywhere
  (`formatScheduledAt()` in `src/lib/dates.ts`). Vehicle and stop cards show season-adjusted
  prices for the chosen date.
- Competitor gaps (2026-11-08): per car + "from $X per person (N travellers)" on vehicle cards and
  route pages; "Every ride includes" list (`RIDE_PROMISES`, `src/lib/trust.ts`); stop cards show
  the entrance: free stop / included / paid at the gate (`entrance`, migration 0014); after a ride is added, an inline
  suggestion of 1–2 day tours in the drop-off region; the ride builder's choices are
  kept in the address so rides can be shared (`src/lib/shareLink.ts`).
- Seasons: peak = Dec 20–Jan 5 + Semana Santa (Palm Sunday → Easter); high = Dec–Apr; else green.
  Live from the `seasons` / `season_ranges` tables (edited at `/admin/pricing`); the same rule is
  the built-in fallback in code.
- **Languages (Jorge, 2026-11-09):** the team pages (`/admin`, the CRM) and the driver web portal
  (`/driver`) are **Spanish by default with an English option**: an "ES | EN" switch in their
  headers stores the choice in the `team_lang` cookie for a year (`src/lib/teamLang.ts`,
  `getTeamLang()` in `src/lib/teamLangServer.ts`). Server-action messages on those pages follow it;
  `/api/v1` calls from the apps get English unless they send an `x-team-lang: es|en` header.
  The **driver app** is Spanish by default with English in Profile, and the **customer app** is
  English with a Costa Rica flag toggle for Spanish (branches `feat/driver-app-spanish` and
  `feat/client-app-spanish`).
  **Travellers hear from us in the language they booked in (2026-11-10):** every trip request
  stores its language in `trips.language` (`en` | `es`, migration 0033): `es` when it is sent from
  `/es` or from the customer app while it is in Spanish, `en` otherwise (also for older app builds
  that don't send it). Everything addressed to the traveller follows it: the emails (request
  received, ride confirmed with driver, driver on the way, rating request and its reminder, new chat
  message), the push notifications to the customer app, and the private trip page `/trip/<code>`
  (status, payment line, driver and car card, live position, rating form, chat labels and errors,
  dates as "22 de noviembre de 2026 · 9:00 a. m."; a flag button switches the page for that visit
  with `?lang=en|es`). All of these texts live in one file, `src/lib/travellerMessages.ts`, English
  and Spanish side by side; `node scripts/preview-traveller-messages.mjs` prints them all for
  proofreading. Emails to the team and to drivers are unchanged, plus one line "Client language:
  Spanish" when it applies; the admin booking page shows the traveller's language and opens
  WhatsApp with a Spanish greeting. English wording is exactly as before.
  **Public website in Spanish (2026-11-10):** every public page exists in English and Spanish.
  Spanish lives under `/es`: the booking storefront at `/es` (same `Storefront`, same trip-request
  server action, `?tab=` and shared ride links work there too), route pages at
  `/es/traslados/<slug>`, info pages with Spanish slugs, and legal pages at `/es/terminos`,
  `/es/privacidad`, `/es/cancelacion` (faithful translations that say the English version
  prevails; same lawyer review pending). `src/lib/publicLang.ts` (`ES_PATHS` + the route-page
  prefix) is the one place read by the language switch, hreflang links and the sitemap. The
  storefront gets its language from `PublicLangProvider` / `useT()`
  (`src/components/PublicLangContext.tsx`); texts are written side by side as `t("English",
  "Español")`. Catalog names from the database (vehicles, stops, tours,
  seasons) plus towns, regions and entrance labels are translated in code by item id in
  `src/lib/catalogEs.ts` (`localizeCatalog()`): only the seeded items, and only while their
  database text is still the original English, so anything added or reworded in `/admin/pricing`
  shows as typed in both languages (Spanish fields in the admin editor are a later PR). Messages
  the server sends back (trip request, place search) are translated for display in
  `src/lib/serverMessagesEs.ts`. Spanish copy is neutral Latin American Spanish with "usted" and
  "conductor".
- **Logo (2026-11-10):** the "CR route" mark (the letters C and R drawn as one road with two gold
  dots; emerald `#047857` + gold `#F5B301` on light backgrounds, white + `#FBBF24` on dark) with
  the wordmark "COSTA RICA" over "Private Transfers". One component, `src/components/brand/Logo.tsx`,
  is used by the site header and footer, the trip page, login, the admin and driver headers and the
  error / 404 screens. The same drawing is in `src/app/icon.svg`, `apple-icon.png` and `favicon.ico`
  (white mark on an emerald rounded square), in the link-preview image (`src/app/opengraph-image.tsx`)
  and in `public/brand/`: `logo-email.png` (email header, loaded from `NEXT_PUBLIC_SITE_URL` because
  mail apps don't show SVG), `logo-mark-1024.png` (profile picture for Facebook / Instagram /
  TikTok), `logo-lockup-white-1600x500.png` and `logo-lockup-green-1600x500.png` (covers), and
  `logo-mark.svg`. Change them together.
- **Photos (2026-11-10):** every picture goes through the registry `src/lib/photos.ts` (file, alt
  text in English and Spanish, focal point, credit) and the `Photo` component
  (`src/components/site/Photo.tsx`, `next/image`, AVIF / WebP). Files are in `public/photos/`,
  metadata-free. An entry without a file shows a drawn placeholder (Arenal Volcano, Corcovado,
  Poás, the 4x4 + boat combo) until a real photo is added with one registry line. The
  rules (own photos preferred and never shared with any other business, a photo shows what its
  caption says, no people / plates / metadata) and the list of published photos are in
  `docs/PHOTOS.md`. **Temporary stock photos (Jorge, 2026-11-11):** where we have no photo yet
  (Monteverde, Drake Bay, the five vehicle classes) the site and the customer app use free
  Pexels photos, each recorded with its source page so it can be replaced by an own photo;
  vehicle photos are examples of the body type ("Photos show example vehicles"), never presented
  as our cars. The customer app bundles the same pictures (`apps/client/src/images.ts`,
  `apps/client/assets/photos/`, about 1.5 MB).
- **Destination and airport guides (2026-11-11, docs/SEO.md §4 step 2):** `/destinations` (index)
  and `/destinations/<slug>` for La Fortuna / Arenal, Manuel Antonio, Monteverde, Tamarindo /
  Guanacaste, Puerto Viejo and Drake Bay & Sierpe; `/airports` (index) and `/airports/sjo`,
  `/airports/lir`. Spanish: `/es/destinos`, `/es/destinos/<slug>`, `/es/aeropuertos`,
  `/es/aeropuertos/<code>` (same slugs, paired in `src/lib/publicLang.ts`). The text is data in
  `src/lib/guides/` (`destinations.ts`, `airports.ts`; English and Spanish side by side, rules in
  `types.ts`), drawn by `src/components/site/pages/GuidePages.tsx` and `site/GuideParts.tsx`.
  No number is typed into the text: drive times (`ROUTE_MINUTES`), "from" prices
  (`routeFromPrices()`, default season), the boat time and the cash fee are tokens filled from
  the catalog, so guides, route pages and the trip builder always agree. A ride to Drake Bay is
  priced with the vehicle option that includes the river boat; rides to Sierpe end at the dock.
  Each guide: dated direct answer, drive-time and price table linking to route pages or the
  pre-filled trip builder, stops on the way, other ways to travel (no timetables or fares), best
  time to go, things to do with the day tours of that region, where to stay
  by area (no hotel names, no affiliate links), FAQs and a booking button. Airport guides show
  `RIDE_PROMISES` word for word and describe the pickup as confirmed: the driver meets the
  traveller at arrivals holding a sign with their name, and the traveller chooses what it says
  (§4.6, Jorge 2026-11-11), plus the trip page and the chat; the exact meeting spot at each
  airport is still an open question (§9). Structured data: WebPage about a TouristDestination / Airport, FAQPage, BreadcrumbList;
  never ratings. Pre-rendered like the route pages. Guides are in the footer, sitemap and
  `llms.txt`, and route pages link to the guides of their two ends.
- **Travel guides, the blog (2026-11-11, docs/SEO.md §4 step 3):** `/guides` (index) and
  `/guides/<slug>`; Spanish `/es/guias` and `/es/guias/<slug>` (same slugs, paired in
  `src/lib/publicLang.ts`). "Travel guides" / "Guías de viaje" is in the top menu (between
  Destinations and Help; the menu now collapses into the phone menu below 1280 px wide, because
  seven entries no longer fit next to the logo at laptop width) and in the footer's Destinations column. First six articles:
  San José → La Fortuna, San José → Manuel Antonio, San José → Monteverde, Liberia airport →
  Tamarindo, SJO or LIR, and a drive-times table between all our towns. Articles are data in
  `src/lib/blog/` (`articlesRoutes.ts`, `articlesPlanning.ts`, shared texts in `shared.ts`, rules
  in `types.ts`), English and Spanish side by side, drawn by
  `src/components/site/pages/BlogPages.tsx` with the guides' parts (rides table, other ways,
  FAQ, call to action, link pills) plus a price-by-vehicle table and a drive-time grid. **To add
  an article, add one object and list it in `ARTICLES` (`src/lib/blog/index.ts`)**: page, index,
  sitemap, `llms.txt` and the links from route pages (`about.hubPairs`) and destination / airport
  guides (`about.hubs`) follow. Numbers are tokens filled from the catalog: the guide tokens plus
  `{pp:A>B}` (lowest price per traveller), `{ppPax:A>B}`, `{ppClass:A>B}`, `{class:A>B}` and
  `{asof}` (month of the last check, required in the opening answer). Links are written
  `[label](/english/path)` and localized automatically. A build-time check fails `npm run build` on
  an unknown token, a link to a page that doesn't exist, fewer than 5 or more than 8 FAQs, an
  undated answer or forbidden words (24/7, the owner's or sister brands' names, multi-day trips);
  `npm run test:blog` runs it plus word counts and both languages. Structured data: BlogPosting
  (author and publisher = the organisation, datePublished / dateModified; no person, no ratings),
  FAQPage, BreadcrumbList; the index is a Blog. Transfers and single-day tours only: no multi-day
  content. Re-check facts and bump each article's `updated` about twice a year.
- **Day tour pages (2026-11-12, docs/SEO.md §4 step 5):** `/tours` (index, grouped by region)
  and `/tours/<slug>` for each active tour; Spanish `/es/tours` and `/es/tours/<slug>` (same
  slugs, paired in `src/lib/publicLang.ts`). Text is data in `src/lib/tours/` (`slugs.ts`,
  `content.ts`, rules in `types.ts`), drawn by `src/components/site/pages/TourPages.tsx`. **To add
  a page for a tour, add its slug and one content object.** Name, region, length, highlights,
  per-person prices (1 / 2–3 / 4+), the Smart En-Route Transfer price and season multipliers come
  from the live catalog; the price table shows every season from the database. Included: only the
  site's existing wording (private vehicle with only your group, local naturalist guide, entrances,
  lunch); not included: rides from other towns, the optional upgrade, the cash booking fee. No clock
  times; park rules reused from the destination guides. The "Book" button opens the trip builder
  with the tour's region chosen and the tour highlighted (`/?tab=tours&tour=<id>`, read in
  `Storefront.tsx`); the builder's tour cards link back to the pages. A build-time check (and
  `npm run test:tours`) fails on a missing page for a built-in tour, an unknown token, an undated
  answer, fewer than 5 or more than 8 FAQs, a clock time or forbidden words. Structured data:
  WebPage + TouristTrip (per-person AggregateOffer in USD; no ratings, no availability), FAQPage,
  BreadcrumbList. In the footer, sitemap and `llms.txt`; linked from route pages, destination
  guides and the travel guides.
- **Site shell (2026-11-09):** every public page (home, `/transfers/*`, legal and info pages; not
  `/admin`, `/driver`, `/trip`, `/login`) shares `SiteHeader` (menu Transfers / Day tours / Destinations / Travel guides /
  Help from `src/lib/siteNav.ts`, WhatsApp, a flag language button always visible in the bar, phones
  included — Costa Rica flag + "ES" on English pages, US flag + "EN" on Spanish pages, like the
  customer app; it opens the same page in the other language and keeps the query string
  (`src/components/site/LangSwitch.tsx`) — and a phone menu) and `SiteFooter` (Company, Partners, Popular routes,
  Support, Legal, social icons, the TravelAgency structured data). The menu's Transfers / Day tours
  open the booking app on that tab (`/?tab=transfers|tours`, `/es?tab=…` in Spanish); the retired
  `?tab=multiday` redirects (308) to `?tab=tours` (`next.config.ts`). Destinations
  (since 2026-11-11) opens the guides index; Travel guides (since 2026-11-11) opens the blog index `/guides`. Info pages (EN · ES):
  `/about` · `/es/nosotros`, `/how-it-works` · `/es/como-funciona`, `/our-drivers` ·
  `/es/nuestros-conductores`, `/faq` · `/es/preguntas-frecuentes` (FAQ content in `src/lib/faq.ts`,
  FAQPage structured data), `/contact` · `/es/contacto` (WhatsApp, hello@costaricaprivatetransfers.com
  and a form that emails `ADMIN_NOTIFY_EMAIL` through Resend with the sender as reply-to; nothing
  stored, honeypot against bots; without Resend it asks people to use WhatsApp or email). Each has
  breadcrumbs (visible + BreadcrumbList data); route pages too. `<html lang>` stays "en" in the
  server HTML (one root layout shared with /admin and /driver); the `/es` layout marks its content
  `lang="es"` and switches `<html lang>` once loaded. Social icons appear only when their
  `NEXT_PUBLIC_SOCIAL_FACEBOOK|INSTAGRAM|TIKTOK|YOUTUBE|X` URL is set (`src/lib/social.ts`).
  `/llms.txt` summarises the business for AI assistants.

## 4. Product modules

### 4.1 Customer storefront (public)
Layout (decided 2026-10-14): a booking **app first**, not a marketing site. The home page opens
on the trip builder; the trip is a persistent sidebar on desktop and a bottom bar + drawer on
phones.
First screen and builder (2026-11-10, design review): a hero photo under a dark-green overlay with
the H1 "Private transfers across Costa Rica", one line ("Fixed price per car. Free cancellation up
to 24 h. Add sightseeing stops on the way.") and a compact form card: tabs Transfers / Day tours
(phones only; on wide screens the header menu does this), From, To, Date + Pickup
time, Travellers and one amber "See prices" button that scrolls to the vehicles; the pre-filled
SJO → Manuel Antonio route is labelled "Example route — change it to yours" (`src/components/BuilderHero.tsx`).
Under it a trust strip of four true claims (`trustStrip()` in `src/lib/trust.ts`). The ride
builder then runs in numbered steps: 2 vehicle (fixed price per car; the "Name your price
(drivers bid)" choice was removed on 2026-11-11), 3 sightseeing stops (folded to three cards with "Show all"), 4
extras (folded, all optional), 5 the live summary (sticky on desktop). While the trip is empty, phones
get a pinned bar "route · vehicle · $price · Add to trip"; once something is added it becomes the
"Your trip · N items · $ · Review & book" bar. Below the builder: Popular routes (the route pages,
with green-season "from" prices from `src/lib/routePrices.ts`), How it works in three steps, the
road and wildlife photos, and a four-question FAQ teaser. Customer-facing names everywhere:
Transfers / Day tours (Traslados / Tours de un día).
Catalog wording that isn't a confirmed fact is replaced at display time (`CLAIM_REPLACEMENTS` in
`src/lib/catalogEs.ts`): the old badge "Most popular" on the 4-traveller class shows as "Roomy for 4 + bags"
(since migration 0038 that is also the stored badge); the database row should be edited
in /admin/pricing. Marketing lives on separate route/tour landing pages (`/transfers/[slug]`) that rank on
Google and pre-fill the builder via `?from=<hub>&to=<hub>`. Shareable ride links (2026-11-08) add
`&date=YYYY-MM-DD&time=HH:MM&pax=N&vehicle=<id>&stops=<id>,<id>`, all checked against the catalog
on load; no personal details ever go in the address. Trust content (driver checks,
guarantees, real reviews only) lives in `src/lib/trust.ts`.
Legal pages (`/terms`, `/privacy`, `/cancellation`) are linked from every footer and under the
"Send trip request" button, so the cancellation policy is visible before anyone pays.

1. **Transfers & Sightseeing** — exact pick-up/drop-off by map place search (hotel, dock,
   restaurant, address; see COMPETITORS.md §2d — *built 2026-11-09: our towns plus Google place search*), date,
   passengers (fixed price only since 2026-11-11; the Fixed Price vs Driver Bids toggle is gone),
   sightseeing stop cards (duration, price, whether there is an entrance fee: free, included or paid at the gate), vehicle
   cards with the price per car and "from $X per person (N travellers)", the "Every ride includes"
   list (flight tracking and the name sign at arrivals on airport pickups, 60 min free waiting, child seats free on request, free
   cancellation up to 24 h), live route timeline with total duration, flight number or hotel
   field, "How many bags?" / "¿Cuántas maletas?" as two counters, **Large suitcases** / "Maletas grandes" and
   **Carry-ons** / "Maletas de mano" (each 0–20; each starts at 1 per traveller and follows the traveller count
   until the traveller changes that counter, Jorge 2026-11-10; always sent with the booking; a gentle amber note,
   never a block, when the large suitcases exceed the number the chosen vehicle lists, `luggageCapacity()` in
   `src/lib/bags.ts`;
   website Extras step and the app's "When & who" step; shown to the driver), price breakdown. After a ride is added, an inline, dismissible suggestion of 1–2 day
   tours in the drop-off region (Welcome Pickups-style).
2. **1-Day Private Tours** — region filter, Smart En-Route Transfer upgrade (+$65); `?tour=<id>`
   opens the tab with that tour picked out, and each card links to its page (`/tours/<slug>`).
3. ~~Multi-Day Expeditions~~ — **retired 2026-11-11** (Jorge: transfers and 1-day tours only).
   An expedition item sent by an older page or app is refused with a clear message (EN/ES,
   `RETIRED_EXPEDITION_ERROR` in `src/lib/tripRequest.ts`); one left in a browser's saved trip is
   dropped on load. Earlier bookings still show their name (`RETIRED_EXPEDITIONS`,
   `bookedItemName()` in `src/lib/catalog.ts`).
4. **Trip Cart & checkout** — combines transfers, stops and day tours. Payment choice
   (decided 2026-11-08, built): **pay online in full** (we send a secure Green Pay link once the
   team confirms the trip; online payment isn't live yet, so the site never says "pay now"), or
   **pay the driver in cash + a 10% cash booking fee** (rides and 1-day tours). The trip summary shows
   "Cash booking fee (10%) +$X" and the cash vs online amounts. The 20% deposit is retired.
5. **WhatsApp support** — context-aware buttons (`route`, `cart`, `general`) that pre-fill the
   route or cart contents into a WhatsApp message to the Costa Rica Private Transfers team.

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
6. **Trip chat oversight** — every traveller ↔ driver thread is readable (and writable) on the
   booking page; **"Mensajes marcados" / Flagged messages** (`/admin/flagged`) lists every message
   or booking note where contact details were hidden, with the original text (admins only), a
   "N times" mark for repeat senders and "Mark reviewed". See §4.5.

**Built today (redesign approved 2026-11-12, Spanish by default with ES | EN).** Every admin page
shares one look (`src/components/admin/*`: page header, cards, status / payment chips, tables, empty
and error states, `AdminActionForm`).
- **Side menu**: dark green, with live counters (bookings not yet confirmed, live trips, drivers to
  review, flagged messages), language switch, signed-in email, sign out. On phones it hides behind
  ☰ (focus stays inside, Escape closes). `src/app/admin/error.tsx` / `loading.tsx` show a clear
  Spanish/English message with "Try again"; actions return readable errors instead of a blank page.
- **Panel** (`/admin`): greeting with the Costa Rica date; search (goes to Bookings); "Nueva reserva";
  KPIs: pickups today (and how many lack a driver), new requests waiting for payment, **revenue this
  month** (= amount received on bookings whose pickup is in this Costa Rica calendar month, cancelled
  bookings and test payments left out) vs last month, average driver rating; upcoming pickups (Hoy /
  Mañana / 7 días) with "Asignar"; **Necesita atención** (no driver within 48 h, documents expiring
  ≤ 30 days, new applications / changes to check, flagged messages not reviewed, waiting for payment
  > 24 h, approved vehicles without a category or seats); bookings received per week (8 weeks).
- **Bookings** (`/admin/bookings`): server-side search (code, traveller name/email, driver name; a
  search covers all dates), status tabs with counts, pickup-date presets or exact dates, type and
  driver filters, sorted by pickup time, 25 per page with real pagination, colour status and payment
  chips. **Export CSV** (`/admin/bookings/export`, same filters, UTF-8 with BOM for Excel) — includes
  the traveller's name, email and phone (the team's own export; see §7.7), never card data.
- **Nueva reserva** (`/admin/bookings/new`): a booking that came by WhatsApp/phone, priced by the
  server exactly like the website (same catalog, season, night premium, stops, sign, bags) and saved
  through the website's own request path (`submitTripRequestAsTeam`, `src/app/trip/actions.ts`):
  same `trips`/`bookings` rows, status "Esperando pago", fixed price, online or cash; optional email
  of the trip link to the traveller. Rides between our towns (typed addresses: on the website).
- **Booking page**: change history ("Historial de cambios", §7.3 `booking_events`) as a timeline.
- **Confirmations in the page** (never a browser pop-up), saying what will happen: cancel a booking,
  change the amount received, accept a driver's offer (sets the payout), mark trips settled,
  reject/suspend a driver or vehicle, change a vehicle's category, change prices / fees / season
  multipliers / commission, add or remove season dates, change a user's role.
- **Drivers are told** (push to the driver app + email, in their language, `profiles.app_lang`) when
  the team approves or rejects their application, approves / rejects / puts on hold one of their
  vehicles, or sets a vehicle's category for the first time — once per decision, only about their own
  account (`src/lib/driverReviewNotices.ts`).

### 4.3 Driver portal (`/driver`, driver role)
KYC document upload, view open booking requests, submit and manage bids, assigned trips,
on-duty toggle (Phase 3), trip chat (Phase 4).

### 4.4 Client account (`/account`, client role) — not built yet
Today travellers don't need an account: each trip request gets a private trip page
(`/trip/<code>`, linked in the confirmation email) with bookings, status, driver and chat.
`/account` is planned for repeat travellers; `src/proxy.ts` already keeps its session fresh.
Bookings, payment status and balance due, trip chat (Phase 4).

### 4.5 Trip chat and contact privacy (Jorge, 2026-11-10)
- **Drivers never see the traveller's phone or email.** Not on the driver portal, the driver app,
  `/api/v1`, pushes or emails to drivers (the driver trip page used to show the phone from the day
  before; removed). Drivers see the traveller's first name + last initial ("Emily R.";
  `passenger_short_name()` in `my_trips()`, letters only, migration 0035), the text for the name
  sign (§4.6) and talk
  to them in the trip chat, or call our team. Admins keep full access. Booking fields the assigned driver can read through
  `my_trips()` (`flight_or_hotel_notes`, `driver_notes`; plus `client_notes`, which drivers don't
  see) have contact details hidden on every write (trigger `bookings_guard_notes`, migration 0034), the original kept for admins.
- **One chat per booking** between the traveller and the currently assigned driver; our team reads
  every thread and can write. Before a driver is assigned the traveller can already write (our team
  answers). Open until **48 hours after the trip ends** (`completed_at`, or the pickup + 12 h, or, on a
  multi-day booking made before they were retired, + its days, `src/lib/chatRules.ts`), then read-only for travellers and drivers; closed
  at once if the booking is cancelled. Text only.
- Shown in three places: the customer app (trip → Chat), the private trip page `/trip/<code>` (in
  the trip's language) and the driver app / driver portal trip page. New messages are checked every
  8–10 s while the chat is open (polling; travellers on the web have no account, so Supabase
  Realtime isn't used). Unread badges: customer app (trip → Chat, `unreadChat` in
  `/api/v1/client/trips`) and driver app trip cards (`my_chat_unread()`).
- **Hide and flag:** the server replaces phone numbers (also spaced, dotted or written "ocho ocho…"),
  emails (also "juan at gmail dot com"), links / domains and @handles or WhatsApp / Instagram /
  Telegram / Facebook mentions with a handle or number by "[hidden]" ("[oculto]" for Spanish
  readers) before storing (`src/lib/contactFilter.ts`, cases in `npm run test:filter`); the sender
  sees "For your safety, contact details are hidden. Use this chat or call our team." The original
  goes to `contact_flags` (admins only). The database applies a simpler copy as a backstop
  (`hide_contact_details()`). Nobody can insert into `trip_chats` directly: every message goes
  through the server (`sendChat()` / `POST /api/v1/chat/<booking>`). Our team's own messages are
  not filtered.
- **Notifications:** each new message pushes the other side in their language: travellers in
  `trips.language`, drivers in Spanish unless they use the app or portal in English
  (`profiles.app_lang`, saved when they open a chat). Travellers without the customer app get **one
  email** once messages have stayed unread 10 minutes (then nothing more until they read), linking to
  their trip page (`src/lib/chatEmails.ts`, `/api/cron/chat-unread`, run every 5 minutes by the
  "Driver ETA check" GitHub Action). Drivers get an email only if no push reached a phone; the team
  is emailed as before.
- **"Call our team" / "Llamar a nuestro equipo"** (phone + WhatsApp, `NEXT_PUBLIC_WHATSAPP_NUMBER`)
  under every chat and on the driver app trip screen. Later PRs: masked "Llamar al cliente" calling
  (Twilio; the contact row is ready for it) and optional translation.

### 4.6 Name sign at the pickup (Jorge, 2026-11-11, migration 0040)
The driver meets the traveller holding a sign (at the airport: at arrivals, with a whiteboard).
The traveller chooses what it says.
- **What the sign says, in this order** (one rule: `pickup_sign()` in the database, mirrored by
  `signShown()` in `src/lib/sign.ts`):
  1. the traveller's **own text**, if they wrote one (`bookings.sign_text`);
  2. else, if they ticked **"Don't show my name" / "No mostrar mi nombre"**
     (`bookings.sign_hide_name`): the brand name, **"Costa Rica Private Transfers"**;
  3. else their **first name + last initial** ("Emily R."), or the brand name when the name they
     gave has no letters.
- **The text:** optional, at most 40 characters, one line, trimmed. Phone numbers, emails and
  links are **refused** (not hidden as in notes: "[hidden]" on a sign helps nobody), with the same
  check as the message for the driver (`hasContactDetails()` on the server and in the app,
  `no_contact_details()` in the database as a backstop). Stored explicitly as two columns:
  `sign_text` NULL = nothing written, and the boolean for "no name"; the two are never set together.
- **Where the traveller sets it:** the ride builder on the website (summary step, under the flight
  number) and the app's "Your ride" screen: "Name on the sign" / "Nombre en el rótulo" with the hint
  "Your driver waits with a sign. Leave it empty and it will show your first name and last initial."
  and the "Don't show my name" tick. **After booking** they can change it on the private trip page
  and in the app's trip screen **until the driver taps "I'm on my way"**; after that it is
  read-only (`saveSign()` in `src/app/trip/[token]/actions.ts`, `POST /api/v1/client/sign`). Rides
  only: day tours have no sign field (their drivers see the short name).
- **What the driver sees:** one computed value, `my_trips().sign_text` (the last column, so
  older driver app builds keep working and keep showing the short name), shown large as
  **"Rótulo"** / "Sign" at the top of the travellers section in the driver app and on the driver
  portal's trip page. Drivers still never get the full name, phone or email and still read 0 rows
  from `bookings` and `trips` (`npm run test:db`). The job board does not show the sign.
- **Team:** the admin booking page shows the sign and which of the three cases it is.
- **Emails:** "request received" (when the request has a ride) and "ride confirmed" say the driver
  will wait with a name sign and that it can be changed on the trip page.
- Older customer app builds don't send the field: their bookings get the default (short name).

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

| ID | Class | Example models (shown as "… or similar") | Factor | Pax | Luggage | Use case |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `economy` | Economy Sedan | Toyota Yaris | 0.90 | 1–3 | 3 suitcases | Spanish-speaking driver, direct ride (no stops) |
| `sedan` | Standard Sedan | Toyota Corolla | 1.00 | 1–3 | 3 suitcases | Best value; default choice |
| `suv` | Minivan (MPV) | Mitsubishi Xpander | 1.20 | 1–4 | 4 suitcases | Roomy for 4 + bags |
| `4x4` | Executive 4x4 | Toyota Prado | 1.30 | 1–4 | 4 suitcases | Osa / Monteverde roads |
| `van` | Private Van | Toyota HiAce | 1.35 | 1–10 | 10 suitcases | Families & groups |
| `sierpe_combo` | 4x4 transfer + Sierpe river boat | Toyota Prado | 1.30 + $75 boat | 1–4 | Wet/dry assist | Drake Bay / Corcovado |

**Example models, always "or similar" (Jorge, 2026-11-11, migration 0039).** Every category has
example models in `vehicle_classes.example_models`, edited in `/admin/pricing` ("Modelos de
ejemplo"). Travellers see them under the category name as **"Toyota Prado or similar"** /
**"Toyota Prado o similar"**: on the website's vehicle cards, in the client app's vehicle list and
on its "Your ride" screen. The words "or similar" are added by the code (`orSimilar()` in
`src/lib/catalog.ts` and `apps/client/src/format.ts`), never typed into the database, so a model
is never shown as a promise. The category **names stay short** and no longer carry model names
("Executive 4x4 (Prado / Fortuner)" → "Executive 4x4", "Private Toyota HiAce / Hyundai Staria" →
"Private Van"; Spanish "4x4 Ejecutivo", "Van privada"). The seeded examples above are a first
proposal; leaving the field empty hides the line for that category.

**The customer app's Rides home lists the vehicle types (Jorge, 2026-11-11, mockup "C").** Under a
dark green band (menu, Rides | Day tours switch, the headline in white; the same band on the Day
tours side) and the From / To card that overlaps its edge, "Choose your ride" shows every
category that an ordinary route offers: a small drawing, the name, "Toyota Prado or similar",
"Up to N travellers · N suitcases" and the badge. **No prices there** (nothing is priced until a
route is chosen); it says "Prices appear once you pick where to" and "The price is for the whole
vehicle, not per person". It replaced the "Popular rides" picture cards. The list is never typed
into the app: it is read from the server's price answer for one ordinary ride (SJO → La Fortuna,
one traveller, in the app's language; `vehicleClasses()` in `apps/client/src/prices.ts`) and kept
on the phone for 12 hours, so a change in `/admin/pricing` reaches the app without an update. The
4x4 + Sierpe boat combo is only offered on Sierpe / Drake Bay routes, so it is not in this list.
Tapping a type remembers it and opens "Plan your ride"; "Choose your vehicle" then opens with it
selected when the route offers it for that group size, and with the first vehicle otherwise.

**The 4-traveller class is a minivan, not an SUV (Jorge, 2026-11-11).** A compact SUV (Aion V,
RAV4) has a sedan-size boot, so it cannot honestly carry 4 travellers + 4 suitcases; on Daytrip
such a car only qualifies for Sedan / Sedan Lite and the 4-person class is MPVs only
(`docs/COMPETITORS.md` §2b). So the class with id `suv` is sold as **"Minivan (MPV)"** (Spanish:
"Minivan (MPV)"). The id stays `suv` everywhere (bookings, quotes, share links, saved prices);
only the wording travellers see changed. Price factor, 4 travellers and 4 suitcases are unchanged.
Sedans stay at 3 travellers / 3 suitcases; the Executive 4x4 and the Van are unchanged.

#### Vehicle categories: which jobs each driver vehicle receives (built 2026-11-11, migrations 0038 and 0039)
Our team tags every driver vehicle with **one** category (`driver_vehicles.vehicle_class`) on the
driver's page in `/admin/drivers` ("Categoría del vehículo"). Bigger or more capable vehicles may
also take the jobs of the categories below them:

| Vehicle tagged | Receives jobs booked as |
| :--- | :--- |
| `economy` (economy sedan) | `economy` |
| `sedan` (sedans **and compact SUVs**) | `economy`, `sedan` |
| `suv` (minivan / MPV) | `economy`, `sedan`, `suv` |
| `4x4` (executive 4x4) | `economy`, `sedan`, `suv`, `4x4`, `sierpe_combo` |
| `van` | `economy`, `sedan`, `suv`, `van` — **not** `4x4` / `sierpe_combo` (those are about rough roads, not size) |
| `van_4x4` ("Van 4x4": a van that is also a 4x4; Jorge, 2026-11-11, migration 0039) | `economy`, `sedan`, `suv`, `van`, `4x4`, `sierpe_combo` — everything a van gets plus everything a 4x4 gets |

`van_4x4` is only a tag for driver vehicles; travellers cannot book it and it has no price.

- **Not tagged yet = not filtered by category**, exactly as before categories existed, so no
  driver was locked out when this shipped. The admin page shows "Sin categoría: recibe todos los
  trabajos" (still subject to the seat rule below).
- **Day tours are not filtered by category**: a tour booking has no vehicle class
  (`bookings.vehicle_class` is null). They do follow the seat rule.
- **Seat rule: jobs too big for the driver's vehicles are hidden (Jorge, 2026-11-11, migration
  0039).** A job is on a driver's board only if **one** of their approved vehicles has both the
  right category **and** at least as many passenger seats as travellers
  (`passenger_capacity >= passenger_count`). Both must be true on the same vehicle: a 4-seat 4x4
  plus an 8-seat van does not show a 6-traveller 4x4 job. A vehicle **without a seat number counts
  as 0 seats**, exactly as `offer_job()` has always treated it, so it shows no job that has
  travellers (the admin's driver page flags an approved vehicle without seats in red). A job
  without a traveller count is not filtered by seats. So the board never lists a job that
  `offer_job()` would refuse for seats or category with every one of the driver's vehicles.
- Where the rule is enforced: the job board (`driver_jobs()`), offers (`offer_job()` refuses a
  vehicle whose category can't serve the job or that has too few seats), and job alerts by push
  and email (`src/lib/jobAlerts.ts`, same category + seats rule, so nobody is alerted about a job
  they cannot see).
  **The team can still assign anyone**; the booking page shows a warning when the assigned
  vehicle's category doesn't cover the booked class, and on any offer in that situation.
- A driver sees their vehicle's category (read-only, with the list of jobs it receives) in the
  driver portal and the driver app, and can never change it (database trigger).
- The rule lives in one database function, `vehicle_can_serve(vehicle_class, job_class)`,
  mirrored by `src/lib/vehicleEligibility.ts` (website) and `apps/driver/src/vehicleCategory.ts`
  (driver app). `npm run test:eligibility` and `npm run test:db` check all three against the
  table above. A job class the rule doesn't know (one added later in /admin/pricing) is not
  restricted.

**Electric vehicles (Jorge, 2026-11-11, migration 0042).** Electric cars are **not** a vehicle
class and cost the **same price**: there are too few for a category, an electric car can be a
sedan, a minivan or a van, and long routes may need a charging stop. Instead:

- **A mark on the vehicle**, `driver_vehicles.is_electric` (default false), set by the team only on
  the driver's page in `/admin/drivers` (checkbox "Vehículo eléctrico", saved with the category).
  A driver's own attempt to set or clear it is ignored (database trigger `guard_vehicle_electric`,
  same idea as the category). The driver sees "Eléctrico" next to the category, read-only, in the
  driver portal and the driver app.
- **A free request at booking**: "Electric vehicle, if available" in the extras of the website
  ride builder and the app's "Your ride" step (`preferences.electric`, optional; older apps don't
  send it). It is a request, never a guarantee, and never changes the price, the category rule
  (`vehicle_can_serve`), the seats rule or the job board. When the traveller asked for one, offers made with an electric
  vehicle are listed first on the booking page (`offerRank`, Jorge 2026-11-11); the team can still assign anyone.
- **Team side**: the request appears with the other preferences on the booking; the driver and
  vehicle list marks electric vehicles ("⚡ eléctrico") and warns "no es eléctrico" when the
  traveller asked and the vehicle isn't; each offer shows the same. Information only.
- **Driver side**: the request appears in "Pidió" on the job board and the trip (portal and app).
- **Traveller side**: once a driver is confirmed, an "Electric vehicle" badge next to the car on
  the private trip page and in the app, when the assigned vehicle is marked electric.
- **Wording**: always "if available"; no environmental claims with numbers and no "zero
  emissions" promises. One FAQ entry (`src/lib/faq.ts`, `electric`).

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

### 5.5 Multi-day expeditions — retired 2026-11-11
Jorge (2026-11-11): "Get rid of the multi day tours, just keep it for transfers and single day
tours." The two packages (`md1` Corcovado 3D/2N, `md2` Classic Trifecta 7D/6N) and the three
lodging tiers are no longer sold. Migration 0043 sets every `expeditions` and `lodging_tiers` row
inactive and readable by admins only (nothing is deleted: earlier bookings and payments keep what
they point to). `/admin/pricing` shows them folded under "Retirado", read-only. Their names stay
in code only for earlier bookings (`RETIRED_EXPEDITIONS` in `src/lib/catalog.ts`).

---

## 6. Pricing logic

### 6.1 Fixed-price transfers (built 2026-11-09, `docs/PRICING.md` §4)
```
standard   = max(minimum fare, base + per km × road km + per hour × driving hours)
ride       = round_to_dollar(standard × vehicle factor × area factor)
             + vehicle extra fee
stop       = round_to_dollar(minutes at stop × wait rate/60 + detour km × per km + detour min × per hour/60)
             + tour price per person × travellers
night      = round_to_cent(round_to_dollar(standard × vehicle factor × area factor) × season multiplier × night %)
             only when the pickup time is in the night window (§6.6), else 0
transfer   = (ride + Σ selected stop prices) × season multiplier
             + night
             + ferries × (car-and-driver fare + passengers × passenger fare)
```
**Order of operations: base formula → vehicle factor (× area factor) → season → night premium →
pass-through costs.** The night premium is charged on the ride itself only (§6.6).
Area factor = the pickup town's, or an extra area's when the pickup OR drop-off is in it and
the route takes the ferry (Southern Nicoya), whichever is higher. Ferry fares (Gulf of Nicoya, per crossing on Google's
route) are added after the season multiplier and never season-adjusted.
Numbers (Jorge, 2026-11-09, on par with Daytrip's lowest prices): base $30, $0.90/km, $10/hour,
minimum $120; area factors Guanacaste (LIR, Tamarindo) 1.10, Osa (Sierpe, Drake Bay) 1.15,
Southern Nicoya 1.35, elsewhere 1.00; ferry ₡15,000 car + driver and ₡1,500 per passenger per
crossing, converted at `crc_per_usd` (₡452; checked weekly). All edited at `/admin/pricing`. Road km and drive times per town pair are in `src/lib/catalog.ts`
(`ROUTE_KM`, `ROUTE_MINUTES`); the Drake Bay boat (75 min) is excluded from driving hours.
`rideCents()` in `src/lib/pricing.ts` is the one implementation used by the ride builder,
route pages, the app's quotes and the server re-check.

### 6.2 Season multipliers
| Season | Multiplier |
| :--- | :--- |
| Green season | 1.00× |
| High season (Dec–Apr) | 1.15× |
| Peak holiday (Christmas / New Year / Easter weeks) | 1.25× |

Multipliers live in the database and are edited from the admin pricing manager.

### 6.3 Fixed prices for travellers; drivers' offers on the job board
> **Decided (Jorge, 2026-11-11): "Let's do fixed prices only for now."** Travellers always book
> at the fixed price (§6.1). The "Driver offers" / "name your price" mode (travellers could offer
> any amount from $50) was removed from the website and the customer app. The driver side is
> unchanged. A "request a custom quote" option for groups and charters stays deferred
> (`docs/PRICING.md` §6, step 7b).

1. The traveller chooses route, date, time, passengers and stops and books at the **fixed price**
   (§6.1, with the season and, at night, the night premium, §6.6). Every new booking is saved
   with `pricing_mode = 'fixed'` and status `pending_payment`.
2. The team confirms and posts the ride to the drivers' **job board** (`/driver/jobs`, the driver
   app's Offers screen). Drivers see only their payout, never the client's price.
3. Approved drivers send an **offer on their payout**: the suggested payout, or an amount from
   70% to 130% of it (`offer_job()`).
4. The team picks the driver on the booking page with the ranking (return trip / home base,
   rating, lower offer, electric when asked; `src/lib/matching.ts`) and accepts that offer; the
   others are declined automatically.
5. Costa Rica Private Transfers keeps its **platform commission** (§9 #2) from the fixed price.

**Older pages and app builds.** A ride sent as a traveller's offer (`pricing: "bid"` or an
`offerCents` field) is refused before anything is looked up, with "Please book at the fixed price
shown; offers are no longer available." / "Por favor, reserve al precio fijo indicado; las ofertas
ya no están disponibles." (`retiredItemError()` in `src/lib/tripRequest.ts`; the app endpoint
translates it). A ride saved as an offer in a browser's trip before the change comes back at the
fixed price ("prices have changed", new total shown). The app quote still returns `minOfferCents`
($50) only because app builds from before 2026-11-11 read it; nothing new uses it.
**Earlier bookings** made as a traveller's offer keep `pricing_mode = 'bid'` and their price; they
show as "client's offer" in admin and like any other booking on the trip page, in driver views
(payout only) and in emails.

### 6.4 Payments
Decided by Jorge 2026-11-08 (replaces the 100% / 20% deposit rule):
- `full_100` — **pay online in full.** Green Pay isn't live yet: the team confirms the trip,
  then sends a secure payment link.
- `cash_driver` — **pay the driver in cash + a cash booking fee** of 10% of the ride / day-tour
  price (after the season multiplier, rounded to the cent). Rides and 1-day tours.
  The fee is `pricing_settings.cash_fee_bps` (1000 = 10%, allowed 0–50%), edited at
  `/admin/pricing` → Payment; built-in fallback 10% (`CASH_FEE_BPS_DEFAULT`).
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
**Driver's arrival estimate (2026-11-10, migration 0035):** each ride stores the drive time it was
priced with (`bookings.drive_minutes`: Google's route for typed places, `ROUTE_MINUTES` between two of
our towns). `my_trips()` returns `arrive_at` = pickup (or the actual pickup once the trip started) +
drive time + each stop's time there and its detour (`sightseeing_stops.duration_min + detour_min`).
The driver app shows it on the drop-off ("Llegada aprox. 3:45 p. m." / "Arrives approx. 3:45 PM"),
the driver portal as "Llegada aprox.". No drive time → nothing shown, never a straight-line guess.

### 6.6 Pickups at any hour, with a night premium (Jorge, 2026-11-11, migration 0041)
Jorge: "24/7 arrivals. Trips that start from 10pm/4am should charge a 20% premium."
- **Pickups at any hour.** The website offers every quarter hour of the day and the app every
  half hour (it was 04:00–22:00). The time is Costa Rica time and belongs to the day the traveller
  picked: a 01:00 pickup on the 15th is stored as the 15th at 01:00 UTC−6.
- **Night window:** a ride whose pickup time is **from 22:00 up to, but not including, 04:00**
  (22:00, 23:30 and 03:45 are night; 04:00 and 21:45 are not) costs **20% more**.
- **The three numbers live in the database**, next to the other pricing settings, and are edited
  at `/admin/pricing` → "Recogidas nocturnas": `pricing_settings.night_premium_bps` (2000 = 20%,
  0–100%; 0 = off), `night_start_hour` (22) and `night_end_hour` (4; the window ends just before
  it and may cross midnight; the same hour in both = off). Loaded by `getCatalog()` as
  `catalog.nightPremium`; the rule is `src/lib/nightPremium.ts`. The values in the code are only
  the built-in fallback for when the database isn't connected, like the other settings.
- **What is marked up:** the ride itself (the formula × vehicle × area), after the season.
  **Not marked up:** sightseeing stops (the driver's waiting time and the guided visit /
  entrance part), ferry fares, the Drake Bay river boat fee (the vehicle's extra fee), the cash
  booking fee's rate (it stays a % of the final price) and day tours.
- **One place computes it:** `quoteTransfer()` in `src/lib/pricing.ts` (`nightCents`), used by the
  website's ride builder, the app's quote API (`POST /api/v1/client/quote` now takes `time`), the
  server re-check when a request is sent (`priceItem()`) and the saved booking
  (`bookings.total_price` includes it; `bookings.night_premium` keeps the amount). An app build
  from before this sends no time to the quote API and gets the daytime price, as before (it
  cannot choose a night hour).
- **Driver payout rises with it automatically:** the payout is the commission share of
  `total_price` after pass-throughs (§9 #2), so with today's 20% commission the driver gets 80%
  of the premium. Example (SJO → Manuel Antonio, Standard Sedan, green season): $202.00 by day,
  $242.40 at night; payout $161.60 → $193.92.
- **Drivers' offers:** the payout drivers' offers are measured against includes the premium.
  (Travellers' own offers, never marked up, were removed on 2026-11-11, §6.3.)
- **Shown before the traveller commits,** like the season: "Night pickup +20%" / "Recogida
  nocturna +20%" on the vehicle cards and as a line with the amount in the summary (website), a
  chip on the vehicle step and on "Your ride" (app), "+20%" beside each night hour in the time
  lists, and "Includes $X night pickup premium" on the trip page. The admin booking page shows
  "Recargo nocturno".
- **"From" prices** (popular routes, route pages, guides) stay daytime
  prices. The airport guides, the FAQ and `llms.txt` carry one sentence built from the database
  values (`nightSentence()`, token `{night}`): "Pickups are available at any hour. Rides that
  start between 10:00 PM and 4:00 AM cost 20% more."
- **Wording rule:** Jorge confirmed pickups at any hour only. Never write "24/7 support",
  "24/7 concierge" or that the team answers at all hours; say "pickups at any hour" /
  "recogidas a cualquier hora".
- **Checked for the old 04:00–22:00 assumption:** pickup-time validation (`isValidPickupTime`),
  shared ride links, the driver's steps ("on my way" from 6 h before, start from 3 h before),
  location sharing, the ETA and late alerts, the chat window and the review reminder all work
  from the stored timestamp, not from a time of day; the driver calendar's "unavailable that day"
  rule and the app's Today / Upcoming lists use the Costa Rica date of the pickup. Known edges,
  for Jorge to decide (§9 #17): a 23:30 ride ends on the next day, and a 01:00 pickup means the
  driver leaves home the evening before, while the calendar only looks at the pickup's own date;
  late-driver and no-location alerts for night pickups are emailed to the team at night.
- Tests: `npm run test:fixed` (fixed prices only: offers refused in EN/ES, fixed requests and old
  carts still work), `npm run test:night` (window, order of operations, pass-throughs, payout, old-style
  request) and `npm run test:db` (the same prices with the values read from the database).

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
`vehicle_class` (`economy` | `sedan` | `suv` | `4x4` | `van`, null = not tagged yet; set by the team only,
decides which jobs the driver receives, §5.3, migration 0038) ·
`is_electric` boolean, default false (set by the team only; a badge and a match for the free
"electric vehicle, if available" request, not a category and no price change, §5.3, migration 0042) ·
`ins_policy_number` · `ins_insurance_expiry` date · `dekra_inspection_expiry` date ·
`marchamo_year` int · `has_wifi` · `child_seats` · `stroller_space` · `pet_friendly` · `documents` jsonb (`insurance`, `dekra`, `marchamo`,
`vehicle_registration`) · `photos` jsonb array (at least 2, one showing the plate; at most 12) · `status` · `note` ·
`needs_review` · `reviewed_at` · `reviewed_by` · `created_at`

The criminal record certificate must be issued ≤ 30 days before first approval (checked by the
approve button). Expiry warnings cover the licence, insurance, Dekra and Marchamo.

### 7.3 `bookings`
`id` uuid PK · `booking_ref` text unique (e.g. `CRPT-10492`) · `client_id` → `profiles.id` ·
`service_type` (`transfer` | `day_tour` | `expedition`) · `catalog_item_id` (nullable; day tour, or a
retired multi-day trip on bookings made before 2026-11-11; `expedition` and `lodging_tier` are kept
only for those) · `origin` text (place name + address) · `origin_coords` jsonb (`lat`, `lng`,
`place_id`, `town`, and `route` = the Google road km / minutes the price was made from, null
between two of our towns) · `destination` text · `destination_coords` jsonb (same, without route) · `sightseeing_stops` jsonb (array of stop IDs + snapshot prices) · `vehicle_class` ·
`lodging_tier` · `scheduled_at` timestamptz · `passenger_count` int · `flight_or_hotel_notes` ·
`luggage_count` smallint (**large suitcases**, 0–20, null = not given; migration 0035) ·
`carry_on_count` smallint (carry-ons, 0–20, null = not given: older bookings and older app builds, which
send one number that is kept as the large suitcases; migration 0037; drivers get both through `my_trips()`
and see "4 + 4" / "4 grandes + 4 de mano") · `drive_minutes` smallint
(door-to-door drive time the ride was priced with: the Google route, or `ROUTE_MINUTES` between two
of our towns; null = unknown; 0035) ·
`sign_text` text (the traveller's own text for the driver's name sign, ≤ 40 characters, no contact
details; null = none) and `sign_hide_name` bool ("Don't show my name": the sign shows the brand
name; never together with a text); §4.6, migration 0040 ·
`pricing_mode` (`fixed` | `bid`; always `fixed` for new bookings since 2026-11-11, `bid` only on
earlier bookings made as a traveller's offer, §6.3) · `total_price` numeric · `night_premium` numeric(10,2) (the part
of `total_price` that is the night-pickup premium, 0 by day; §6.6, migration 0041) · `driver_payout` / `platform_fee` numeric
(migration 0017; null on retired multi-day bookings) · `company_costs` (entrances / lunch / activities the company pays, deducted before the driver's share; part of `platform_fee`; 0023) · `claimed_at` (set when the team accepted an offer from the job board) · `currency` (`USD` | `CRC`) ·
`amount_paid` numeric · `payment_mode` (`full_100` | `cash_driver`; `deposit_20` on old rows
only) · `cash_fee` numeric(10,2) (cash booking fee snapshot, 0 unless `cash_driver`) · `assigned_driver_id` →
`drivers.id` (nullable) · `status` (`pending_payment` | `pending_bids` | `confirmed` |
`in_progress` | `completed` | `cancelled`) · `created_at`

**`booking_events`** (change history, migration 0044): `id` · `booking_id` → `bookings.id` · `at` ·
`actor_id` → `profiles.id` (who did it; empty for the website's server and scheduled jobs) · `action`
(`status` | `assignment` | `amount_paid` | `price` | `payout` | `payment_mode` | `schedule` |
`settled` | `sign` | `notes` | `created_by_team` | `trip_link_emailed`) · `before` / `after` jsonb
(only the changed fields). Written by triggers on `bookings` and `booking_admin_notes` (so every path
is covered: admin pages, accepting an offer, the driver app, the traveller's sign) and by the server
for bookings entered by the team. Never card data, never chat messages.

### 7.4 `bids`
`id` uuid PK · `booking_id` → `bookings.id` · `driver_id` → `drivers.id` · `bid_amount` numeric ·
`vehicle_snapshot` jsonb · `status` (`submitted` | `accepted` | `declined` | `withdrawn`) ·
`created_at` · unique (`booking_id`, `driver_id`)

### 7.5 `trip_chats`
`id` uuid PK · `booking_id` → `bookings.id` · `sender_id` → `profiles.id` · `sender_role`
(`client` | `driver` | `admin`) · `message` text (contact details from travellers and drivers
already hidden) · `flagged` bool (something was hidden; migration 0034) · `sent_at`

**`contact_flags`** (migration 0034, admins only): `id` · `booking_id` · `chat_id` (null for
booking notes) · `source` (`chat` | `booking_notes`) · `field` (`client_notes` |
`flight_or_hotel_notes` | `driver_notes`) · `sender_role` · `sender_id` · `original` text · `shown`
text · `kinds` text[] (`phone`, `email`, `link`, `handle`) · `created_at` · `reviewed_at` ·
`reviewed_by`. `profiles.app_lang` (`es` | `en`, migration 0034): the language a driver last used,
for their pushes.

### 7.6 Catalog & pricing tables (new — needed for the admin pricing manager)
Implemented in `supabase/migrations/`. Catalog ids are short text slugs (`suv`, `tarcoles`)
matching `src/lib/catalog.ts`; seasons use `season_ranges` (start/end dates) plus a `priority`,
and `season_for_date(date)` returns the season for a travel date.
- `sightseeing_stops` — id, name, description, duration_min, detour_km, detour_min, tour_price_pp (migration 0021; `price` is retired, the stop price is computed from these), entrance (free | included | gate; replaces park_fee_included, which is kept in step), corridors, active
- `vehicle_classes` — id, name, example_models (shown as "… or similar", migration 0039), price_factor, extra_fee, allows_stops, spanish_speaking_driver,
  max_pax, luggage, badge, only_for_hubs, active (`base_rate` retired 2026-11-09, kept for old data)
- `day_tours` — id, region, name, description, duration_hours, price_pp_solo / price_pp_small / price_pp_group (per person by group size, migration 0022; `price` retired), cost_pp (company-paid costs per person, 0023), en_route_upgrade_price, active
- `expeditions` — id, name, days, nights, base_price, itinerary jsonb, active. **Retired
  2026-11-11** (migration 0043): all rows inactive, readable by admins only; kept for earlier bookings.
- `lodging_tiers` — id, expedition_id (nullable = applies to all), name, surcharge. Retired with
  the expeditions (same migration).
- `seasons` — id, name, multiplier, date ranges
- `pricing_settings` — a single row (`id` = true): `cash_fee_bps` int (default 1000 = 10%, 0–5000),
  ride formula `ride_base_fare`, `ride_per_km`, `ride_per_hour`, `ride_minimum_fare` (USD),
  ferry fares `ferry_vehicle_fare_crc`, `ferry_passenger_fare_crc` (colones per crossing) and
  `crc_per_usd` (migration 0015), `driver_commission_bps` (0017), `wait_per_hour` (USD/h at a stop, 0021), night pickups
  `night_premium_bps`, `night_start_hour`, `night_end_hour` (§6.6, migration 0041), `updated_at`. Public read, admin write. Loaded by `getCatalog()`
  as `cashFeeBps` / `rideFormula` / `ferryFares` / `crcPerUsd` / `nightPremium`.
- `driver_reviews` — id, booking_id (unique), driver_id, trip_id, stars 1–5, comment (no contact details),
  weight (generated: 2 with a comment, 1 without), created_at. Written by the server from the traveller's
  private trip page or the app once the booking is completed; driver reads own, admin all.
  **Stars are required, words are optional** (`parseRating()` in `src/lib/reviewReminder.ts`); the form says
  "Tap the stars to rate. That's all we need." and "Add a few words (optional)". The double weight of a written
  comment is internal and is never told to the traveller.
  **Asking for the rating (Jorge, 2026-11-11):**
  1. *As soon as the trip ends* (`src/lib/reviewRequest.ts`, `bookings.review_requested_at`): a push to the
     app and an email. In the app, the next time it is opened, comes back to the front or refreshes the trips,
     the rating panel opens by itself, **once per booking** (remembered on the phone; only over the home screen,
     My trips or a trip, never during a booking; only for trips of the last 7 days; at most one panel each time
     the app comes to the front; `apps/client/src/ratePrompt.tsx`). The "Rate your ride" button stays on the
     trip. On the private trip page the rating form of a completed, unrated trip is the first thing on the page.
  2. *One reminder 24 hours later* if there is still no rating (`bookings.review_reminded_at`): a push
     (tapping it opens the trip with the rating panel) **and** an email, exactly once, never a second one.
     **Quiet hours:** nothing is sent between 9 PM and 7 AM Costa Rica time; a reminder that comes due at night
     goes out with the first check after 7 AM. The job is `/api/cron/review-reminders` (protected by
     `CRON_SECRET`), called **about once an hour** by the GitHub Action `.github/workflows/eta-check.yml`
     (its `reviews` job, minute 7) and once a day by Vercel Cron as a backstop (`vercel.json`, 09:00 Costa Rica).
     So the reminder arrives 24–25 hours after the trip ended (GitHub's schedule can run some minutes late), or
     at about 7 AM when that falls at night. Each booking is marked before anything is sent and only the call
     that marked it sends, so calling the job more often can never send twice. Rules and their checks:
     `src/lib/reviewReminder.ts`, `npm run test:reviews`.
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
  vehicles always start `pending`; only admins change `status`, `note`, review fields and the
  category `vehicle_class` and the electric mark `is_electric` (a driver's own attempt is
  ignored, migrations 0038 and 0042); file
  links must be in the driver's own folder. Clients never see Cédula,
  license or insurance numbers.
- **bookings:** clients see their own; admins see all. **Drivers never read booking rows**
  (since migration 0017, restated in 0036): the row holds the client's price (`total_price`,
  `platform_fee`, `amount_paid`, `company_costs`) and, on rides booked as a traveller's offer
  before 2026-11-11, `client_notes` with the fixed price. Drivers read only through `driver_jobs()` (open jobs, town to town) and `my_trips()`
  (their own trips), which return their payout and never the client's price (`driver_jobs()` lists
  only rides one of the driver's approved vehicles can serve by category, §5.3); stop snapshots come
  without their price (`stops_for_driver()`, 0036); the name sign comes as one computed text
  (`pickup_sign()`, 0040), never the full name. The one exception is `my_trips().cash_to_collect`
  on cash trips. `npm run test:db` checks all of this. Traveller contact details and
  the private trip-page code live in **`trips`**, readable only by admins and the server.
  `trips.language` (`en` | `es`, default `en`) is the language the request was sent in; the
  traveller's emails, push notifications and trip page follow it.
- **trip_chats:** per booking; readable only by the booking's client, its currently assigned
  driver and admins. **Nobody writes directly** (travellers, drivers and admins alike, migration
  0034): the server posts every message through `post_chat_message()` after hiding contact details.
  **contact_flags:** admins read and mark reviewed; only the server writes. **Drivers never get the
  traveller's phone or email** (§4.5). `chat_reads`,
  `request_log` and the rate-limit functions are server-only. Approved drivers see **open** requests (`pending_bids`) only through the
  `open_trip_requests()` function: towns, date, vehicle, passengers and price, without the client's id,
  exact coordinates or flight/hotel notes, until a bid is accepted.
- **bids:** drivers create and manage their own; the amount can change only while the request is
  open and the driver is still approved (withdrawing is always allowed); the booking's client
  reads bids on their booking; admins see all.
- **catalog tables:** public read for active items; admin write. **pricing_settings** (cash fee, ride formula) and **hub_pricing** (area factors): public read, admin write.
- **payments:** written only by the server (service role); clients read their own; admins read all.
- **auth_code_requests** (sign-in code rate limits, migration 0050): RLS on with **no policies**;
  browsers and apps can't read or write it. Only the server (service role) uses it, through
  `allow_auth_code()` and `auth_email_status()`, which anon and signed-in users can't call.
  Public sign-ups are off in Supabase: only the server creates accounts (§3, "Sign-in codes").
- **booking_events:** admins read; nobody writes from a browser or app (no insert/update/delete
  policies) — only the triggers and the server (service role). Travellers, drivers and visitors read
  nothing. `npm run test:db` checks this.
- **Admin CSV export (privacy):** `/admin/bookings/export` is admins only and reads with the admin's
  own session (RLS applies). It holds travellers' names, emails and phones because it is the team's
  own working copy: keep downloaded files private, don't share them outside the team, and delete them
  when no longer needed. It never contains card data (bookings hold none) or chat messages.

---

## 8. Roadmap

**Scope change (Jorge, 2026-11-11):** the product is private transfers and 1-day tours only;
multi-day trips were retired (§1, §5.5) and are not on the roadmap.

| Phase | Scope | Status |
| :--- | :--- | :--- |
| **1. Prototype** | Static `index.html` design for storefront + admin tab | Done as a design mock, but the JS is truncated and non-functional |
| **2a. Next.js foundation** | Next.js + TS + Tailwind scaffold; rebuild storefront from the prototype design with catalog data from §5; working cart and WhatsApp buttons | **Done (PR #2)** |
| **2b. Supabase core** | Schema + RLS from §7, Auth with roles, catalog served from DB, `/admin` behind login, inventory & season pricing manager | **Live** (PRs #7–#9; Supabase connected). All migrations through 0016 applied; since 2026-11-09 new ones run automatically after a merge (`.github/workflows/db-migrations.yml`) |
| **2c. Driver KYC vault** | Driver sign-up, document upload, admin approval, 30-day expiry alerts | **Built (PRs #12–#14): `/driver` portal with several vehicles, `/admin/drivers` vault** |
| **2d. Checkout** | Part 1: trip requests saved online (server re-prices every item, guest name/email/WhatsApp, booking refs) + `/admin/bookings` dispatch (status, driver + vehicle, amount received, internal notes). Part 2: Green Pay (online in full; cash to the driver + 10% fee is built, 2026-11-08), webhooks, confirmation emails | **Part 1 built (PR #15)**; payment options built; Green Pay needs credentials |
| **3. Job board & GPS** | Driver job board with fixed payouts (replaces public bidding); driver on-duty GPS broadcast to admin Leaflet map | **Job board built 2026-11-09** (`/driver/jobs`, migration 0017): the team posts a booking as "Open for drivers", drivers send offers (suggested payout or 70–130% of it), the team accepts one on the booking page, where offers are ranked (same-day return trip first, then the driver's rating — travellers are emailed to rate 1–5 stars from their trip page when a trip is marked completed, a comment counts double, `driver_reviews` + `drivers.rating_avg/rating_count`, migration 0019 — then drivers based near the pickup — `drivers.home_hub`, migration 0018 — then price, then fewer trips; `src/lib/matching.ts`) and refresh live; drivers never see the client's price. Drivers see "Return trip" / "Starts in your area" badges on the job board. Rides sent in "Driver bids" mode with an offer of 70%+ of the fixed price go to the board automatically; approved drivers are emailed each new job (`src/lib/jobAlerts.ts`) and the traveller is emailed when an offer is accepted. Drivers mark their own trips **Start trip** / **Complete trip** on the trip page (`driver_set_trip_status()`, migration 0024; from 3 h before pickup), and completing one asks the traveller for a rating at once (`src/lib/reviewRequest.ts`). Settlements (migration 0025): `/admin/payouts` lists completed, unsettled trips per driver (online: pay the payout; cash: the driver collected price + fee and owes the difference) with "Mark settled" (`bookings.driver_settled_at`); drivers see `/driver/earnings` and, on cash trips, how much to collect (`my_trips().cash_to_collect`, the one case where a driver sees the client's price). Push notifications come with the driver app (Phase 5); email today. GPS planned |
| **4. Chat & CRM** | Tri-party trip chat (traveller via private trip link, assigned driver, team) with Resend email notifications; HubSpot sync; SMS / WhatsApp Business API | **Chat built (PR #17)**, polling every 8 s; **privacy round 2026-11-10** (§4.5): traveller ↔ driver with the team reading, contact details hidden and flagged, pushes, batched unread email, read-only 48 h after the trip; HubSpot and SMS planned |
| **5. Mobile apps** | Driver app (GPS, push notifications, camera) first, then Client app, for App Store / Google Play; plan in §11 | **Required before launch (Jorge, 2026-11-09).** Groundwork started: `device_tokens` + Expo push sender (migration 0026, `src/lib/push.ts`), pushes for new jobs and accepted offers. Driver flows already exist as database functions the app can call directly (`driver_jobs`, `my_trips`, `offer_job`, `driver_set_trip_status`, `register_device`). `/api/v1` (2026-11-09) covers what the server must do for the apps: driver offers, withdraw, trip start/complete and trip chat, each calling the same server action as the website; the apps send their Supabase session as a bearer token (`bearerToken()` in `src/lib/supabase/server.ts`). **Driver app first version built 2026-11-09 in `apps/driver/`** (Expo SDK 58, its own project, ignored by Vercel; see its README): email-code sign-in, jobs and offers, trips with start/complete, navigation and chat, earnings, profile, push. **Location sharing built 2026-11-09 (migration 0028):** with the driver's consent in the app (`drivers.location_consent_at`), the phone reports its position from 3 h before a pickup until the trip is completed, in the background too; `report_location()` refuses anything outside that window, only the latest position is kept (`driver_locations`), the team follows trips at `/admin/live`, and the travellers on that booking see it on their trip page and in their app (Jorge, 2026-11-09; the driver's consent text says so). **Driver steps and lateness (migration 0029):** "I'm on my way" (`bookings.en_route_at`, from 6 h before pickup; opens the tracking window and emails the traveller) → "Client picked up" → "Trip ended" (erases the position, closes the window). Before the pickup the app asks `/api/v1/driver/eta` every 5 minutes; the server estimates arrival from its stored position with Google live traffic (`src/lib/eta.ts`, every 5 min in the last hour, 10 before), shows it on `/admin/live`, and emails the team once if the driver would be more than 20 minutes late (`bookings.late_alert_at`). A GitHub Action (`eta-check.yml`, every 5 minutes, `CRON_SECRET`) runs the same check for every upcoming pickup via `/api/cron/eta`, so a driver who is parked, offline or never opened the app is still caught; with no position at all 60 minutes before pickup the team gets a "no driver location" alert. **Documents in the app (2026-11-09):** details, document photos by camera, vehicles, vehicle documents and photos, renewals (`apps/driver/src/screens/Documents.tsx`; routes `/api/v1/driver/details|profile|vehicles|vehicles/save|documents`). A new driver can do everything from the phone: the first sign-in creates the account, `/api/v1/driver/apply` starts the application, and documents can be photos or PDFs. **Calendar and help (migration 0032):** drivers block days in a calendar (`driver_unavailable`, `set_unavailable()`): no jobs shown, no offers, no job alerts that day, and the team sees "unavailable that day" when assigning; a Help screen has driver FAQs and support by WhatsApp and email (`/api/v1/support`). **Driver app layout (2026-11-10, Jorge approved the mockup):** the bottom tabs became a side menu (☰, `apps/driver/src/nav.tsx`, plain React Native Modal + Animated, no navigation library): profile card (name, "Independent driver" or the application status, ★ rating), Upcoming trips (the home screen), Offers (gold count of open jobs), Availability (the calendar), Earnings, Documents, My account, then Help, the language switch and Sign out. Trips are cards with a big date block, vehicle class, small icons (airport, stops, child seat; gold = needs attention: Drake Bay boat, Gulf of Nicoya ferry, cash to collect), the route, a countdown and the driver's payout; Upcoming / Today / Past views. The trip screen shows the route with each stop's time there, the travellers' requests, "You receive", Waze and a WhatsApp button to our team (never to the client), and the next step. First build installed on Jorge's Android phone 2026-11-09 (sign-in screen reached). During development the apps are private test builds under La Familia Mágica's store accounts; they are published publicly only under the new Costa Rica Private Transfers company. **Traveller app first version built 2026-11-09 in `apps/client/`** ("CR Transfers", `com.costaricaprivatetransfers.app`): no account needed (Jorge, 2026-11-09): the app opens on "Plan a trip" with prices for anyone; sending a request asks for name, WhatsApp and email and confirms the email with a 6-digit code (Supabase email OTP, which signs them in), and "Already booked?" in My trips / Account uses the same code to see trips on another phone; trips found by the booking email (`GET /api/v1/client/trips`, `src/lib/travellerTrips.ts`), driver and car, chat and rating with the trip's private code, "Plan a trip" opens the website, pushes for confirmed / on the way / rate (`sendPushToEmail`). Booking in the app (2026-11-09): rides (place search, vehicle, stops) and day tours priced by the server (`src/lib/appQuote.ts`, `/api/v1/client/quote|tours`), sent through `/api/v1/client/trip-request`; the app offers the same ride options as the website (fixed price only since 2026-11-11, driver's language, child seats, Wi-Fi, stroller, pet, message for the driver, "from $X per person", the ride promises, and the tours' region filter and Smart En-Route Transfer), with a **test checkout** (`/api/v1/client/pay-test`, `payments.provider = 'test'`, migration 0030) that switches itself off when the site is made indexable for launch. Travellers see the driver's position and arrival estimate for their own booking while the driver is sharing it (app and trip page). **Traveller app v2 (2026-11-10, Jorge approved an Airbnb-style look and a proper navigation rebuild):** React Navigation native stacks with bottom tabs Explore / My trips / Account (native slide transitions, iPhone swipe-back, slide-up panels for place search, pickup time, tour date, the email code and the rating); a new Explore home ("Where to?", popular rides with "from $X" priced by the same quote API and cached on the phone for 12 h, day tours, the four true promises, "Your next trip"); booking as five steps (Where → When & who → Your ride → Make it yours → Review & send) sharing one booking store so going back keeps every choice and the price is only re-asked when route, date, travellers or stops change; Plus Jakarta Sans throughout; the "CR route" logo and new app icons; an image system (`apps/client/src/images.ts`) with designed placeholders until our own photos are added. Same API calls and payloads as v1. **Rides rebuilt map-first (2026-11-11, Jorge approved the mockup):** the Explore tab has a "Rides \| Day tours" switch (the phone remembers the side); booking a ride is places → vehicle → "Your ride" (travellers and bags, flight number, stops, driver and extras, payment, contact details, "Request ride"), with the date, stops and extras as slide-up panels; a ride can't be sent until the traveller has opened the date panel once. Still book-ahead: our team confirms the driver. **No map while booking (Jorge, 2026-11-11: "it doesn't really provide value to the customer"):** Rides is a scrolling booking start (headline, the "From / To" card with a "Date" button, popular rides as picture cards with drive time and "from" price, the short "Every ride includes" list of the four promises, "Your next trip" when signed in); "Choose your vehicle" opens with a route summary card (pickup → drop-off, the drive time, date/time and travellers) instead of the map; the "Set on map" picker is gone (the place search covers it). The map appears only on the trip page: once a driver is assigned and the ride is close, the trip page leads with the map (driver's position, minutes to arrival, "Message driver", "Call our team"; the driver's phone is never shown), like Uber. One map component (`apps/client/src/MapView.tsx`, used only there): Apple Maps on iPhone, Google Maps on Android **only when the build has a key** (EAS variable `EXPO_PUBLIC_GOOGLE_MAPS_KEY`, read in `apps/client/app.config.ts`; Jorge still has to create it), otherwise the app's own drawn map. The line on the map is straight between the two ends (no directions API); no server, pricing or database change. Day tours screens unchanged. Not yet: real card payments, in-app account deletion. Store accounts (§11.6) are the long pole |

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
   custom quote" for groups, charters and unusual routes. **Decided (Jorge, 2026-11-09).**
   **Decided: fixed prices only for travellers (Jorge, 2026-11-11); drivers still offer on
   payouts.** The traveller "Driver offers" / "name your price" mode is removed from the website
   and the customer app (§6.3). Drivers' offers stay within 70%–130% of the suggested payout
   (`offer_job()`). "Request a custom quote" (`docs/PRICING.md` step 7b) stays deferred.
4. **Stop ↔ corridor mapping** (which stops are offered on which routes). Built 2026-11-08 as
   the "both ends" rule with reviewed lists (§5.2), **pending Jorge's confirmation**. If the
   detour cases in §5.2 matter, the next step is listing exact route pairs per stop. With exact
   routing (`docs/PRICING.md` §5) the detour decides it instead of a list.
5. **Lodging tier pricing**: **closed — not applicable: multi-day trips removed 2026-11-11.**
   Day tours: decided (Jorge, 2026-11-09): per person, see §5.4.
6. **Passenger-based pricing**: **day tours yes, per person with 1 / 2–3 / 4+ tiers (built,
   migration 0022)**. Expeditions: **closed — not applicable: multi-day trips removed 2026-11-11.**
7. **Cancellation & refund policy:** decided (Jorge, 2026-11-08), published at `/cancellation`.
   Rides (transfers) and 1-day tours: free cancellation up to 24 h before pickup, full refund;
   within 24 h or no-show, no refund. (The multi-day section was removed from `/cancellation`
   with the multi-day trips on 2026-11-11; no multi-day booking existed in the database.)
   Date/time changes free if asked 24 h+ ahead, subject to
   availability. If we or the driver cancel: full refund. Weather / road / park closures: rebook
   or refund of the affected service. The cash-booking fee is non-refundable within 24 h.
8. **Custom domain:** done. `www.costaricaprivatetransfers.com` is connected (2026-11-09) and the
   apps and defaults use it since 2026-11-11; still hidden from search engines until launch.
9. **Driver edits after approval: decided (Jorge, 2026-11-09), built in migration 0031.**
   Replacing a licence, ID, criminal-record or vehicle document, or changing their dates or a
   plate, pauses NEW jobs for that driver / vehicle (`review_hold`) until the team checks it;
   trips already assigned are unaffected; small edits only raise the flag. Original note:
   **Driver edits after approval.** (Expired licence / insurance / Dekra / Marchamo already block trips
   automatically, see §7.7; this is about other edits.) Built as: the driver stays approved and the record is flagged
   "changed since last review" for the admin. Stricter alternative: any change sends them back to
   *pending* (off the job board) until re-approved. Decide before drivers can receive trips (Phase 3).
10. **Ride extras pricing.** Travellers can ask for an English-speaking driver (vs Spanish / basic
    English), Wi-Fi, stroller, child seats, booster seats, pets and (2026-11-11) an electric vehicle
    "if available" (§5.3). Built as **free requests matched by the
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
13. **One app or two:** decided (Jorge, 2026-10-14): **two store listings**, "Costa Rica Private Transfers" for
    travellers and "Costa Rica Private Transfers Partner" for drivers, built from one codebase (§11.1).
14. **Store publisher:** plan (Jorge, 2026-10-14): a **new Costa Rican S.A.** for Costa Rica Private Transfers
    (legal name to confirm, ideally "Costa Rica Private Transfers S.A."). The same company should hold the D-U-N-S
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
16. **Airport meeting points and guide facts (partly open, from the guides of 2026-11-11).**
    **Decided (Jorge, 2026-11-11): drivers meet travellers at arrivals holding a sign (a
    whiteboard) with the traveller's name, and the traveller may choose what it says; with "no
    name" it shows the brand name. Built, §4.6.** **Decided (Jorge, 2026-11-11): pickups at any hour, and rides that start between 10 PM
    and 4 AM cost 20% more. Built, §6.6.** Still to confirm with Jorge: the exact meeting
    spot at SJO and at LIR (which exit, inside or outside). Also to confirm from his own experience:
    the Sierpe boat times, the three Drake Bay / Sierpe stay areas, and each "where to stay"
    description. Until then the guides stay general on those points.

17. **Night pickups: operations (open, from §6.6 of 2026-11-11).** (a) The driver calendar's
    "unavailable that day" looks only at the pickup's own date: should a blocked day also hide a
    ride that starts at 23:30 the evening before and ends on it, or a 01:00 pickup the driver
    must leave home for the evening before? (b) Who watches the late-driver and "no driver
    location" alerts for night pickups? They are emailed to the team at any hour, and the site
    makes no promise about support hours. (c) The premium is on the ride only, not on stops:
    confirm. (d) Should the Drake Bay boat be offered at night at all (the river-mouth crossing
    is done in daylight only)? Today the builder does not block it.

18. **Electric vehicles: follow-ups (from §5.3 of 2026-11-11).** (a) Decided: not a
    category, same price, a free "if available" request. **All decided (Jorge, 2026-11-11):** (b) no alert for
    long routes; the warning on the booking is enough. (c) Yes: offers made with an electric vehicle
    rank first when the traveller asked for one (built). (d) No message when the request could
    not be met: the option says "if available", so the traveller only sees the badge when the
    assigned vehicle is electric.
19. **Measurement and cookies: follow-ups (open, from the build of 2026-11-11, `docs/SEO.md`
    §7).** (a) The cookie paragraphs of the Privacy Policy (English and Spanish) and the banner
    wording need the same lawyer review as the rest of the legal pages. (b) Three privacy
    settings live in Google Analytics' own screens and cannot be forced from the code (no
    automatic page views on address changes, no outbound-click tracking, query redaction): Jorge
    sets them when he creates the property (SEO.md §7.2). (c) Microsoft Clarity and the Meta
    pixel read the full page address, which holds the name of a typed hotel while a ride is
    being built; decide before switching either on whether typed place names should leave the
    address (shared ride links would then carry only the place id). (d) `purchase` is not sent
    until real payments exist; decide then whether the paid amount or the lead is the main
    conversion for ads. (e) **Decided (Jorge, 2026-11-11):** the banner is shown only in the
    EEA, the UK and Switzerland; elsewhere analytics is on by default with an opt-out in the
    footer. For the lawyer: whether this is enough under Costa Rica's Ley 8968 (it asks for
    informed consent) and other non-European laws, and the "legitimate interest" basis now
    stated for visitors outside Europe in the Privacy Policy's section 4.

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
- **Brand separation (decided 2026-10-14):** Costa Rica Private Transfers is a separate public brand. Nothing a
  customer or driver can see (UI copy, page metadata, WhatsApp messages, emails, legal pages)
  may name the owner, Costa Rica Travel Planner, La Familia Mágica or Jorge's Daytrip profile.
  Use "Costa Rica Private Transfers" or "our team".
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

| | **Costa Rica Private Transfers Partner** (driver app) | **Costa Rica Private Transfers** (client app) |
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
- **EAS Update** ships small fixes to installed apps without waiting for store review. Set up 2026-11-11 in both apps (channel `main`, runtime version = the app's `version`; publish with `scripts/app-update.sh`). A native change needs a new build and a higher `version`.

Not chosen:
- **Capacitor wrapping the website.** The website is rendered on the server for each request,
  so a wrapper would just load the live site. Apple regularly rejects apps that are mostly a
  website (guideline 4.2), and background GPS is weaker. Kept as a fallback for the client
  app only.
- **Lovable or other no-code builders.** They produce web apps, not store apps, and they work
  outside the branch → PR → Gemini review → Jorge merges workflow (§10).

### 11.3 Code layout

**As built (2026-11-09):** `apps/driver/` is a standalone Expo project (own `package.json`, no
npm workspaces), so the website's install, build and Vercel deploy are untouched. It shares no
code with `src/` yet: it reads through database functions and acts through `/api/v1`, so prices
and rules stay on the server. The `packages/core/` move below is deferred until an app needs
to price something itself.

Original plan: this repo becomes a small monorepo (npm workspaces):
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
8. Store names, icons and screenshots say **Costa Rica Private Transfers** only (brand separation, §10).

### 11.7 Order of work

1. This plan (docs only).
2. Jorge: decide §9 #14–#15 and start the accounts in §11.6.
3. PR: move shared logic to `packages/core/` (no behaviour change).
4. PR: `/api/v1` routes (including chat), `device_tokens` table + push sender.
5. PR: driver app MVP → TestFlight and Google Play internal testing with Jorge and 1–2 partner
   drivers.
6. Phase 3 (live bidding, GPS fleet map) ships through the driver app.
7. Client app, then store submission of both.
