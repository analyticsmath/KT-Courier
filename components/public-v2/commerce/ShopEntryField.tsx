import Link from "next/link";
import Image from "next/image";
import { CommerceSearchCommand } from "./CommerceSearchCommand";
import { marketplaceCategoryHref, marketplaceHref } from "@/lib/public-marketplace/routes";
import { homeMedia } from "@/components/public-v2/home/home-media";
import styles from "./commerce.module.css";

interface CategorySummary {
  reference: string;
  path: string;
  name: string;
  imageReference?: string;
}

interface ShopEntryFieldProps {
  categories: readonly CategorySummary[];
}

export function ShopEntryField({ categories }: ShopEntryFieldProps) {
  const primaryCat = categories[0];
  const secondaryCat = categories[1] || categories[0];

  const primaryHref = (primaryCat ? marketplaceCategoryHref(primaryCat.path) : null) ?? marketplaceHref();
  const secondaryHref = (secondaryCat ? marketplaceCategoryHref(secondaryCat.path) : null) ?? marketplaceHref();

  return (
    <section aria-labelledby="market-entry-title" className={styles.marketEntryField}>
      <div className={styles.commerceInnerWide}>
        <div className={styles.marketEntryLayout}>
          {/* Editorial Text Plane */}
          <div className={styles.entryCopyPlane}>
            <h1 className={styles.entryTitle} id="market-entry-title">
              Find what moves next.
            </h1>
            <p className={styles.entryLead}>
              Browse products and independent stores across the KT marketplace.
            </p>

            <div className={styles.entrySearchWrap}>
              <CommerceSearchCommand />
            </div>
          </div>

          {/* Visual Market Media Composition */}
          <div className={styles.entryMediaComposition}>
            {/* Dominant Category Media Frame */}
            <Link className={styles.dominantMediaFrame} href={primaryHref}>
              <Image
                alt={primaryCat?.name || "Featured marketplace category"}
                fill
                priority
                sizes="(max-width: 899px) 100vw, 55vw"
                src={
                  primaryCat?.imageReference
                    ? `/api/catalog/media/${primaryCat.imageReference}`
                    : homeMedia.fashion.src
                }
                style={{ objectFit: "cover" }}
              />
              <div className={styles.entryMediaOverlay}>
                <span className={styles.mediaCategoryName}>
                  {primaryCat?.name || "Fashion & Goods"}
                </span>
                <span className={styles.mediaActionLink}>Explore &rarr;</span>
              </div>
            </Link>

            {/* Secondary Portrait Category Strip */}
            <Link className={styles.secondaryMediaFrame} href={secondaryHref}>
              <Image
                alt={secondaryCat?.name || "Local fresh grocery"}
                fill
                priority
                sizes="25vw"
                src={
                  secondaryCat?.imageReference
                    ? `/api/catalog/media/${secondaryCat.imageReference}`
                    : homeMedia.grocery.src
                }
                style={{ objectFit: "cover" }}
              />
              <div className={styles.entryMediaOverlay}>
                <span className={styles.mediaCategoryName}>
                  {secondaryCat?.name || "Market Grocery"}
                </span>
                <span className={styles.mediaActionLink}>&rarr;</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
