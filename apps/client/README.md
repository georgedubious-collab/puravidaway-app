# Costa Rica Private Transfers (traveller app)

The customers' mobile app, built with Expo like the driver app (`apps/driver`). Name on the
phone: "CR Transfers". App ID: `com.costaricaprivatetransfers.app` (permanent once published).
Its own project: Vercel ignores this folder.

## What it does (first version)
- No account and no password. Anyone can plan a trip and see prices without signing in. When they
  send a request they type their email and confirm it with a 6-digit code we email them (that
  signs this phone in as that email). "Already booked?" in My trips or Account does the same, to
  see trips made on the website or on another phone.
- **My trips:** every ride, tour and expedition requested with that email; status, amount due and
  how it's paid; "your driver is on the way".
- **Trip:** the driver's first name, photo, rating, languages and car photos once assigned; the
  same chat as the trip page; a 1–5 star rating after the trip.
- **Plan a trip, in the app:** a private ride (type any hotel, airport or address; date, time,
  travellers, vehicle, optional stops) or a day tour; contact details; pay online or cash. Every
  price comes from the server (`/api/v1/client/quote`, `/tours`) and the request goes through the
  same server action as the website (`/api/v1/client/trip-request`). Expeditions open the website.
- **Test checkout:** "Pay (test)" marks the trip paid with a `provider = 'test'` payment; no card,
  no money. Works only while the site is pre-launch (`src/lib/testCheckout.ts`); replace with
  Green Pay before launch.
- **Where the driver is:** a small map and arrival estimate on the trip, only while the driver
  is sharing location for that booking (3 hours before pickup, or on the way, until the trip ends).
- **Account:** WhatsApp, terms, privacy, cancellation policy, sign out.
- **Push notifications:** ride confirmed with a driver, driver on the way, rating request.

Not yet: real card payments, expeditions and "name your price" in the app, and account deletion
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

`src/config.ts`, `supabase.ts`, `api.ts`, `theme.ts`, `ui.tsx`, `format.ts` and `push.ts` started
as copies of the driver app's files. If one changes in a way both apps need, change both.

## Design previews (no phone needed)

Every screen can be shown in a browser with made-up data, without signing in:

    EXPO_PUBLIC_PREVIEW=1 npx expo start --web

Then open the address it prints and add `?s=trips` (or `empty`, `trip`, `trip2`, `rate`, `book`,
`date`, `tours`, `send`, `checkout`, `account`, `signin`); add `&lang=es` to see it in Spanish. The sample data lives in
`src/preview.tsx`. Phone builds never set `EXPO_PUBLIC_PREVIEW`, so travellers never see it.
