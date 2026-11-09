"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { ErrorScreen } from "@/components/ErrorScreen";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Shows up in the browser console and Vercel logs; the digest matches the server log entry.
    console.error("[PuraVidaWay] Page error", error.digest ?? "", error);
  }, [error]);

  return (
    <ErrorScreen
      eyebrow="Something went wrong"
      title="We hit a bump in the road"
      text="This page didn't load properly. Please try again; if it keeps happening, message our team and we'll sort it out."
      whatsAppMessage={`Hi! A page on your site showed an error${error.digest ? ` (code ${error.digest})` : ""}. Can you help?`}
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
  );
}
