import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
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
