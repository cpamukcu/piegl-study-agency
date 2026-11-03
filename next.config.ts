import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Only the public demo build (scripts/demo/build.ts) sets this, to serve under /<repo> on GitHub Pages.
  basePath: process.env.DEMO_BASE_PATH || undefined,
  // Course files are uploaded through a server action; one file may be up to 50 MB.
  experimental: {
    serverActions: { bodySizeLimit: "100mb" },
  },
  // A config redirect, so "/" never renders a page that only redirects.
  async redirects() {
    return [{ source: "/", destination: "/today", permanent: false }];
  },
  partialPrefetching: true,
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
