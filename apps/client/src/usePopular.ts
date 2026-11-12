import { useEffect, useState } from "react";
import { useBooking } from "./booking";
import { useDemo } from "./demo";
import { useT } from "./i18n";
import { popularPrices, vehicleClasses, type PopularPrice, type VehicleClass } from "./prices";

/**
 * "From $X" and the drive time of our most asked-for routes (keyed "SJO>Arenal"), for
 * the day and group size being planned. Asked from the server one route at a
 * time and kept on the phone for 12 hours (src/prices.ts). `done` turns true
 * once every answer is in, so a route without a price stops showing a placeholder.
 */
export function usePopular(): { prices: Record<string, PopularPrice>; done: boolean } {
  const demo = useDemo();
  const { state } = useBooking();
  const { date, pax } = state;
  const [prices, setPrices] = useState<Record<string, PopularPrice>>(demo?.popular ?? {});
  const [done, setDone] = useState(Boolean(demo && !demo.loading));

  useEffect(() => {
    if (demo) return;
    let live = true;
    void popularPrices(date, pax, (p) => {
      if (live) setPrices(p);
    }).then(() => {
      if (live) setDone(true);
    });
    return () => {
      live = false;
    };
  }, [date, pax, demo]);

  return { prices: demo?.loading ? {} : prices, done };
}

/**
 * Our vehicle types for the home screen, in the app's language (src/prices.ts
 * vehicleClasses). `classes` is null while loading and after a failure;
 * `failed` tells the two apart so the section can hide quietly.
 */
export function useVehicleClasses(): { classes: VehicleClass[] | null; failed: boolean } {
  const demo = useDemo();
  const { lang } = useT();
  const [got, setGot] = useState<{ lang: string; classes: VehicleClass[] | null } | null>(null);

  useEffect(() => {
    if (demo) return;
    let live = true;
    void vehicleClasses(lang).then((classes) => {
      if (live) setGot({ lang, classes });
    });
    return () => {
      live = false;
    };
  }, [lang, demo]);

  if (demo) return { classes: demo.loading ? null : (demo.vehicles ?? null), failed: !demo.loading && !demo.vehicles };
  // An answer in the other language is not shown: the placeholders come back until the right one is in.
  const mine = got && got.lang === lang ? got : null;
  return { classes: mine?.classes ?? null, failed: Boolean(mine && !mine.classes) };
}
