# Costa Rica Private Transfers (traveller app)

The customers' mobile app, built with Expo like the driver app (`apps/driver`). Name on the
phone: "CR Transfers". App ID: `com.costaricaprivatetransfers.app` (permanent once published).
Its own project: Vercel ignores this folder.

## What it does (first version)
- No account and no password. Anyone can plan a trip and see prices without signing in. When they
  send a request they type their email and confirm it with a 6-digit code we email them (that
  signs this phone in as that email). "Already booked?" in My trips or Account does the same, to
  see trips made on the website or on another phone.
- **My trips:** every ride and tour requested with that email; status, amount due and
  how it's paid; "your driver is on the way".
- **Trip:** the driver's first name, photo, rating, languages and car photos once assigned; the
  same chat as the trip page; a 1–5 star rating after the trip.
- **Plan a trip, in the app** (no map while booking since 2026-11-11, see below): a private ride (type any hotel, airport or address; date, time,
  travellers, vehicle, optional stops) or a day tour; contact details; pay online or cash. Every
  price comes from the server (`/api/v1/client/quote`, `/tours`) and the request goes through the
  same server action as the website (`/api/v1/client/trip-request`).
- **Test checkout:** "Pay (test)" marks the trip paid with a `provider = 'test'` payment; no card,
  no money. Works only while the site is pre-launch (`src/lib/testCheckout.ts`); replace with
  Green Pay before launch.
- **Where the driver is:** once a driver is assigned and the ride is close, the trip opens on a
  map with the driver's position, the minutes to arrival, "Message driver" and "Call our team".
  The position shows only while the driver is sharing it for that booking (3 hours before pickup,
  or on the way, until the trip ends). The driver's phone number is never shown.
- **Account:** WhatsApp, terms, privacy, cancellation policy, sign out.
- **Push notifications:** ride confirmed with a driver, driver on the way, rating request.

Not yet: real card payments and account deletion
inside the app (both stores require it before publishing).

## Language
English by default. A small flag button at the top right of every screen (and on the sign-in
screen) switches the app to Spanish: 🇨🇷 ES in English, 🇺🇸 EN in Spanish to switch back. The
Account screen also has a "Language / Idioma" row. The choice is remembered on the phone.

- `src/i18n.tsx` holds the switch: `useT()` gives `{ lang, setLang, t }`, and every text is written
  in place as `t("English", "Español")`. Helpers that build text (`crDateTime`, `plural`,
  `longDate`, `bookingStage`) take a `lang` argument.
- Spanish is neutral Latin American and uses "usted".
- What the server sends stays in English for now: vehicle names, badges and luggage, tour names
  and highlights, stops, season names, driver bios and server error messages. Town and airport
  names are also kept as they are.

## How it talks to the backend
- `GET /api/v1/client/trips` returns the trips for the signed-in email (the server looks them up;
  travellers book as guests, so there are no rows of "their own" to read directly). Only
  traveller-safe fields come back.
- Chat and rating go through `/api/v1/chat/[bookingId]` and `/api/v1/client/rate` with the trip's
  private code, which the server checks exactly as on the trip page.
- `src/config.ts` holds only public values.

## Building a test version
Same steps as `apps/driver/README.md`, inside `apps/client`: `npm install`,
`npx eas-cli@latest init` (choose the organization; commit the `app.json` change), then
`npx eas-cli@latest build --platform android --profile preview`.

`src/config.ts`, `supabase.ts`, `api.ts`, `format.ts` and `push.ts` started as copies of the
driver app's files. If one changes in a way both apps need, change both. Since v2 the traveller
app has its own look (`theme.ts`, `ui.tsx`).

## Google Maps key for Android
iPhone needs nothing. Android shows Google's map only if the build was made with a key:

1. In Google Cloud, enable **Maps SDK for Android** and create an API key restricted to Android
   apps: package `com.costaricaprivatetransfers.app` plus the SHA-1 of the build's signing
   certificate (expo.dev → the project → Credentials; later also the Play app-signing certificate).
2. Save it as the EAS environment variable **`EXPO_PUBLIC_GOOGLE_MAPS_KEY`** for the project
   (expo.dev → Environment variables, for the preview and production environments). Never put it
   in this repo. For a local build it can go in `apps/client/.env.local` (ignored by git).
3. Make a new Android build. `app.config.ts` reads the variable, hands it to the
   `react-native-maps` plugin and sets `extra.androidMapsKey`, which `src/MapView.tsx` checks.

Without the key nothing breaks: Android shows the app's own drawn map.

## How the app is put together (v2, 2026-11-10)

- **Navigation** — React Navigation native stacks (`src/Navigator.tsx`, map in `src/nav.ts`).
  Bottom tabs: Explore, My trips, Account. Booking steps, tours, trip chat and the "request sent"
  screen push onto the stack (slide in, swipe back on iPhone). Place search, pickup time, tour
  date, the email code and the rating are panels that slide up from the bottom.
