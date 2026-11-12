# Website and organic traffic plan

> Jorge, 2026-11-09: build out the public website (social media, blog, contact, etc.) to win
> organic traffic for the site and the apps, benchmarked against the competition. Research done
> 2026-11-09 (web search + Ubersuggest free tier; Ahrefs/Semrush unavailable on our plans).
> Re-check volumes and rankings before big content decisions. Brand rules in PROJECT.md §10 apply
> to everything public: never name the owner, Costa Rica Travel Planner or La Familia Mágica.

## 1. What the competition does

| Site | Structure | What drives its traffic |
| :--- | :--- | :--- |
| **Daytrip** (daytrip.com) | Costa Rica hub with ~101 route links, 8 pickup cities, FAQ, app promo. Route pages: breadcrumbs, H1 "Private car transfer from X to Y", km + time + "from $X per person", included, stops, "Good to know", review badges + per-route reviews, ~50 related routes. `/landing/` pages add a 6-question Q&A ("How do I get from San José to Monteverde?", "How much is the bus?"…). Old blog "How to get from X to Y" posts. Footer: About, Blog, Press, Careers, Sitemap, support, socials, app badges, safety pages | Programmatic route pages × ~8 languages, review volume |
| **GetTransfer** | Header: Support, Destinations, For drivers, For business, For agents, Blog, FAQ | Destination directory, partner sign-up pages; thin on Costa Rica |
| **Welcome Pickups** | Thin San José city page, taxi-style airport pickups | Not a real organic competitor for intercity Costa Rica |
| **Interbus** | Home, Services, FAQs, Blog, Contact; footer with policies, "Trabaje con nosotros", socials, WhatsApp | Brand authority (30 years, 180+ routes), cited by every blog |
| **Costa Rica Shuttle** | Rates, Reserve, Fleet, Contact; destination pages; EN/ES | Hundreds of Rezdy product pages in ~10 languages |
| **Two Weeks in Costa Rica** | Articles (itineraries, destinations, practical), things to do, services (shuttles, tours), reviews, about | Guides that sell its own private shuttles — the model closest to ours |

## 2. What wins on Google

- **"[route] + transfer / shuttle / private"** → booking pages (Daytrip, Rezdy operators, resellers).
- **"How to get from X to Y", "shuttle vs rental car", "how to get to Drake Bay"** → guides and
  blogs. No operator owns this space: **that's our gap.** Daytrip copies it with a Q&A block on
  its landing pages; we should do both.

US monthly searches (Ubersuggest, Nov 2026; difficulty out of 100 in brackets):

| Search | Volume | | Search | Volume |
| :--- | ---: | --- | :--- | ---: |
| san jose to la fortuna | 1,000 (22) | | costa rica airport transfer | 880 (25) |
| san jose to manuel antonio | 880 (19) | | costa rica private transfer | 720 (24) |
| san jose to santa teresa | 720 (15) | | costa rica shuttle from airport | 590 (22) |
| san jose to monteverde costa rica | 590 (23) | | costa rica shuttle | 390 (36) |
| shuttles from liberia airport to tamarindo | 390 (29) | | private driver costa rica | 260 (25) |
| liberia airport to tamarindo | 320 (23) | | how to get from san jose to la fortuna | 210 (25) |
| san jose to la fortuna drive | 320 (7) | | how far from san jose to manuel antonio | 210 (20) |
| shuttle san jose to la fortuna | 320 (19) | | bus from san jose to la fortuna | 170 (18) |

Difficulty is low (≈15–35): winnable for a new domain. Clicks cost $3–7 in ads, so the
searches are worth money.

## 3. Site map

**Top nav:** Transfers · Tours · Destinations · Travel guides · Help · WhatsApp ·
EN/ES (config in `src/lib/siteNav.ts`).

**Footer:** Company (About, How it works, Our drivers & safety, Reviews) · Partners (Drive with
us, Hotels & agents) · Popular routes · Destinations · Support (Help & FAQ, Contact,
Cancellation) · Legal · Social icons (shown once each account exists) · App badges (once the
apps are in the stores).

