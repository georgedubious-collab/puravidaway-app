import { Suspense } from "react";
import { Storefront } from "@/components/Storefront";

// Default travel dates and season pricing depend on "today", so the storefront
// streams in per request instead of being frozen at build time.
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-slate-500">
          Loading PuraVidaWay…
        </div>
      }
    >
      <Storefront />
    </Suspense>
  );
}
