import { useEffect, useState } from "react";
import { useBooking } from "./booking";
import { useDemo } from "./demo";
import { popularPrices, type PopularPrice } from "./prices";

/**
 * "From $X" and the drive time of the popular rides (keyed "SJO>Arenal"), for
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