**Languages:** English at the root, Spanish under `/es` with hreflang (Jorge, 2026-11-09:
Spanish now). Since 2026-11-10 every public page has its Spanish version (storefront `/es`, route
pages `/es/traslados/<slug>` and their index `/es/traslados`, destination guides `/es/destinos/<slug>`, airport guides `/es/aeropuertos/<code>`, travel guides `/es/guias/<slug>` (since 2026-11-11), day tours `/es/tours` and `/es/tours/<slug>` (since 2026-11-12), info and legal pages); every new page must ship in both languages. More languages later (Daytrip and the Rezdy operators win partly through them).

## 4. Build order (one PR each)

1. **Site shell** — header, footer, social links, EN/ES switch, About, How it works, Our
   drivers, FAQ (help center), Contact (WhatsApp, hello@costaricaprivatetransfers.com, form),
   Organization + Breadcrumb + FAQ schema, AI crawlers allowed in robots, `llms.txt`.
2. **Destination and airport guides** (`/destinations/la-fortuna`, `/airports/sjo`…): how to
   get there from each airport, drive-time table, best time to go, tours, where to stay by area.
   **Built 2026-11-11:** six destinations (La Fortuna / Arenal, Manuel Antonio, Monteverde,
   Tamarindo / Guanacaste, Puerto Viejo, Drake Bay & Sierpe), two airports (SJO, LIR) and the
   index pages `/destinations` and `/airports`; Spanish at `/es/destinos/<slug>`,
   `/es/aeropuertos/<code>`, `/es/destinos`, `/es/aeropuertos` (same slugs as English, like the
   route pages). Content is data in `src/lib/guides/`: to add a destination, add one object to
   `destinations.ts` (English and Spanish side by side; drive times and prices are written as
   tokens such as `{time:SJO>Arenal}` and `{price:SJO>Arenal}` and filled from the catalog) and
   the page, index, footer, sitemap and `llms.txt` pick it up. Bus timetables, fares and flight
   routes are described in general on purpose; re-check each guide's facts and bump its
   `updated` date about twice a year.
3. **Blog / travel guides** with the first articles (§5), each linking to the route pages.
   **Built 2026-11-11:** `/guides` and `/guides/<slug>`, Spanish `/es/guias` and
   `/es/guias/<slug>` (same slugs, like the other page families; "guides" matches the menu label
   "Travel guides" and stays distinct from `/destinations`). First six articles, from §5 in order:
   #1 San José → La Fortuna (`san-jose-to-la-fortuna`), #2 San José → Manuel Antonio
   (`san-jose-to-manuel-antonio`), #4 San José → Monteverde (`san-jose-to-monteverde`), #5 Liberia
   airport → Tamarindo (`liberia-airport-to-tamarindo`), #6 SJO or LIR
   (`sjo-or-liberia-which-airport`) and #8 the drive-times table (`costa-rica-drive-times`).
   **#3 Santa Teresa was skipped for now:** Santa Teresa is not one of our towns in the catalog (it
   is priced by map search with the Paquera ferry), so there is no drive-time or price token for it,
   and the ferry timetable is exactly the kind of fact we don't print; it needs a Santa Teresa hub
   (or a token for typed places) first. Content is data in `src/lib/blog/` (see PROJECT.md §3);
   adding article 7 is one object. Each article: dated direct answer, comparison table,
   prices by vehicle class from the live catalog, 6–7 FAQs, links to route pages, destination and
   airport guides and day tours, and a booking button. Bus, shuttle, flight and park details stay
   general ("check current times"). Next in line: #9 Drake Bay (needs Jorge's boat facts), #10
   shared vs private (3+ people), #11 SJO arrivals, #12 La Fortuna → Monteverde, #13 tipping.
