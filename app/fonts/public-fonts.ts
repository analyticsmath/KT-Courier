import localFont from "next/font/local";

/**
 * Public-only typefaces. The variable classes are applied at the public visual
 * boundary, never at the application root, so dashboard typography is unchanged.
 */
const publicSchibsted = localFont({
  src: [{
    path: "./public/SchibstedGrotesk-Variable.woff2",
    weight: "400 900",
    style: "normal",
  }],
  display: "swap",
  preload: true,
  variable: "--kt-public-font-schibsted-source",
});

/** Kept separate from the primary family so it is not preloaded globally. */
const publicMonaMono = localFont({
  src: "./public/MonaSansMonoVF[wdth,wght].woff2",
  weight: "200 900",
  style: "normal",
  display: "optional",
  preload: false,
  variable: "--kt-public-font-mono-source",
});

export const publicFontVariables = `${publicSchibsted.variable} ${publicMonaMono.variable}`;
