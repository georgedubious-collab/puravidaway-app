import { sendCodeRoute } from "@/lib/authCodeServer";

/** Mobile apps: email a sign-in code (rate limits + account rules, src/lib/authCode.ts). No sign-in needed. */
export async function POST(req: Request) {
  return sendCodeRoute(req, "app");
}
