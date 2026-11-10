import { WHATSAPP_NUMBER } from "@/lib/catalog";
import { json } from "../shared";

/**
 * GET → how to reach the team from the apps: the WhatsApp number (digits) and the
 * support email. Set DRIVER_SUPPORT_EMAIL in Vercel to change the address; never
 * a personal one, since drivers and travellers see it.
 */
export function GET() {
  return json({
    ok: true,
    whatsapp: WHATSAPP_NUMBER,
    email: process.env.DRIVER_SUPPORT_EMAIL || "hello@costaricaprivatetransfers.com",
  });
}
