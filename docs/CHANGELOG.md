# Changelog

Every merged change gets one line: `YYYY-MM-DD — <AI or Jorge> — <what changed>`.
Newest entries first. AIs: read the top of this file before starting work.

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
