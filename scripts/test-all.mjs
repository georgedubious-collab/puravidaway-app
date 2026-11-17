/**
 * Runs every `test:*` script in package.json, one after another, and prints one line per suite.
 *
 *   npm test
 *
 * Used by `npm run verify`, by the "Checks" GitHub Action on every pull request, and by the
 * `verify` skill (.claude/skills/verify/SKILL.md). A new `test:<name>` script is picked up
 * automatically; nothing to register here. Exits 1 if any suite fails.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const scripts = Object.keys(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).scripts)
  .filter((name) => name.startsWith("test:"));

const failed = [];
for (const name of scripts) {
  const started = Date.now();
  const run = spawnSync("npm", ["run", "-s", name], { encoding: "utf8", shell: process.platform === "win32" });
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim();
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (run.status === 0) {
    console.log(`✓ ${name} (${seconds}s) ${(run.stdout ?? "").trim().split("\n").pop() ?? ""}`);
  } else {
    failed.push(name);
    console.log(`✗ ${name} (${seconds}s)\n${output}\n`);
  }
}

console.log(`\n${scripts.length - failed.length} of ${scripts.length} test suites passed${failed.length ? `; failed: ${failed.join(", ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
