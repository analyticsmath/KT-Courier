import type { MetadataRoute } from "next";
import { publicSiteMetadata } from "@/lib/public-site/site-metadata";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: publicSiteMetadata.displayName,
    short_name: publicSiteMetadata.displayName,
    start_url: "/",
    display: "browser",
    background_color: "#FFFFFF",
    theme_color: publicSiteMetadata.themeColor,
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png" },
      { src: "/icon", sizes: "512x512", type: "image/png" },
    ],
  };
}
