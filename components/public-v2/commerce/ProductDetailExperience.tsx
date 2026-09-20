"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, LayoutGroup } from "motion/react";
import type {
  StorefrontDocument,
  StorefrontProductCard,
} from "@/lib/storefront/storefront-types";
import type { StorefrontModifierGroupDTO } from "@/lib/services/storefront-catalog.service";
import {
  marketplaceCategoryHref,
  marketplaceHref,
  marketplaceStoreHref,
  marketplaceVariantHref,
} from "@/lib/public-marketplace/routes";
import { formatCommercePrice } from "@/lib/public-marketplace/commerce-presentation";
import { ProductMediaGallery } from "./ProductMediaGallery";
import { SellerSelector } from "./SellerSelector";
import { ProductInformation } from "./ProductInformation";
import { ProductGrid } from "./ProductGrid";
import { triggerCartFlight } from "./AddToCartFlightPortal";
import { CommerceBreadcrumbs } from "./CommerceBreadcrumbs";
import type { CommerceCategoryNode } from "@/lib/public-marketplace/category-presentation";
import styles from "./commerce.module.css";

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
  modifierGroupsByOffer?: Record<string, StorefrontModifierGroupDTO[]>;
  categoryHierarchy?: readonly CommerceCategoryNode[];
}

export function ProductDetailExperience({
  product,
  offers,
  store,
  sameStoreProducts = [],
  relatedProducts = [],
  selectedVariantReference,
  modifierGroupsByOffer,
  categoryHierarchy = [],
}: ProductDetailExperienceProps) {
  const router = useRouter();

  const variants = [
    ...new Map(offers.map((offer) => [offer.variantReference, offer])).values(),
  ];

  const gallery = product.mediaGallery && product.mediaGallery.length > 0
    ? product.mediaGallery
    : product.primaryMedia
      ? [product.primaryMedia]
      : [];

  const categoryHref = marketplaceCategoryHref(product.categoryPath);
  const storeHref = store ? marketplaceStoreHref(store.slug) : null;

  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
  const [cartFeedback, setCartFeedback] = useState<{
    type: "success" | "error";
    message: string;
    existingCartItemCount?: number;
  } | null>(null);
  const [cartVersion, setCartVersion] = useState<number | null>(null);

  // Multi-seller offer selection
  const [selectedOfferOverride, setSelectedOfferOverride] = useState<string | null>(null);
  const selectedOfferReference = selectedOfferOverride ?? product.offerReference;
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});

  const handleSelectOffer = (offerRef: string) => {
    setSelectedOfferOverride(offerRef);
    setSelectedModifiers({});
    setCartFeedback(null);
  };

  const activeOffer = offers.find((o) => o.offerReference === selectedOfferReference) ?? product;

  // Modifiers state
  const modifierGroups = modifierGroupsByOffer?.[activeOffer.offerReference] ?? [];

  const toggleModifierOption = (groupReference: string, optionReference: string, maxSelections: number) => {
    setSelectedModifiers((prev) => {
      const current = prev[groupReference] ?? [];
      if (maxSelections === 1) {
        return { ...prev, [groupReference]: [optionReference] };
      }
      if (current.includes(optionReference)) {
        return { ...prev, [groupReference]: current.filter((id) => id !== optionReference) };
      }
      if (current.length >= maxSelections) {
        return prev;
      }
      return { ...prev, [groupReference]: [...current, optionReference] };
    });
  };

  const missingRequiredGroup = modifierGroups.find((g) => {
    const selected = selectedModifiers[g.groupReference] ?? [];
    if (g.isRequired && selected.length === 0) return true;
    if (selected.length < g.minimumSelections) return true;
    return false;
  });

  const isPurchasable = activeOffer.availability === "IN_STOCK" || activeOffer.availability === "LOW_STOCK";

  const computeHash = async (val: string) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(val));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const getPayloadModifiers = () => {
    return Object.entries(selectedModifiers).flatMap(([groupReference, optionRefs]) =>
      optionRefs.map((optionReference) => ({
        groupReference,
        optionReference,
        quantity: 1,
      }))
    );
  };

  const executeAddLine = async (ver: number) => {
    const opId = `add-${crypto.randomUUID()}`;
    const reqHash = await computeHash(`${activeOffer.offerReference}:${quantity}:${ver}:${opId}`);
    return fetch("/api/cart/lines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerReference: activeOffer.offerReference,
        variantReference: activeOffer.variantReference,
        quantity,
        modifiers: getPayloadModifiers(),
        operationId: opId,
        requestHash: reqHash,
        cartVersion: ver,
      }),
    });
  };

  const handleAddToCart = async () => {
    if (!isPurchasable || addingToCart || buyingNow) return;

    if (missingRequiredGroup) {
      setCartFeedback({
        type: "error",
        message: `Please select a required option for "${missingRequiredGroup.name}".`,
      });
      return;
    }

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

      let res = await executeAddLine(activeVersion);

      if (res.status === 409) {
        const refreshRes = await fetch("/api/cart");
        if (refreshRes.ok) {
          const freshData = await refreshRes.json();
          const freshVersion = freshData.cart?.version ?? (activeVersion + 1);
          setCartVersion(freshVersion);
          res = await executeAddLine(freshVersion);
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

      // Trigger physical cart flight into header cart target
      triggerCartFlight({
        sourceElement: document.querySelector<HTMLElement>('[data-kt-cart-flight-source="product-media"]'),
        imageSrc: activeOffer.primaryMedia ? `/api/catalog/media/${activeOffer.primaryMedia.publicReference}` : undefined,
      });

      window.dispatchEvent(new CustomEvent("kt-cart-updated"));
    } catch (err) {
      setCartFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Could not add item to cart.",
      });
    } finally {
      setAddingToCart(false);
    }
  };

  /**
   * Buy Now: adds the item to the customer's existing cart, then creates
   * a canonical checkout session with the combined cart and navigates to checkout.
   */
  const handleBuyNow = async () => {
    if (!isPurchasable || addingToCart || buyingNow) return;

    if (missingRequiredGroup) {
      setCartFeedback({
        type: "error",
        message: `Please select a required option for "${missingRequiredGroup.name}".`,
      });
      return;
    }

    setBuyingNow(true);
    setCartFeedback(null);

    try {
      // Check existing cart state to get version and reference
      let activeVersion = cartVersion ?? 1;
      let cartRef: string | undefined;

      const initialCartRes = await fetch("/api/cart");
      if (initialCartRes.ok) {
        const initialCartData = await initialCartRes.json();
        activeVersion = initialCartData.cart?.version ?? 1;
        cartRef = initialCartData.cart?.reference;
        setCartVersion(activeVersion);
      }

      // Add selected offer to the canonical cart
      let res = await executeAddLine(activeVersion);

      if (res.status === 409) {
        const refreshRes = await fetch("/api/cart");
        if (refreshRes.ok) {
          const freshData = await refreshRes.json();
          const freshVersion = freshData.cart?.version ?? (activeVersion + 1);
          cartRef = freshData.cart?.reference;
          setCartVersion(freshVersion);
          res = await executeAddLine(freshVersion);
        }
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Failed to prepare checkout.");
      }

      const addData = await res.json();
      cartRef = addData.cart?.reference ?? cartRef;
      if (!cartRef) {
        // Fetch cart reference if not returned directly
        const fetchCart = await fetch("/api/cart");
        const fetchCartData = await fetchCart.json().catch(() => ({}));
        cartRef = fetchCartData.cart?.reference;
      }

      if (!cartRef) {
        throw new Error("Unable to establish canonical cart reference for checkout.");
      }

      // Notify cart listeners
      window.dispatchEvent(new CustomEvent("kt-cart-updated"));

      // Create checkout session using existing canonical cart
      const checkoutRes = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartReference: cartRef }),
      });

      if (!checkoutRes.ok) {
        const checkoutErr = await checkoutRes.json().catch(() => ({}));
        throw new Error(checkoutErr.error || checkoutErr.message || "Checkout initialization failed.");
      }

      const checkoutData = await checkoutRes.json();
      const checkoutReference = checkoutData.checkout?.reference;

      if (!checkoutReference) {
        throw new Error("Server did not return a valid checkout session.");
      }

      // Route directly to the returned checkout reference
      router.push(`/checkout?ref=${encodeURIComponent(checkoutReference)}`);
    } catch (err) {
      setCartFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Could not proceed to checkout.",
      });
      setBuyingNow(false);
    }
  };

  const breadcrumbItems = [
    { label: "Shop", href: marketplaceHref() },
    ...categoryHierarchy.map((item) => ({ label: item.name, href: item.href })),
    { label: product.title },
  ];

  return (
    <div className={styles.commerceInner}>
      {/* Mobile Top Header */}
      <div className={styles.pdpMobileTopBar}>
        <button aria-label="Go back" onClick={() => window.history.back()} type="button">
          ‹ <span>Back</span>
        </button>
        <Link aria-label="Cart" data-kt-cart-target="mobile-header" href="/cart">
          Cart
        </Link>
      </div>

      {/* Breadcrumbs */}
      <CommerceBreadcrumbs items={breadcrumbItems} />

      {/* Main First Viewport Split Layout */}
      <div className={styles.pdpLayout}>
        {/* Product Media Gallery */}
        <ProductMediaGallery product={product} mediaGallery={gallery} />

        {/* Product Purchase Column */}
        <section aria-label="Purchase product" className={styles.pdpInfoPlane}>
          {/* Identity & Context */}
          <div>
            {product.brandName && (
              <p className={styles.pdpBrandBadge}>{product.brandName}</p>
            )}
            <h1 className={styles.pdpTitle}>{product.title}</h1>
          </div>

          {/* Short Description */}
          {product.shortDescription && (
            <p className={styles.pdpShortDescription}>{product.shortDescription}</p>
          )}

          {/* Price & VAT Row */}
          <div className={styles.pdpPriceRow}>
            <span className={styles.pdpPrice}>
              {offers.length > 1 && selectedOfferReference === product.offerReference ? "From " : ""}
              {formatCommercePrice(activeOffer.price.amount, activeOffer.price.currency)}
            </span>
            <span className={styles.pdpVatNote}>VAT included</span>
          </div>

          {/* Seller / Offer Decision Section */}
          <SellerSelector
            offers={offers}
            selectedOfferReference={activeOffer.offerReference}
            onSelectOffer={handleSelectOffer}
            defaultStoreName={store?.name}
          />

          {/* Variant Selector */}
          {variants.length > 1 && (
            <div className={styles.variantSelectorBlock}>
              <span className={styles.variantGroupLabel}>Available options</span>
              <LayoutGroup id="pdp-variants">
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
                        } relative overflow-hidden`}
                        href={vHref}
                        key={v.variantReference}
                      >
                        <span className="relative z-10">
                          {Object.values(v.variantOptions).join(" · ") || "Standard"}
                        </span>
                        {isSelected && (
                          <motion.div
                            layoutId="activeVariantIndicator"
                            className="absolute inset-0 bg-[#0E1012]/10 z-0 pointer-events-none rounded-[2px]"
                            transition={{ type: "spring", stiffness: 350, damping: 28 }}
                          />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </LayoutGroup>
            </div>
          )}

          {/* Modifiers Selection */}
          {modifierGroups.length > 0 && (
            <div className={styles.pdpModifiersContainer}>
              <span className={styles.variantGroupLabel}>Customise options</span>
              {modifierGroups.map((group) => {
                const selected = selectedModifiers[group.groupReference] ?? [];
                const isGroupSatisfied = !group.isRequired || selected.length >= group.minimumSelections;

                return (
                  <div key={group.groupReference} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className={styles.pdpModifierGroupHeader}>
                      <span className={styles.pdpModifierGroupName}>{group.name}</span>
                      <span
                        className={
                          group.isRequired && !isGroupSatisfied
                            ? styles.pdpModifierBadgeRequired
                            : styles.pdpModifierBadgeOptional
                        }
                      >
                        {group.isRequired ? (isGroupSatisfied ? "Selected" : "Required") : "Optional"}
                      </span>
                    </div>

                    {group.description && (
                      <p style={{ fontSize: "0.8rem", color: "var(--commerce-muted)", margin: 0 }}>
                        {group.description}
                      </p>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {group.options.map((option) => {
                        const isChecked = selected.includes(option.optionReference);
                        const isRadio = group.maximumSelections === 1;

                        return (
                          <label
                            key={option.optionReference}
                            className={`${styles.pdpModifierOptionRow} ${
                              isChecked ? styles.pdpModifierOptionRowActive : ""
                            }`}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <input
                                type={isRadio ? "radio" : "checkbox"}
                                name={group.groupReference}
                                checked={isChecked}
                                onChange={() =>
                                  toggleModifierOption(
                                    group.groupReference,
                                    option.optionReference,
                                    group.maximumSelections
                                  )
                                }
                              />
                              <span>{option.name}</span>
                            </div>
                            <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                              {Number(option.priceDelta) > 0
                                ? `+${formatCommercePrice(option.priceDelta, "ZAR")}`
                                : "Included"}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quantity & Dual Purchase Actions */}
          <div className={styles.pdpActionsBlock}>
            <div className={styles.pdpQuantityRow}>
              <span className={styles.pdpQuantityLabel}>Quantity</span>
              <div className={styles.pdpQuantityStepper}>
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || addingToCart || buyingNow}
                  className={styles.pdpQuantityBtn}
                >
                  −
                </button>
                <span className={styles.pdpQuantityVal}>{quantity}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                  disabled={quantity >= 10 || addingToCart || buyingNow}
                  className={styles.pdpQuantityBtn}
                >
                  +
                </button>
              </div>
            </div>

            {/* Action Buttons: Add to cart & Buy now */}
            <div className={styles.pdpActionButtons}>
              <button
                type="button"
                data-kt-action="add-to-cart"
                onClick={handleAddToCart}
                disabled={!isPurchasable || addingToCart || buyingNow}
                className={styles.pdpBtnAddToCart}
              >
                {addingToCart ? "Adding..." : "Add to cart"}
              </button>

              <button
                type="button"
                data-kt-action="buy-now"
                onClick={handleBuyNow}
                disabled={!isPurchasable || addingToCart || buyingNow}
                className={styles.pdpBtnBuyNow}
              >
                {buyingNow ? "Preparing checkout..." : isPurchasable ? "Buy now" : "Unavailable"}
              </button>
            </div>

            {/* Add to Cart / Buy Now Feedback Toast */}
            {cartFeedback && (
              <div
                className={`${styles.pdpFeedbackBox} ${
                  cartFeedback.type === "success" ? styles.pdpFeedbackSuccess : styles.pdpFeedbackError
                }`}
                role="status"
              >
                <span>{cartFeedback.message}</span>
                {cartFeedback.type === "success" && (
                  <div className={styles.pdpFeedbackActions}>
                    <Link href="/cart" className={styles.pdpFeedbackBtn}>
                      View cart
                    </Link>
                    <Link
                      href="/checkout"
                      className={`${styles.pdpFeedbackBtn} ${styles.pdpFeedbackBtnPrimary}`}
                    >
                      Checkout
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Structured Product Information (Overview + Details) */}
      <ProductInformation
        product={product}
        activeOffer={activeOffer}
        storeName={store?.name}
      />

      {/* Same Store Products */}
      {sameStoreProducts.length > 0 && (
        <section aria-labelledby="pdp-same-store-heading" className={styles.pdpRelatedSection}>
          <div className={styles.commerceSectionHeader}>
            <h2 id="pdp-same-store-heading">
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
          <div className={styles.commerceSectionHeader}>
            <h2 id="pdp-related-heading">
              You may also like
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

      {/* Mobile Sticky Purchase Dock (No truncated title, pure price + dual action) */}
      {isPurchasable && (
        <div className={styles.pdpMobileStickyBar} aria-label="Quick purchase dock">
          <div className={styles.pdpMobileStickyPriceCol}>
            <span className={styles.pdpMobileStickyPrice}>
              {formatCommercePrice(activeOffer.price.amount, activeOffer.price.currency)}
            </span>
            <span className={styles.pdpMobileStickyVat}>VAT included</span>
          </div>
          <div className={styles.pdpMobileStickyBtns}>
            <button
              type="button"
              className={styles.pdpMobileStickyAddBtn}
              onClick={handleAddToCart}
              disabled={!isPurchasable || addingToCart || buyingNow}
            >
              {addingToCart ? "Adding..." : "Add to cart"}
            </button>
            <button
              type="button"
              className={styles.pdpMobileStickyBuyBtn}
              onClick={handleBuyNow}
              disabled={!isPurchasable || addingToCart || buyingNow}
            >
              {buyingNow ? "Checking out..." : "Buy now"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
