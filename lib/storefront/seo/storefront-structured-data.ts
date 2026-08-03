import type { StorefrontDocument } from "@/lib/storefront/storefront-types";

function availability(value: StorefrontDocument["availability"]): string {
  return value === "OUT_OF_STOCK" || value === "NOT_AVAILABLE_IN_AREA" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock";
}
function safeJson(value: unknown): string { return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026"); }
export function storefrontProductGroupJsonLd(product: StorefrontDocument, offers: StorefrontDocument[]): string {
  return safeJson({ "@context": "https://schema.org", "@type": "ProductGroup", name: product.title, ...(product.brandName ? { brand: { "@type": "Brand", name: product.brandName } } : {}), variesBy: Object.keys(product.variantOptions).map((key) => `https://schema.org/${key}`), hasVariant: [...new Map(offers.map((offer) => [offer.variantReference, offer])).values()].map((variant) => ({ "@type": "Product", name: variant.title, offers: { "@type": "Offer", priceCurrency: "ZAR", price: variant.price.amount, availability: availability(variant.availability), seller: { "@type": "Organization", name: variant.storeSlug } } })) });
}
export function storefrontVariantJsonLd(variant: StorefrontDocument): string {
  return safeJson({ "@context": "https://schema.org", "@type": "Product", name: variant.title, ...(variant.brandName ? { brand: { "@type": "Brand", name: variant.brandName } } : {}), offers: { "@type": "Offer", priceCurrency: "ZAR", price: variant.price.amount, availability: availability(variant.availability), seller: { "@type": "Organization", name: variant.storeSlug } } });
}
export function storefrontBreadcrumbJsonLd(items: Array<{ label: string; url: string }>): string { return safeJson({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.label, item: item.url })) }); }
