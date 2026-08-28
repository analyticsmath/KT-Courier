import Image from "next/image";
import Link from "next/link";
import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";
import { availabilityLabel } from "@/lib/storefront/storefront-availability-policy";
import { marketplaceProductHref, marketplaceHref } from "@/lib/public-marketplace/routes";
import styles from "./commerce.module.css";

function formatPrice(amount: string, currency: "ZAR") {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(
    Number(amount)
  );
}

interface ProductTileProps {
  product: StorefrontProductCard;
  priority?: boolean;
}

export function ProductTile({ product, priority = false }: ProductTileProps) {
  const href = marketplaceProductHref(
    product.productSlug,
    product.productReference
  ) ?? marketplaceHref();

  return (
    <li style={{ listStyle: "none" }}>
      <Link className={styles.productTile} href={href}>
        <div className={styles.productTileMediaFrame}>
          {product.primaryMedia ? (
            <Image
              alt={product.primaryMedia.alt || product.title}
              fill
              priority={priority}
              sizes="(max-width: 639px) calc(50vw - 20px), (max-width: 1023px) 33vw, 24vw"
              src={`/api/catalog/media/${product.primaryMedia.publicReference}`}
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
                fontSize: "0.85rem",
              }}
            >
              No image
            </div>
          )}
        </div>

        <div className={styles.productTileBody}>
          {product.brandName && (
            <span className={styles.productTileBrand}>{product.brandName}</span>
          )}
          <h3 className={styles.productTileTitle}>{product.title}</h3>
          <span className={styles.productTilePrice}>
            {formatPrice(product.price.amount, product.price.currency)}
          </span>
          <span className={styles.productTileAvailability}>
            {availabilityLabel(product.availability)}
          </span>
        </div>
      </Link>
    </li>
  );
}
