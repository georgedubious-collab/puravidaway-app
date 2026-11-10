# Costa Rica Private Transfers (traveller app)

The customers' mobile app, built with Expo like the driver app (`apps/driver`). Name on the
phone: "CR Transfers". App ID: `com.costaricaprivatetransfers.app` (permanent once published).
Its own project: Vercel ignores this folder.

## What it does (first version)
- Sign in with an emailed 6-digit code, using the email the trip request was sent with.
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
