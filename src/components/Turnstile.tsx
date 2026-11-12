"use client";

import Script from "next/script";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

/**
 * Cloudflare Turnstile: a quiet "are you a person" check for website forms that email a code
 * (/login). Most visitors never see anything; a few get one click. The script is loaded only on
 * the pages that render this component, and only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 * The token it produces is checked by our server (src/lib/authCode.ts) with the secret key.
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface TurnstileHandle {
  /** Tokens work once: get a fresh one after each attempt. */
  reset: () => void;
}

export function Turnstile({
  onToken,
  lang = "en",
  ref,
}: {
  onToken: (token: string | null, failed?: boolean) => void;
  lang?: "en" | "es";
  ref?: Ref<TurnstileHandle>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(() => typeof window !== "undefined" && Boolean(window.turnstile));
  const cb = useRef(onToken);
  useEffect(() => {
    cb.current = onToken;
  });

  const render = useCallback(() => {
    if (!box.current || !window.turnstile || id.current) return;
    id.current = window.turnstile.render(box.current, {
      sitekey: TURNSTILE_SITE_KEY,
      language: lang,
      // Invisible unless Cloudflare needs the visitor to click once.
      appearance: "interaction-only",
      callback: (t: string) => cb.current(t),
      "expired-callback": () => cb.current(null),
      "error-callback": () => cb.current(null, true),
    });
  }, [lang]);

  useEffect(() => {
    if (loaded) render();
    return () => {
      if (id.current && window.turnstile) window.turnstile.remove(id.current);
      id.current = null;
    };
  }, [loaded, render]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (id.current && window.turnstile) window.turnstile.reset(id.current);
      cb.current(null);
    },
  }));

  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setLoaded(true)} />
      <div ref={box} />
    </>
  );
}
