import type { NextConfig } from "next";

// Cache Components is off on purpose: almost every page depends on the
// signed-in user, so pages render per request.
const nextConfig: NextConfig = {
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
