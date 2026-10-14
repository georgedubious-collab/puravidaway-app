# Changelog

Every merged change gets one line: `YYYY-MM-DD — <AI or Jorge> — <what changed>`.
Newest entries first. AIs: read the top of this file before starting work.

- 2026-10-14 — Claude — COMPETITORS.md §2c GetTransfer "from" prices for 9 Costa Rica routes vs
  Daytrip; §2d exact pick-up/drop-off analysis (map place search, zone + distance pricing) with
  requirements for our transfer form; Sierpe road drop-off added to the Daytrip grid.
- 2026-10-14 — Claude — COMPETITORS.md §2b: Daytrip per-vehicle price grid for 12 Costa Rica
  routes (Nov 2026 quote), stop pricing, pricing behaviour (distance from SJO, supply elsewhere),
  plus SJO→Drake Bay and SJO→Puerto Jiménez (Daytrip sells both; it does not sell the Sierpe
  boat connection, permits or Corcovado logistics).
- 2026-10-14 — Claude — COMPETITORS.md §1b: driver economics from real Daytrip statements (~30%
  cut) and GetTransfer's carrier commission tiers (13–25%); corrected the outdated 5% claim.
- 2026-10-14 — Claude — Added `docs/COMPETITORS.md` (Daytrip, GetTransfer, Welcome Pickups
  business models, Costa Rica price points, openings, per-PR checklist) and linked it from
  PROJECT.md, CLAUDE.md and GEMINI.md as the standing benchmark.
- 2026-10-14 — Claude — Phase 2a: rebuilt the storefront on Next.js 16 + TypeScript + Tailwind.
  Typed catalog and cents-based pricing engine with season multipliers; working Transfers
  (corridor-filtered stops, vehicle classes, live route summary, fixed/bid toggle), Day Tours
  (Smart En-Route upgrade), Expeditions (lodging tiers, itineraries); Trip Cart with 100% / 20%
  deposit and WhatsApp booking link. Old prototype moved to `legacy/index.html`. Added
  `.env.example`. Needs `NEXT_PUBLIC_WHATSAPP_NUMBER` in Vercel. Bid mode prices the cart
  item at the client's offer (fixed price shown for reference; warning below 70%).
- 2026-10-13 — Claude — Merged Architecture.md, Database-Schema.md, Route-Pricing.md and the
  Gemini master spec into `docs/PROJECT.md` as the single source of truth; corrected it to the
  real repo state (no admin.html; index.html JS truncated; Phase 1 is a design mock, not
  completed). Added `CLAUDE.md` (builder rules), `GEMINI.md` + `.gemini/styleguide.md` (reviewer
  rules) and this changelog. Decision recorded: rebuild on Next.js + TypeScript + Supabase
  (PROJECT.md §2), Claude as primary builder with Gemini as PR reviewer (§10).
