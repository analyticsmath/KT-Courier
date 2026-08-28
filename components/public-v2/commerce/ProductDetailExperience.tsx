import Image from "next/image";
import Link from "next/link";
import type {
  StorefrontDocument,
  StorefrontProductCard,
} from "@/lib/storefront/storefront-types";
import {
  marketplaceCategoryHref,
  marketplaceHref,
  marketplaceStoreHref,
  marketplaceVariantHref,
} from "@/lib/public-marketplace/routes";
import { availabilityLabel, AVAILABILITY_ADVISORY } from "@/lib/storefront/storefront-availability-policy";
import { OfferComparison } from "./OfferComparison";
import { ProductGrid } from "./ProductGrid";
import styles from "./commerce.module.css";

function formatPrice(amount: string, currency: "ZAR") {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(
    Number(amount)
  );
}

interface ProductStoreInfo {
  slug: string;
  name: string;
  description?: string;
}

interface ProductDetailExperienceProps {
  product: StorefrontDocument;
  offers: readonly StorefrontDocument[];
  store?: ProductStoreInfo | null;
  sameStoreProducts?: readonly StorefrontProductCard[];
  relatedProducts?: readonly StorefrontProductCard[];
  selectedVariantReference?: string;
}

export function ProductDetailExperience({
  product,
  offers,
  store,
  sameStoreProducts = [],
  relatedProducts = [],
  selectedVariantReference,
}: ProductDetailExperienceProps) {
  const variants = [
    ...new Map(offers.map((offer) => [offer.variantReference, offer])).values(),
  ];

  const categoryHref = marketplaceCategoryHref(product.categoryPath);
  const storeHref = store ? marketplaceStoreHref(store.slug) : null;

  return (
    <div className={styles.commerceInner}>
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        style={{
          fontSize: "0.85rem",
          color: "var(--kt-muted, #5f6763)",
          padding: "1.5rem 0 1rem",
        }}
      >
        <Link href={marketplaceHref()} style={{ color: "inherit", textDecoration: "none" }}>
          Shop
        </Link>{" "}
        /{" "}
        {categoryHref ? (
          <Link href={categoryHref} style={{ color: "inherit", textDecoration: "none" }}>
            {product.categoryPath}
          </Link>
        ) : (
          <span>{product.categoryPath}</span>
        )}{" "}
        /{" "}
        <span aria-current="page" style={{ color: "var(--kt-carbon, #101210)", fontWeight: 600 }}>
          {product.title}
        </span>
      </nav>

      {/* Main First Viewport Layout */}
      <div className={styles.pdpLayout}>
        {/* Large Media Field */}
        <section aria-label="Product image" className={styles.pdpMediaField}>
          {product.primaryMedia ? (
            <Image
              alt={product.primaryMedia.alt || product.title}
              fill
              priority
              sizes="(max-width: 991px) 100vw, 58vw"
              src={`/api/catalog/media/${product.primaryMedia.publicReference}`}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              aria-label={`${product.title} image unavailable`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                color: "var(--kt-muted, #5f6763)",
                fontSize: "0.95rem",
              }}
            >
              Image unavailable
            </div>
          )}
        </section>

        {/* Product Information Plane */}
        <section aria-label="Product details" className={styles.pdpInfoPlane}>
          {product.brandName && (
            <span style={{ fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--kt-muted, #5f6763)" }}>
              {product.brandName}
            </span>
          )}

          <h1 className={styles.pdpTitle}>{product.title}</h1>

          <div className={styles.pdpPriceRow}>
            <span className={styles.pdpPrice}>
              {offers.length > 1 ? "From " : ""}
              {formatPrice(product.price.amount, product.price.currency)}
            </span>
            <span className={styles.pdpVatNote}>VAT included</span>
          </div>

          <span style={{ fontSize: "0.85rem", color: "var(--kt-graphite, #303532)" }}>
            {availabilityLabel(product.availability)}
          </span>

          {store && storeHref && (
            <div className={styles.pdpSellerByline}>
              Sold by <Link href={storeHref}>{store.name}</Link>
            </div>
          )}

          {/* Variant Selector */}
          {variants.length > 1 && (
            <div className={styles.variantSelectorBlock}>
              <span className={styles.variantGroupLabel}>Available options</span>
              <div className={styles.variantOptionsList}>
                {variants.map((v) => {
                  const isSelected = selectedVariantReference === v.variantReference;
                  const vHref = marketplaceVariantHref(
                    product.productSlug,
                    product.productReference,
                    v.variantReference
                  );
                  if (!vHref) return null;

                  return (
                    <Link
                      className={`${styles.variantOptionButton} ${
                        isSelected ? styles.variantOptionButtonActive : ""
                      }`}
                      href={vHref}
                      key={v.variantReference}
                    >
                      {Object.values(v.variantOptions).join(" · ") || "Standard"}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Attributes List */}
          <ul
            aria-label="Product specifications"
            style={{
              listStyle: "none",
              padding: "16px 0",
              margin: 0,
              borderBlock: "1px solid var(--kt-cool-200, #dde1e0)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: "0.9rem",
            }}
          >
            <li style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--kt-muted, #5f6763)" }}>Condition</span>
              <span style={{ fontWeight: 540 }}>{product.condition.replaceAll("_", " ").toLowerCase()}</span>
            </li>
            <li style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--kt-muted, #5f6763)" }}>Fulfilment</span>
              <span style={{ fontWeight: 540 }}>{product.fulfilmentMode.replaceAll("_", " ").toLowerCase()}</span>
            </li>
            <li style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--kt-muted, #5f6763)" }}>Availability</span>
              <span style={{ fontWeight: 540 }}>{AVAILABILITY_ADVISORY}</span>
            </li>
          </ul>

          {/* Honest Purchase Availability Box */}
          <div className={styles.pdpPurchaseStatusBox}>
            <h2 className={styles.purchaseStatusHeading}>Purchasing Information</h2>
            <p className={styles.purchaseStatusText}>
              Online purchase is not available on this public storefront yet.
              Availability is confirmed from the selected product, store and delivery details.
            </p>
            {storeHref && (
              <Link className={styles.sectionDirectLink} href={storeHref} style={{ marginTop: 6 }}>
                Explore store products &rarr;
              </Link>
            )}
          </div>
        </section>
      </div>

      {/* Description Section */}
      {product.description && (
        <section aria-labelledby="pdp-desc-heading" className={styles.pdpOffersSection}>
          <h2 id="pdp-desc-heading" style={{ fontSize: "1.6rem", fontWeight: 560, marginBottom: 16 }}>
            About this product
          </h2>
          <p style={{ fontSize: "1.05rem", color: "var(--kt-graphite, #303532)", lineHeight: 1.6, maxWidth: 800 }}>
            {product.description}
          </p>
        </section>
      )}

      {/* Available Offers from Stores */}
      <section aria-labelledby="pdp-offers-heading" className={styles.pdpOffersSection}>
        <h2 id="pdp-offers-heading" style={{ fontSize: "1.6rem", fontWeight: 560, marginBottom: 20 }}>
          Available from stores
        </h2>
        <OfferComparison offers={offers} />
      </section>

      {/* Same Store Products */}
      {sameStoreProducts.length > 0 && (
        <section aria-labelledby="pdp-same-store-heading" className={styles.pdpRelatedSection}>
          <div className={styles.sectionHeaderRow}>
            <h2 id="pdp-same-store-heading" style={{ fontSize: "1.6rem", fontWeight: 560 }}>
              More from {store?.name || "this store"}
            </h2>
            {storeHref && (
              <Link className={styles.sectionDirectLink} href={storeHref}>
                All store items &rarr;
              </Link>
            )}
          </div>
          <ProductGrid label={`More from ${store?.name}`} products={sameStoreProducts} />
        </section>
      )}

      {/* Related Category Products */}
      {relatedProducts.length > 0 && (
        <section aria-labelledby="pdp-related-heading" className={styles.pdpRelatedSection}>
          <div className={styles.sectionHeaderRow}>
            <h2 id="pdp-related-heading" style={{ fontSize: "1.6rem", fontWeight: 560 }}>
              Related in {product.categoryPath}
            </h2>
            {categoryHref && (
              <Link className={styles.sectionDirectLink} href={categoryHref}>
                Explore category &rarr;
              </Link>
            )}
          </div>
          <ProductGrid label="Related products" products={relatedProducts} />
        </section>
      )}
    </div>
  );
}
