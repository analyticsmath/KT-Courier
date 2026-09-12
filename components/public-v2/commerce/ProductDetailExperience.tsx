"use client";

import { useState } from "react";
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

  const gallery = product.mediaGallery && product.mediaGallery.length > 0
    ? product.mediaGallery
    : product.primaryMedia
      ? [product.primaryMedia]
      : [];
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const activeMedia = gallery[activeMediaIndex] ?? product.primaryMedia;

  const categoryHref = marketplaceCategoryHref(product.categoryPath);
  const storeHref = store ? marketplaceStoreHref(store.slug) : null;

  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartFeedback, setCartFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [cartVersion, setCartVersion] = useState<number | null>(null);

  const isPurchasable = product.availability === "IN_STOCK" || product.availability === "LOW_STOCK";

  const handleAddToCart = async () => {
    if (!isPurchasable || addingToCart) return;
    setAddingToCart(true);
    setCartFeedback(null);

    try {
      let activeVersion: number = cartVersion ?? 1;
      if (cartVersion === null) {
        const cartRes = await fetch("/api/cart");
        if (cartRes.ok) {
          const cartData = await cartRes.json();
          activeVersion = cartData.cart?.version ?? 1;
          setCartVersion(activeVersion);
        }
      }

      const computeHash = async (val: string) => {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(val));
        return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
      };

      const sendAddLine = async (ver: number) => {
        const opId = `add-${crypto.randomUUID()}`;
        const reqHash = await computeHash(`${product.offerReference}:${quantity}:${ver}:${opId}`);
        return fetch("/api/cart/lines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offerReference: product.offerReference,
            variantReference: product.variantReference,
            quantity,
            modifiers: [],
            operationId: opId,
            requestHash: reqHash,
            cartVersion: ver,
          }),
        });
      };

      let res = await sendAddLine(activeVersion);

      if (res.status === 409) {
        const refreshRes = await fetch("/api/cart");
        if (refreshRes.ok) {
          const freshData = await refreshRes.json();
          const freshVersion = freshData.cart?.version ?? (activeVersion + 1);
          setCartVersion(freshVersion);
          res = await sendAddLine(freshVersion);
        }
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Failed to add item to cart.");
      }

      const data = await res.json();
      const updatedVersion = data.cart?.version ?? (activeVersion + 1);
      setCartVersion(updatedVersion);
      setCartFeedback({
        type: "success",
        message: `${quantity} ${quantity === 1 ? "item" : "items"} added to your cart.`,
      });
    } catch (err) {
      setCartFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Could not add item to cart.",
      });
    } finally {
      setAddingToCart(false);
    }
  };

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
        {/* Large Media Field with Gallery */}
        <section aria-label="Product image gallery" className={styles.pdpMediaField}>
          <div style={{ position: "relative", width: "100%", aspectRatio: "1/1", borderRadius: "12px", overflow: "hidden", backgroundColor: "var(--kt-surface-raised, #f6f8f7)" }}>
            {activeMedia ? (
              <Image
                alt={activeMedia.alt || product.title}
                fill
                priority
                sizes="(max-width: 991px) 100vw, 58vw"
                src={`/api/catalog/media/${activeMedia.publicReference}`}
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
          </div>

          {gallery.length > 1 && (
            <div
              role="tablist"
              aria-label="Product image thumbnails"
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "12px",
                overflowX: "auto",
                paddingBottom: "4px",
              }}
            >
              {gallery.map((media, idx) => {
                const isSelected = idx === activeMediaIndex;
                return (
                  <button
                    key={media.publicReference}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    aria-label={`View image ${idx + 1} of ${gallery.length}: ${media.alt || product.title}`}
                    tabIndex={0}
                    onClick={() => setActiveMediaIndex(idx)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveMediaIndex(idx);
                      }
                    }}
                    style={{
                      position: "relative",
                      width: "72px",
                      height: "72px",
                      flexShrink: 0,
                      borderRadius: "8px",
                      overflow: "hidden",
                      border: isSelected ? "2px solid var(--kt-primary, #047857)" : "1px solid var(--kt-cool-200, #dde1e0)",
                      cursor: "pointer",
                      padding: 0,
                      background: "transparent",
                      outlineOffset: "2px",
                      transition: "border-color 0.15s ease",
                    }}
                  >
                    <Image
                      alt={media.alt || `${product.title} view ${idx + 1}`}
                      fill
                      sizes="72px"
                      src={`/api/catalog/media/${media.publicReference}`}
                      style={{ objectFit: "cover" }}
                    />
                  </button>
                );
              })}
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

          {/* Interactive Purchase Controls */}
          <div className={styles.pdpPurchaseStatusBox}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--kt-carbon, #101210)" }}>
                Quantity
              </span>
              <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--kt-cool-200, #dde1e0)", borderRadius: 4, overflow: "hidden" }}>
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || addingToCart}
                  style={{
                    padding: "6px 12px",
                    background: "none",
                    border: "none",
                    cursor: quantity <= 1 ? "not-allowed" : "pointer",
                    fontSize: "1rem",
                    fontWeight: 600,
                  }}
                >
                  -
                </button>
                <span style={{ padding: "6px 14px", fontSize: "0.95rem", fontWeight: 600, minWidth: 24, textAlign: "center" }}>
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                  disabled={quantity >= 10 || addingToCart}
                  style={{
                    padding: "6px 12px",
                    background: "none",
                    border: "none",
                    cursor: quantity >= 10 ? "not-allowed" : "pointer",
                    fontSize: "1rem",
                    fontWeight: 600,
                  }}
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!isPurchasable || addingToCart}
              style={{
                marginTop: 10,
                width: "100%",
                padding: "14px 20px",
                backgroundColor: isPurchasable ? "var(--kt-carbon, #101210)" : "#8e9591",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: "1rem",
                fontWeight: 600,
                cursor: isPurchasable && !addingToCart ? "pointer" : "not-allowed",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
              }}
            >
              {addingToCart ? "Adding to Cart..." : isPurchasable ? "Add to Cart" : "Currently Unavailable"}
            </button>

            {cartFeedback && (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 14px",
                  borderRadius: 4,
                  fontSize: "0.875rem",
                  backgroundColor: cartFeedback.type === "success" ? "#eef8f1" : "#fdf2f2",
                  color: cartFeedback.type === "success" ? "#1e6e38" : "#ba1a1a",
                  border: `1px solid ${cartFeedback.type === "success" ? "#bce3c6" : "#f8b4b4"}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{cartFeedback.message}</span>
                {cartFeedback.type === "success" && (
                  <Link
                    href="/cart"
                    style={{
                      fontWeight: 600,
                      color: "#1e6e38",
                      textDecoration: "underline",
                      marginLeft: 8,
                      whiteSpace: "nowrap",
                    }}
                  >
                    View Cart &rarr;
                  </Link>
                )}
              </div>
            )}

            {storeHref && (
              <Link className={styles.sectionDirectLink} href={storeHref} style={{ marginTop: 8 }}>
                Explore more from {store?.name || "this store"} &rarr;
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
