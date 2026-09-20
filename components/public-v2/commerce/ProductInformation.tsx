"use client";

import { useState } from "react";
import Link from "next/link";
import type { StorefrontDocument } from "@/lib/storefront/storefront-types";
import { marketplaceStoreHref } from "@/lib/public-marketplace/routes";
import {
  humanizeCondition,
  humanizeFulfilmentMode,
  humanizeAvailability,
  humanizeAttributeName,
} from "@/lib/public-marketplace/commerce-presentation";
import styles from "./commerce.module.css";

interface ProductInformationProps {
  product: StorefrontDocument;
  activeOffer: StorefrontDocument;
  storeName?: string;
}

export function ProductInformation({
  product,
  activeOffer,
  storeName,
}: ProductInformationProps) {
  // Mobile accordion state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    details: true,
    fulfilment: false,
    seller: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const conditionLabel = humanizeCondition(product.condition);
  const fulfilmentLabel = humanizeFulfilmentMode(activeOffer.fulfilmentMode);
  const availability = humanizeAvailability(activeOffer.availability);

  // Filter meaningful attributes: exclude IDs, timestamps, empty strings, internal flags
  const rawAttributes = {
    ...(product.searchableAttributes as Record<string, unknown> | undefined),
    ...(product.filterableAttributes as Record<string, unknown> | undefined),
  };

  const meaningfulAttributes = Object.entries(rawAttributes).filter(([key, val]) => {
    if (!val || typeof val !== "string" && typeof val !== "number") return false;
    const lower = key.toLowerCase();
    if (lower.includes("reference") || lower.includes("id") || lower.includes("slug") || lower.includes("status")) {
      return false;
    }
    return true;
  });

  const variantAttributes = Object.entries(activeOffer.variantOptions ?? {});
  const sellerStoreName = activeOffer.storeName ?? storeName ?? activeOffer.storeSlug;
  const storeHref = marketplaceStoreHref(activeOffer.storeSlug);

  return (
    <section aria-labelledby="product-info-heading" className={styles.pdpInfoSection}>
      <div className={styles.pdpInfoHeader}>
        <h2 id="product-info-heading" className={styles.pdpInfoTitle}>
          Product Information
        </h2>
      </div>

      {/* Desktop Split View: Overview on Left, Specifications on Right */}
      <div className={styles.pdpDesktopInfoLayout}>
        <div className={styles.pdpOverviewCol}>
          <h3 className={styles.pdpSubheading}>Overview</h3>
          {product.shortDescription && (
            <p className={styles.pdpLeadDescription}>{product.shortDescription}</p>
          )}
          {product.description && (
            <div className={styles.pdpBodyDescription}>
              <p>{product.description}</p>
            </div>
          )}
        </div>

        <div className={styles.pdpDetailsCol}>
          <h3 className={styles.pdpSubheading}>Details & Specifications</h3>
          <dl className={styles.pdpSpecTable}>
            <div className={styles.pdpSpecRow}>
              <dt className={styles.pdpSpecKey}>Condition</dt>
              <dd className={styles.pdpSpecVal}>{conditionLabel}</dd>
            </div>
            <div className={styles.pdpSpecRow}>
              <dt className={styles.pdpSpecKey}>Availability</dt>
              <dd className={styles.pdpSpecVal}>{availability.label}</dd>
            </div>
            <div className={styles.pdpSpecRow}>
              <dt className={styles.pdpSpecKey}>Fulfilment</dt>
              <dd className={styles.pdpSpecVal}>{fulfilmentLabel}</dd>
            </div>
            {product.brandName && (
              <div className={styles.pdpSpecRow}>
                <dt className={styles.pdpSpecKey}>Brand</dt>
                <dd className={styles.pdpSpecVal}>{product.brandName}</dd>
              </div>
            )}
            {variantAttributes.map(([vKey, vVal]) => (
              <div className={styles.pdpSpecRow} key={vKey}>
                <dt className={styles.pdpSpecKey}>{humanizeAttributeName(vKey)}</dt>
                <dd className={styles.pdpSpecVal}>{String(vVal)}</dd>
              </div>
            ))}
            {meaningfulAttributes.map(([aKey, aVal]) => (
              <div className={styles.pdpSpecRow} key={aKey}>
                <dt className={styles.pdpSpecKey}>{humanizeAttributeName(aKey)}</dt>
                <dd className={styles.pdpSpecVal}>{String(aVal)}</dd>
              </div>
            ))}
            <div className={styles.pdpSpecRow}>
              <dt className={styles.pdpSpecKey}>Merchant</dt>
              <dd className={styles.pdpSpecVal}>
                {storeHref ? (
                  <Link href={storeHref} className={styles.pdpSpecStoreLink}>
                    {sellerStoreName}
                  </Link>
                ) : (
                  sellerStoreName
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Mobile Disclosure / Accordion View */}
      <div className={styles.pdpMobileDisclosures}>
        {/* Section 1: Overview & Details */}
        <div className={styles.pdpDisclosureBlock}>
          <button
            type="button"
            className={styles.pdpDisclosureTrigger}
            onClick={() => toggleSection("details")}
            aria-expanded={openSections.details}
          >
            <span>Product details & specifications</span>
            <span className={styles.pdpDisclosureIcon}>
              {openSections.details ? "−" : "+"}
            </span>
          </button>
          {openSections.details && (
            <div className={styles.pdpDisclosureContent}>
              {product.shortDescription && (
                <p className={styles.pdpMobileShortDesc}>{product.shortDescription}</p>
              )}
              {product.description && (
                <p className={styles.pdpMobileFullDesc}>{product.description}</p>
              )}
              <dl className={styles.pdpSpecTable}>
                <div className={styles.pdpSpecRow}>
                  <dt className={styles.pdpSpecKey}>Condition</dt>
                  <dd className={styles.pdpSpecVal}>{conditionLabel}</dd>
                </div>
                {product.brandName && (
                  <div className={styles.pdpSpecRow}>
                    <dt className={styles.pdpSpecKey}>Brand</dt>
                    <dd className={styles.pdpSpecVal}>{product.brandName}</dd>
                  </div>
                )}
                {variantAttributes.map(([vKey, vVal]) => (
                  <div className={styles.pdpSpecRow} key={vKey}>
                    <dt className={styles.pdpSpecKey}>{humanizeAttributeName(vKey)}</dt>
                    <dd className={styles.pdpSpecVal}>{String(vVal)}</dd>
                  </div>
                ))}
                {meaningfulAttributes.map(([aKey, aVal]) => (
                  <div className={styles.pdpSpecRow} key={aKey}>
                    <dt className={styles.pdpSpecKey}>{humanizeAttributeName(aKey)}</dt>
                    <dd className={styles.pdpSpecVal}>{String(aVal)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        {/* Section 2: Delivery & Fulfilment */}
        <div className={styles.pdpDisclosureBlock}>
          <button
            type="button"
            className={styles.pdpDisclosureTrigger}
            onClick={() => toggleSection("fulfilment")}
            aria-expanded={openSections.fulfilment}
          >
            <span>Delivery & fulfilment</span>
            <span className={styles.pdpDisclosureIcon}>
              {openSections.fulfilment ? "−" : "+"}
            </span>
          </button>
          {openSections.fulfilment && (
            <div className={styles.pdpDisclosureContent}>
              <dl className={styles.pdpSpecTable}>
                <div className={styles.pdpSpecRow}>
                  <dt className={styles.pdpSpecKey}>Fulfilment mode</dt>
                  <dd className={styles.pdpSpecVal}>{fulfilmentLabel}</dd>
                </div>
                <div className={styles.pdpSpecRow}>
                  <dt className={styles.pdpSpecKey}>Stock status</dt>
                  <dd className={styles.pdpSpecVal}>{availability.label}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        {/* Section 3: Merchant & Store */}
        <div className={styles.pdpDisclosureBlock}>
          <button
            type="button"
            className={styles.pdpDisclosureTrigger}
            onClick={() => toggleSection("seller")}
            aria-expanded={openSections.seller}
          >
            <span>Seller information</span>
            <span className={styles.pdpDisclosureIcon}>
              {openSections.seller ? "−" : "+"}
            </span>
          </button>
          {openSections.seller && (
            <div className={styles.pdpDisclosureContent}>
              <p style={{ margin: "0 0 10px", fontWeight: 600 }}>{sellerStoreName}</p>
              {storeHref && (
                <Link href={storeHref} className={styles.pdpSpecStoreLink}>
                  Visit merchant storefront &rarr;
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
