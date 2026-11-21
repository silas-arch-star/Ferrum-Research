import type { NextConfig } from "next";

const launcherPort = process.env.FERRUM_PRODUCTION_PORT;
const revision = process.env.FERRUM_WEB_REVISION;
const nextConfig: NextConfig = {
  ...(launcherPort && {
    distDir: `.next/ferrum-${launcherPort}`,
    typescript: { tsconfigPath: ".next/tsconfig.ferrum.json" },
  }),
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Ferrum-Mode", value: process.env.NODE_ENV === "development" ? "development" : "production" },
        ...(revision ? [{ key: "X-Ferrum-Revision", value: revision }] : []),
      ],
    }];
  },
  async rewrites() {
    const apiOrigin = (process.env.FERRUM_API_ORIGIN ?? "http://127.0.0.1:8000").replace(/\/$/, "");
    return {
      beforeFiles: [{ source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` }],
    };
  },
  cacheComponents: true,
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
