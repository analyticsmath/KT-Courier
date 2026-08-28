import Link from "next/link";
import Image from "next/image";
import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";
import { ProductTile } from "./ProductTile";
import { homeMedia } from "@/components/public-v2/home/home-media";
import styles from "./commerce.module.css";

interface ProductGridProps {
  products: readonly StorefrontProductCard[];
  label?: string;
  withEditorialInterruption?: boolean;
  editorialCategoryHref?: string;
  editorialCategoryTitle?: string;
}

export function ProductGrid({
  products,
  label = "Products",
  withEditorialInterruption = false,
  editorialCategoryHref = "/shop/categories",
  editorialCategoryTitle = "Local Food & Kitchens",
}: ProductGridProps) {
  if (!products.length) return null;

  return (
    <ul aria-label={label} className={styles.productGrid}>
      {products.map((product, idx) => {
        const showInterruption = withEditorialInterruption && idx === 4;

        return (
          <div key={product.productReference} style={{ display: "contents" }}>
            {showInterruption && (
              <li className={styles.editorialInterruptionTile}>
                <Image
                  alt={homeMedia.foodLocal.alt}
                  fill
                  sizes="(max-width: 767px) 100vw, 50vw"
                  src={homeMedia.foodLocal.src}
                  style={{ objectFit: "cover", zIndex: 1 }}
                />
                <div className={styles.editorialTileContent}>
                  <h3 className={styles.editorialTileTitle}>
                    {editorialCategoryTitle}
                  </h3>
                  <Link
                    className={styles.editorialTileLink}
                    href={editorialCategoryHref}
                  >
                    <span>Browse Category</span> &rarr;
                  </Link>
                </div>
              </li>
            )}
            <ProductTile priority={idx < 4} product={product} />
          </div>
        );
      })}
    </ul>
  );
}
