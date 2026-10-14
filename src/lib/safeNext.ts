const BASE = "https://puravidaway.invalid";

/**
 * Where to send someone after sign-in. Only paths on this site are allowed:
 * "/\evil.com", "/\t/evil.com" and "//evil.com" are all read by browsers as
 * another website, so anything with a backslash or control character, or that
 * resolves off-site, falls back to the default.
 */
export function safeNext(value: string | null | undefined, fallback = "/admin"): string {
  if (!value || !value.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const u = new URL(value, BASE);
    if (u.origin !== BASE) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
