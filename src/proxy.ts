import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { HAS_CONSENT_TOOLS } from "@/lib/analyticsConfig";
import { REGION_COOKIE, REGION_COOKIE_MAX_AGE_SECONDS, regionForCountry } from "@/lib/consentRegion";

/** Account areas: the Supabase login session is kept fresh here, and a signed-out visitor is sent to /login. */
const AUTH_PATHS = ["/admin", "/account", "/driver"];
const isAuthPath = (path: string) => path === "/login" || AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Two small jobs, before any page is served:
 *
 * 1. Cookie banner region (docs/SEO.md §7.1). Reads the visitor's country from Vercel's
 *    `x-vercel-ip-country` header and stores "consent" (EEA, UK, Switzerland, or unknown) or
 *    "open" (anywhere else) in the first-party `crpt-region` cookie, so the pages stay static
 *    and the banner (src/components/site/ConsentManager.tsx) decides in the browser. Only when a
 *    measurement tool is switched on, and only when the cookie is missing or different.
 * 2. Keeps the Supabase login session fresh on account pages. This is an optimistic check only:
 *    every admin page and action re-checks the role on the server (src/lib/auth.ts), and the
 *    database enforces it again (RLS).
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const response = isAuthPath(path) ? await authResponse(request, path) : NextResponse.next();
  if (HAS_CONSENT_TOOLS) setRegionCookie(request, response);
  return response;
}

function setRegionCookie(request: NextRequest, response: NextResponse): void {
  const region = regionForCountry(request.headers.get("x-vercel-ip-country"));
  if (request.cookies.get(REGION_COOKIE)?.value === region) return;
  response.cookies.set(REGION_COOKIE, region, {
    path: "/",
    maxAge: REGION_COOKIE_MAX_AGE_SECONDS,
    sameSite: "lax",
    // Secure on Vercel and any https address; not on a plain-http local run (Safari would drop it).
    secure: process.env.VERCEL === "1" || request.nextUrl.protocol === "https:",
    // The banner reads it in the browser; it holds only "consent" or "open".
    httpOnly: false,
  });
}

async function authResponse(request: NextRequest, path: string): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && path !== "/login") {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  // Every page, but not Next's own files, the API, images, icons or other files with an
  // extension (robots.txt, sitemap.xml, photos…): those need neither a session nor a region.
  matcher: ["/((?!_next/|api/|.*\\.[A-Za-z0-9]+$|opengraph-image|apple-icon|icon).*)"],
};
