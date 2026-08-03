type BreadcrumbItem = { label: string; href: string };

/** Matches the existing storefront BreadcrumbList convention without product or price schema. */
export function publicBreadcrumbJsonLd(items: readonly BreadcrumbItem[]): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: `https://ktcouriers.com${item.href}`,
    })),
  }).replace(/</g, "\\u003c");
}
