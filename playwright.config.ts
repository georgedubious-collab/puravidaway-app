import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: a real browser uses the site the way a traveller does (e2e/*.spec.ts).
 *
 *   npm run e2e
 *
 * They run on a phone-sized screen (the site is mobile-first) against a copy of the site started
 * just for the test, with NO database keys: the storefront then runs on its built-in catalog,
 * so nothing here can touch real bookings. On GitHub the site is built and started the way
 * Vercel does; on a computer it uses `npm run dev` (or the one already running on port 3210).
 */
const PORT = 3210;
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: CI,
  // No automatic retries: a test that only passes the second time is hiding a real problem.
  retries: 0,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "phone",
      use: {
        ...devices["Pixel 7"],
        // PW_CHANNEL=chrome uses the Chrome already installed instead of Playwright's download.
        channel: process.env.PW_CHANNEL || undefined,
      },
    },
  ],
  webServer: {
    command: CI ? `npm run build && npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 300_000,
    // The tests must never reach a real database, mail or maps account.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      RESEND_API_KEY: "",
      GOOGLE_MAPS_API_KEY: "",
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
    },
  },
});
