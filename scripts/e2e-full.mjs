/**
 * Runs the full-trip browser tests (e2e/full/) against a throwaway local database.
 *
 *   npm run e2e:full            needs Docker running (GitHub's test machines have it)
 *
 * 1. Starts a local Supabase (database, sign-in, test inbox) if it isn't running.
 * 2. Empties it and rebuilds it from supabase/migrations, so every run starts the same.
 * 3. Starts the site with that database's keys and runs the tests.
 * The live database is never involved: its keys are not read, and e2e/full/support.ts refuses
 * any database address that isn't on this computer.
 */
import { execFileSync, spawnSync } from "node:child_process";

const SUPABASE = ["-y", "supabase@2.122.1"];
const SKIP = "studio,imgproxy,logflare,vector,edge-runtime,postgres-meta,supavisor";
const run = (args, opts = {}) => spawnSync("npx", [...SUPABASE, ...args], { stdio: "inherit", ...opts });
const status = () => {
  try {
    return execFileSync("npx", [...SUPABASE, "status", "-o", "env"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
};

let env = status();
if (!env.includes("SERVICE_ROLE_KEY")) {
  if (run(["start", "-x", SKIP]).status !== 0) process.exit(1);
  env = status();
} else if (run(["db", "reset"]).status !== 0) {
  process.exit(1);
}
const keys = Object.fromEntries(
  env.split("\n").map((l) => l.match(/^([A-Z0-9_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]),
);
if (!keys.API_URL || !keys.ANON_KEY || !keys.SERVICE_ROLE_KEY) {
  console.error("Could not read the local database's keys (is Docker running?).");
  process.exit(1);
}

const test = spawnSync("npx", ["playwright", "test", "-c", "playwright.full.config.ts", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: keys.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: keys.SERVICE_ROLE_KEY,
    E2E_MAIL_URL: keys.MAILPIT_URL ?? keys.INBUCKET_URL ?? "http://127.0.0.1:54324",
    CRON_SECRET: "local-test-only-cron-secret",
  },
});
process.exit(test.status ?? 1);
