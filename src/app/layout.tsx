import type { Metadata, Viewport } from "next";
import { dmSans, sora } from "./fonts";
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
  themeColor: "#f8f7fb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IE" className={`${dmSans.variable} ${sora.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
