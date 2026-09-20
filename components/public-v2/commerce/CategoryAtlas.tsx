"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { marketplaceCategoryHref, marketplaceCategoriesHref, marketplaceHref } from "@/lib/public-marketplace/routes";
import { ktMedia } from "@/components/public-v2/media";
import { storefrontCategoryMediaSrc } from "@/lib/storefront/category-media";
import styles from "./commerce.module.css";

interface CategoryAtlasItem {
  reference: string;
  path: string;
  name: string;
  description?: string;
  imageReference?: string;
  productCount?: number;
  children?: Array<{ reference: string; path: string; name: string }>;
}

interface CategoryAtlasProps {
  categories: readonly CategoryAtlasItem[];
}

export function CategoryAtlas({ categories }: CategoryAtlasProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!categories.length) {
    return (
      <div className={styles.commerceInner} style={{ padding: "4rem 0" }}>
        <h2 style={{ fontSize: "1.8rem", fontWeight: 560 }}>Categories are being prepared</h2>
        <p style={{ color: "var(--kt-muted, #5f6763)", margin: "8px 0 24px" }}>
          Published categories will appear here when items are available.
        </p>
        <Link className={styles.sectionDirectLink} href={marketplaceHref()}>
          Return to shop &rarr;
        </Link>
      </div>
    );
  }

  const activeCat = categories[activeIdx] || categories[0];
  const activeHref = (activeCat ? marketplaceCategoryHref(activeCat.path) : null) ?? marketplaceCategoriesHref();

  const getMediaSrc = (cat: CategoryAtlasItem) => {
    const authoritative = storefrontCategoryMediaSrc(cat.imageReference);
    if (authoritative) return authoritative;
    const p = cat.path.toLowerCase();
    if (p.includes("food")) return ktMedia.categories.foodDining.hero.src;
    if (p.includes("groc")) return ktMedia.categories.groceries.hero.src;
    if (p.includes("fash") || p.includes("cloth")) return ktMedia.categories.fashion.hero.src;
    if (p.includes("pharm") || p.includes("well") || p.includes("care")) return ktMedia.categories.healthWellness.hero.src;
    if (p.includes("home")) return ktMedia.categories.homeLiving.hero.src;
    return ktMedia.categories.fashion.streetLook1.src;
  };

  return (
    <div className={styles.categoryAtlasPage}>
      <div className={styles.categoryAtlasLayout}>
        {/* Category Index Column */}
        <ul className={styles.categoryListStream}>
          {categories.map((cat, idx) => {
            const isActive = idx === activeIdx;
            const href = marketplaceCategoryHref(cat.path) ?? marketplaceCategoriesHref();

            return (
              <li key={cat.reference}>
                <Link
                  className={`${styles.categoryStreamItem} ${
                    isActive ? styles.categoryStreamItemActive : ""
                  }`}
                  href={href}
                  onFocus={() => setActiveIdx(idx)}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  <div>
                    <span className={styles.categoryStreamTitle}>{cat.name}</span>
                    {cat.description && (
                      <p style={{ fontSize: "0.85rem", color: "var(--kt-muted, #5f6763)", margin: "4px 0 0" }}>
                        {cat.description}
                      </p>
                    )}
                    {cat.children && cat.children.length > 0 && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        {cat.children.slice(0, 4).map((child) => (
                          <span
                            key={child.reference}
                            style={{
                              fontSize: "0.75rem",
                              backgroundColor: "var(--kt-cool-100, #eceeee)",
                              padding: "2px 8px",
                              color: "var(--kt-graphite, #303532)",
                            }}
                          >
                            {child.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={styles.categoryStreamCount}>
                    {Boolean(cat.productCount && cat.productCount > 0) ? `${cat.productCount} items` : "Explore"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Sticky Active Category Media Environment */}
        <div className={styles.categoryAtlasStickyMedia}>
          <Link aria-label={`Explore ${activeCat.name}`} href={activeHref}>
            <Image
              alt={activeCat.name}
              fill
              priority
              sizes="(max-width: 899px) 100vw, 55vw"
              src={getMediaSrc(activeCat)}
              style={{ objectFit: "cover" }}
            />
            <div className={styles.entryMediaOverlay}>
              <div>
                <span className={styles.mediaCategoryName}>{activeCat.name}</span>
                {Boolean(activeCat.productCount && activeCat.productCount > 0) && (
                  <p style={{ fontSize: "0.85rem", color: "var(--kt-cool-300, #c9cecc)", margin: "4px 0 0" }}>
                    {activeCat.productCount} products listed
                  </p>
                )}
              </div>
              <span className={styles.mediaActionLink}>Browse Products &rarr;</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
