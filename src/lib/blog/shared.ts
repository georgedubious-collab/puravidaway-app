/**
 * Small helpers and texts shared by several travel-guide articles (rules: ./types.ts).
 * Service wording repeats src/lib/trust.ts and src/lib/faq.ts; nothing new is promised here.
 */
import type { HubId } from "../catalog";
import type { ArticleBlock, GuideFaq, L } from "./types";

export const l = (en: string, es: string): L => ({ en, es });
export const p = (en: string, es: string): ArticleBlock => ({ kind: "p", text: { en, es } });
export const note = (en: string, es: string): ArticleBlock => ({ kind: "note", text: { en, es } });
export const list = (...items: [string, string][]): ArticleBlock => ({ kind: "list", items: items.map(([en, es]) => ({ en, es })) });
export const faq = (qEn: string, qEs: string, aEn: string, aEs: string): GuideFaq => ({ q: { en: qEn, es: qEs }, a: { en: aEn, es: aEs } });

/** Date the first articles were written and checked. */
export const FIRST_ISSUE = "2026-11-11";

/** What a private transfer includes, as the site already states it (trust.ts, faq.ts). */
export function includedBlock(airport: boolean): ArticleBlock {
  return airport
    ? p(
        "On an airport pickup your driver waits at arrivals holding a sign with your name (or the text you choose when you book). We follow your flight, and the driver waits up to 60 minutes free after it actually lands. Child seats and booster seats are free on request, and you can ask for an electric vehicle at the same price, if one is available. {night} Cancellation is free up to 24 hours before pickup ([cancellation policy](/cancellation)).",
        "En una recogida en el aeropuerto, su conductor lo espera en la salida de llegadas con un rótulo con su nombre (o con el texto que usted elija al reservar). Damos seguimiento a su vuelo, y el conductor espera hasta 60 minutos gratis después del aterrizaje real. Las sillas para niños y los boosters (asientos elevadores) son gratis a solicitud, y puede pedir un vehículo eléctrico al mismo precio, si hay disponible. {night} La cancelación es gratuita hasta 24 horas antes de la recogida ([política de cancelación](/cancellation)).",
      )
    : p(
        "Your driver picks you up at the door of your hotel or rental and waits up to 60 minutes after your pickup time, so there is no rush at check-out. Child seats and booster seats are free on request, and you can ask for an electric vehicle at the same price, if one is available. {night} Cancellation is free up to 24 hours before pickup ([cancellation policy](/cancellation)).",
        "Su conductor lo recoge en la puerta de su hotel o alojamiento y espera hasta 60 minutos después de la hora de recogida, así que no hay prisa a la salida. Las sillas para niños y los boosters (asientos elevadores) son gratis a solicitud, y puede pedir un vehículo eléctrico al mismo precio, si hay disponible. {night} La cancelación es gratuita hasta 24 horas antes de la recogida ([política de cancelación](/cancellation)).",
      );
}

/** The vehicle classes, explained once: Economy is the "from" price. */
export function classesIntro(o: HubId, d: HubId): ArticleBlock {
  return p(
    `Prices are for the whole vehicle, not per person, and fixed before you book. The "from" price, {price:${o}>${d}}, is our {class:${o}>${d}} class: a direct ride (no sightseeing stops) with a Spanish-speaking driver. The other classes allow stops, and you can ask for an English-speaking driver when you book. Shared by a full group, the lowest price works out at {pp:${o}>${d}} per traveller ({ppPax:${o}>${d}} travellers in the {ppClass:${o}>${d}}).`,
    `Los precios son por el vehículo completo, no por persona, y quedan fijos antes de reservar. El precio "desde", {price:${o}>${d}}, corresponde a nuestra categoría {class:${o}>${d}}: un traslado directo (sin paradas turísticas) con un conductor de habla hispana. Las demás categorías permiten paradas, y al reservar puede pedir un conductor que hable inglés. Compartido por un grupo completo, el precio más bajo sale a {pp:${o}>${d}} por viajero ({ppPax:${o}>${d}} viajeros en la categoría {ppClass:${o}>${d}}).`,
  );
}

/** How to compare a per-seat shuttle with a per-vehicle private ride. */
export function shuttleMath(o: HubId, d: HubId): ArticleBlock {
  return p(
    `The quick test: multiply the shuttle's seat price by the number of people in your group and compare the total with {price:${o}>${d}} for a whole private vehicle. For one or two travellers the shuttle usually wins on price; for three or more the gap closes fast, and the private ride leaves when you want, goes straight to your door and can stop on the way.`,
    `La prueba rápida: multiplique el precio del asiento en el shuttle por el número de personas de su grupo y compare el total con {price:${o}>${d}} por un vehículo privado completo. Para una o dos personas el shuttle suele ganar en precio; para tres o más la diferencia se achica rápido, y el traslado privado sale cuando usted quiere, va directo a su puerta y puede parar en el camino.`,
  );
}

/** Driving yourself: the facts every rental-car paragraph needs. */
export const RENTAL_FACTS: ArticleBlock = list(
  [
    "Costa Rica requires third-party liability insurance on every rental, and rental companies add it to the advertised daily rate. A credit card's rental cover does not replace it, so ask for the full price with insurance before you compare.",
    "Costa Rica exige un seguro de responsabilidad civil ante terceros en todo alquiler, y las arrendadoras lo suman a la tarifa diaria anunciada. La cobertura de alquiler de una tarjeta de crédito no lo reemplaza, así que pida el precio total con seguro antes de comparar.",
  ],
  [
    "Night falls around 6 pm all year. Mountain roads are narrow, often foggy and poorly lit, and shared with trucks, cyclists and people on foot: plan long drives for daylight.",
    "Anochece hacia las 6 p. m. todo el año. Las carreteras de montaña son angostas, muchas veces con neblina y poca iluminación, y las comparten camiones, ciclistas y peatones: planifique los recorridos largos con luz de día.",
  ],
  [
    "Add fuel, parking at your hotels and, on some highways, tolls. Many rental offices are a short shuttle ride from the airport terminal, which adds time on arrival.",
    "Sume combustible, parqueo en los hoteles y, en algunas carreteras, peajes. Muchas arrendadoras tienen la oficina a un trayecto corto en su transporte desde la terminal del aeropuerto, lo que suma tiempo al llegar.",
  ],
);
