# Competitors — who PuraVidaWay is built to beat

> Jorge's standing instruction: **every product, pricing and UX decision is benchmarked
> against Daytrip, GetTransfer and Welcome Pickups.** Read this before designing a feature.
> Researched 2026-10-13; prices and policies change — re-verify before quoting them.

## 1. Side by side

| | **Daytrip** | **GetTransfer** | **Welcome Pickups** | **PuraVidaWay (target)** |
| :--- | :--- | :--- | :--- | :--- |
| Core product | Door-to-door intercity private transfers with curated sightseeing stops | Marketplace: traveler posts a trip, carriers bid | Airport pickups with meet-and-greet, plus in-destination add-ons | All three combined, Costa Rica only, plus 1-day tours and multi-day expeditions |
| Pricing model | Fixed price per car, shown "from $X per person"; stops priced on driver distance + wait time; entrance fees extra | Set by competing carriers; traveler can name a price; claims no hidden markup | Fixed per ride, premium vs ride-share; includes meet-and-greet and flight tracking | Fixed route × vehicle price table **and** bid mode with the fixed price as reference |
| Revenue | Sets retail price and keeps **~30%** of the fare (driver gets ~70%); 5% to US/CA travel agents; local partner drivers are independent contractors | Commission from carriers: **13–25%** by monthly volume and rating, minus tenure and prepaid-credit discounts (effective floor ~8%). The 2022 "5%" claim is not current | Commission per transaction; shares it with referring hotels / Airbnb hosts (B2B2C) | Margin on own rides; **commission on accepted partner-driver bids** (% still to be set, §9 of PROJECT.md) |
| Payment | Card online or **cash to driver after the trip** | Card in advance on offer acceptance | Card online | Card via Green Pay: **100% or 20% deposit**; WhatsApp-assisted booking |
| Cancellation | **Free up to 24 h before pickup** | Varies by carrier; refunds reported slow | Not prominent | To decide (PROJECT.md §9 #7) — must be at least as clear as Daytrip's |
| Trust signals | 10,000+ drivers, 130+ countries; Tripadvisor 5.0 (5k+ reviews), Trustpilot 4.6; flight tracking; driver waits if delayed | Carrier ratings, vehicle photos, reviews; AI checks on photos and unresponsive drivers | Vetted English-speaking "Welcomers", meet-and-greet with name sign, flight tracking | **Owner-operated, no-handoff**: Jorge personally drives or vouches for every partner; ICT / INS / Dekra / Marchamo compliance visible per driver |
| Scale | Global | 150–180 countries, ~1M passengers in 2025 | 374+ destinations; not in the US; Costa Rica unconfirmed | One country, deep: Costa Rica-specific logistics (Sierpe boats, SINAC permits, 4x4 roads) |
| Distribution | Direct + travel agents | Direct | Direct + **hotels and short-term-rental hosts** via referral links/widgets | Direct + WhatsApp; hotel/Airbnb host referral program is an open opportunity |

## 1b. Driver economics (what drivers actually keep)

| | Daytrip | GetTransfer |
| :--- | :--- | :--- |
| Platform cut | ~29% of the client price (19–34% across 9 Costa Rica rides, Aug 2026; most 29–33%) | 25% → 13% by rides/month and rating (≤10 rides at 4–5★ = 20%); −1 to −5 points for tenure; −3 points if paid from prepaid Commission Credit |
| Prepaid credit | — | Buy $100 → $150 credit, or swap $100 of payouts → $130 credit; non-withdrawable, never expires |
| Driver keeps on a $150 ride | ~$105 | $120 (20%) to ~$135 (10%) |
| Payout | Weekly statement, paid ~3 days after the week closes | Card rides paid out later; Cash Direct paid same day by the passenger |
| Driver tools | Driver app | 24/7 AI support, free dispatcher software, AI pricing tips |

Implication: a simple, flat PuraVidaWay partner commission in the **12–15%** range, paid
weekly, beats Daytrip outright and matches or beats most GetTransfer drivers without their
tier maze. Final % is Jorge's call (PROJECT.md §9 #2).

## 2. Daytrip in Costa Rica (observed Oct 2026)

- SJO → La Fortuna: **from US$29 per person**, 116 km, ~2 h 30. Stops offered: Britt Coffee
  Tour (1 h 30), Juan Santamaría Museum (2 h), Else Kientzler Garden (2 h), Proyecto Asis (1 h 30),
  La Fortuna Waterfall (2 h).
- SJO → Puerto Viejo: **from US$52 per person**, 232 km, ~4 h. Stops: La Paz Waterfall Gardens
  (2 h), Cartago (1 h 30), Frogs Heaven (1 h 30), Sloth Sanctuary (3 h), Finca La Isla (1 h).
- Included everywhere: door-to-door, flight tracking + driver waits, English-speaking licensed
  and insured driver, A/C vehicle, 1 suitcase + 1 carry-on per pax, child seats on request,
  pet-friendly, free cancellation up to 24 h.
- "From $X per person" is the **per-car price divided by the vehicle's max seats**. A sedan at
  $29 × 4 = roughly **$116–120 per car** SJO → La Fortuna. Real SUV bookings on that route
  cleared at **~$150** (Aug 2026). Our prototype SUV at $175 is above both; the price table must
  be built against these numbers (see Route-Pricing decision).
- Observed real client prices (SUV, Aug 2026): SJO→La Fortuna ~$150, Arenal→SJO ~$185,
  SJO→Tamarindo ~$320, Monteverde→Manuel Antonio ~$251, Puerto Viejo→SJO ~$280,
  San José→Limón ~$150.

## 2b. Daytrip price grid, Costa Rica (checked 2026-10-14 via daytrip.com)

Quote for **Wed 18 Nov 2026, 9:00, 2 passengers, 2 bags** (green season). Prices are per car,
one way, VAT included, free cancellation up to 24 h.

| Route | km / time | Sedan Lite | Sedan | Compact MPV | Van | SUV |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: |
| SJO → La Fortuna | 116 km / 2 h 30 | $150 | $161 | $212 | $212 | $202 |
| SJO → Monteverde | 132 km / 2 h 30 | $169 | $182 | $241 | $241 | $225 |
| SJO → Manuel Antonio | 159 km / 2 h 50 | $189 | $205 | $273 | $273 | $252 |
| SJO → Puerto Viejo | 232 km / 4 h | $260 | $281 | $384 | $384 | $352 |
| SJO → Tamarindo | 273 km / 4 h 40 | $313 | $338 | $457 | $457 | $421 |

Vehicle classes (Daytrip's definitions):
- **Sedan Lite** — budget, direct ride only (no stops), driver may not speak English; 1–3 pax, 3 bags.
- **Sedan** — default "best for you"; 1–3 pax, 3 bags.
- **Compact MPV** — 4 pax, 4 bags. **Van** — 5–7 pax, 7 bags (same price as MPV).
- **SUV** — "built for any road", elevated seating; only **1–2 pax, 2 bags** (premium, not family).

Pattern (fits all 5 routes within ~4%):
- **Sedan ≈ $30 + $1.13 per km.** Price scales with distance; there is no flat rate.
- Sedan Lite ≈ 0.93 × Sedan · SUV ≈ 1.24 × Sedan · MPV = Van ≈ 1.33 × Sedan.
- Driver payout ≈ 68–71% of these prices (see §1b).

Implication for PuraVidaWay: our prototype's flat $175 SUV is ~$27 too high on SJO→La Fortuna
and ~$250 too low on SJO→Tamarindo. Transfer prices must be **distance-based per route ×
vehicle class**, like Daytrip.

## 3. What each one does well — copy it

**Daytrip**
- Stops as an upsell inside the transfer flow, with realistic durations. Our stop cards do this;
  keep the duration added to the route summary.
- "From $X per person" framing makes private transfers look cheap. Show per-car **and**
  per-person prices.
- Flight tracking + "driver waits" as an explicit promise.
- Cash-to-driver option reduces booking friction for hesitant travelers.

**GetTransfer**
- Transparent bidding with vehicle photos and ratings builds trust in unknown drivers.
- They compete hard for **driver supply**: volume-based commission tiers, tenure discounts,
  prepaid "Commission Credit", a **Cash Direct** option (passenger pays the driver on ride day,
  price locked at booking), opt-in long-distance and corporate rides, and a free dispatcher
  web app for drivers' own bookings. Our commission must be clearly better than theirs **and
  simpler**, and we must pay drivers **on time** (their biggest complaint).

**Welcome Pickups**
- Meet-and-greet ritual: name sign, local tips, a named "Welcomer" assigned ahead of time.
- Referral program for hotels and Airbnb hosts, with a booking widget. Costa Rica hosts are a
  natural channel for us.
- Post-transfer upsell: the driver becomes the gateway to tours and extras. Our tabs 2 and 3 are
  exactly this; surface them after a transfer is added to the cart.

## 4. Where they fail — our openings

- **GetTransfer: driver cancellations, no-shows, slow refunds, late driver payments.** Our
  answer: Jorge or a vetted partner is accountable for every ride; KYC vault; instant WhatsApp
  line; clear refund rule.
- **Daytrip / Welcome: generic drivers, not guides.** Our drivers are naturalist-level guides;
  stops are guided, not just a drop-off.
- **Welcome Pickups is airport-only** and may not operate in Costa Rica at all.
- **None of them handle Costa Rica's hard logistics**: Sierpe boat connections to Drake Bay,
  SINAC Corcovado permits, 4x4-only roads to Monteverde, Poás timed entry. That is our moat.
- **None sell multi-day expeditions.** Tab 3 has no direct competitor among the three.

## 5. Product requirements that follow (checklist for every PR)

1. Price display: per car **and** "from $X per person".
2. Every transfer card states: flight tracking, driver waits, luggage allowance, free
   cancellation window, English-speaking ICT-certified driver.
3. Sightseeing stops show duration and whether entrance fees are included.
4. Bid mode shows the fixed price as reference and warns on unrealistic offers.
5. Cancellation and refund policy visible before payment.
6. Driver profile (photo, vehicle, rating, compliance badges) visible before the trip.
7. After adding a transfer, suggest a tour or expedition (Welcome-style upsell).
8. Host/hotel referral links are a planned feature (Phase 4) — keep booking URLs shareable.

## Sources

- Daytrip agent FAQ: https://agents.daytrip.com/daytrip-for-travel-agents-frequently-asked-questions
- Daytrip SJO→La Fortuna: https://daytrip.com/en/transfers/san-jose-international-airport-cr/la-fortuna-cr
- Daytrip SJO→Puerto Viejo: https://daytrip.com/en/transfers/san-jose-international-airport-cr/puerto-viejo-cr
- GetTransfer driver earnings & commission tiers: carrier-facing offer shared by Jorge (Oct 2026)
- Daytrip driver payout share: Jorge's own Daytrip driver statements (Aug 2026), summarized only
- GetTransfer 5% commission, outdated (PR Newswire, Apr 2022): https://www.prnewswire.co.uk/news-releases/gettransfer-com-offers-record-low-commissions-for-drivers-872351810.html
- GetTransfer marketplace model (Cyprus Mail, May 2026): https://cyprus-mail.com/2026/05/12/the-economics-of-transparency-in-a-mobility-marketplace
- GetTransfer traveler review: https://www.thetraveler.org/is-gettransfer-com-worth-using-for-airport-transfers/
- Welcome Pickups funding and model: https://trendingtopics.eu/greek-transfer-and-travel-service-welcome-pickups-raises-e3-3m-for-expand-in-cee-and-the-middle-east
- Welcome Pickups STR review: https://strspecialist.com/reviews/welcome-pickups-airport-transfer-review
