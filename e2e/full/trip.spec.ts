import { expect, test, type Page } from "@playwright/test";
import { db, dollars, PEOPLE, prepareAccounts, signIn } from "./support";

/**
 * One trip from start to finish, each person in their own browser:
 * traveller books → team posts the job → driver offers → team accepts → driver drives →
 * traveller rates. Along the way: nobody sees what isn't theirs, and the money adds up.
 */
test.describe.configure({ mode: "serial" });

let ids: Awaited<ReturnType<typeof prepareAccounts>>;
let bookingRef = "";
let bookingId = "";
let tripUrl = "";
let price = 0;
let payout = 0;
let offer = 0;

test.beforeAll(async () => {
  ids = await prepareAccounts();
});

const booking = async () => {
  const { data, error } = await db.from("bookings").select("*").eq("id", bookingId).single();
  if (error) throw new Error(error.message);
  return data;
};

test("1. a traveller books a ride and gets a private trip page", async ({ page }) => {
  await page.goto("/");
  price = dollars(await page.getByText(/^Total private ride$/).first().locator("..").textContent());
  await page.getByRole("button", { name: "Add this ride to your trip" }).first().click();
  await page.getByRole("button", { name: "Review & book" }).click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Send trip request" }) });
  await form.getByLabel("Full name").fill(PEOPLE.traveller.name);
  await form.getByRole("textbox", { name: "Email" }).fill(PEOPLE.traveller.email);
  await form.getByLabel(/Mobile number/).fill(PEOPLE.traveller.phone);
  await form.getByRole("button", { name: "Send trip request" }).click();

  const done = page.getByRole("status").filter({ hasText: "Request sent" });
  await expect(done).toBeVisible();
  bookingRef = (await done.textContent())!.match(/CRPT-\d+/)![0];
  tripUrl = (await done.getByRole("link", { name: /Open your trip page/ }).getAttribute("href"))!;

  // What was saved is what was shown, and the company's share plus the driver's is the price.
  const { data } = await db.from("bookings").select("*").eq("booking_ref", bookingRef).single();
  bookingId = data.id;
  payout = Number(data.driver_payout);
  expect(Number(data.total_price)).toBe(price);
  expect(data.status).toBe("pending_payment");
  expect(payout).toBeGreaterThan(0);
  expect(payout).toBeLessThan(price);
  expect(Number(data.platform_fee) + payout).toBeCloseTo(price, 2);

  await page.goto(tripUrl);
  await expect(page.getByText(bookingRef).first()).toBeVisible();
});

test("2. a wrong trip address shows nothing", async ({ page }) => {
  const wrong = tripUrl.slice(0, -4) + (tripUrl.endsWith("aaaa") ? "bbbb" : "aaaa");
  const response = await page.goto(wrong);
  expect(response?.status()).toBe(404);
  await expect(page.getByText(bookingRef)).toHaveCount(0);
  await expect(page.getByText(PEOPLE.traveller.name)).toHaveCount(0);
});

test("3. signed-out visitors and drivers cannot open the team's pages", async ({ page, browser }) => {
  await page.goto(`/admin/bookings/${bookingId}`);
  await expect(page).toHaveURL(/\/login/);
  const driver = await signIn(browser, PEOPLE.driver.email, "/driver");
  await driver.goto(`/admin/bookings/${bookingId}`);
  await expect(driver.getByText(bookingRef)).toHaveCount(0);
  await expect(driver.getByText(PEOPLE.traveller.email)).toHaveCount(0);
  await driver.context().close();
});

/** Clicks a team or driver action button and, if the page asks "are you sure?", confirms it. */
async function act(page: Page, button: RegExp, confirm?: RegExp) {
  await page.getByRole("button", { name: button }).filter({ visible: true }).first().click();
  if (confirm) await page.getByRole("button", { name: confirm }).filter({ visible: true }).first().click();
}

test("4. the team posts the ride to the drivers' job board", async ({ browser }) => {
  const team = await signIn(browser, PEOPLE.admin.email, `/admin/bookings/${bookingId}`);
  await expect(team.getByText(bookingRef).first()).toBeVisible();
  await act(team, /Publicar para conductores|Post to drivers/, /Sí, publicar|Yes, post it/);
  await expect.poll(async () => (await booking()).status).toBe("pending_bids");
  await team.context().close();
});

test("5. a driver waiting for approval sees no jobs", async ({ browser }) => {
  const outsider = await signIn(browser, PEOPLE.outsider.email, "/driver/jobs");
  await outsider.goto("/driver/jobs");
  await expect(outsider.getByText(/Suggested payout|Pago sugerido/)).toHaveCount(0);
  await expect(outsider.getByText("Manuel Antonio")).toHaveCount(0);
  await outsider.context().close();
});

