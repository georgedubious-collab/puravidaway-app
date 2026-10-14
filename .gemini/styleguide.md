# Gemini Code Assist style guide — PuraVidaWay

This file configures Gemini Code Assist's PR reviews for this repo.
Full reviewer instructions: see `GEMINI.md` in the repo root; project source of truth:
`docs/PROJECT.md`.

Priorities, in order:
1. Security: no committed secrets; Supabase RLS on every table; KYC and payment data never
   exposed client-side; prices validated server-side.
2. Spec conformance with `docs/PROJECT.md` (schema, status enums, pricing rules).
3. TypeScript-strict correctness; safe money handling (no float arithmetic on prices).
4. Simplicity and maintainability for a solo operator.
5. Mobile-first responsive UI.

Mark findings as blocking vs suggestion. Be concise and reference exact files/lines.
