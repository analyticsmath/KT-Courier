"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { marketplaceCategoryHref, marketplaceHref } from "@/lib/public-marketplace/routes";
import { homeMedia } from "@/components/public-v2/home/home-media";
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
  const activeHref = (activeCat ? marketplaceCategoryHref(activeCat.path) : null) ?? marketplaceHref();

  const getMediaSrc = (cat: CategoryAtlasItem) => {
    if (cat.imageReference) return `/api/catalog/media/${cat.imageReference}`;
    const p = cat.path.toLowerCase();
    if (p.includes("food")) return homeMedia.foodLocal.src;
    if (p.includes("groc")) return homeMedia.grocery.src;
    if (p.includes("fash") || p.includes("cloth")) return homeMedia.fashion.src;
    if (p.includes("well") || p.includes("care")) return homeMedia.wellness.src;
    if (p.includes("home")) return homeMedia.homeware.src;
    return homeMedia.retailLocal.src;
  };

  return (
    <div className={styles.categoryAtlasPage}>
      <div className={styles.categoryAtlasLayout}>
        {/* Category Index Column */}
        <ul className={styles.categoryListStream} role="tablist">
          {categories.map((cat, idx) => {
            const isActive = idx === activeIdx;
            const href = marketplaceCategoryHref(cat.path) ?? marketplaceHref();

            return (
              <li key={cat.reference}>
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
                    {typeof cat.productCount === "number" ? `${cat.productCount} items` : "Explore"}
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
                {typeof activeCat.productCount === "number" && (
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
