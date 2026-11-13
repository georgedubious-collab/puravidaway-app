# Ride pricing — analysis and recommendation

> Written 2026-11-08 for Jorge. Answers PROJECT.md §9 #1 (transfer pricing model) and the
> question "should we offer both bidding and flat rates?". Competitor numbers come from
> `docs/COMPETITORS.md` §2b–2d (checked 2026-10-14); re-check them before quoting publicly.
> Nothing here is built yet. Decisions for Jorge are in §8.

## 1. The problem today

Every ride costs the vehicle's flat rate (SUV $175, 4x4 $215, Van $245) plus stops, whatever the
distance. Compared with Daytrip's Sedan:

| Route | Daytrip Sedan | Our SUV today | Difference |
| :--- | ---: | ---: | :--- |
| LIR → Tamarindo (69 km, 1 h 30) | $136 | $175 | **$39 too expensive**, also above GetTransfer ($119) |
| SJO → La Fortuna (116 km, 2 h 30) | $161 | $175 | $14 too expensive |
| SJO → Tamarindo (273 km, 4 h 40) | $338 | $175 | **$163 too cheap**: the driver loses a whole day for less than a short ride pays |

Short rides lose customers, long rides lose money or drivers. The bid "reference price" was
built from the same number, so it was wrong too (traveller bids were removed on 2026-11-11, §6).

## 2. What travellers should experience

Like Daytrip and GetTransfer (COMPETITORS §2d):

1. **Type any place**: airport, town, hotel, Airbnb, restaurant, boat dock, tour operator or
   street address. Suggestions are limited to Costa Rica.
2. **See the route on a map** with the real drive time and distance.
3. **Get a price instantly** for each vehicle class, per car and "from $X per person".
4. Special places are recognised automatically:
   - **SJO / LIR terminals** ask for a flight number and offer the name sign and 60 min free waiting.
   - The **Sierpe dock** offers the boat-to-Drake combo.
   - **Drake Bay lodges** are boat drop-off only.
   - Places that **need a 4x4** (Monteverde back roads, rural Osa, some Nosara / Santa Teresa
     roads in rainy season) only show 4x4-capable vehicles.
   - **Nicoya Peninsula** routes (Montezuma, Santa Teresa) can include the Puntarenas–Paquera
     ferry, priced in.

## 3. How the automatic price works

Three building blocks, all **on the server** (the API keys and the formula never reach the browser):

| Step | What it does | Recommended service |
| :--- | :--- | :--- |
| Place search | Turns "Hotel Arenas del Mar" into a name, address, map pin and place ID | **Google Places Autocomplete**, restricted to Costa Rica. It has the best coverage of hotels, lodges and businesses in Costa Rica, and gives drivers Google Maps / Waze links |
| Route | Real road distance and drive time between the two pins | **Google Routes API** (same account). Mountain roads and ferries come out realistic, never straight-line |
| Price | Turns km + hours + vehicle + date into dollars | Our own formula (§4), with all numbers stored in the database and edited at `/admin/pricing` |

Cost: Google charges per search session and per route. At launch volumes this costs a few
dollars a month, and Google's free monthly allowance probably covers it at first. Check current
Google Maps Platform pricing before signing up. Searches are cached, so each new keystroke isn't
billed. Mapbox is cheaper, but its business listings in rural Costa Rica are weaker; it's the
fallback if Google gets expensive.

Every quote saved on a booking keeps a snapshot: both pins, km, drive time and the formula
version. A later price change never alters a booked trip, and the admin can see exactly how a
price was made.

### 3.1 How it's built (step 3) and the Google setup

- The pickup / drop-off boxes list our 10 towns at once (Puerto Jiménez added 2026-11-12); typing 3+ letters adds Google
  suggestions in Costa Rica. Our server calls Google (`/api/places/suggest`, `/lookup`, `/route`);
  the key never reaches the browser.
- A typed place is linked to its **nearest town** (straight line) for the area factor, stops and
  suggestions. Places within 15 km of Drake Bay count as Drake Bay: the car drives to the Sierpe
  dock and the boat time is added.
