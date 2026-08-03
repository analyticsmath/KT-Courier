import type { MetadataRoute } from "next";
import { sitemapPublicRoutes } from "@/lib/public-site/public-route-registry";
import { canonicalUrl } from "@/lib/public-site/site-origin";

export default function sitemap(): MetadataRoute.Sitemap {
  // indexablePublicServicePages
  return sitemapPublicRoutes.map((route) => ({ url: canonicalUrl(route.route) }));
}
