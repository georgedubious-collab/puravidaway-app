import { expect, type Browser, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Helpers for the full-trip browser tests. They only ever talk to the throwaway local database
 * started by `npm run e2e:full` (scripts/e2e-full.mjs): the address must be on this computer,
 * and the tests refuse to start otherwise.
 */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const MAIL = process.env.E2E_MAIL_URL ?? "http://127.0.0.1:54324";

if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_)) {
  throw new Error(`The full browser tests only run against the local test database, not "${URL_}". Start them with: npm run e2e:full`);
}

/** The server's own access to the test database, to prepare accounts and read results. */
export const db: SupabaseClient = createClient(URL_, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

export const PEOPLE = {
  admin: { email: "team@example.test", name: "Test Team" },
  driver: { email: "driver@example.test", name: "Diego Conductor" },
  outsider: { email: "other-driver@example.test", name: "Olga Pendiente" },
  traveller: { email: "traveller@example.test", name: "Tessa Traveller", phone: "+1 555 123 4567" },
} as const;

async function account(email: string, name: string, role: "admin" | "driver"): Promise<string> {
  const made = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } });
  if (made.error) throw new Error(`create ${email}: ${made.error.message}`);
  const id = made.data.user.id;
  const upd = await db.from("profiles").update({ role, full_name: name, app_lang: "en" }).eq("id", id);
  if (upd.error) throw new Error(`role for ${email}: ${upd.error.message}`);
  return id;
}

/** One team member, one approved driver with an approved 4-seat car, one driver still waiting for approval. */
export async function prepareAccounts(): Promise<{ adminId: string; driverId: string; outsiderId: string; vehicleId: string }> {
  const adminId = await account(PEOPLE.admin.email, PEOPLE.admin.name, "admin");
  const driverId = await account(PEOPLE.driver.email, PEOPLE.driver.name, "driver");
  const outsiderId = await account(PEOPLE.outsider.email, PEOPLE.outsider.name, "driver");

  const drivers = await db.from("drivers").insert([
    { id: driverId, kyc_status: "approved", license_expiry: "2099-01-01", home_hub: "SJO", documents: { license: `${driverId}/license-0.pdf` } },
    { id: outsiderId, kyc_status: "pending", home_hub: "SJO", documents: {} },
  ]);
  if (drivers.error) throw new Error(`drivers: ${drivers.error.message}`);

  const vehicle = await db
    .from("driver_vehicles")
    .insert({
      driver_id: driverId,
      status: "approved",
      vehicle_class: "sedan",
      make_model: "Toyota Corolla",
      plate: "TST123",
      year: 2023,
      color: "White",
      passenger_capacity: 4,
      ins_insurance_expiry: "2099-01-01",
      dekra_inspection_expiry: "2099-01-01",
      marchamo_year: 2099,
      documents: {
        insurance: `${driverId}/vehicles/1/insurance-0.pdf`,
        dekra: `${driverId}/vehicles/1/dekra-0.pdf`,
        marchamo: `${driverId}/vehicles/1/marchamo-0.pdf`,
      },
      photos: [`${driverId}/vehicles/1/photo-0.jpg`, `${driverId}/vehicles/1/photo-1.jpg`],
    })
    .select("id")
    .single();
  if (vehicle.error) throw new Error(`vehicle: ${vehicle.error.message}`);
  return { adminId, driverId, outsiderId, vehicleId: vehicle.data.id };
}

/** The newest sign-in code emailed to this address (read from the local test inbox). */
async function signInCode(email: string, after: number): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const list = (await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json()) as {
      messages: { ID: string; Created: string }[];
    };
    const fresh = list.messages.filter((m) => new Date(m.Created).getTime() >= after - 2000);
    if (fresh.length) {
      const msg = (await (await fetch(`${MAIL}/api/v1/message/${fresh[0].ID}`)).json()) as { HTML: string; Text: string };
      const code = `${msg.HTML} ${msg.Text}`.match(/\b(\d{6})\b/);
      if (code) return code[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No sign-in email arrived for ${email}`);
}

/** Signs in through the real /login page: ask for a code, read it from the test inbox, type it in. */
export async function signIn(browser: Browser, email: string, next: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const started = Date.now();
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('button[type="submit"]').first().click();
  const codeBox = page.locator('input[inputmode="numeric"]');
  await expect(codeBox).toBeVisible();
  await codeBox.fill(await signInCode(email, started));
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
  return page;
}

/** "$1,234.50" → 1234.5 */
export const dollars = (text: string | null): number => {
  const m = (text ?? "").match(/\$([\d,]+(?:\.\d{2})?)/);
  if (!m) throw new Error(`No price in "${text}"`);
  return Number(m[1].replace(/,/g, ""));
};