- Between two of our towns the price still comes from the built-in km / time tables (no Google
  cost, same prices as the route pages). As soon as one end is a typed place, the price uses
  Google's road km and driving time.
- When a trip is sent, the server looks each place up again by its Google id (never trusting
  coordinates from the browser), gets the route and re-prices. Place lookups and routes are
  cached for 30 days, so the re-check and repeat searches cost nothing.
- Each booking keeps the place name, address, map point and the route used for the price
  (`bookings.origin_coords.route`).
- Costs: only "Essentials" fields are requested; about 1.5 US cents per quote after Google's free
  monthly allowance (~5,000 quotes / month free, checked 2026-11-09).

Google Cloud setup (done by Jorge 2026-11-09, project "Costa Rica Private Transfers"): enable **Places API (New)**
and **Routes API**; one API key restricted to those two APIs (no application restriction, it is
only used by our server); daily quota caps (~2,000 Places, ~1,000 Routes requests); a $10/month
budget alert; the key in Vercel as `GOOGLE_MAPS_API_KEY` (Production + Preview) and in `.env.local`.

## 4. The price formula (recommended)

### 4.1 Base formula

```
ride price = max( minimum fare,  base + per-km × road km + per-hour × drive hours )
             × vehicle factor
             × area factor (where drivers are scarce)
             × season multiplier (already in the database)
             × night-pickup premium (only when the pickup is at night; built 2026-11-11,
               `docs/PROJECT.md` §6.6: +20% from 10 PM to 4 AM, values in the database)
             + stops (as extras, §5) + ferry / boat costs
```

Paying for **hours as well as km** matters in Costa Rica: 100 km of mountain road (Monteverde,
Route 32) costs the driver far more time than 100 km of highway. Daytrip and GetTransfer both
follow this. Their Monteverde and Osa prices are high for the distance.

### 4.2 Starting numbers, to tune in `/admin/pricing`

Standard class (Sedan / Comfort, 1–3 passengers): **base $35 + $0.70 per km + $12 per hour,
minimum $110.**

What that gives on real routes:

| Route | km / time | Daytrip Sedan | GetTransfer Comfort | **Costa Rica Private Transfers** | vs Daytrip | Driver keeps at 85% | Daytrip driver gets ~70% |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| LIR → Tamarindo | 69 km / 1 h 30 | $136 | $119 | **$110** | 81% | $94 | $95 |
| SJO → La Fortuna | 116 km / 2 h 30 | $161 | $106 | **$146** | 91% | $124 | $113 |
| SJO → Monteverde | 132 km / 2 h 30 | $182 | $115 | **$157** | 86% | $133 | $127 |
| SJO → Manuel Antonio | 159 km / 2 h 50 | $205 | $113 | **$180** | 88% | $153 | $144 |
| SJO → Puerto Viejo | 232 km / 4 h | $281 | $163 | **$245** | 87% | $208 | $197 |
| SJO → Tamarindo | 273 km / 4 h 40 | $338 | $187 | **$282** | 83% | $240 | $237 |
| La Fortuna → Monteverde | 111 km / 2 h 50 | $200 | — | **$147** | 74% | $125 | $140 |
| Monteverde → Manuel Antonio | 193 km / 3 h 40 | $251 | — | **$214** | 85% | $182 | $176 |
| La Fortuna → Manuel Antonio | 235 km / 4 h 50 | $322 | — | **$257** | 80% | $218 | $225 |

Result of the table above: **10–20% cheaper than Daytrip** and above GetTransfer's "from" price
(theirs is a floor, and drivers can still bid higher or cancel).

**Revised 2026-11-09 (Jorge):** Daytrip already charges some of the lowest fares in the market,
so undercutting them by 10–20% only cut what our drivers earn. The target is now **on par with,
or a few dollars under, Daytrip's lowest published price**: base **$30 + $0.90/km + $10/hour,
minimum $120** (migration 0016). SJO → La Fortuna $162 (Daytrip $161), Manuel Antonio $202
($205), Tamarindo $324 ($338), LIR → Tamarindo $132 ($136), SJO → Santa Teresa $346 with the
ferry for 2 ($356). Daytrip's seasonal swing (e.g. La Fortuna $161 → $185) is matched by our
season multipliers (high season +15%, peak +25%).

