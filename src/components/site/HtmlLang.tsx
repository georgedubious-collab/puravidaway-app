"use client";

import { useEffect } from "react";

/**
 * Sets <html lang> for the Spanish pages. The root layout is shared with /admin,
 * /driver and /trip and renders lang="en"; the /es layout also wraps its pages
 * in an element with lang="es", so the content is marked Spanish in the HTML
 * itself. This keeps the document's lang right after the page loads and while
 * moving between English and Spanish pages without a reload.
 */
export function HtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    const el = document.documentElement;
    const previous = el.lang;
    el.lang = lang;
    return () => {
      el.lang = previous || "en";
    };
  }, [lang]);
  return null;
}
