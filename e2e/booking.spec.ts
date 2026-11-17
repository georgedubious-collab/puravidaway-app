import { expect, test, type Page } from "@playwright/test";
import { watchErrors } from "./helpers";

/**
 * The traveller's path on the public site: pick a ride, see a fixed price, add it to the trip,
 * fill in details and send the request. Runs without a database (playwright.config.ts), so the
 * last step expects the site's own "not switched on" message rather than a saved booking.
 */

/** "$1,234.50" → 1234.5 */
const dollars = (text: string | null): number => {
  const m = (text ?? "").match(/\$([\d,]+(?:\.\d{2})?)/);
  if (!m) throw new Error(`No price in "${text}"`);
  return Number(m[1].replace(/,/g, ""));
};

/** The total at the bottom of the ride builder ("Total private ride $202"), in either language. */
const rideTotal = async (page: Page) =>
  dollars(await page.getByText(/^(Total private ride|Total del traslado privado)$/).first().locator("..").textContent());

test("the home page offers a ride with a price", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Private transfers");
  await expect(page.getByLabel("From")).toBeVisible();
  await expect(page.getByLabel("To", { exact: true })).toBeVisible();
  expect(await rideTotal(page)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("choosing a vehicle sets the total to that vehicle's price", async ({ page }) => {
  await page.goto("/");
  for (const name of [/Economy Sedan/, /Private Van/]) {
    const card = page.getByRole("button", { name });
    await card.click();
    await expect(card).toHaveAttribute("aria-pressed", "true");
    const cardPrice = dollars((await card.textContent())!.match(/\$[\d,.]+ per car/)![0]);
    await expect.poll(() => rideTotal(page)).toBe(cardPrice);
  }
});

test("a night pickup costs 20% more, and the page says so before booking", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Pickup time").selectOption({ label: "9:00 AM" });
  const day = await rideTotal(page);
  await page.getByLabel("Pickup time").selectOption({ label: "11:00 PM · +20%" });
  await expect.poll(() => rideTotal(page)).toBeCloseTo(day * 1.2, 1);
});

test("a shared link opens the same ride", async ({ page }) => {
  await page.goto("/?from=LIR&to=Tamarindo&pax=4&vehicle=van");
  await expect(page.getByLabel("From")).toHaveValue(/LIR/);
  await expect(page.getByLabel("To", { exact: true })).toHaveValue(/Tamarindo/);
  await expect(page.getByLabel("Travellers")).toHaveValue("4");
  await expect(page.getByRole("button", { name: /Private Van/ })).toHaveAttribute("aria-pressed", "true");
});

test("a traveller adds a ride, reviews the trip and sends the request", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  const price = await rideTotal(page);

  await page.getByRole("button", { name: "Add this ride to your trip" }).first().click();
  const cart = page.getByRole("button", { name: /Open your trip, 1 item/ });
  await expect(cart).toBeVisible();
  expect(dollars(await cart.textContent())).toBe(price);

  await page.getByRole("button", { name: "Review & book" }).click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Send trip request" }) });
  await expect(form).toBeVisible();
  // What the traveller is asked to agree to is exactly the price they were shown.
  expect(dollars(await form.getByText("Trip price").locator("..").textContent())).toBe(price);
  expect(dollars(await form.getByText("Total", { exact: true }).locator("..").textContent())).toBe(price);
  await expect(form).toContainText("Nothing is charged now");

  await form.getByLabel("Full name").fill("Test Traveller");
  await form.getByRole("textbox", { name: "Email" }).fill("traveller@example.com");
  await form.getByLabel(/Mobile number/).fill("+1 555 123 4567");
  await form.getByRole("button", { name: "Send trip request" }).click();

  // No database in this test run: the site must answer with its own message, not break.
  await expect(form.getByRole("alert")).toContainText(/WhatsApp/);
  await expect(cart).toBeVisible(); // the trip is still there to send another way
  expect(errors).toEqual([]);
});

test("the request cannot be sent without contact details", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add this ride to your trip" }).first().click();
  await page.getByRole("button", { name: "Review & book" }).click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Send trip request" }) });
  await form.getByRole("button", { name: "Send trip request" }).click();
  // The form points at the missing field and nothing is sent to the server.
  await expect(form.getByLabel("Full name")).toHaveAttribute("aria-invalid", "true");
  await expect(form.locator("#trip-name-error")).toBeVisible();
  await expect(form.getByRole("alert").filter({ hasText: "WhatsApp" })).toHaveCount(0);
});

test("the Spanish site shows the same ride at the same price", async ({ page }) => {
  await page.goto("/");
  const english = await rideTotal(page);
  await page.goto("/es");
  await expect(page.locator("html")).toHaveAttribute("lang", /^es/);
  await expect(page.getByRole("button", { name: "Agregar este traslado a su viaje" }).first()).toBeVisible();
  expect(await rideTotal(page)).toBe(english);
});
