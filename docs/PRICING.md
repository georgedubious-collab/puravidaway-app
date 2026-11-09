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

Short rides lose customers, long rides lose money or drivers. The bid "reference price" is
built from the same number, so it is wrong too.

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

## 4. The price formula (recommended)

### 4.1 Base formula

```
ride price = max( minimum fare,  base + per-km × road km + per-hour × drive hours )
             × vehicle factor
             × area factor (where drivers are scarce)
             × season multiplier (already in the database)
             + stops (as extras, §5) + ferry / boat costs
```

Paying for **hours as well as km** matters in Costa Rica: 100 km of mountain road (Monteverde,
Route 32) costs the driver far more time than 100 km of highway. Daytrip and GetTransfer both
follow this. Their Monteverde and Osa prices are high for the distance.

### 4.2 Starting numbers, to tune in `/admin/pricing`

Standard class (Sedan / Comfort, 1–3 passengers): **base $35 + $0.70 per km + $12 per hour,
minimum $110.**

What that gives on real routes:

| Route | km / time | Daytrip Sedan | GetTransfer Comfort | **PuraVidaWay** | vs Daytrip | Driver keeps at 85% | Daytrip driver gets ~70% |
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

Result: **10–20% cheaper than Daytrip** and above GetTransfer's "from" price (theirs is a floor,
and drivers can still bid higher or cancel). Drivers earn about the same as on Daytrip or more,
assuming a 12–15% commission (§9 #2), which is what attracts the best drivers.

### 4.3 Vehicle classes

Match Daytrip's names and capacities so travellers compare like with like (COMPETITORS §2b #3):

| Class | Seats / bags | Factor | Notes |
| :--- | :--- | ---: | :--- |
| **Economy** *(new, Jorge 2026-11-08)* | 1–3 / 3 | **0.90** | Spanish-speaking driver (basic English at most), direct ride. Like Daytrip's Sedan Lite. Says so clearly on the card |
| **Standard** (Sedan) | 1–3 / 3 | 1.00 | English-speaking driver requested and matched by the team |
| **Comfort SUV** | 1–4 / 4 | 1.20 | |
| **4x4** (Prado / Fortuner) | 1–4 / 4 | 1.30 | Forced for 4x4-only destinations |
| **Van** (HiAce / Staria) | 5–10 / 10 | 1.35 | Same as Daytrip's van factor |
| **Sierpe combo** | 1–4 | 4x4 price + boat fare | Boat priced per person, set by the operator |

### 4.4 Area factor (driver scarcity)

Daytrip charges Manuel Antonio → Uvita (68 km) the same as SJO → Uvita (211 km). Most drivers
live in the Central Valley, so a driver has to come from far away. Rather than copy that, set
an **area factor per zone** (e.g. Southern Pacific / Osa 1.15, Liberia 1.10, Central Valley 1.00)
and lower it as local partner drivers join. It is one number per zone in the admin.

### 4.5 Zones for the most popular places (optional, phase 2)

For the 20 or so busiest pairs (SJO ↔ La Fortuna, Manuel Antonio, Monteverde, Tamarindo…), Jorge
can **pin a fixed price** that overrides the formula. Any point inside a zone gets the zone price,
and Arenas del Mar costs the same as Manuel Antonio town, exactly as Daytrip does. Points
outside the zones use the formula. This mixes the two models the spec mentioned (§9 #1): the
formula covers everything, and fixed prices exist where marketing needs a round number.

## 5. Stops as paid extras (Jorge 2026-11-08)

A stop is an **extra with its own cost**, the way Daytrip prices them:

```
stop price = waiting time × hourly wait rate ($22–28 / h, Daytrip's range)
           + detour km × per-km rate (0 if the stop is on the road)
           + guide fee where the stop is guided (Carara, Poás)
           + entrance fee, if we include it (otherwise shown as "pay at the gate, ~$X")
```

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

**Fixed prices for travellers. Let drivers compete behind the scenes. Keep "name your price"
only as a custom quote.**

Why not lead with open bidding (GetTransfer style):
- **Bidding needs many drivers.** With a small, hand-picked network, many requests would get
  zero or one bid. The traveller waits hours and books Daytrip instead.
- **Travellers want certainty.** Daytrip grew on "this is the price, booked in a minute".
  GetTransfer's worst reviews are exactly about bidding: drivers who bid low then cancel,
  no-shows and slow refunds (COMPETITORS §4).
- **It confuses the trip cart.** A bid price isn't known when the traveller pays, so a combined
  cart with tours and expeditions can't be paid in one go.
- **It makes prices race to the bottom**, which hurts the driver quality we sell.

What to do instead:
1. **Travellers always see one fixed price** from the formula and book instantly.
2. **Drivers claim jobs at a fixed payout.** Approved drivers see open jobs with their payout
   (e.g. 85% of the price) and the first suitable driver accepts. This is how Daytrip
   dispatches. Optionally, drivers can offer to take a job for a little less, and our margin
   grows. The traveller never sees that auction. The `bids` table already built can carry these
   offers.
3. **"Request a custom quote"** replaces "name your price" for things the formula doesn't
   cover well: groups of 11+, multi-day private charters, unusual routes or very late hours. The
   team or drivers send an offer, and the traveller accepts it on the trip page.

This changes PROJECT.md §6.3 (bidding) and §9 #2–#3. The bidding work already done isn't wasted;
it moves to the driver side.

## 7. Build order (each one a small PR)

| # | What | Needs from Jorge |
| :--- | :--- | :--- |
| 1 ✅ | **Built 2026-11-09** (migration 0013). **Formula in the database** with the current town list: per-km, per-hour, minimum, vehicle factors, area factors, editable at `/admin/pricing`. Each town pair gets its km and hours from a table we fill once. This fixes the flat price **without any map service** | Approve the starting numbers in §4.2 |
| 2 ✅ | **Built 2026-11-09 with step 1.** **Economy class** (Spanish-speaking driver, 0.90×) | Confirm the factor |
| 3 | **Place search + route** (Google): type any place, see map + drive time, price from real km/hours. Prices are re-checked on the server when the trip is sent, as today | Google Cloud account with billing + API key (setup guide in the PR) |
| 4 | **Special places**: airports, Sierpe dock / Drake boat, 4x4-only areas, Paquera ferry | List of 4x4-only areas and boat fares |
| 5 | **Stops priced as wait + detour**; park-fee note on cards | Hourly wait rate, which stops are guided |
| 6 | **Zone prices** for the busiest pairs (optional) | Prices for those pairs |
| 7 | **Driver job board** with fixed payouts (replaces public bidding) + "custom quote" | Commission % (§9 #2) |

## 8. Decisions

**Decided by Jorge, 2026-11-09:**
1. **Price level: 10–20% below Daytrip.** Starting numbers as in §4.2 (base $35 + $0.70/km +
   $12/hour, minimum $110), editable at `/admin/pricing`.
2. **Economy class: 10% cheaper** than Standard (factor 0.90).
3. **Google Maps Platform** (Places + Routes) for place search and road distance/time.
4. **Fixed prices for travellers; drivers claim jobs** at a fixed payout behind the scenes;
   "name your price" becomes "request a custom quote" (§6).

**Starting defaults, not yet confirmed (editable in the admin, change any time):**
5. Park entrance fees are shown as "paid at the gate, ~$X" unless a stop is marked as included.
6. Area factors: Southern Pacific / Osa 1.15, Liberia 1.10, everywhere else 1.00.

**Still open:** platform commission % (PROJECT.md §9 #2; 12–15% recommended), needed for the
driver job board (build step 7).
