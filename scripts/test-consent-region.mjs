/**
 * Cases for where the cookie banner is shown (src/lib/consentRegion.ts, docs/SEO.md §7.1).
 *
 *   npm run test:consent-region        (Node 22.15+; Node runs the TypeScript directly)
 *
 * The rule (Jorge, 2026-11-11): ask first only in the EU, the rest of the EEA (Iceland,
 * Liechtenstein, Norway), the UK and Switzerland; everyone else gets analytics by default.
 * Unknown or missing country → ask first (the safe side).
 */
const { CONSENT_COUNTRIES, regionForCountry, parseRegion, REGION_COOKIE, REGION_COOKIE_MAX_AGE_SECONDS } = await import(
  "../src/lib/consentRegion.ts"
);

let passed = 0;
const failures = [];
const check = (name, got, want) => {
  if (got === want) passed++;
  else failures.push(`${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};

const EU27 = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
check("EU has 27 members in the test list", EU27.length, 27);
for (const c of [...EU27, "IS", "LI", "NO", "GB", "CH"]) {
  check(`${c} asks first`, regionForCountry(c), "consent");
  check(`${c} is in the list`, CONSENT_COUNTRIES.has(c), true);
}

// Everyone else: analytics on by default.
for (const c of ["US", "CA", "CR", "MX", "AR", "BR", "AU", "CN", "JP", "IN", "IL", "ZA", "TR", "UA", "RS", "AL", "MC", "AD", "SM", "VA"]) {
  check(`${c} is open`, regionForCountry(c), "open");
}

// Case and spaces do not matter.
check("lower case de", regionForCountry("de"), "consent");
check("lower case us", regionForCountry(" us "), "open");

// Unknown or missing → the safe side.
for (const v of [undefined, null, "", "  ", "USA", "U", "1", "XX", "ZZ", "T1", "EU", "A1"]) {
  check(`unknown ${JSON.stringify(v)} asks first`, regionForCountry(v), "consent");
}

// The banner reads the cookie: only exactly "open" means open.
check("cookie open", parseRegion("open"), "open");
check("cookie consent", parseRegion("consent"), "consent");
check("cookie missing", parseRegion(undefined), "consent");
check("cookie garbage", parseRegion("OPEN"), "consent");

check("cookie name", REGION_COOKIE, "crpt-region");
check("cookie lasts 30 days", REGION_COOKIE_MAX_AGE_SECONDS, 30 * 86400);
// The list is exactly EU-27 + EEA + GB + CH + the territories noted in the module.
check("list size", CONSENT_COUNTRIES.size, 27 + 3 + 2 + 11);

if (failures.length) {
  console.error(`✗ ${failures.length} failed, ${passed} passed`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✓ consent region: ${passed} checks passed`);
