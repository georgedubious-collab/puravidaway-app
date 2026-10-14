-- Initial catalog, generated from src/lib/catalog.ts by scripts/generate-catalog-seed.mjs.
-- `on conflict do nothing` so re-running never overwrites prices edited in /admin.

insert into public.vehicle_classes (id, name, base_rate, max_pax, luggage, badge, only_for_hubs, sort_order) values ('suv', 'Standard Comfort SUV', 175.00, 4, '4 suitcases', 'Most popular', '{}'::text[], 0) on conflict (id) do nothing;
insert into public.vehicle_classes (id, name, base_rate, max_pax, luggage, badge, only_for_hubs, sort_order) values ('4x4', 'Executive 4x4 (Prado / Fortuner)', 215.00, 4, '4 suitcases', 'Osa / Monteverde roads', '{}'::text[], 1) on conflict (id) do nothing;
insert into public.vehicle_classes (id, name, base_rate, max_pax, luggage, badge, only_for_hubs, sort_order) values ('van', 'Private Toyota HiAce / Hyundai Staria', 245.00, 10, '10 suitcases', 'Families & groups', '{}'::text[], 2) on conflict (id) do nothing;
insert into public.vehicle_classes (id, name, base_rate, max_pax, luggage, badge, only_for_hubs, sort_order) values ('sierpe_combo', '4x4 Transfer + Sierpe River Boat', 290.00, 4, 'Wet/dry assist', 'Drake Bay / Corcovado', array['Sierpe', 'DrakeBay']::text[], 3) on conflict (id) do nothing;

insert into public.sightseeing_stops (id, name, description, duration_min, price, corridors, sort_order) values ('tarcoles', 'Tárcoles Crocodile Bridge', 'Watch 15-ft American crocodiles from the famous bridge while your driver stays with the bags.', 45, 25.00, array['SJO', 'ManuelAntonio', 'Sierpe', 'DrakeBay']::text[], 0) on conflict (id) do nothing;
insert into public.sightseeing_stops (id, name, description, duration_min, price, corridors, sort_order) values ('carara', 'Carara National Park Scarlet Macaw Walk', 'Guided trail walk through transitional rainforest full of wild scarlet macaws.', 90, 55.00, array['SJO', 'ManuelAntonio', 'Sierpe', 'DrakeBay']::text[], 1) on conflict (id) do nothing;
insert into public.sightseeing_stops (id, name, description, duration_min, price, corridors, sort_order) values ('poas', 'Poás Volcano Crater & Doka Coffee Estate', 'Peer into an active turquoise crater lake, then sample highland Arabica coffee. Timed-entry tickets required.', 120, 68.00, array['SJO', 'Arenal']::text[], 2) on conflict (id) do nothing;
insert into public.sightseeing_stops (id, name, description, duration_min, price, corridors, sort_order) values ('rioceleste', 'Río Celeste Waterfall Hike', 'Hike to the sky-blue river inside Tenorio Volcano National Park.', 120, 65.00, array['Arenal', 'LIR', 'Tamarindo']::text[], 3) on conflict (id) do nothing;
insert into public.sightseeing_stops (id, name, description, duration_min, price, corridors, sort_order) values ('sloth', 'La Fortuna Sloth & Wildlife Sanctuary Trail', 'Spot two- and three-toed sloths on a guided boardwalk trail near La Fortuna.', 75, 48.00, array['Arenal']::text[], 4) on conflict (id) do nothing;

insert into public.day_tours (id, region, name, highlights, duration_hours, price, en_route_upgrade_price, sort_order) values ('dt1', 'Arenal', 'Arenal Volcano 1968 Lava Trails, La Fortuna Waterfall & Hot Springs', array['Lava-field trails', 'La Fortuna Waterfall', 'Hot springs soak']::text[], 8, 145.00, 65.00, 0) on conflict (id) do nothing;
insert into public.day_tours (id, region, name, highlights, duration_hours, price, en_route_upgrade_price, sort_order) values ('dt2', 'ManuelAntonio', 'Manuel Antonio National Park Wildlife Walk + Catamaran Snorkel', array['Naturalist guide & scope', 'Sloths, monkeys, toucans', 'Afternoon catamaran']::text[], 7.5, 155.00, 65.00, 1) on conflict (id) do nothing;
insert into public.day_tours (id, region, name, highlights, duration_hours, price, en_route_upgrade_price, sort_order) values ('dt3', 'Osa', 'Sierpe Mangrove Boat Safari & Caño Island Snorkeling', array['Mangrove wildlife', 'Caño Island reef', 'Dolphins in season']::text[], 7, 165.00, 65.00, 2) on conflict (id) do nothing;
insert into public.day_tours (id, region, name, highlights, duration_hours, price, en_route_upgrade_price, sort_order) values ('dt4', 'Monteverde', 'Monteverde Hanging Bridges, Zipline & Night Walk', array['Cloud-forest canopy', 'Zipline', 'Guided night walk']::text[], 7, 140.00, 65.00, 3) on conflict (id) do nothing;

