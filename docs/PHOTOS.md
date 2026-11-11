# Photos on the website

All pictures on the public site go through one registry, `src/lib/photos.ts`, and one component,
`src/components/site/Photo.tsx`. The files live in `public/photos/`.

## Rules

1. **Our own photos only.** Never stock photos or pictures downloaded from the web.
2. **One business per photo.** A photo used on this site must never be used by any other business
   (including the owner's other projects), and a photo used by another business must never be
   used here. Every new photo is checked against the exclusion list (the folder of images already
   used elsewhere, kept by the owner outside this repository) **before** it is used: no identical
   file, no other shot of the same scene taken minutes apart, no recognisable vehicle that also
   appears elsewhere.
3. **A photo shows what its caption says.** Never use one place to stand for another (no Pacific
   beach on the La Fortuna page). Generic "road / sunset / wildlife" pictures may be used
   generically, with an honest caption.
4. **No identifiable people, readable licence plates, logos or watermarks.**
5. **No metadata.** Published files carry no EXIF, GPS, XMP, IPTC, camera, date or author data, and
   their file names are neutral (no original file names, dates or camera names). sRGB JPEG,
   quality ≈ 80, at most 2000 px on the long side for heroes and ≈ 1200 px for cards;
   `next/image` then serves AVIF / WebP at the size each screen needs.
6. **Alt text in English and Spanish** for every photo, in the registry. Credit: Costa Rica
   Private Transfers.

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

## Placeholders (no suitable photo yet)

Where we have no photo, the same component draws a soft emerald / teal panel with a simple line
illustration: **Arenal / La Fortuna**, **Monteverde**, **Sierpe / Drake Bay**, **Corcovado**,
**Poás**, and **every vehicle class** (sedan, minivan / MPV, 4x4, van, 4x4 + boat). Still without a photo
and not shown anywhere yet: Tamarindo town and Puerto Viejo scenery.

Destination guides (2026-11-11) use the same picture as each town's route pages (`HUB_PHOTO` in
`src/lib/photos.ts`): real photos for La Fortuna (`la-fortuna-hot-river.jpg`), Manuel Antonio,
Tamarindo / Guanacaste and Puerto Viejo, placeholders for Monteverde and Drake Bay. Airport guides
have no picture: we have no photo of either airport, and no other place may stand in for one.

To replace one: clean the photo (rules above), save it in `public/photos/`, and add `file`,
`width` and `height` to its line in `src/lib/photos.ts`. No page needs to change.

## Adding a photo: checklist

- Checked against the exclusion list (rule 2) and looked at full size (rule 4).
- Cropped, converted to sRGB, resized, saved as a new JPEG with a neutral name.
- Metadata check: the file must contain no APP1 (EXIF / XMP), APP2 (ICC) or APP13 (IPTC) blocks;
  `sips -g all <file>` must show no GPS, camera or author lines.
- Added to `src/lib/photos.ts` with English and Spanish alt text and a focal point, and to the
  table above with where it is used.
