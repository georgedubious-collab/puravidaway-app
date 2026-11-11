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

**Top nav:** Transfers · Tours · Multi-day · Destinations · Travel guides · Help · WhatsApp ·
EN/ES (config in `src/lib/siteNav.ts`).

**Footer:** Company (About, How it works, Our drivers & safety, Reviews) · Partners (Drive with
us, Hotels & agents) · Popular routes · Destinations · Support (Help & FAQ, Contact,
Cancellation) · Legal · Social icons (shown once each account exists) · App badges (once the
apps are in the stores).

**Languages:** English at the root, Spanish under `/es` with hreflang (Jorge, 2026-11-09:
Spanish now). Since 2026-11-10 every public page has its Spanish version (storefront `/es`, route
pages `/es/traslados/<slug>` and their index `/es/traslados`, destination guides `/es/destinos/<slug>`, airport guides `/es/aeropuertos/<code>`, info and legal pages); every new page must ship in both languages. More languages later (Daytrip and the Rezdy operators win partly through them).

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
5. **Tour and multi-day pages** (TouristTrip schema, permits where they apply: Poás timed entry,
   Corcovado SINAC).
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
- At launch: set `NEXT_PUBLIC_SITE_INDEXABLE=true`, connect the domain, submit the sitemap in
  Google Search Console and Bing Webmaster Tools.