test("6. the approved driver sees the job with their payout only, and sends an offer", async ({ browser }) => {
  const driver = await signIn(browser, PEOPLE.driver.email, "/driver/jobs");
  await driver.goto("/driver/jobs");
  // The board shows whole dollars.
  const suggested = dollars(await driver.getByText(/Suggested payout|Pago sugerido/).first().locator("..").textContent());
  expect(suggested).toBe(Math.round(payout));

  // Never the client's price or who the client is.
  const text = await driver.locator("body").innerText();
  expect(text).not.toContain(`$${price}`);
  expect(text).not.toContain(PEOPLE.traveller.name);
  expect(text).not.toContain(PEOPLE.traveller.email);
  expect(text).not.toContain("555 123 4567");

  await act(driver, /Send my offer|Enviar mi oferta/);
  await expect(driver.getByText(/waiting for the team|esperando al equipo/)).toBeVisible();
  const { data: offers } = await db.from("bids").select("bid_amount, status, driver_id").eq("booking_id", bookingId);
  expect(offers).toHaveLength(1);
  offer = Number(offers![0].bid_amount);
  console.log(`offer sent: $${offer} (suggested payout $${payout}, client price $${price})`);
  expect(Math.abs(offer - payout)).toBeLessThan(1);
  expect(offers![0].status).toBe("submitted");
  await driver.context().close();
});

test("7. the team accepts the offer; the booking is confirmed and the money adds up", async ({ browser }) => {
  const team = await signIn(browser, PEOPLE.admin.email, `/admin/bookings/${bookingId}`);
  await expect(team.getByText(PEOPLE.driver.name).first()).toBeVisible();
  await act(team, /^(Aceptar oferta|Accept)$/, /Sí, aceptar esta oferta|Yes, accept this offer/);
  await expect.poll(async () => (await booking()).status).toBe("confirmed");
  const b = await booking();
  expect(b.assigned_driver_id).toBe(ids.driverId);
  expect(b.assigned_vehicle_id).toBe(ids.vehicleId);
  expect(Number(b.driver_payout)).toBe(offer);
  expect(Number(b.total_price)).toBe(price); // the traveller's price never moves
  expect(Number(b.platform_fee) + Number(b.driver_payout)).toBeCloseTo(price, 2);
  await team.context().close();
});

test("8. the traveller sees their driver, and nothing about payouts", async ({ page }) => {
  await page.goto(tripUrl);
  await expect(page.getByText(PEOPLE.driver.name.split(" ")[0]).first()).toBeVisible();
  await expect(page.getByText("Toyota Corolla").first()).toBeVisible();
  const text = await page.locator("body").innerText();
  expect(text).not.toContain(`$${offer}`);
  expect(text).not.toContain(PEOPLE.driver.email);
  expect(text).not.toMatch(/license-0|insurance-0/);
});

test("9. the driver runs the trip: on my way, picked up, ended", async ({ browser }) => {
  // Drivers can only start close to the pickup time, so the test moves the pickup to one hour from now.
  await db.from("bookings").update({ scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }).eq("id", bookingId);
  const driver = await signIn(browser, PEOPLE.driver.email, `/driver/trips/${bookingId}`);
  await driver.goto(`/driver/trips/${bookingId}`);

  // The driver gets a short name for the sign, never the traveller's contact details or price.
  const text = await driver.locator("body").innerText();
  expect(text).not.toContain(PEOPLE.traveller.email);
  expect(text).not.toContain("555 123 4567");
  expect(text).not.toContain(`$${price}`);

  await act(driver, /I'm on my way|Voy en camino/);
  await expect.poll(async () => (await booking()).en_route_at).not.toBeNull();
  await act(driver, /Client picked up|Cliente recogido/);
  await expect.poll(async () => (await booking()).status).toBe("in_progress");
  await act(driver, /Trip ended|Viaje terminado/);
  await expect.poll(async () => (await booking()).status).toBe("completed");
  await driver.context().close();
});

test("10. the traveller rates the driver, once", async ({ page }) => {
  await page.goto(tripUrl);
  await page.getByRole("radiogroup", { name: "Rating" }).getByRole("radio", { name: "5 stars" }).click();
  await page.getByRole("button", { name: "Send rating" }).click();
  await expect.poll(async () => (await db.from("driver_reviews").select("stars").eq("booking_id", bookingId)).data).toEqual([{ stars: 5 }]);
  const { data: d } = await db.from("drivers").select("rating_avg, rating_count").eq("id", ids.driverId).single();
  expect(Number(d!.rating_avg)).toBe(5);
  expect(d!.rating_count).toBe(1);
  await page.reload();
  await expect(page.getByRole("button", { name: "Send rating" })).toHaveCount(0);
});

test("11. the team's payouts page owes the driver exactly the accepted offer", async ({ browser }) => {
  const team = await signIn(browser, PEOPLE.admin.email, "/admin/payouts");
  await team.goto("/admin/payouts");
  const row = team.locator("section, article, li, tr, div").filter({ hasText: bookingRef }).last();
  await expect(row).toBeVisible();
  await expect(team.getByText(PEOPLE.driver.name).first()).toBeVisible();
  await expect(team.locator("body")).toContainText(`$${offer.toFixed(2)}`);
  await team.context().close();
});
