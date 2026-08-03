import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/public-site/site-origin";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Robots is not an authorization boundary. Route metadata provides the
        // noindex decisions; these prefixes simply avoid inviting crawler work.
        disallow: [
          "/account/", "/admin/", "/store/", "/driver/", "/applicant/", "/payments/", "/api/",
          "/cart", "/checkout/", "/order-confirmation/", "/membership/checkout",
          "/shop/search", "/shop/preview",
        ],
      },
    ],
    sitemap: [canonicalUrl("/sitemap.xml"), canonicalUrl("/shop/sitemap.xml")],
  };
}
