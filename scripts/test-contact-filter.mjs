/**
 * Cases for the chat's "hide and flag" filter (src/lib/contactFilter.ts).
 *
 *   npm run test:filter        (Node 22.6+; Node runs the TypeScript directly)
 *
 * HIDE: every case must come out with something hidden and none of the listed
 * secrets left in the text. KEEP: normal trip talk must come out unchanged.
 */
import { HIDDEN, displayHidden, hideContactDetails } from "../src/lib/contactFilter.ts";

/** [message, a piece that must disappear] */
const HIDE = [
  ["Call me on 8888 8888", "8888"],
  ["My number is +506 8888-8888", "8888"],
  ["WhatsApp +1 (555) 123-4567 when you land", "4567"],
  ["text me 8.8.8.8.8.8.8.8", "8.8.8"],
  ["mi cel 8 8 8 8 - 1 2 3 4", "8 8 8 8"],
  ["number: 88881234", "88881234"],
  ["call 0044 7700 900123", "7700"],
  ["my phone is eight eight eight eight one two three four", "eight eight"],
  ["mi número es ocho ocho ocho ocho uno dos tres cuatro", "ocho ocho"],
  ["call 8888 one two three four", "8888"],
  ["write to juan.perez@gmail.com", "juan.perez"],
  ["email: JUAN@HOTMAIL.COM", "JUAN"],
  ["juan at gmail dot com", "juan"],
  ["juan (at) yahoo (dot) com", "juan"],
  ["escríbame a juan arroba gmail punto com", "juan"],
  ["my gmail is juanperez77", "juanperez77"],
  ["see https://example.com/tours", "example.com"],
  ["book at www.mytours.cr", "mytours"],
  ["costaricashuttles.com is cheaper", "costaricashuttles"],
  ["message me wa.me/50688888888", "wa.me"],
  ["telegram t.me/juancr", "t.me"],
  ["mytours dot com", "mytours"],
  ["follow me @juan.cr", "@juan"],
  ["(@pura_vida) on IG", "@pura_vida"],
  ["my insta is pura_vida_juan", "pura_vida_juan"],
  ["Instagram: juanito", "juanito"],
  ["mi whatsapp es 8888 8888", "8888"],
  ["Telegram @juan_driver", "juan_driver"],
  ["fb juan.perez.77", "juan.perez"],
  ["Facebook: juan perez cr", "juan"],
];

/** Normal messages that must not change. */
const KEEP = [
  "Hello! I'll be at the arrivals exit with a sign with your name.",
  "We land at 14:30 on flight AA 1234.",
  "Our booking is CRPT-10492 for 2026-11-22.",
  "Pickup on 22/11/2026 at 9:30, please.",
  "We are 4 adults and 2 kids with 6 bags.",
  "Is the price $1,250 or $1,350?",
  "We stayed in Costa Rica 2019-2024 every year.",
  "Hotel Arenal Springs, room 214.",
  "Can we stop for coffee at the soda near km 45?",
  "Sí, nos vemos a las 7:00 en el lobby del hotel.",
  "The line at immigration is long, we'll be 30 minutes late.",
  "I use WhatsApp a lot, but let's talk here.",
  "We are two adults and one child.",
  "Gate 5, terminal 2, exit B.",
  "Dates: 2026-11-22 2026-11-25",
  "Thanks for the ride! 5 stars from us.",
  "I'll text our team if anything changes.",
];

let passed = 0;
const failures = [];
for (const [msg, secret] of HIDE) {
  const out = hideContactDetails(msg);
  if (out.kinds.length > 0 && out.text.includes(HIDDEN) && !out.text.includes(secret)) passed++;
  else failures.push(`should hide: ${JSON.stringify(msg)} → ${JSON.stringify(out.text)}`);
}
for (const msg of KEEP) {
  const out = hideContactDetails(msg);
  if (out.text === msg && out.kinds.length === 0) passed++;
  else failures.push(`should keep: ${JSON.stringify(msg)} → ${JSON.stringify(out.text)}`);
}
// Spanish readers see [oculto]; repeated hidden pieces collapse into one.
const twice = hideContactDetails("8888 8888, juan@gmail.com");
if (twice.text.split(HIDDEN).length - 1 === 1 && displayHidden(twice.text, "es").includes("[oculto]")) passed++;
else failures.push(`collapse / Spanish: ${JSON.stringify(twice.text)}`);

console.log(`${passed} filter checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
