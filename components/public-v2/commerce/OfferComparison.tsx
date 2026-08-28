import Link from "next/link";
import type { StorefrontDocument } from "@/lib/storefront/storefront-types";
import { availabilityLabel } from "@/lib/storefront/storefront-availability-policy";
import { marketplaceStoreHref, marketplaceStoresHref } from "@/lib/public-marketplace/routes";
import styles from "./commerce.module.css";

function formatPrice(amount: string, currency: "ZAR") {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(
    Number(amount)
  );
}

interface OfferComparisonProps {
  offers: readonly StorefrontDocument[];
}

export function OfferComparison({ offers }: OfferComparisonProps) {
  if (!offers.length) return null;

  return (
    <ul aria-label="Available offers from stores" className={styles.offerComparisonList}>
      {offers.map((offer) => {
        const storeHref = marketplaceStoreHref(offer.storeSlug) ?? marketplaceStoresHref();

        return (
          <li className={styles.offerComparisonRow} key={offer.offerReference}>
            <div>
              <Link
                href={storeHref}
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  color: "var(--kt-carbon, #101210)",
                  textDecoration: "none",
                }}
              >
                {offer.storeSlug}
              </Link>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  fontSize: "0.85rem",
                  color: "var(--kt-muted, #5f6763)",
                  marginTop: 4,
                }}
              >
                <span>{offer.fulfilmentMode.replaceAll("_", " ").toLowerCase()}</span>
                <span>&bull;</span>
                <span>{availabilityLabel(offer.availability)}</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <span style={{ fontSize: "1.3rem", fontWeight: 600, color: "var(--kt-carbon, #101210)" }}>
                {formatPrice(offer.price.amount, offer.price.currency)}
              </span>
              <Link
                className={styles.sectionDirectLink}
                href={storeHref}
              >
                View store &rarr;
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
