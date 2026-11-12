# Photos on the website and in the customer app

All pictures on the public site go through one registry, `src/lib/photos.ts`, and one component,
`src/components/site/Photo.tsx`. The files live in `public/photos/`. The customer app has its own
small registry, `apps/client/src/images.ts`, with files in `apps/client/assets/photos/` (see
"In the customer app" below). The same rules apply to both.

## Rules

1. **Our own photos preferred. Temporary stock photos are allowed where we have none (Jorge,
   2026-11-11).** Only from **Pexels or Unsplash**, only photos under their free licence (free
   commercial use, no attribution required; never an "editorial", "+" or paid item), never from
   Wikimedia, Google Images, Getty / Shutterstock previews or anything with a watermark. Every
   stock photo is listed below with its source page, and carries `source` and `licence` in the
   registry (internal, never shown to travellers), so each can be **replaced by one of our own
   photos** as soon as we have it. This is a stopgap, not the plan.
2. **One business per photo.** A stock photo is by nature used by other sites too, so before a new
   one is used the owner confirms it is **not on his other business's website** (the list of
   sources below is what to check). For our own photos the rule is unchanged: a photo used on this site must never be used by any other business
   (including the owner's other projects), and a photo used by another business must never be
   used here. Every new photo is checked against the exclusion list (the folder of images already
   used elsewhere, kept by the owner outside this repository) **before** it is used: no identical
   file, no other shot of the same scene taken minutes apart, no recognisable vehicle that also
   appears elsewhere.
3. **A photo shows what its caption says.** Never use one place to stand for another (no Pacific
   beach on the La Fortuna page): a stock photo of a Costa Rica place must really be that place
   (the source page says where it was taken). Generic "road / sunset / wildlife" pictures may be used
   generically, with an honest caption. **Vehicles:** a stock vehicle photo may be generic but must
   be the right body type, and its alt text / caption says **"Example vehicle"**, never "our car";
   the vehicle lists say "Photos show example vehicles".
4. **No identifiable people, readable licence plates, logos or watermarks.**
5. **No metadata.** Published files carry no EXIF, GPS, XMP, IPTC, camera, date or author data, and
   their file names are neutral (no original file names, dates or camera names). sRGB JPEG,
   quality ≈ 80, at most 2000 px on the long side for heroes and ≈ 1200 px for cards;
   `next/image` then serves AVIF / WebP at the size each screen needs.
6. **Alt text in English and Spanish** for every photo, in the registry. Credit: Costa Rica
   Private Transfers for our own photos; stock photos carry their licence name instead.

## Published photos (2026-11-10)

| File in `public/photos/` | Shows | Used on |
| :--- | :--- | :--- |
| `pacific-beach-aerial.jpg` | Long palm-lined beach from the air, Pacific coast | Home hero (behind the headline) |
| `pacific-bay-aerial.jpg` | Turquoise bay and forest, Nicoya Peninsula | About |
| `manuel-antonio-sunset.jpg` | Red sunset over the Pacific, Manuel Antonio | Route pages ending in Manuel Antonio; "Popular routes" card; the Arenal–Monteverde–Manuel Antonio trip card; Manuel Antonio destination guide and its card |
| `manuel-antonio-hills-sunset.jpg` | Sun rays over forested hills and sea, Manuel Antonio | Manuel Antonio day-tour card |
| `guanacaste-beach-sunset.jpg` | Sunset with headland and islets, Guanacaste | Route pages ending in Tamarindo / Guanacaste; "Popular routes" card; Tamarindo / Guanacaste destination guide and its card |
| `guanacaste-beach-islet.jpg` | Empty beach and islet, northern Guanacaste | Contact |
| `gulf-sunset-ferry.jpg` | Sunset from the ferry, Gulf of Nicoya | Our drivers |
| `gulf-ferry-crossing.jpg` | Car ferry in front of green hills | Home, "On the road" band |
| `route-27-highway.jpg` | Route 27 highway (vehicles small, plates unreadable) | Home, "On the road" band; How it works; "the drive" on San José → Manuel Antonio / Tamarindo |
| `central-valley-view.jpg` | Central Valley from the hills | Home, "On the road" band; "the drive" on other San José departures |
| `central-valley-dusk.jpg` | Hydrangeas and valley lights at dusk (Naranjo–Zarcero hills) | "The drive" on San José → La Fortuna |
| `mountain-sunset.jpg` | Sunset above the clouds, Talamanca | Home, "On the road" band |
| `sloth-resting.jpg` | Two-toed sloth, Puerto Viejo | Route page San José → Puerto Viejo; "Popular routes" card; Puerto Viejo destination guide and its card |
| `wildlife-sloth.jpg`, `wildlife-capuchin.jpg`, `wildlife-toucan.jpg`, `wildlife-blue-morpho.jpg`, `wildlife-dolphins.jpg`, `wildlife-deer.jpg` | Sloth, capuchin monkey, toucan, blue morpho, dolphins, white-tailed deer | Home, wildlife strip |

## Temporary stock photos in use (2026-11-11) — to be replaced by our own

All from Pexels, under the Pexels licence (checked on each photo's page: "Free", no editorial or
paid marker). Cropped, resized and re-saved without metadata like every other photo.

| File (`public/photos/` and `apps/client/assets/photos/`) | Shows | Source page | Used on |
| :--- | :--- | :--- | :--- |
| `monteverde-hanging-bridge.jpg` | Red hanging bridge in the Monteverde cloud forest (source: "Monteverde, Puntarenas Province, Costa Rica") | https://www.pexels.com/photo/iron-bridge-in-a-jungle-16806198/ | Website: route pages ending in Monteverde, Monteverde guide and cards, the Monteverde day-tour card. App: Monteverde trips, the Monteverde day tour |
| `drake-bay-coast.jpg` | The coast of Drake Bay from the air (source: "Bahía Drake, Provincia de Puntarenas, Costa Rica") | https://www.pexels.com/photo/aerial-photography-of-body-of-water-824223/ | Website: route pages ending in Sierpe / Drake Bay, Drake Bay guide and cards, the Sierpe & Caño Island day-tour card. App: Sierpe / Drake Bay / Osa trips, that day tour |
| `vehicle-economy.jpg` | Example vehicle: compact sedan | https://www.pexels.com/photo/white-car-on-the-roadside-9544521/ | Economy Sedan (website vehicle cards; app vehicle lists) |
| `vehicle-sedan.jpg` | Example vehicle: sedan | https://www.pexels.com/photo/sleek-white-car-parked-by-spring-blooms-37140081/ | Standard Sedan |
| `vehicle-mpv.jpg` | Example vehicle: minivan (MPV) | https://www.pexels.com/photo/sleek-modern-minivan-driving-on-scenic-road-30195580/ | Minivan (MPV) |
| `vehicle-4x4.jpg` | Example vehicle: large 4x4 | https://www.pexels.com/photo/black-suv-parked-on-road-at-sunset-37049414/ | Executive 4x4 |
| `vehicle-van.jpg` | Example vehicle: high-roof passenger van | https://www.pexels.com/photo/white-van-on-a-mountain-road-in-oman-37989724/ | Private Van |

The vehicle photos were not taken in Costa Rica and are not our vehicles: they only show the body
type, next to "… or similar" and "Photos show example vehicles". To replace any of these with an
own photo: clean it, save it under the same file name (or a new one and change the registry
line), and delete its row here and its `source` / `licence` in the registries.

## Placeholders (no suitable photo yet)

Where we have no photo, the same component draws a soft emerald / teal panel with a simple line
illustration: **Arenal Volcano itself**, **Corcovado**, **Poás**, and the **4x4 + Sierpe boat**
combo (no honest photo of that pairing). Still without a photo and not shown anywhere yet:
Tamarindo town and Puerto Viejo scenery.

Destination guides (2026-11-11) use the same picture as each town's route pages (`HUB_PHOTO` in
`src/lib/photos.ts`): our own photos for La Fortuna (`la-fortuna-hot-river.jpg`), Manuel Antonio,
Tamarindo / Guanacaste and Puerto Viejo; the temporary stock photos above for Monteverde and
Drake Bay. Airport guides have no picture: we have no photo of either airport, and no other place
may stand in for one.

