import { defineConfig, devices } from "@playwright/test";

/**
 * The full-trip browser tests (e2e/full/): traveller books → team posts the job → driver offers →
 * team accepts → driver drives → traveller rates, against a THROWAWAY local database.
 *
 *   npm run e2e:full        (scripts/e2e-full.mjs starts the database and passes its keys)
 *
 * One story, told in order, so one browser at a time.
 */
const PORT = 3210;
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e/full",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  forbidOnly: CI,
  retries: 0,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"], channel: process.env.PW_CHANNEL || undefined } }],
  webServer: {
    command: CI ? `npm run build && npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    // Keys of the local test database arrive from scripts/e2e-full.mjs; mail and maps stay off.
    env: { RESEND_API_KEY: "", GOOGLE_MAPS_API_KEY: "", NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}` },
  },
});
