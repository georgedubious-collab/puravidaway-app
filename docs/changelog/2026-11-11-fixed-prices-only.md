- 2026-11-11 — Claude — Fixed prices only for travellers (Jorge's decision, PROJECT §6.3 and §9 #3):
  the website ride builder and the customer app's vehicle screen no longer offer "Name your price
  (drivers bid)" / "Driver offers"; the vehicle screen goes straight from the route card to
  "Choose your vehicle", and "Your ride" always shows "Fixed price for the whole vehicle". The
  trip request refuses a ride sent as a traveller's offer by an older page or app build with
  "Please book at the fixed price shown; offers are no longer available." (Spanish with usted);
  a ride saved as an offer in a browser's trip comes back at the fixed price. New bookings are
  always `pricing_mode = 'fixed'`; earlier offer bookings still show as "client's offer" in admin.
  FAQ, How it works, About, site descriptions, `llms.txt` and the terms no longer mention driver
  bids; the trip page says "Finding your driver" for rides open on the job board. The analytics
  `pricing` parameter (always "fixed" now) is dropped. The app quote keeps returning
  `minOfferCents` for older app builds. Drivers' offers on their payout (job board,
  `offer_job()`, the driver app's Offers screen) and the team's driver ranking are unchanged.
  New test: `npm run test:fixed`. No price changes, no migration.