**Puerto Jiménez (added 2026-11-12, for Jorge to review):** same formula, no special case. SJO →
Puerto Jiménez 370 km / 6 h → Standard **$423** (Daytrip Sedan $530, Lite $518), back $486 with
the Osa area factor; Manuel Antonio → $269; Sierpe ↔ $197. That is about 20% under Daytrip,
because Daytrip adds a scarcity premium in Osa. **Jorge, 2026-11-12: "a little under Daytrip"**,
so SJO ↔ Puerto Jiménez now has a pinned price (§4.5, built): Standard **$499** both ways
(Economy $489, Minivan $549, 4x4 $585, Van $605), about 5% under Daytrip's matching class. The
other Puerto Jiménez pairs keep the formula. Every pair: `docs/PROJECT.md` §5.1.

### 4.3 Vehicle classes

Match Daytrip's names and capacities so travellers compare like with like (COMPETITORS §2b #3):

| Class | Seats / bags | Factor | Notes |
| :--- | :--- | ---: | :--- |
| **Economy** *(new, Jorge 2026-11-08)* | 1–3 / 3 | **0.90** | Spanish-speaking driver (basic English at most), direct ride. Like Daytrip's Sedan Lite. Says so clearly on the card |
| **Standard** (Sedan) | 1–3 / 3 | 1.00 | English-speaking driver requested and matched by the team |
| **Minivan (MPV)** *(id `suv`; was "Comfort SUV" until 2026-11-11)* | 1–4 / 4 | 1.20 | Like Daytrip's Compact MPV. Compact SUVs drive the sedan classes (PROJECT.md §5.3) |
| **4x4** (Prado / Fortuner) | 1–4 / 4 | 1.30 | Forced for 4x4-only destinations |
| **Van** (HiAce / Staria) | 5–10 / 10 | 1.35 | Same as Daytrip's van factor |
| **Sierpe combo** | 1–4 | 4x4 price + boat fare | Boat priced per person, set by the operator |

### 4.4 Area factor (driver scarcity)

Daytrip charges Manuel Antonio → Uvita (68 km) the same as SJO → Uvita (211 km). Most drivers
live in the Central Valley, so a driver has to come from far away. Rather than copy that, set
an **area factor per zone** (e.g. Southern Pacific / Osa 1.15, Liberia 1.10, Central Valley 1.00)
and lower it as local partner drivers join. It is one number per zone in the admin.

### 4.5 Pinned (fixed) price for a route — built 2026-11-12 (migration 0058)

For the 20 or so busiest pairs (SJO ↔ La Fortuna, Manuel Antonio, Monteverde, Tamarindo…), Jorge
can **pin a fixed price** that overrides the formula. Any point inside a zone gets the zone price,
and Arenas del Mar costs the same as Manuel Antonio town, exactly as Daytrip does. Points
outside the zones use the formula. This mixes the two models the spec mentioned (§9 #1): the
formula covers everything, and fixed prices exist where marketing needs a round number.

**How it works (first use: SJO ↔ Puerto Jiménez, where the formula was about 20% under Daytrip).**

- **What a pin is.** One price per town pair and vehicle class, in USD, at the green-season base,
  for the whole vehicle. By default it counts in both directions; untick "Mismo precio en los
  dos sentidos" to pin only one direction (the other can get its own price, or keep the formula).
- **What it replaces.** Only the formula's ride price for that pair and class, i.e. the amount
  after the vehicle factor and the area factor. So with a pin the area factor no longer makes
  "leaving" dearer than "arriving".
- **What still applies on top, unchanged:** the season multiplier from the database (Standard
  $499 → $573.85 in high season, $623.75 at peak), the night premium (+20% → $598.80), stops,
  ferries and the Drake Bay boat fee, the cash booking fee, promo codes (same 50/50 split and cap)
  and the driver's payout (80% of the shared part: $399.20 on $499).
- **Classes.** A class left empty on a pinned route keeps the formula. The "4x4 + Sierpe boat"
  class has no box of its own: it is always the 4x4's price + the boat fee, pinned or not.
- **Hotels and addresses.** A typed place inside the town's zone (12 km around the town's map
  point; 20 km around SJO airport, which takes in San José city; 15 km around Drake Bay) costs
  the pinned price. Outside the zone the formula prices it from Google's road km as before, but a
  ride at least as long as the town-to-town road never costs less than the pinned price, so a
  Corcovado lodge beyond Puerto Jiménez is never cheaper than the town itself. A place that is a
  shorter drive (Golfito, Cartago) keeps the plain formula.
