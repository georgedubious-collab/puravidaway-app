import { sendCodeRoute } from "@/lib/authCodeServer";

/** Website: email a sign-in code (Turnstile + rate limits + account rules, src/lib/authCode.ts). */
export async function POST(req: Request) {
  return sendCodeRoute(req, "web");
}
