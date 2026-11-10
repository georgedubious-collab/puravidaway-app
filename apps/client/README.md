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
- **Plan a trip:** opens the website's trip builder in an in-app browser.
- **Account:** WhatsApp, terms, privacy, cancellation policy, sign out.
- **Push notifications:** ride confirmed with a driver, driver on the way, rating request.

Not yet: building or paying for a trip inside the app (the website does both), account deletion
inside the app (both stores require it before publishing), and the driver's live position.

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
