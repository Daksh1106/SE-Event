import type { NextConfig } from "next";

// Note: Next 16 "Cache Components" and "partial prefetching" were enabled by an earlier AI session.
// They require every page that reads cookies/params to sit inside <Suspense> and made the
// production build fail (e.g. /approver), so they are switched off. Pages are rendered
// dynamically per request, which is what this app needs (live seats, per-user data).
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
