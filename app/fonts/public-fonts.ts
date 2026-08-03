import localFont from "next/font/local";

/**
 * Public-only typefaces. The variable classes are applied at the public visual
 * boundary, never at the application root, so dashboard typography is unchanged.
 */
const publicMonaSans = localFont({
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
  variable: "--kt-public-font-mona-source",
});

const publicNewsreader = localFont({
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
  variable: "--kt-public-font-editorial-source",
});

export const publicFontVariables = `${publicMonaSans.variable} ${publicNewsreader.variable}`;