4. **Route pages, more and better**: from 9 to ~40 (both directions), plus "Other ways to get
   there" (bus, shared shuttle, private, flight, car), 5–8 FAQs, breadcrumbs, Product/Offer +
   FAQ schema, a dated direct answer in the first lines; Spanish versions; the booking
   storefront in Spanish.
   **Built 2026-11-11:** 40 route pages (20 pairs, both directions) at `/transfers/<slug>` and
   `/es/traslados/<slug>`, plus the index `/transfers` · `/es/traslados`. Chosen by demand:
   airport ↔ destination first (SJO ↔ Manuel Antonio, La Fortuna, Monteverde, Tamarindo, Puerto
   Viejo, Sierpe, Drake Bay; LIR ↔ Tamarindo, La Fortuna, Monteverde, Manuel Antonio), then the
   classic legs between destinations. Left out on purpose: SJO ↔ LIR, the 7-hour-plus rides
   (LIR or Guanacaste ↔ Osa / Caribbean, Puerto Viejo ↔ Monteverde / Manuel Antonio / Osa) and
   Sierpe ↔ Drake Bay (a boat, not a ride). Content is data in `src/lib/routes/`: to add a
   route, add one pair to `corridorsAirports.ts` or `corridorsTowns.ts` (English and Spanish side
   by side, numbers as tokens). Schema: a `Service` with an `AggregateOffer` (price range from
   the live catalog) instead of `Product`: a transfer is a service, and without real reviews a
   Product block earns nothing and risks looking like a fake listing. Bus, shuttle and flight
   notes are general on purpose (no timetables, fares, terminals or boat times); re-check them
   and bump `ROUTES_UPDATED` in `src/lib/routes/make.ts` about twice a year.
