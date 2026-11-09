"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { ErrorScreen } from "@/components/ErrorScreen";
import "./globals.css";

/** Last-resort page when the root layout itself fails. Renders its own <html> and <body>. */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[PuraVidaWay] Global error", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        <title>Something went wrong | Costa Rica Private Transfers</title>
        <meta name="robots" content="noindex" />
        <ErrorScreen
          eyebrow="Something went wrong"
          title="We hit a bump in the road"
          text="The site didn't load properly. Please try again; if it keeps happening, message our team and we'll sort it out."
          whatsAppMessage={`Hi! Your site showed an error${error.digest ? ` (code ${error.digest})` : ""}. Can you help?`}
          action={
            <button
              type="button"
              onClick={() => retry()}
              className="min-h-12 w-full sm:w-auto inline-flex items-center justify-center px-6 rounded-xl bg-emerald-950 hover:bg-emerald-900 font-bold text-white"
            >
              Try again
            </button>
          }
        />
      </body>
    </html>
  );
}
