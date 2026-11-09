/**
 * Public settings (safe to ship inside the app): the Supabase project address and
 * its publishable key, which only allows what the database's row-level security
 * allows for the signed-in driver. Never put a secret or the service key here.
 */
export const SUPABASE_URL = "https://yfbwpdnjgpbjjonoiydy.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YDrpcWXyAMAzv880CGEGUw_fsvXGNbs";

/** The website, for /api/v1 calls (offers, trip status, chat). Change when the custom domain is live. */
export const SITE_URL = "https://puravidaway-app.vercel.app";