- **Where Jorge edits it.** `/admin/pricing` → "Precios fijos por ruta": each pinned route shows
  a box per vehicle with the formula's price under it for comparison; "Quitar precio fijo" sends
  the route back to the formula; "Agregar una ruta con precio fijo" pins another pair. Changes
  show on the website and in the app at once. Bookings already made keep their price.
- **Where it shows.** Everywhere a ride is priced, because they all share one function: the
  website's ride builder, the route pages and "Popular routes" ("from $489"), the guides, the
  customer app, the team's manual booking and the "change pickup / drop-off" price check.
- **Keeping it honest.** A pinned route does not move when the formula or an area factor is
  changed, and Daytrip's prices move too. Check pinned routes whenever the formula is retuned.

**Seeded prices, SJO ↔ Puerto Jiménez (both directions the same):**

| Our class | Daytrip (2026-10-14) | **Pinned** | Formula before (to PJ / from PJ) |
| :--- | ---: | ---: | ---: |
| Economy | Sedan Lite $518 | **$489** | $381 / $438 |
| Standard | Sedan $530 | **$499** | $423 / $486 |
| Minivan (MPV) | Compact MPV $582 | **$549** | $508 / $584 |
| 4x4 | no equivalent | **$585** | $550 / $632 |
| Van | Van $639 | **$605** | $571 / $657 |

Code: `src/lib/pinnedPrices.ts` (the rule), `rideDriveCents()` in `src/lib/pricing.ts` (the one
place it is applied), table `pinned_route_prices` (public read, admin write). Tests:
`npm run test:pinned`, `npm run test:db`. Assumptions for Jorge: `docs/PROJECT.md` §9 #26.

## 5. Stops as paid extras (Jorge 2026-11-08)

A stop is an **extra with its own cost**, the way Daytrip prices them:

```
stop price = waiting time × hourly wait rate ($22–28 / h, Daytrip's range)
           + detour km × per-km rate (0 if the stop is on the road)
           + guide fee where the stop is guided (Carara, Poás)
           + entrance fee, if we include it (otherwise shown as "pay at the gate, ~$X")
```

**Built 2026-11-09 (step 5, migration 0021):** exactly this, with the waiting rate at **$20/hour**
(Jorge; the market gives ~1 h free then $10–20/h), detour km and minutes per stop (there and back,
estimates to refine), rounded to whole dollars, **plus a tour part per person** for stops that are
really tours (Jorge, 2026-11-09: "tours are not just a drive"; priced like his tours on
costaricatravelplanner.com, which are per person with the vehicle, guide and entrances included).
Today, driver part + tour part per person: Tárcoles $15 + 0 (was $25 flat), Carara $33 + $45,
Poás $68 + $55, Río Celeste $62 + $35, sloth trail $25 + $30. The per-person amounts are starting
guesses to confirm at `/admin/pricing`. Park-fee amounts aren't shown yet.

