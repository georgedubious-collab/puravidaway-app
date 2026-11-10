# Costa Rica Private Transfers Partner (driver app)

App name on the phone: "CR Transfers Partner". App ID: `com.costaricaprivatetransfers.partner` (permanent once published).

The drivers' mobile app, built with Expo (React Native + TypeScript). One codebase makes
both the Android and the iPhone app. It lives next to the website but is its own project:
Vercel ignores this folder, and the website's checks don't run on it.

## What it does (first version)
- Sign in with the same emailed 6-digit code as the website. A new email creates an account and
  goes straight to the application form (name, WhatsApp, partner statement).
- **Jobs:** open jobs with the suggested payout; send, change or withdraw an offer.
- **Trips:** assigned trips; Start trip / Complete trip; Waze and Google Maps buttons;
  cash to collect on cash trips; chat with the traveller and the team.
- **Calendar:** tap a day to block it (`set_unavailable()`); blocked days hide jobs, refuse offers
  and skip job alerts; days with a confirmed trip are marked and can't be blocked.
- **Earnings:** balance to settle and trip history.
- **Help:** FAQs (`src/screens/Help.tsx`, keep them true to how the app works) and driver support
  by WhatsApp and email (`GET /api/v1/support`; email from `DRIVER_SUPPORT_EMAIL`).
- **Profile:** approval status, rating, vehicles, sign out.
- **Push notifications:** new open jobs and accepted offers.

- **Location sharing:** with the driver's agreement, the phone shares its position from 3 hours
  before a pickup until the trip is completed (also in the background), shown on `/admin/live`.
  The database refuses positions outside that window (`report_location()`), and the app's
  background task then stops itself. Only the latest position is kept.

- **Documents and vehicles:** personal details, a photo of each document straight from the
  camera (or the gallery), vehicles with their documents and photos, and renewals with the new
  date. Files go to the driver's private storage folder; `/api/v1/driver/documents` links them
  with the website's checks. Documents can also be PDFs or files from the phone
  (`expo-document-picker`); vehicle photos are pictures only.

Store review notes: Google Play needs a background-location declaration with a short video, and
Apple asks why "Always" location is needed. The reason in both cases: the team coordinates
pickups and follows active trips; sharing is limited to the trip window and stated in the app
before the permission prompt.

## How it talks to the backend
- Reads go straight to Supabase as the signed-in driver (`driver_jobs()`, `my_trips()`,
  own driver and vehicle rows). Row-level security decides what they can see; a driver
  never receives the traveller's price except the cash to collect on a cash trip.
- Actions go through the website's `/api/v1` (offers, trip status, chat), which runs the
  same code as the website and sends the emails, pushes and rating requests.
- `src/config.ts` holds only public values (Supabase address and publishable key, site address).

## Building a test version (Jorge, one-time setup)
Needs a free Expo account (expo.dev). In a terminal, inside `apps/driver`:

1. `npm install`
2. `npx eas-cli@latest login`
3. `npx eas-cli@latest init` (creates the Expo project and writes its id into `app.json`;
   commit that change, push notifications need it)
4. Android test build: `npx eas-cli@latest build --platform android --profile preview`
   When it finishes, Expo gives a link and QR code; open it on an Android phone to install.
5. iPhone test build (needs the Apple Developer account):
   `npx eas-cli@latest build --platform ios --profile preview`, then register the test phones
   when asked.

Push notifications on Android also need a Firebase project linked in Expo (Expo's "FCM V1"
credentials); `eas build` explains the step the first time.

## Working on it
- `npx expo start` runs it on a phone with the Expo Go app (push notifications don't work
  in Expo Go; everything else does).
- `npx tsc --noEmit` and `npx expo-doctor` must pass before a pull request.
- Add libraries with `npx expo install <name>` so versions match the Expo SDK.
- Customer- and driver-facing text says "Costa Rica Private Transfers" only (brand separation).

## Design previews (no phone needed)

Every screen can be shown in a browser with made-up data, without signing in:

    EXPO_PUBLIC_PREVIEW=1 npx expo start --web

Then open the address it prints and add `?s=jobs` (or `trips`, `trip`, `trip2`, `calendar`,
`earnings`, `profile`, `documents`, `apply`, `help`, `signin`). The sample data lives in
`src/preview.tsx`. Phone builds never set `EXPO_PUBLIC_PREVIEW`, so drivers never see it.
