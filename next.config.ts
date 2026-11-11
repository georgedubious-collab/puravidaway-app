import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The storefront is rendered per request (see src/app/page.tsx) so that
  // search engines and first paint get real content, not a loading fallback.
  // Photos in public/photos are clean JPEGs; next/image serves them as AVIF or WebP at the size each screen needs.
  images: { formats: ["image/avif", "image/webp"] },
  // Multi-day trips were retired on 2026-11-11. Their only public address was the booking
  // app's ?tab=multiday (menu, guides); send it to the day tours, the closest thing we sell.
  async redirects() {
    return [
      { source: "/", has: [{ type: "query", key: "tab", value: "multiday" }], destination: "/?tab=tours", permanent: true },
      { source: "/es", has: [{ type: "query", key: "tab", value: "multiday" }], destination: "/es?tab=tours", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
