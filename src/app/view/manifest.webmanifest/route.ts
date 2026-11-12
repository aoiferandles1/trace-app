import type { MetadataRoute } from "next";

/**
 * The doctor's portal as its own home screen app (/view/manifest.webmanifest;
 * src/app/view/layout.tsx points every portal page at it). Saved from /view,
 * the icon is "Trace Portal", ink where the patient app's is accent, and it
 * opens the portal full screen. The patient app's manifest is
 * src/app/manifest.ts.
 */
const manifest: MetadataRoute.Manifest = {
  id: "/view",
  name: "Trace Clinical Access Portal",
  short_name: "Trace Portal",
  description: "Read a patient's Trace record for this visit, with their permission.",
  lang: "en-IE",
  start_url: "/view",
  scope: "/view",
  display: "standalone",
  background_color: "#f7f7fb",
  theme_color: "#f7f7fb",
  icons: [
    { src: "/icons/portal-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/portal-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/portal-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export function GET() {
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
