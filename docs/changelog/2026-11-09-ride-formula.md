- 2026-11-09 — Claude — Pricing step 1 (docs/PRICING.md §7, migration 0013): rides are priced by
  formula instead of a flat rate per vehicle: max($110, $35 + $0.70/km + $12/driving hour) ×
  vehicle factor × pickup-town area factor (+ $75 boat on the Sierpe combo), rounded to whole
  dollars, then stops and season. Road-km table for all 36 town pairs next to the drive times.
  New Economy Sedan (×0.90, Spanish-speaking driver, direct ride: no stops, enforced on the
  server) and Standard Sedan (×1.00, new default); SUV 1.20, 4x4 1.30, Van 1.35. `/admin/pricing`
  edits the formula (with a live example table), area factors and vehicle factors. If 0013 isn't
  run yet the site uses the same numbers built in. 202 database checks.
