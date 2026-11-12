import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogData } from "./catalogModel";
import {
  PROMO_FAILED_CHECKS_PER_HOUR,
  PROMO_INVALID_ERROR,
  PROMO_RATE_LIMIT_ERROR,
  applyPromo,
  normalizePromoCode,
  promoProblem,
  type PromoCodeRow,
  type PromoItemInput,
  type PromoResult,
} from "./promo";

/**
 * Checking a promo code on the server (rules: src/lib/promo.ts). Uses the service-role client:
 * travellers never read promo_codes or promo_redemptions themselves (migration 0052).
 */

export type PromoCheck =
  | { ok: true; code: PromoCodeRow; result: PromoResult }
  | { ok: false; error: string; rateLimited?: boolean };

const COLUMNS =
  "id, code, description, discount_type, value, applies_to, min_order, valid_from, valid_to, max_uses, max_uses_per_email, active";

/**
 * Is `raw` a code these items can use, for this email? Every wrong code counts towards the
 * per-network limit (PROMO_FAILED_CHECKS_PER_HOUR an hour), so codes can't be guessed; a right
 * one doesn't. The traveller only ever sees "This code isn't valid." (no hint why).
 */
export async function checkPromo(
  db: SupabaseClient,
  input: { raw: unknown; email: string | null; ip: string; today: string; items: PromoItemInput[]; catalog: CatalogData },
): Promise<PromoCheck> {
  const allowed = await db.rpc("promo_check_allowed", { p_ip: input.ip, p_limit: PROMO_FAILED_CHECKS_PER_HOUR });
  if (allowed.error) {
    console.error("[promo] rate limit", allowed.error.message);
    return { ok: false, error: PROMO_INVALID_ERROR };
  }
  if (allowed.data !== true) return { ok: false, error: PROMO_RATE_LIMIT_ERROR, rateLimited: true };

  const fail = async (): Promise<PromoCheck> => {
    const r = await db.rpc("promo_check_failed", { p_ip: input.ip });
    if (r.error) console.error("[promo] record failure", r.error.message);
    return { ok: false, error: PROMO_INVALID_ERROR };
  };

  const code = normalizePromoCode(input.raw);
  if (!code) return fail();
  const { data, error } = await db.from("promo_codes").select(COLUMNS).eq("code", code) /* stored upper-case by the database */.maybeSingle<PromoCodeRow>();
  if (error) {
    console.error("[promo] load", error.message);
    return { ok: false, error: PROMO_INVALID_ERROR };
  }
  if (!data) return fail();
  const usage = await db.rpc("promo_usage", { p_code_id: data.id, p_email: input.email ?? "" }).single<{ total: number; by_email: number }>();
  if (usage.error) {
    console.error("[promo] usage", usage.error.message);
    return { ok: false, error: PROMO_INVALID_ERROR };
  }
  const problem = promoProblem(data, {
    today: input.today,
    usesTotal: Number(usage.data?.total ?? 0),
    // Without an email yet (the app before sign-in), the per-email limit is checked when the trip is sent.
    usesByEmail: input.email ? Number(usage.data?.by_email ?? 0) : 0,
    items: input.items,
  });
  if (problem) return fail();
  const result = applyPromo(data, input.items, input.catalog);
  if (result.totalDiscountCents <= 0) return fail();
  return { ok: true, code: data, result };
}
