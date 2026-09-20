import Link from "next/link";
import type { StorefrontDocument } from "@/lib/storefront/storefront-types";
import { availabilityLabel } from "@/lib/storefront/storefront-availability-policy";
import { marketplaceStoreHref } from "@/lib/public-marketplace/routes";
import styles from "./commerce.module.css";

function formatPrice(amount: string, currency: "ZAR") {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(
    Number(amount)
  );
}

interface OfferComparisonProps {
  offers: readonly StorefrontDocument[];
  selectedOfferReference?: string;
  onSelectOffer?: (offerReference: string) => void;
}

export function OfferComparison({ offers, selectedOfferReference, onSelectOffer }: OfferComparisonProps) {
  if (!offers.length) return null;

  return (
    <ul aria-label="Available offers from stores" className={styles.offerComparisonList}>
      {offers.map((offer) => {
        const storeHref = marketplaceStoreHref(offer.storeSlug);
        const isSelected = selectedOfferReference === offer.offerReference;
        const storeName = offer.storeName ?? offer.storeSlug.split("-").map((part) => `${part[0]?.toLocaleUpperCase("en-ZA")}${part.slice(1)}`).join(" ");
        const fulfilment = offer.fulfilmentMode === "COURIER_DELIVERY" ? "Courier delivery" : offer.fulfilmentMode === "STORE_PICKUP" ? "Store pickup" : "Pickup and delivery";

        return (
          <li className={styles.offerComparisonRow} key={offer.offerReference}>
            <div>
              {storeHref ? (
                <Link
                  href={storeHref}
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    color: "var(--kt-carbon, #101210)",
                    textDecoration: "none",
                  }}
                >
                  {storeName}
                </Link>
              ) : (
                <span
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    color: "var(--kt-carbon, #101210)",
                  }}
                >
                  {storeName}
                </span>
              )}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  fontSize: "0.85rem",
                  color: "var(--kt-muted, #5f6763)",
                  marginTop: 4,
                }}
              >
                <span>{fulfilment}</span>
                <span>&bull;</span>
                <span>{availabilityLabel(offer.availability)}</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: "1.3rem", fontWeight: 600, color: "var(--kt-carbon, #101210)" }}>
                {formatPrice(offer.price.amount, offer.price.currency)}
              </span>
              {onSelectOffer && (
                <button
                  type="button"
                  onClick={() => onSelectOffer(offer.offerReference)}
                  style={{
                    padding: "6px 14px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    borderRadius: 4,
                    border: isSelected ? "1px solid var(--kt-primary, #047857)" : "1px solid var(--kt-carbon, #101210)",
                    backgroundColor: isSelected ? "var(--kt-primary, #047857)" : "transparent",
                    color: isSelected ? "#ffffff" : "var(--kt-carbon, #101210)",
                    cursor: isSelected ? "default" : "pointer",
                  }}
                >
                  {isSelected ? "Selected" : "Buy from this store"}
                </button>
              )}
              {storeHref ? (
                <Link
                  className={styles.sectionDirectLink}
                  href={storeHref}
                >
                  View store &rarr;
                </Link>
              ) : (
                <span
                  className={styles.sectionDirectLink}
                  style={{ opacity: 0.5, cursor: "not-allowed" }}
                >
                  Store unavailable
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
