"use client";

import Link from "next/link";
import type { StorefrontDocument } from "@/lib/storefront/storefront-types";
import { marketplaceStoreHref } from "@/lib/public-marketplace/routes";
import {
  humanizeAvailability,
  humanizeFulfilmentMode,
  formatCommercePrice,
} from "@/lib/public-marketplace/commerce-presentation";
import styles from "./commerce.module.css";

interface SellerSelectorProps {
  offers: readonly StorefrontDocument[];
  selectedOfferReference: string;
  onSelectOffer: (offerReference: string) => void;
  defaultStoreName?: string;
  defaultStoreSlug?: string;
}

function resolveStoreName(offer: StorefrontDocument, fallbackName?: string): string {
  if (offer.storeName) return offer.storeName;
  if (fallbackName && offer.storeSlug) return fallbackName;
  return offer.storeSlug
    .split("-")
    .map((part) => (part[0]?.toLocaleUpperCase("en-ZA") ?? "") + part.slice(1))
    .join(" ");
}

export function SellerSelector({
  offers,
  selectedOfferReference,
  onSelectOffer,
  defaultStoreName,
}: SellerSelectorProps) {
  if (offers.length === 0) return null;

  // Single seller case: fold directly into a quiet merchant identity row
  if (offers.length === 1) {
    const singleOffer = offers[0]!;
    const storeName = resolveStoreName(singleOffer, defaultStoreName);
    const storeHref = marketplaceStoreHref(singleOffer.storeSlug);
    const availability = humanizeAvailability(singleOffer.availability);
    const fulfilment = humanizeFulfilmentMode(singleOffer.fulfilmentMode);

    return (
      <div className={styles.pdpSingleSellerRow}>
        <div className={styles.pdpSingleSellerMeta}>
          <span className={styles.pdpSingleSellerLead}>Sold & delivered by</span>
          <span className={styles.pdpSingleSellerName}>{storeName}</span>
          <div className={styles.pdpSingleSellerAdvisory}>
            <span
              className={`${styles.pdpStockDot} ${
                availability.isAvailable ? styles.pdpStockDotGreen : styles.pdpStockDotMuted
              }`}
              aria-hidden="true"
            />
            <span>{availability.label}</span>
            <span className={styles.pdpAdvisoryDivider}>·</span>
            <span>{fulfilment}</span>
          </div>
        </div>
        {storeHref && (
          <Link href={storeHref} className={styles.pdpStorefrontLink}>
            View storefront
          </Link>
        )}
      </div>
    );
  }

  // Multiple sellers case: deliberate "Choose seller" comparison before CTA
  // Find minimum price among offers
  const minPrice = Math.min(...offers.map((o) => Number(o.price.amount)));

  return (
    <div className={styles.pdpMultiSellerContainer} role="group" aria-labelledby="choose-seller-heading">
      <div className={styles.pdpMultiSellerHeader}>
        <span id="choose-seller-heading" className={styles.pdpMultiSellerHeading}>
          Choose seller
        </span>
        <span className={styles.pdpMultiSellerCount}>
          {offers.length} offers available
        </span>
      </div>

      <div className={styles.pdpSellerOptionList} role="radiogroup" aria-label="Available sellers">
        {offers.map((offer) => {
          const isSelected = offer.offerReference === selectedOfferReference;
          const storeName = resolveStoreName(offer, defaultStoreName);
          const storeHref = marketplaceStoreHref(offer.storeSlug);
          const isLowestPrice = Number(offer.price.amount) <= minPrice;
          const availability = humanizeAvailability(offer.availability);
          const fulfilment = humanizeFulfilmentMode(offer.fulfilmentMode);

          return (
            <div
              key={offer.offerReference}
              className={`${styles.pdpSellerOptionCard} ${
                isSelected ? styles.pdpSellerOptionCardSelected : ""
              }`}
              onClick={() => onSelectOffer(offer.offerReference)}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  onSelectOffer(offer.offerReference);
                }
              }}
            >
              <div className={styles.pdpSellerRadioCircle} aria-hidden="true">
                {isSelected && <span className={styles.pdpSellerRadioDot} />}
              </div>

              <div className={styles.pdpSellerOptionInfo}>
                <div className={styles.pdpSellerOptionTopLine}>
                  <strong className={styles.pdpSellerOptionStoreName}>{storeName}</strong>
                  <span className={styles.pdpSellerOptionPrice}>
                    {formatCommercePrice(offer.price.amount, offer.price.currency)}
                  </span>
                </div>

                <div className={styles.pdpSellerOptionDetails}>
                  <span className={styles.pdpSellerOptionAvailability}>{availability.label}</span>
                  <span className={styles.pdpAdvisoryDivider}>·</span>
                  <span className={styles.pdpSellerOptionFulfilment}>{fulfilment}</span>
                  {isLowestPrice && (
                    <span className={styles.pdpBestPriceBadge}>Best price</span>
                  )}
                </div>

                {storeHref && (
                  <Link
                    href={storeHref}
                    onClick={(e) => e.stopPropagation()}
                    className={styles.pdpSellerStoreSublink}
                  >
                    View store
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
