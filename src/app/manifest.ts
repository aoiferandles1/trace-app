import type { MetadataRoute } from "next";

/**
 * The patient app as a home screen app (/manifest.webmanifest). "Add to Home
 * Screen" gives a Trace icon that opens the app full screen, without the
 * browser's bars: Welcome for a new visitor, Home for someone signed in.
 *
 * The doctor's portal has its own manifest (/view/manifest.webmanifest, see
 * src/app/view/layout.tsx), so the two sides can sit on one phone as two
 * icons, the way the demo treats them as two devices.
 *
 * Colours are the tokens' values (globals.css): ground for the splash and
 * the bars, accent on the icons. Icons come from scripts/make-icons.mjs.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Trace",
    short_name: "Trace",
    description: "A health record you own and share with your doctor only when you say so.",
    lang: "en-IE",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7fb",
    theme_color: "#f7f7fb",
    icons: [
      { src: "/icons/trace-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/trace-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/trace-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Doctor's portal",
        url: "/view",
        icons: [{ src: "/icons/portal-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
