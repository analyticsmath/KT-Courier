"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { marketplaceCategoryHref, marketplaceCategoriesHref, marketplaceHref } from "@/lib/public-marketplace/routes";
import { homeMedia } from "@/components/public-v2/home/home-media";
import styles from "./commerce.module.css";

interface CategoryDiscoveryItem {
  reference: string;
  path: string;
  name: string;
  description?: string;
  imageReference?: string;
  productCount?: number;
}

interface CategoryDiscoveryFieldProps {
  categories: readonly CategoryDiscoveryItem[];
}

export function CategoryDiscoveryField({ categories }: CategoryDiscoveryFieldProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!categories.length) return null;

  const activeCat = categories[activeIdx] || categories[0];
  const activeHref = (activeCat ? marketplaceCategoryHref(activeCat.path) : null) ?? marketplaceHref();

  // Fallback editorial media matching
  const getCategoryMedia = (cat: CategoryDiscoveryItem) => {
    if (cat.imageReference) {
      return `/api/catalog/media/${cat.imageReference}`;
    }
    const pathLower = cat.path.toLowerCase();
    if (pathLower.includes("food")) return homeMedia.foodLocal.src;
    if (pathLower.includes("groc")) return homeMedia.grocery.src;
    if (pathLower.includes("fash") || pathLower.includes("cloth")) return homeMedia.fashion.src;
    if (pathLower.includes("well") || pathLower.includes("care")) return homeMedia.wellness.src;
    if (pathLower.includes("home")) return homeMedia.homeware.src;
    return homeMedia.retailLocal.src;
  };

  return (
    <section aria-labelledby="category-discovery-title" className={styles.categoryDiscoverySection}>
      <div className={styles.commerceInner}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <h2 className={styles.sectionTitleMain} id="category-discovery-title">
              Browse Categories
            </h2>
          </div>
          <Link className={styles.sectionDirectLink} href={marketplaceCategoriesHref()}>
            All categories &rarr;
          </Link>
        </div>

        <div className={styles.categoryActiveField}>
          {/* Category Navigation Stream */}
          <ul className={styles.categoryListStream} role="tablist">
            {categories.slice(0, 7).map((category, idx) => {
              const isActive = idx === activeIdx;
              const href = marketplaceCategoryHref(category.path) ?? marketplaceHref();

              return (
                <li key={category.reference}>
                  <Link
                    aria-selected={isActive}
                    className={`${styles.categoryStreamItem} ${
                      isActive ? styles.categoryStreamItemActive : ""
                    }`}
                    href={href}
                    onFocus={() => setActiveIdx(idx)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    role="tab"
                  >
                    <span className={styles.categoryStreamTitle}>{category.name}</span>
                    <span className={styles.categoryStreamCount}>
                      {typeof category.productCount === "number"
                        ? `${category.productCount} items`
                        : "Explore"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Active Category Media Stage */}
          <div className={styles.categoryActiveMediaStage}>
            <Link aria-label={`Explore ${activeCat.name}`} href={activeHref}>
              <Image
                alt={activeCat.name}
                fill
                priority
                sizes="(max-width: 899px) 100vw, 55vw"
                src={getCategoryMedia(activeCat)}
                style={{ objectFit: "cover" }}
              />
              <div className={styles.entryMediaOverlay}>
                <div>
                  <span className={styles.mediaCategoryName}>{activeCat.name}</span>
                  {activeCat.description && (
                    <p style={{ fontSize: "0.85rem", color: "var(--kt-cool-300, #c9cecc)", margin: "4px 0 0" }}>
                      {activeCat.description}
                    </p>
                  )}
                </div>
                <span className={styles.mediaActionLink}>View Category &rarr;</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
