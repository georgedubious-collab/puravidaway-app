import type { Page } from "@playwright/test";

/**
 * Collects what goes wrong in the browser while a page is used: script errors, errors written
 * to the console, and files or calls the site itself fails to serve (named by address, which the
 * browser's own "Failed to load resource" line does not do). A test fails if the list isn't empty.
 *
 * Not counted: `/_vercel/…` (Vercel's analytics script only exists on Vercel's servers) and
 * anything on another website.
 */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`script error: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(`console: ${m.text()}`);
  });
  page.on("response", (r) => {
    const url = new URL(r.url());
    const ours = url.origin === new URL(page.url() === "about:blank" ? r.url() : page.url()).origin;
    if (r.status() >= 400 && ours && !url.pathname.startsWith("/_vercel/")) errors.push(`${r.status()} ${url.pathname}`);
  });
  return errors;
}
