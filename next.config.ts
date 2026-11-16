import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The end-to-end tests build the app against a local stand-in for Supabase
  // (playwright.config.ts sets TRACE_E2E=1). That build goes in its own
  // folder, so it can never be mistaken for, or overwrite, a real build.
  distDir: process.env.TRACE_E2E === "1" ? ".next-e2e" : ".next",
  cacheComponents: true,
  // Only Trace itself (the /demo page) and Aoife's portfolio case study
  // (aoiferandles.com/trace/, its "Try it yourself" frames) may frame Trace.
  // Everyone else is refused, against clickjacking. The app is served at
  // trace.aoiferandles.com, so the portfolio's frames are same-site and the
  // SameSite=Lax session cookies reach them. Browsers that understand
  // frame-ancestors ignore X-Frame-Options; only very old ones fall back to it.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://aoiferandles.com https://www.aoiferandles.com",
          },
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
      {
        // A patient's document, served as itself to the doctor (supabase/README.md,
        // documents): sandboxed, so no file can run script or act as this site.
        // These rules override the ones above for this path, so the route's own
        // policy is repeated here with frame-ancestors.
        source: "/api/portal/document",
        headers: [{ key: "Content-Security-Policy", value: "sandbox; frame-ancestors 'self'" }],
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
