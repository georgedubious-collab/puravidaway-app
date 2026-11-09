-- Price level (Jorge, 2026-11-09): on par with, or a few dollars under, Daytrip's lowest
-- published prices, so partner drivers earn a proper rate (docs/PRICING.md §8 #1).
-- Replaces the 10–20%-below starting numbers from 0013:
--   base $30 + $0.90 per km + $10 per driving hour, minimum $120
--   SJO → La Fortuna $162 (Daytrip $161), Manuel Antonio $202 ($205), Tamarindo $324 ($338).
-- Run after 0015. Re-running resets the formula to these numbers (later edits are made at
-- /admin/pricing), so run it once.

update public.pricing_settings
   set ride_base_fare    = 30,
       ride_per_km       = 0.90,
       ride_per_hour     = 10,
       ride_minimum_fare = 120;