- **Explore** — `src/screens/Explore.tsx`: a "Rides | Day tours" switch (the phone remembers the
  side). Rides is a scrolling booking start: a headline, the "From / To" card with a "Date" button,
  popular rides as picture cards (drive time, "from" price) and "Every ride includes" (`Home.tsx`,
  promises in `Promises.tsx`); Day tours is the photo list (`Tours.tsx`). The ☰ button opens a small
  menu panel (`Menu.tsx`).
- **Booking a ride** (no map while booking since 2026-11-11; the map is only on the trip screen once a driver is close) — in `src/screens/book/`: `Where.tsx` (pickup and
  drop-off, "Add a stop", our towns with drive times) → `Ride.tsx` (a route summary card
  with the drive time, date and travellers, then "Choose your vehicle" with fixed prices; travellers book at the fixed price only since 2026-11-11) → `Confirm.tsx`
  ("Your ride": travellers and bags, flight number, stops, driver and extras, payment, contact
  details, "Request ride"). Panels: `When.tsx` (date, time, travellers, bags), `Extras.tsx` (stops;
  driver and extras), `PlaceSearch.tsx`. A ride can't be sent until the traveller
  has opened the date panel once (`whenSet` in the store), because the day starts as our guess.
  All screens share one store (`src/booking.tsx`), so going back keeps every choice and the price
  is only asked again when route, date, travellers or stops change. Day tours: `Tours.tsx` (list →
  tour → `Review.tsx`). The request body sent to `/api/v1/client/trip-request` is exactly the v1 one.
- **Maps** — one component, `RouteMap` in `src/MapView.tsx`, used only on the trip screen. iPhone: Apple Maps
  (`react-native-maps`, no key). Android: Google Maps, only when the build has a key (below);
  otherwise, and in the browser preview, the app draws its own map of Costa Rica with the pins in
  their real places. The line between pickup and drop-off is straight (the app has the two points,
  not the road); drive times and prices always come from the server. Town points: `src/geo.ts`.
- **Signed in or not** — `src/session.tsx` holds who is signed in and their trips. It and the
  booking store sit above the navigator, so confirming the email code half-way through a booking
  never loses the planned trip.
- **Look** — `src/theme.ts` (colours, spacing, type scale) and `src/ui.tsx` (buttons, cards,
  inputs, skeletons, the sticky price bar). Every text goes through `Text` / `Input` from
  `src/ui.tsx`, which use Plus Jakarta Sans (loaded in `App.tsx` while the launch screen stays up)
  and pick the font file for the weight. `src/haptics.ts` gives light taps on phones only.
- **Logo** — `src/Logo.tsx` (`<LogoMark/>`, `<Logo/>`, `<Logo short/>`). App icons in `assets/`
  were drawn from the same mark.

## Pictures: how to add a real photo

Every picture slot is a `<Photo name="…" />` (`src/Photo.tsx`). The name is looked up in
`src/images.ts`: a real photo if one is listed there, otherwise a designed placeholder (a soft
gradient with a simple line drawing: volcano, beach, bridge, wave, boat, plane, or a car by class).

To add a photo:

1. Put the file in `apps/client/assets/photos/`, e.g. `arenal.jpg` (landscape JPEG, about 1600 px
   wide, under ~400 KB). Only use photos we own or have licensed, never one another company uses.
2. Add one line to `PHOTOS` in `src/images.ts`:
   `arenal: require("../assets/photos/arenal.jpg"),`

Every card, hero and list that shows that name then uses the photo. Names: destinations `arenal`,
`monteverde`, `manuel-antonio`, `tamarindo`, `santa-teresa`, `puerto-viejo`, `drake-bay`, `sjo`,
`lir`; vehicles `economy`, `sedan`, `suv`, `4x4`, `van`; tours `tour:<id>` (e.g. `tour:dt1`);
stops `stop:<id>` (e.g. `stop:poas`); and `hero`. A new phone build (or an over-the-air update) is
needed for added photos to reach phones.

## Design previews (no phone needed)

Every screen can be shown in a browser with made-up data, without signing in:

    EXPO_PUBLIC_PREVIEW=1 npx expo start --web

Then open the address it prints and add `?s=<screen>`; add `&lang=es` to see it in Spanish.
Screens: `home` (rides), `home-in`, `home-route`, `home-loading`, `menu`, `places`,
`where-empty`, `where`, `search`, `search-found`, `map-pick` (now opens the place search), `when`, `time`, `choose` (same as
`ride`), `ride-new`, `ride-bid` (now opens `ride`), `ride-loading`, `stops`, `extras`, `extras-empty`, `confirm`, `confirm-electric`
(`review` and `guest` are the same screen with other data), `code`, `tours` (with the switch),
`tours-loading`, `tour-when`, `tour`, `tour-review`, `sent`, `sent-paid`, `sent-cash`, `trips`,
`empty`, `trips-loading`, `signin`, `signin-code`, `live` (same as `trip`), `trip-driver`, `trip2`,
`rate`, `rate-sheet`, `chat`, `chat-empty`, `account`, `account-out`. The sample data and the list live in
`src/preview.tsx`. Phone builds never set `EXPO_PUBLIC_PREVIEW`, so travellers never see it.