With exact routing, "is this stop on my way?" is answered by the detour. A stop that adds
more than about 45 min of detour isn't offered. That replaces the hand-made stop ↔ corridor
list (§9 #4).

Entrance fees (the item you weren't sure about): Carara, Poás and Río Celeste (Tenorio) charge
foreigners a national-park entrance fee of very roughly $12–18. Travellers need to know
whether our stop price **includes** it or whether they **pay at the gate**. The admin already has a
"park fee included" switch per stop; the storefront just doesn't show it yet. Recommendation:
don't include it (prices stay comparable with Daytrip's) and show "Park entrance ~$X, paid at the
gate" on the card.

## 6. Bidding vs flat rates — my recommendation

> **Decided (Jorge, 2026-11-11): "Let's do fixed prices only for now."** Travellers always book
> at the fixed price; the storefront's and the app's "Driver offers" / "name your price" mode
> (offers from $50) is removed. Drivers still send offers on their payout on the job board (7a)
> and the team picks the driver. "Request a custom quote" (7b) stays deferred.

**Fixed prices for travellers. Let drivers compete behind the scenes. Keep "name your price"
only as a custom quote.**

Why not lead with open bidding (GetTransfer style):
- **Bidding needs many drivers.** With a small, hand-picked network, many requests would get
  zero or one bid. The traveller waits hours and books Daytrip instead.
- **Travellers want certainty.** Daytrip grew on "this is the price, booked in a minute".
  GetTransfer's worst reviews are exactly about bidding: drivers who bid low then cancel,
  no-shows and slow refunds (COMPETITORS §4).
- **It confuses the trip cart.** A bid price isn't known when the traveller pays, so a combined
  cart with tours can't be paid in one go.
- **It makes prices race to the bottom**, which hurts the driver quality we sell.

What to do instead:
1. **Travellers always see one fixed price** from the formula and book instantly.
2. **Drivers claim jobs at a fixed payout.** Approved drivers see open jobs with their payout
   (e.g. 85% of the price) and the first suitable driver accepts. This is how Daytrip
   dispatches. Optionally, drivers can offer to take a job for a little less, and our margin
   grows. The traveller never sees that auction. The `bids` table already built can carry these
   offers.
3. **"Request a custom quote"** replaces "name your price" for things the formula doesn't
   cover well: groups of 11+, unusual routes or very late hours (multi-day trips were retired
   on 2026-11-11 and are not quoted). The
   team or drivers send an offer, and the traveller accepts it on the trip page.

This changes PROJECT.md §6.3 (bidding) and §9 #2–#3. The bidding work already done isn't wasted;
it moves to the driver side.

## 7. Build order (each one a small PR)

| # | What | Needs from Jorge |
| :--- | :--- | :--- |
| 1 ✅ | **Built 2026-11-09** (migration 0013). **Formula in the database** with the current town list: per-km, per-hour, minimum, vehicle factors, area factors, editable at `/admin/pricing`. Each town pair gets its km and hours from a table we fill once. This fixes the flat price **without any map service** | Approve the starting numbers in §4.2 |
| 2 ✅ | **Built 2026-11-09 with step 1.** **Economy class** (Spanish-speaking driver, 0.90×) | Confirm the factor |
| 3 ✅ | **Built 2026-11-09.** **Place search + route** (Google): type any place, see drive time + km and a Google Maps link, price from real km/hours. Prices are re-checked on the server when the trip is sent, as today. See §3.1 | Google Cloud account with billing + API key ✅ |
| 4a ✅ | **Built 2026-11-09** (migrations 0015–0016). **Southern Nicoya + ferries**: places on the peninsula tip (Santa Teresa, Montezuma, Paquera…) get a 1.35 area factor at either end when the route takes the ferry (not from Liberia by road); Puntarenas ferry crossings on Google's route add the car + driver fare and a per-passenger fare (in colones, converted at the admin's exchange rate), shown as their own line. Also the new price level (§8 #1). SJO → Santa Teresa (2 pax) Standard ≈ $349 vs Daytrip $356; LIR → Santa Teresa $276 vs $300–350 elsewhere | Ferry fares ✅, exchange rate ✅ |
| 4b (part) ✅ | **Built 2026-11-09.** Typed airports: a typed pickup that Google itself lists as an airport at SJO or LIR gets the same flight-tracking / free-waiting promises and flight-number prompt as the listed airport (`isAirportPickup()`); hotels and car-rental offices next to the terminals do not | — |
| 4b | **Special places** still to do: Sierpe dock / Drake boat fares, 4x4-only areas | List of 4x4-only areas; Drake boat fares (private boat and per seat) |
| 5 ✅ | **Built 2026-11-09** (migration 0021). **Stops priced as wait + detour** (driver's part) **+ a per-person tour part** for guided stops, see §5. Park-fee amounts on cards still to do | Wait rate ✅ ($20/h); confirm the per-person tour amounts |
| 5b ✅ | **Built 2026-11-09** (migration 0022). **Day tours priced per person, tiered by group size** (1 / 2–3 / 4+), like costaricatravelplanner.com (e.g. Arenal full day $350 / $295 / $275 pp); the tour builder has a travellers selector and shows the total and the per-person rate. Replaces the flat per-group tour prices | Confirm the per-person tiers for our 4 tours (PROJECT.md §5.4) |
| 6 | **Zone prices** for the busiest pairs (optional) | Prices for those pairs |
| 7a ✅ | **Built 2026-11-09** (migration 0017). **Driver job board with offers**: the team posts a booking ("Open for drivers"); approved drivers see it at `/driver/jobs` with a **suggested payout only** (never the client's price; route town to town until assigned) and send an offer at that amount or their own (70–130%), with a note. The team compares offers on the booking page, ranked for it (a driver with a same-day **return trip** ending where this job starts first, then the **better-rated** driver (travellers rate after every completed trip; a rating with a comment counts double; new drivers count as 4.0), then drivers **based near the pickup**, then the lower offer, then fewer trips with us; new offers appear live) and accepts one: driver + vehicle assigned, booking confirmed, the offer becomes the payout, other offers declined. Suggested payout = (price − pass-through costs such as ferry tickets) × (1 − commission) + pass-through; commission 20% at `/admin/pricing` → Drivers' payout | Commission ✅ (20%) |
| 7a+ ✅ | **Built 2026-11-09; traveller side removed 2026-11-11.** Still running: approved drivers are emailed each new job when the team opens a booking for drivers (town-level route, time, suggested payout; never the client's price), and accepting an offer emails the traveller that the ride is confirmed with that driver. **Removed (Jorge, 2026-11-11, fixed prices only):** the traveller's "Driver bids" / "Driver offers" mode, where an offer of 70%+ of the fixed price was posted to the job board at once and lower offers waited for the team. Requests from older pages or app builds that still carry an offer are refused with a clear message (EN/ES) | — |
| 7b | *Deferred by Jorge.* **"Request a custom quote"** for groups, charters and unusual routes (the storefront's "Driver bids" mode it was meant to replace is already gone, 2026-11-11) | — |

## 8. Decisions

**Decided by Jorge, 2026-11-09:**
1. **Price level: on par with, or a few dollars under, Daytrip's lowest published prices**
   (revised the same day from "10–20% below": Daytrip is already among the cheapest, and the
   gap only lowered drivers' earnings). Numbers: base $30 + $0.90/km + $10/hour, minimum $120
   (migration 0016), editable at `/admin/pricing`. See the §4.2 note.
2. **Economy class: 10% cheaper** than Standard (factor 0.90).
3. **Google Maps Platform** (Places + Routes) for place search and road distance/time.
4. **Fixed prices for travellers; drivers claim jobs** at a fixed payout behind the scenes;
   "name your price" becomes "request a custom quote" (§6). **2026-11-11: fixed prices only** —
   the traveller "name your price" mode is removed; drivers still offer on payouts.

**Starting defaults, not yet confirmed (editable in the admin, change any time):**
5. Park entrance fees are shown as "paid at the gate, ~$X" unless a stop is marked as included
   or free (no ticket, e.g. Tárcoles; migration 0014).
6. Area factors: Southern Pacific / Osa 1.15 (Sierpe, Drake Bay and, since 2026-11-12, Puerto Jiménez), Liberia 1.10, Southern Nicoya 1.35 (applies at
   either end, but only when the route takes the Puntarenas ferry; it pays for the queue and
   the driver's crossing back, so rides around the gulf by road from Liberia don't get it),
   everywhere else 1.00.
7. Ferry fares (Jorge, 2026-11-09): Puntarenas ↔ Paquera / Playa Naranjo about ₡15,000 per
   crossing for the car with its driver and ₡1,500 per passenger, kept in colones and converted
   at `crc_per_usd` (₡452 on 2026-11-09; **Jorge checks the rate about once a week** and updates
   it at `/admin/pricing`). Charged per crossing on Google's route, on top of the ride, rounded
   to whole dollars, not season-adjusted. Drake Bay boat fares still unknown (today's combo adds
   a flat $75).

8a. **Tours: the driver gets 80% of the net** (Jorge, 2026-11-09). The company pays the lunch,
   park tickets and activities, so they come off first: payout = (price − ferries − company-paid
   costs) × 80% + ferries. Day tours have "Our costs per person" (`day_tours.cost_pp`, migration
   0023; starting guesses Arenal $95, Manuel Antonio $110, Sierpe & Caño $140, Monteverde $125,
   to confirm). On ride stops the per-person tour part is treated as company-paid in full, so
   the driver earns on driving and waiting. Each booking records `company_costs`.
8. **Platform commission: 20%** of a ride or day tour, after pass-through costs (ferry tickets,
   later boats and park fees, which go to the driver in full). Jorge, 2026-11-09: drivers should
   keep about 80% of the net; Daytrip keeps roughly 40% of the gross on his own rides. Drivers
   never see what the client paid, only the suggested payout. Editable at `/admin/pricing`; each
   booking keeps the payout it was created with, or the offer the team accepted. Example:
   SJO → La Fortuna $162 suggests $130 to the driver. Jorge wants several drivers to be able to
   offer so he can see what each would do the trip for and spread the work (2026-11-09); offers
   are limited to 70–130% of the suggestion.
9. **Waiting time: $20/hour** (Jorge, 2026-11-09; he first suggested $30, the market check
   showed ~1 h free then $10–20/h). The driver gets their usual share (80%). Built in step 5.

**Still open:** none for the job board. Drake Bay boat fares and 4x4-only areas (step 4b) are
deferred by Jorge.

## 9. Promo codes (built 2026-11-12, migration 0052)

**Jorge's rule: the discount is split 50/50** between our share and the driver's payout ($20 off →
we keep $10 less, the driver is paid $10 less). Drivers still see only their own payout, never the
client's price or the code. The team creates codes at `/admin/promos` (link from Prices & catalog);
travellers type them at checkout (website trip panel, app "Your ride" and the tour review).
Rules (code: `src/lib/promo.ts`; tests: `npm run test:money`):

1. **Order:** base → vehicle and area → season → night premium → ferries (§4, §6.6) → **then the
   discount**. The cash booking fee is charged on what is left after the discount.
2. **What is discounted:** only the part we and the driver share = price − ferries − costs the
   company pays (park entrances, lunch, activities on tours and guided stops) − the Drake Bay boat
   fee. Ferry tickets, the boat and those costs are **never** discounted. Percent codes: that percent of the shared part of each
   eligible booking, half-up to the cent. Fixed codes: the amount once per trip, taken from the
   eligible bookings in trip order.
3. **Limit:** our half never exceeds our commission on the booking, so a code never makes us pay
   to run a trip. With the 20% commission a booking can get at most **40% off its shared part**
   (a "50%" code gives 40%). A total never goes below zero.
4. **Split and rounding:** the driver's part is **half the discount rounded DOWN to the cent**; we
   take the odd cent ($10.01 off → driver $5.00 less, us $5.01 less). `driver_payout` and
   `platform_fee` are stored already reduced; `bookings.promo_code` / `promo_discount` and one
   `promo_redemptions` row per booking keep the details. If the team later accepts a driver's offer
   on the job board, the offer becomes the payout as before.
5. **Conditions:** active, between "valid from" and "valid until" (Costa Rica dates, inclusive),
   rides / tours / both, minimum order (the eligible bookings before the discount), most uses in total
   and per email (uses = trips, cancelled bookings don't count). One code per trip.
6. **Checks:** always on the server, again when the trip is sent (with the real email). A wrong or
   unusable code always gets the same answer, "This code isn't valid." / "Este código no es
   válido.", never why. After **10 wrong codes in an hour from one network** the checks stop for
   an hour. Older app builds that send no code book exactly as before.
