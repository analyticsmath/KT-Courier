import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MarketplaceOfferList } from "@/components/public-v2/marketplace/MarketplaceCards";
import styles from "@/components/public-v2/marketplace/market-hall.module.css";
import { marketplaceHref, marketplaceProductHref, marketplacePublicReference, marketplaceVariantHref, parseMarketplaceProductParameter } from "@/lib/public-marketplace/routes";
import { availabilityLabel } from "@/lib/storefront/storefront-availability-policy";
import { storefrontVariantJsonLd } from "@/lib/storefront/seo/storefront-structured-data";
import { publicStorefrontPageExposureAllowed } from "@/lib/storefront/storefront-page-access";
import { getStorefrontVariant } from "@/lib/services/storefront-catalog.service";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ product: string; variantReference: string }> }): Promise<Metadata> {
  if (!publicStorefrontPageExposureAllowed()) return { robots: { index: false, follow: true } };
  const { product, variantReference } = await params;
  const parsed = parseMarketplaceProductParameter(product);
  if (!parsed || !marketplacePublicReference(variantReference)) return {};
  const data = await getStorefrontVariant(parsed.reference, variantReference);
  const canonical = data ? marketplaceVariantHref(data.variant.productSlug, data.variant.productReference, data.variant.variantReference) : null;
  return data && data.variant.productSlug === parsed.slug ? { title: `${data.variant.title} | ${data.variant.variantReference}`, alternates: canonical ? { canonical } : undefined } : {};
}

export default async function VariantPage({ params }: { params: Promise<{ product: string; variantReference: string }> }) {
  const { product, variantReference } = await params;
  const parsed = parseMarketplaceProductParameter(product);
  if (!parsed || !marketplacePublicReference(variantReference)) notFound();
  const data = await getStorefrontVariant(parsed.reference, variantReference);
  if (!data || data.variant.productSlug !== parsed.slug) notFound();
  const variant = data.variant;
  const price = new Intl.NumberFormat("en-ZA", { style: "currency", currency: variant.price.currency }).format(Number(variant.price.amount));
  const productHref = marketplaceProductHref(variant.productSlug, variant.productReference);

  return <main className={`${styles.page} ${styles.productDetail}`} id="storefront-content"><script dangerouslySetInnerHTML={{ __html: storefrontVariantJsonLd(variant) }} type="application/ld+json" /><div className={styles.inner}><nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href={marketplaceHref()}>Shop</Link> / {productHref ? <Link href={productHref}>{variant.title}</Link> : <span>{variant.title}</span>} / <span aria-current="page">Variant</span></nav><div className={styles.productLayout}><section className={styles.productGallery}><div className={styles.productMedia}>{variant.primaryMedia ? <Image alt={variant.primaryMedia.alt} fill preload sizes="(max-width: 899px) calc(100vw - 40px), 55vw" src={`/api/catalog/media/${variant.primaryMedia.publicReference}`} /> : <div aria-label={`${variant.title} image unavailable`} className={styles.productMediaUnavailable} role="img">Image unavailable</div>}</div><div className={styles.galleryCaption}><span>{variant.primaryMedia ? "1 published image" : "Media unavailable"}</span><span>Variant media</span></div></section><section className={styles.productSide}><p className={styles.eyebrow}>Published variant</p><h1 className={styles.productTitle}>{variant.title}</h1><p className={styles.price}>{price}<small>VAT included</small></p><p className={styles.availability}>{availabilityLabel(variant.availability)}</p><ul className={styles.attributeList} aria-label="Variant selections">{Object.entries(variant.variantOptions).map(([name, value]) => <li key={name}><strong>{name}</strong>{value}</li>)}</ul><p className={styles.purchaseLock}>Purchase controls are unavailable until the canonical cart and checkout flow is enabled.</p></section></div><section className={styles.offerSection} aria-labelledby="variant-offers"><p className={styles.eyebrow}>Published offers</p><h2 id="variant-offers">Available from stores</h2><MarketplaceOfferList offers={data.offers} /></section></div></main>;
}
