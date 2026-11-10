import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The storefront is rendered per request (see src/app/page.tsx) so that
  // search engines and first paint get real content, not a loading fallback.
  // Photos in public/photos are clean JPEGs; next/image serves them as AVIF or WebP at the size each screen needs.
  images: { formats: ["image/avif", "image/webp"] },
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
