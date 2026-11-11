import { Inter, Sora } from "next/font/google";

/**
 * The only two typefaces (BRIEF.md section 2), self-hosted by next/font.
 *
 * Inter 400 / 500 / 600: everything except display text. Labels 500,
 * buttons and tab labels 600.
 */
export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

/** Sora 300 for titles, section headings and big numerals; 400 and 600 are loaded as the brief asks. */
export const sora = Sora({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "600"],
  variable: "--font-sora",
  display: "swap",
});
