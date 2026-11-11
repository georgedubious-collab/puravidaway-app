/** Small helpers that keep the corridor data readable: English first, Spanish second. */
import type { L, OtherWay } from "../guides/types";
import type { RouteFaq } from "./types";

/** Date the route pages' facts were last checked; shown on every page. Bump it after a re-check. */
export const ROUTES_UPDATED = "2026-11-11";

export const l = (en: string, es: string): L => ({ en, es });

export const q = (qEn: string, qEs: string, aEn: string, aEs: string): RouteFaq => ({ q: l(qEn, qEs), a: l(aEn, aEs) });

export const way = (kind: OtherWay["kind"], en: string, es: string): OtherWay => ({ kind, text: l(en, es) });
