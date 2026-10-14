# GEMINI.md — PuraVidaWay reviewer guide

Gemini's role in this project is **code review and second opinions**. Claude is the primary
builder. Gemini does not push code; it reviews pull requests and flags problems.

## Before reviewing
Read `docs/PROJECT.md` (source of truth), the latest `docs/CHANGELOG.md` entries, and
`docs/COMPETITORS.md` (Daytrip / GetTransfer / Welcome Pickups benchmark).

## What to check in every PR
1. **Does it match the spec?** Schema fields, status values, pricing rules and RLS policies must
   match `docs/PROJECT.md` §5–§7. If the PR intentionally changes the spec, the spec file must be
   updated in the same PR.
2. **Security.**
   - No secrets committed; service-role keys and Green Pay credentials never reach client code.
   - Supabase RLS on every new table; KYC data (Cédula, license, insurance) exposed only to
     admins and the owning driver.
   - Payment amounts computed server-side; never trust a price sent from the browser.
3. **Correctness.** TypeScript strict passes, money uses numeric/decimal (never float math on
   prices in JS — use cents or a decimal lib), timezone handling uses `America/Costa_Rica` where
   it matters, season multipliers come from the DB.
4. **Simplicity.** Jorge is a solo operator: prefer boring, maintainable code over clever
   abstractions. Flag over-engineering.
5. **Mobile-responsiveness** of any UI change.
6. **Competitive parity.** For UI or pricing changes, check the `docs/COMPETITORS.md` §5 list
   (per-car + per-person price, cancellation window, flight tracking, luggage, driver badges).
7. **Changelog** line present: `YYYY-MM-DD — <AI> — <what changed>`.

## Tone
Concise, specific, actionable. Reference file and line. Say clearly whether an issue is
**blocking** or a **suggestion**. Address the founder as Jorge Li.
