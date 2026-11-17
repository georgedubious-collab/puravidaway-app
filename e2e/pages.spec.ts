import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

/** Every main public page opens, has a heading, and reports no errors in the browser. */
const PAGES = ["/", "/es", "/transfers", "/tours", "/how-it-works", "/our-drivers", "/faq", "/contact", "/cancellation", "/terms", "/privacy", "/login"];

for (const path of PAGES) {
  test(`${path} opens without errors`, async ({ page }) => {
    const errors = watchErrors(page);
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("the customer-facing site never names the owner or the sister brands", async ({ page }) => {
  for (const path of ["/", "/es", "/how-it-works", "/our-drivers", "/faq", "/contact", "/terms", "/privacy"]) {
    await page.goto(path);
    const text = (await page.locator("body").innerText()).toLowerCase();
    for (const banned of ["jorge", "travel planner", "familia mágica", "familia magica"]) {
      expect(text, `${path} mentions "${banned}"`).not.toContain(banned);
    }
  }
});
