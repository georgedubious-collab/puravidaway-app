-- Sightseeing stop corridors, for the new "both ends" rule (PROJECT.md §5.2, §9 #4):
-- a stop with two or more hubs is offered only when BOTH the pickup and the drop-off
-- are on its list (it sits on the road between them); a stop with a single hub is in
-- that town and is offered on any ride to or from it. No road stops on the Sierpe ↔
-- Drake Bay boat (enforced in the app).
--
-- Plain UPDATEs: safe to run more than once. Only the corridor lists change; prices,
-- names and Live switches edited in /admin are left alone.

-- Tárcoles and Carara: Route 34, just south of the Route 27 exit.
update public.sightseeing_stops
   set corridors = array['SJO', 'Monteverde', 'ManuelAntonio', 'Sierpe', 'DrakeBay']::text[]
 where id in ('tarcoles', 'carara');

-- Poás: the scenic SJO ↔ La Fortuna road (Vara Blanca).
update public.sightseeing_stops
   set corridors = array['SJO', 'Arenal']::text[]
 where id = 'poas';

-- Río Celeste (Bijagua): the Arenal ↔ Liberia road. Not LIR ↔ Tamarindo, which goes the other way.
update public.sightseeing_stops
   set corridors = array['Arenal', 'LIR']::text[]
 where id = 'rioceleste';

-- Sloth trail: in La Fortuna itself.
update public.sightseeing_stops
   set corridors = array['Arenal']::text[]
 where id = 'sloth';
