import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MarketplaceOfferList, MarketplaceProductGrid } from "@/components/public-v2/marketplace/MarketplaceCards";
import styles from "@/components/public-v2/marketplace/market-hall.module.css";
import { marketplaceCategoryHref, marketplaceHref, marketplaceProductHref, marketplaceStoreHref, marketplaceVariantHref, parseMarketplaceProductParameter } from "@/lib/public-marketplace/routes";
import { AVAILABILITY_ADVISORY, availabilityLabel } from "@/lib/storefront/storefront-availability-policy";
import { storefrontBreadcrumbJsonLd, storefrontProductGroupJsonLd } from "@/lib/storefront/seo/storefront-structured-data";
import { getStorefrontProduct, getStorefrontStore } from "@/lib/services/storefront-catalog.service";
import { PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import { notFound } from "next/navigation";

function formatPrice(amount: string, currency: "ZAR") {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(Number(amount));
}

export async function generateMetadata({ params }: { params: Promise<{ product: string }> }): Promise<Metadata> {
  const parsed = parseMarketplaceProductParameter((await params).product);
  if (!parsed) return {};
  const data = await getStorefrontProduct(parsed.reference);
  if (!data || data.product.productSlug !== parsed.slug) return {};
  const canonical = marketplaceProductHref(data.product.productSlug, data.product.productReference);
  return data ? {
    title: data.product.title,
    description: data.product.shortDescription ?? data.product.description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: data.product.title,
      description: data.product.shortDescription ?? data.product.description,
      ...(data.product.primaryMedia ? { images: [{ url: `/api/catalog/media/${data.product.primaryMedia.publicReference}`, width: data.product.primaryMedia.width, height: data.product.primaryMedia.height, alt: data.product.primaryMedia.alt }] } : {}),
    },
  } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ product: string }> }) {
  const parsed = parseMarketplaceProductParameter((await params).product);
  if (!parsed) notFound();
  const data = await getStorefrontProduct(parsed.reference);
  if (!data || data.product.productSlug !== parsed.slug) notFound();
  const { product, offers } = data;
  const [sameStore, related, store] = await Promise.all([
    new StorefrontSearchService(new PostgresStorefrontSearchAdapter()).search({ store: product.storeSlug, pageSize: 8 }),
    new StorefrontSearchService(new PostgresStorefrontSearchAdapter()).search({ category: product.categoryPath, pageSize: 8 }),
    getStorefrontStore(product.storeSlug),
  ]);
  const sameStoreProducts = sameStore.results.filter((item) => item.productReference !== product.productReference).slice(0, 4);
  const relatedProducts = related.results.filter((item) => item.productReference !== product.productReference).slice(0, 4);
  const variants = [...new Map(offers.map((offer) => [offer.variantReference, offer])).values()];
  const productHref = marketplaceProductHref(product.productSlug, product.productReference);
  const categoryHref = marketplaceCategoryHref(product.categoryPath);
  const storeHref = store ? marketplaceStoreHref(store.slug) : null;

  return (
    <main className={`${styles.page} ${styles.productDetail}`} id="storefront-content">
      <script dangerouslySetInnerHTML={{ __html: storefrontProductGroupJsonLd(product, offers) }} type="application/ld+json" />
      {productHref ? <script dangerouslySetInnerHTML={{ __html: storefrontBreadcrumbJsonLd([{ label: "Shop", url: marketplaceHref() }, { label: product.title, url: productHref }]) }} type="application/ld+json" /> : null}
      <div className={styles.inner}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href={marketplaceHref()}>Shop</Link> / {categoryHref ? <Link href={categoryHref}>{product.categoryPath}</Link> : <span>{product.categoryPath}</span>} / <span aria-current="page">{product.title}</span></nav>
        <div className={styles.productLayout}>
          <section className={styles.productGallery} aria-label="Product media">
            <div className={styles.productMedia}>{product.primaryMedia ? <Image alt={product.primaryMedia.alt} fill preload sizes="(max-width: 899px) calc(100vw - 40px), 55vw" src={`/api/catalog/media/${product.primaryMedia.publicReference}`} /> : <div aria-label={`${product.title} image unavailable`} className={styles.productMediaUnavailable} role="img">Image unavailable</div>}</div>
            <div className={styles.galleryCaption}><span>{product.primaryMedia ? "1 published image" : "Media unavailable"}</span><span>Media is supplied by the public catalog projection.</span></div>
          </section>
          <section className={styles.productSide}>
            {product.brandName ? <p className={styles.eyebrow}>{product.brandName}</p> : <p className={styles.eyebrow}>Marketplace product</p>}
            <h1 className={styles.productTitle}>{product.title}</h1>
            <p className={styles.price}>{offers.length > 1 ? "From " : ""}{formatPrice(product.price.amount, product.price.currency)}<small>VAT included</small></p>
            <p className={styles.availability}>{availabilityLabel(product.availability)}</p>
            {product.shortDescription ? <p className={styles.productDescription}>{product.shortDescription}</p> : null}
            {store && storeHref ? <p className={styles.storeByline}>Sold by <Link href={storeHref}>{store.name}</Link></p> : null}
            <ul className={styles.attributeList} aria-label="Product details">
              <li><strong>Condition</strong>{product.condition.replaceAll("_", " ").toLocaleLowerCase("en-ZA")}</li>
              <li><strong>Fulfilment</strong>{product.fulfilmentMode.replaceAll("_", " ").toLocaleLowerCase("en-ZA")}</li>
              <li><strong>Availability</strong>{AVAILABILITY_ADVISORY}</li>
            </ul>
            {variants.length > 1 ? <section className={styles.offerSection} aria-labelledby="product-variants"><p className={styles.eyebrow}>Published variants</p><h2 id="product-variants">Choose a variant</h2><div className={styles.appliedFilters}>{variants.flatMap((variant) => { const href = marketplaceVariantHref(product.productSlug, product.productReference, variant.variantReference); return href ? <Link href={href} key={variant.variantReference}>{Object.values(variant.variantOptions).join(" · ") || "View variant"}</Link> : []; })}</div></section> : null}
            <p className={styles.purchaseLock}>Purchase controls are unavailable until the canonical cart and checkout flow is enabled. Product and store browsing remain available.</p>
          </section>
        </div>
        {product.description ? <section className={styles.offerSection} aria-labelledby="product-description"><p className={styles.eyebrow}>Description</p><h2 id="product-description">About this product</h2><p className={styles.productDescription}>{product.description}</p></section> : null}
        <section className={styles.offerSection} aria-labelledby="product-offers"><p className={styles.eyebrow}>Published offers</p><h2 id="product-offers">Available from stores</h2><MarketplaceOfferList offers={offers} /></section>
        {sameStoreProducts.length ? <section className={styles.offerSection} aria-labelledby="same-store-products"><p className={styles.eyebrow}>From this store</p><h2 id="same-store-products">More to explore</h2><MarketplaceProductGrid label="More from this store" products={sameStoreProducts} /></section> : null}
        {relatedProducts.length ? <section className={styles.offerSection} aria-labelledby="related-products"><p className={styles.eyebrow}>Same category</p><h2 id="related-products">Related products</h2><MarketplaceProductGrid label="Related products" products={relatedProducts} /></section> : null}
      </div>
    </main>
  );
}