5. **Day tour pages** (TouristTrip schema, permits where they apply: Poás timed entry).
   **Built 2026-11-12:** `/tours` (index by region) and `/tours/<slug>` for the four catalog tours
   (`arenal-volcano-waterfall-hot-springs`, `manuel-antonio-park-catamaran`,
   `sierpe-mangroves-cano-island`, `monteverde-hanging-bridges-zipline-night-walk`); Spanish
   `/es/tours` and `/es/tours/<slug>` (same slugs; Spanish keeps the word "tours", as the site's
   "Tours de un día" does). Text is data in `src/lib/tours/`: **to add a page for a new tour, give
   its catalog id a slug in `slugs.ts` and add one object to `content.ts`**; the page, index,
   sitemap, `llms.txt` and links follow. Name, region, length, highlights and every price come from
   the catalog (tokens `{pp1}`, `{pp2}`, `{pp4}`, `{hours}`, `{enRoute}`, `{asof}` plus the guide
   tokens). Included items are only what the site already states (private vehicle, local naturalist
   guide, entrances, lunch); no clock times (the build rejects them); park rules are the
   destination guides' own lines (`guideNote()`). No tour touches Poás today, so no Poás text.
   Schema: WebPage + TouristTrip (AggregateOffer of the per-person green-season prices, USD; no
   ratings, reviews or availability), FAQPage, BreadcrumbList; the index carries an ItemList. The
   top menu's "Day tours" still opens the booking app's tab (like "Transfers": on wide screens these
   two entries are the builder's tab switch); `/tours` is in the footer and linked from the pages.
   A tour switched off in /admin/pricing loses its page (404) and leaves the sitemap and `llms.txt`.
   Multi-day trips were retired on 2026-11-11: no multi-day pages, schema or links; the old
   `/?tab=multiday` address redirects (308) to `/?tab=tours`. Corcovado is mentioned only as
   travel advice (SINAC permit and guide booked separately), never as something we sell.
6. **Partners and app**: Hotels & agents (referral), app download page with QR and store badges.

## 5. First guide articles (by opportunity)

1. How to get from San José to La Fortuna/Arenal: bus vs shuttle vs private vs driving
2. San José to Manuel Antonio: every option, drive time and cost
3. San José to Santa Teresa: ferry vs road, schedules, private transfer
4. San José to Monteverde: the road, drive time, bus and shuttle
5. Liberia Airport to Tamarindo: taxi, shuttle, private and bus compared
6. SJO or LIR: which Costa Rica airport to fly into
7. Shuttle vs rental car in Costa Rica: real costs including mandatory insurance
8. Costa Rica drive-times table between all main destinations
9. How to get to Drake Bay: Sierpe boat, flights, driving
10. Shared shuttle vs private transfer: when private is cheaper (3+ people)
11. San José Airport arrivals guide: taxis, Uber and pre-booked drivers
12. La Fortuna to Monteverde: the drive and the jeep-boat-jeep
13. Tipping drivers and guides in Costa Rica
14. How to get to Puerto Viejo and Cahuita (and on to Bocas del Toro)
15. Hiring a private driver for a Costa Rica road trip: how it works and a 7-day itinerary

## 6. Rules for AI answer engines (ChatGPT, Gemini, Perplexity)

- A direct, dated answer in the first ~50 words ("A private transfer from SJO to La Fortuna
  takes about 2.5–3 hours and costs from $X per vehicle for up to 3 people").
- Real HTML tables for drive times, prices by group size, ferry and boat schedules, each with a
  "last updated" date.
- FAQ blocks with schema; `llms.txt`; AI crawlers allowed once the site is indexable.
- Same name, email and description everywhere: Google Business Profile, Tripadvisor, social
  profiles, directories.
- Get mentioned where AI answers already look: Costa Rica travel blogs and r/CostaRica.

## 7. Off-site, for Jorge

- Claim the social handles (@costaricaprivatetransfers or @crprivatetransfers) on Facebook,
  Instagram, TikTok; YouTube and X later. Put each URL in Vercel (`NEXT_PUBLIC_SOCIAL_*`).
- Google Business Profile and Tripadvisor listing at launch; ask happy travellers for reviews
  (the app already asks for a rating after each trip).
- At launch: follow the checklist in §7.3 below (ids → Search Console → sitemap → Bing → make
  the site visible to Google).

### 7.1 Measuring visits: what is built (2026-11-11)

Two layers, on purpose:

- **Vercel Web Analytics** (already on): counts page views without cookies. Always on, needs no
  banner. Unchanged.
- **Google Analytics 4**, with a **cookie banner only where the law asks for it**. Optional
  extras, each off until its id is set: Microsoft Clarity (recordings and heatmaps), Google Ads
  and the Meta pixel (for later ads).

**Who sees the banner (Jorge, 2026-11-11: "I want real analytics data").** Only visitors in
the European Economic Area (the 27 EU countries plus Iceland, Liechtenstein and Norway), the
United Kingdom and Switzerland, where a yes is legally required before analytics cookies.
Everyone else gets no banner: Google Analytics (and Clarity / the ads tools, when their ids are
set) is on from the first page, and "Cookie settings" in the footer lets them switch it off.

- **How we know the region, without making pages slower.** The pages stay prerendered
  (static). `src/proxy.ts` (Next's middleware) reads Vercel's `x-vercel-ip-country` header on
  each page request and stores the answer in a small first-party cookie, **`crpt-region`**:
  `consent` (ask first) or `open` (on by default). 30 days, `SameSite=Lax`, `Secure` on
  Vercel, path `/`, readable by the page (it holds only that word); it is only written when
  missing or different, and only when at least one measurement tool is switched on. The
  banner reads it in the browser.
- **Country list** (one place: `src/lib/consentRegion.ts`, tested by
  `npm run test:consent-region`): EU-27 + IS, LI, NO + GB + CH, plus, on the safe side, EU
  areas with their own country code (French overseas regions, Åland) and Gibraltar, Jersey,
  Guernsey and the Isle of Man.
- **Unknown country** (header missing, local runs, placeholder codes such as `XX`): treated as
  `consent`, so the banner shows. Cookies blocked in the browser: same.
- **A choice the visitor made always wins, in every region**: a stored Reject means nothing
  loads, even outside Europe. Outside Europe that choice never expires (an opt-out stays an
  opt-out); in Europe it is asked again after six months, as before.
- The privacy text (`src/components/legal/MeasurementText.tsx`, English and Spanish) says this
  in plain words; it still needs the lawyer's review (PROJECT.md §9 item 19).

How the banner behaves where it is shown (the code is `src/components/site/ConsentManager.tsx`
and `src/lib/analytics.ts`):

- **In Europe, nothing loads before the visitor says yes.** Google's script is not on the page
  at all until then. This is Google's "Consent Mode v2" in its simplest form (the tag starts with
  everything refused, then gets the visitor's answer); we chose it over the "advanced" form,
  where Google's script loads for everyone and sends cookieless pings, because "nothing runs
  until you accept" is the only version the Privacy Policy can state in one true sentence.
  Cost: European visitors who refuse or ignore the banner are not counted in Google Analytics
  (they still are in Vercel Web Analytics, so the two totals will differ). Outside Europe the
  tag starts the same way and is switched to "granted" straight away, before anything is sent.
- "Accept" and "Reject" look the same; "Choose" opens Analytics and Advertising as separate
  boxes, both unticked (the Advertising box only exists when an ads id is set). No wall: the
  site works the same whatever the answer, and the banner sits above the "Add to trip" bar on
  phones.
- The answer is kept on the visitor's device for **six months**, then asked again (in Europe).
  "Cookie settings" at the bottom of every page reopens it, for every visitor in every region
  (outside Europe it opens as "Cookie settings" with Analytics ticked); switching off stops
  the tools at once and deletes their cookies for our site.
- **Never on private pages**: `/admin`, `/driver`, `/trip/<secret link>`, `/login`. No banner
  and no script there, and a trip link is never sent to Google, not even as "the page you came
  from".
- **No personal data in events.** Towns go as their codes (`SJO`, `ManuelAntonio`), a typed
  hotel or address only as `custom`. Never names, emails, phones, notes, sign text, typed
  places, booking references or trip links. Page addresses are sent without their `?…` part
  (the ride builder keeps the ride there, including a typed hotel's name); only campaign tags
  (`utm_…`, `gclid`…) are kept.

What is recorded in Google Analytics (GA4's standard names, so its built-in reports work):

| Event | When | What it carries |
| :--- | :--- | :--- |
| `page_view` | each public page | cleaned address, page title |
| `view_item` | the ride builder shows prices for a route (once per route) | route as town codes, number of vehicle classes offered, "from" price, USD |
| `select_item` | a vehicle class is tapped | route, vehicle class, its price |
| `add_to_cart` | a ride or day tour is added to "Your trip" | item code, price (the `pricing` fixed / bid parameter was dropped on 2026-11-11: fixed prices only) |
| `begin_checkout` | the trip is opened to review (phones) or the details form is first touched (desktop), once per trip | total, payment choice, number of items |
| `generate_lead` | "Send trip request" succeeded | total in USD, payment choice (`full_100` online or `cash_driver`), items |
| `click` | a WhatsApp button, an app store link (none on the site yet) or the language switch | only the kind of link (`whatsapp`, `app_store`, `language`) |

`purchase` is **not sent at all** for now: the website takes no payment (the team sends a
payment link later), and the test checkout only exists inside the traveller app, on the
server. Sending test payments as purchases would put fake revenue in the reports. Add it with
the real Green Pay payment page, when a payment really succeeds in the browser. Until then
`generate_lead` is the number to watch; mark it as a "key event" in Google Analytics.

### 7.2 The ids: what to create and where to paste them

All of them go in **Vercel → the project → Settings → Environment Variables**, with only
**Production** ticked (not Preview, not Development: test sites must not send data), then
**redeploy** (Deployments → the latest one → ⋯ → Redeploy), because these values are read when
the site is built. A value in the wrong format is ignored, so a typo switches the tool off
rather than breaking the page. None of these is a password: they are visible in the page of any
site that uses them.

| Variable | What to paste | Where to get it | What it switches on |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_GA_ID` | `G-` + 10 letters/digits | analytics.google.com → Admin → Create property "Costa Rica Private Transfers" → Web data stream for the site → "Measurement ID" | Google Analytics (outside Europe at once; in Europe after a yes in the cookie banner), the `crpt-region` cookie, the "Cookie settings" footer link and the Google Analytics paragraphs of the Privacy Policy |
| `NEXT_PUBLIC_GSC_VERIFICATION` | the long code inside `content="…"` | Search Console → add property → "HTML tag" method. **Only needed if DNS verification (preferred, §7.3) is not used** | a hidden ownership tag on every page |
| `NEXT_PUBLIC_BING_VERIFICATION` | 32 letters/digits inside `content="…"` | Bing Webmaster Tools → add site → "HTML meta tag". Not needed when Bing imports the site from Search Console | a hidden ownership tag on every page |
| `NEXT_PUBLIC_CLARITY_ID` (optional) | about 10 lowercase letters/digits | clarity.microsoft.com → new project → Settings → Setup → "Project ID" | Microsoft Clarity, following the Analytics rule (on outside Europe, after a yes in Europe); adds it to the banner and the Privacy Policy |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` (later) | `AW-` + digits | Google Ads → Tools → Google tag | the "Advertising" box in the banner; the Google Ads tag (page visit only, no conversions yet), on outside Europe and after a yes in Europe |
| `NEXT_PUBLIC_META_PIXEL_ID` (later) | 15–16 digits | Meta Events Manager → Data sources → the pixel's ID | same box; the Meta pixel (page view only), on outside Europe and after a yes in Europe |

Use accounts that belong to Costa Rica Private Transfers (its own Google account), not to
another brand: property and account names can show up in shared reports (PROJECT.md §10).

**Settings to change inside Google Analytics right after creating the property** (Admin → Data
streams → the web stream). They matter for privacy, because the site already sends cleaned page
views itself:

1. **Enhanced measurement** → gear icon → Page views → "Show advanced settings" → **untick
   "Page changes based on browser history events"**. Otherwise Google also records its own page
   views with the full address, including the ride details after the `?`, and counts pages twice.
2. Same panel: switch **off "Outbound clicks"** and **"Form interactions"** (the site reports
   WhatsApp clicks itself, without the message text).
3. **Redact data** → switch on "Email" and "URL query parameters", and add these keys:
   `from, to, fromName, toName, fromAt, toAt` (a second lock on the same door).
4. Admin → Data collection and modification → **Data retention**: leave it at **2 months**
   (the default). The Privacy Policy says 2 months; if this is changed to 14, the text in
   `src/components/legal/MeasurementText.tsx` must change too.
5. Leave **Google signals** off unless ads start (it is what the Advertising box would cover).
6. Admin → Events → mark `generate_lead` as a **key event**.

If Clarity is switched on: Clarity → Settings → Masking → **Strict** (the site already asks it
to hide all page text; this makes sure typed fields are hidden too).

Before switching on Clarity or either ads tool, read "Known limits" below.

**Known limits (2026-11-11)**

- The steps 1–3 above are settings in Google's screens; the code cannot enforce them. Until
  step 1 is done, Google Analytics may record the full page address of visitors it runs for.
- Clarity and the Meta pixel read the page address themselves, including the ride details after
  the `?` (a typed hotel's name). If that matters, the ride builder should stop putting typed
  place names in the address before these two are switched on (a small change).
- The cookie texts are part of the legal pages, still a draft pending a lawyer's review.
- Not measured: the mobile apps (they have no analytics), and payments.

### 7.3 Launch checklist, in this order

1. **Create the Google Analytics property** and paste `NEXT_PUBLIC_GA_ID` in Vercel (Production
   only); do the six settings above; redeploy. Open the site in a private window: from Costa
   Rica (or anywhere outside Europe) there is no banner and Google Analytics → Reports →
   Realtime shows the visit at once; with a VPN set to Germany or the UK the banner shows and
   the visit appears only after "Accept".
2. **Connect the domain** (costaricaprivatetransfers.com) in Vercel and set
   `NEXT_PUBLIC_SITE_URL` to it.
3. **Google Search Console** (search.google.com/search-console) → Add property → **Domain** →
   it shows a TXT record → add that record where the domain's DNS is managed → Verify. (DNS
   covers every version of the address. Fallback: the "URL prefix" method with the HTML tag →
   `NEXT_PUBLIC_GSC_VERIFICATION`.)
4. **Flip the switch**: `NEXT_PUBLIC_SITE_INDEXABLE=true` in Vercel, Production only, and
   redeploy. Until this is done the site tells Google to stay away, and Search Console will
   report the pages as blocked. Do it only when real payments are ready: the same switch turns
   off the test checkout (PROJECT.md §6.4).
5. **Submit the sitemap** in Search Console → Sitemaps → `sitemap.xml`.
6. **Bing Webmaster Tools** (bing.com/webmasters) → "Import from Google Search Console" (brings
   the site and the sitemap across in one step; no code needed).
7. In Google Analytics → Admin → Product links → link Search Console, so search terms show next
   to visits.
