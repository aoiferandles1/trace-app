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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