## In the customer app (2026-11-11)

The app bundles a small set of the same pictures in `apps/client/assets/photos/` (about 1200 px
on the long side, 600 px for vehicles; about 1.5 MB in total), registered in
`apps/client/src/images.ts` (`PHOTOS`; the stock ones also in `STOCK_PHOTOS` with their source):

| App picture | File | Own / stock |
| :--- | :--- | :--- |
| La Fortuna / Arenal trips; the Arenal day tour (it ends in the hot springs) | `la-fortuna-hot-river.jpg` | Own |
| Manuel Antonio / Quepos trips | `manuel-antonio-sunset.jpg` | Own |
| The Manuel Antonio day tour | `manuel-antonio-hills-sunset.jpg` | Own |
| Tamarindo and the Guanacaste coast | `guanacaste-beach-sunset.jpg` | Own |
| Puerto Viejo | `sloth-resting.jpg` | Own |
| Monteverde trips; the Monteverde day tour | `monteverde-hanging-bridge.jpg` | Stock |
| Sierpe / Drake Bay / Osa trips; the Sierpe & Caño Island day tour | `drake-bay-coast.jpg` | Stock |
| Vehicle types (home "Choose your ride", "Choose your vehicle") | `vehicle-*.jpg` | Stock, "example vehicles" |

Everything else in the app keeps its drawing: the airports, Santa Teresa / Nicoya, sightseeing
stops, and places that only resemble one we have a photo of (Jacó, Uvita, Cahuita, Tortuguero,
Río Celeste, Corcovado, other volcanoes), so no place stands in for another. Image files reach
phones with an over-the-air update; no new build is needed.

To replace one: clean the photo (rules above), save it in `public/photos/`, and add `file`,
`width` and `height` to its line in `src/lib/photos.ts`. No page needs to change.

## Adding a photo: checklist

- Checked against the exclusion list (rule 2) and looked at full size (rule 4). For a stock
  photo: its Pexels / Unsplash page read (free licence, where it was taken), and its source page
  added to the table above and to the registries.
- Cropped, converted to sRGB, resized, saved as a new JPEG with a neutral name.
- Metadata check: the file must contain no APP1 (EXIF / XMP), APP2 (ICC) or APP13 (IPTC) blocks;
  `sips -g all <file>` must show no GPS, camera or author lines.
- Added to `src/lib/photos.ts` with English and Spanish alt text and a focal point, and to the
  table above with where it is used. For the app: saved smaller in `apps/client/assets/photos/`
  and added to `PHOTOS` in `apps/client/src/images.ts`.
