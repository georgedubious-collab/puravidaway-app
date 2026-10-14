import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The storefront is rendered per request (see src/app/page.tsx) so that
  // search engines and first paint get real content, not a loading fallback.
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
