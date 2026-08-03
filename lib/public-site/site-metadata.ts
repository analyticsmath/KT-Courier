import type { Metadata } from "next";
import { canonicalSiteOrigin } from "./site-origin";

export const publicSiteMetadata = {
  displayName: "KT Couriers",
  language: "en",
  locale: "en_GB",
  defaultTitle: "KT Couriers | Courier services",
  titleTemplate: "%s | KT Couriers",
  defaultDescription:
    "Explore KT Couriers public service information and use the account-based request flow for current delivery arrangements.",
  defaultOpenGraphImage: {
    url: "/opengraph-image",
    width: 1200,
    height: 630,
    alt: "KT Couriers — courier services",
  },
  themeColor: "#101210",
} as const;

export const rootSiteMetadata: Metadata = {
  title: {
    default: publicSiteMetadata.defaultTitle,
    template: publicSiteMetadata.titleTemplate,
  },
  description: publicSiteMetadata.defaultDescription,
  metadataBase: canonicalSiteOrigin,
  applicationName: publicSiteMetadata.displayName,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: publicSiteMetadata.displayName,
    locale: publicSiteMetadata.locale,
    title: publicSiteMetadata.defaultTitle,
    description: publicSiteMetadata.defaultDescription,
    url: "/",
    images: [publicSiteMetadata.defaultOpenGraphImage],
  },
  twitter: {
    card: "summary_large_image",
    title: publicSiteMetadata.defaultTitle,
    description: publicSiteMetadata.defaultDescription,
    images: [publicSiteMetadata.defaultOpenGraphImage.url],
  },
  robots: { index: true, follow: true },
};

/**
 * Removes inherited public canonical and social metadata from functional or
 * protected routes. Individual pages can still provide a safe route title.
 */
export const noIndexPublicMetadata: Metadata = {
  robots: { index: false, follow: true, nocache: true },
  alternates: { canonical: null },
  openGraph: null,
  twitter: null,
};

type PublicPageMetadataInput = {
  title: string;
  description: string;
  route: `/${string}`;
  noindex?: boolean;
};

/** Creates complete metadata for ordinary public routes without adding a social account or business facts. */
export function publicPageMetadata({
  title,
  description,
  route,
  noindex = false,
}: PublicPageMetadataInput): Metadata {
  const fullTitle = `${title} | ${publicSiteMetadata.displayName}`;

  return {
    title,
    description,
    alternates: { canonical: route },
    robots: noindex ? { index: false, follow: true, nocache: true } : { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: publicSiteMetadata.displayName,
      locale: publicSiteMetadata.locale,
      title: fullTitle,
      description,
      url: route,
      images: [publicSiteMetadata.defaultOpenGraphImage],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [publicSiteMetadata.defaultOpenGraphImage.url],
    },
  };
}