insert into public.expeditions (id, name, days, nights, base_price, includes, itinerary, sort_order) values ('md1', 'Corcovado National Park — Overnight at Sirena Station (via Sierpe)', 3, 2, 695.00, array['Sierpe → Drake Bay → Sirena boat transfers', 'Official SINAC overnight permits', 'Meals at Sirena Ranger Station', 'Certified Osa naturalist guide']::text[], '[{"day":1,"title":"Sierpe mangroves → Drake Bay, sunset on the beach"},{"day":2,"title":"Boat to Sirena, full day of trails, overnight in the park"},{"day":3,"title":"Dawn wildlife walk, boat back to Sierpe"}]'::jsonb, 0) on conflict (id) do nothing;
insert into public.expeditions (id, name, days, nights, base_price, includes, itinerary, sort_order) values ('md2', 'Classic Costa Rica Trifecta: Arenal, Monteverde & Manuel Antonio', 7, 6, 1290.00, array['Door-to-door sightseeing transfers', 'Lake Arenal boat crossing', 'Monteverde hanging bridges', 'Manuel Antonio guided tour', '24/7 WhatsApp concierge']::text[], '[{"day":1,"title":"SJO → La Fortuna with Poás Volcano stop"},{"day":2,"title":"Arenal lava trails & hot springs"},{"day":3,"title":"Lake Arenal boat crossing → Monteverde"},{"day":4,"title":"Hanging bridges, zipline & night walk"},{"day":5,"title":"Monteverde → Manuel Antonio with Tárcoles stop"},{"day":6,"title":"Manuel Antonio NP wildlife walk & catamaran"},{"day":7,"title":"Manuel Antonio → SJO"}]'::jsonb, 1) on conflict (id) do nothing;

insert into public.lodging_tiers (id, name, surcharge, sort_order) values ('base', 'Base (ranger station / standard)', 0.00, 0) on conflict (id) do nothing;
insert into public.lodging_tiers (id, name, surcharge, sort_order) values ('boutique', '4-star boutique eco-resort', 280.00, 1) on conflict (id) do nothing;
insert into public.lodging_tiers (id, name, surcharge, sort_order) values ('luxury', '5-star luxury lodge', 650.00, 2) on conflict (id) do nothing;

insert into public.seasons (id, name, multiplier, priority, is_default) values ('green', 'Green season', 1.00, 0, true) on conflict (id) do nothing;
insert into public.seasons (id, name, multiplier, priority, is_default) values ('high', 'High season (Dec–Apr)', 1.15, 1, false) on conflict (id) do nothing;
insert into public.seasons (id, name, multiplier, priority, is_default) values ('peak', 'Peak holiday (Christmas / New Year / Easter)', 1.25, 2, false) on conflict (id) do nothing;

-- Season dates for the next few travel years. Add more years from /admin.
insert into public.season_ranges (season_id, starts_on, ends_on, note) values
('high', '2026-12-01', '2027-04-30', 'Dry season 2026–27'),
('peak', '2026-12-20', '2027-01-05', 'Christmas & New Year 2026–27'),
('high', '2027-12-01', '2028-04-30', 'Dry season 2027–28'),
('peak', '2027-12-20', '2028-01-05', 'Christmas & New Year 2027–28'),
('high', '2028-12-01', '2029-04-30', 'Dry season 2028–29'),
('peak', '2028-12-20', '2029-01-05', 'Christmas & New Year 2028–29'),
('high', '2029-12-01', '2030-04-30', 'Dry season 2029–30'),
('peak', '2029-12-20', '2030-01-05', 'Christmas & New Year 2029–30'),
('high', '2030-12-01', '2031-04-30', 'Dry season 2030–31'),
('peak', '2030-12-20', '2031-01-05', 'Christmas & New Year 2030–31'),
('peak', '2027-03-21', '2027-03-28', 'Semana Santa 2027'),
('peak', '2028-04-09', '2028-04-16', 'Semana Santa 2028'),
('peak', '2029-03-25', '2029-04-01', 'Semana Santa 2029'),
('peak', '2030-04-14', '2030-04-21', 'Semana Santa 2030'),
('peak', '2031-04-06', '2031-04-13', 'Semana Santa 2031');
