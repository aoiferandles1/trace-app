import type { Metadata, Viewport } from "next";
import { inter, sora } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Trace",
    template: "%s · Trace",
  },
  description:
    "A health record you own and share with your doctor only when you say so. A portfolio project by Aoife Randles, not a medical service.",
  // Home screen app (src/app/manifest.ts). iOS reads these two as well as the manifest:
  // the name under the icon, and that the saved app opens without Safari's bars.
  appleWebApp: { capable: true, title: "Trace", statusBarStyle: "default" },
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The page may draw to the screen's edges; the shells pad for the notch and the
  // home indicator with env(safe-area-inset-*), which is 0 everywhere else.
  viewportFit: "cover",
  // Ground (--ground). Session screens switch it to session indigo with <ThemeColor tone="session" />.
  themeColor: "#f7f7fb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IE" className={`${inter.variable} ${sora.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
