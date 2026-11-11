import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Only Trace itself may frame Trace (the /demo page frames the patient app
  // and the portal). Everyone else is refused, against clickjacking.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          // A health record: never tell other sites which page linked to them.
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
      {
        // A patient's own uploaded file (src/app/api/documents/[id]/route.ts): sandboxed, so even a
        // file that slipped past the type checks can never run as part of Trace. Last, so it wins.
        source: "/api/documents/:id",
        headers: [
          { key: "Content-Security-Policy", value: "sandbox; frame-ancestors 'self'" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
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
