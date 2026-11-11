import { DM_Sans, Sora } from "next/font/google";

/** DM Sans: body, labels, buttons, most headings. Variable, with the optical size axis. */
export const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  variable: "--font-dm-sans",
  display: "swap",
});

/** Sora: display headings and code digits (Figma: Display, H1, Display/SM). */
export const sora = Sora({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "700"],
  variable: "--font-sora",
  display: "swap",
});
