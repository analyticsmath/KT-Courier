import localFont from "next/font/local";

/**
 * Protected-only font variables. The files are shared with the public font
 * authority; only the scoped variable names differ so neither surface leaks
 * typography into the other.
 */
const protectedMonaSans = localFont({
  src: [
    {
      path: "./public/MonaSansVF[wdth,opsz,wght].woff2",
      weight: "200 900",
      style: "normal",
    },
    {
      path: "./public/MonaSansVF-Italic[wdth,opsz,wght].woff2",
      weight: "200 900",
      style: "italic",
    },
  ],
  display: "swap",
  preload: true,
  variable: "--eo-font-mona-source",
});

const protectedNewsreader = localFont({
  src: [
    {
      path: "./public/Newsreader[opsz,wght].woff2",
      weight: "200 800",
      style: "normal",
    },
    {
      path: "./public/Newsreader-Italic[opsz,wght].woff2",
      weight: "200 800",
      style: "italic",
    },
  ],
  display: "swap",
  preload: false,
  variable: "--eo-font-newsreader-source",
});

export const protectedFontVariables = `${protectedMonaSans.variable} ${protectedNewsreader.variable}`;
