"use client";

import Image from "next/image";
import Link from "next/link";
import type { CinematicCategoryNode } from "@/lib/public-marketplace/category-navigation-model";
import { marketplaceCategoriesHref, marketplaceCategoryHref } from "@/lib/public-marketplace/routes";
import { categoryTransitionId } from "@/lib/public-marketplace/category-transition-id";
import { useTransitionContext } from "@/components/public-v2/motion/PublicTransitionRouter";
import { childCategoryMedia, majorCategoryMedia } from "./category-navigator-media";
import styles from "./category-navigator.module.css";

export function SubcategoryAccordion({ parent, activeIndex, onActiveChange, onReturn, headingRef, reducedMotion }: {
  parent: CinematicCategoryNode;
  activeIndex: number;
  onActiveChange: (index: number) => void;
  onReturn: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  reducedMotion: boolean;
}) {
  const { captureSourceMedia } = useTransitionContext();
  const visibleChildren = parent.children.slice(0, 8);
  const parentMedia = majorCategoryMedia(parent);
  const parentHref = marketplaceCategoryHref(parent.path) ?? marketplaceCategoriesHref();
  const activeGrow = Math.min(3.4, 1 + visibleChildren.length * 0.28);

  return (
    <section className={styles.subcategoryScene} aria-labelledby="subcategory-title">
      <header className={styles.subcategoryHeader}>
        <button type="button" className={styles.returnButton} onClick={onReturn}>← All categories</button>
        <div className={styles.subcategoryHeading}>
          <span className={styles.eyebrow}>{parent.name}</span>
          <h2 id="subcategory-title" tabIndex={-1} ref={headingRef}>Choose a subcategory</h2>
        </div>
        <Link className={styles.viewAll} href={parentHref}>View all {parent.name} →</Link>
      </header>
      <span className={styles.environmentNumber} aria-hidden="true">{String(activeIndex + 1).padStart(2, "0")}</span>
      <div className={`${styles.accordion} ${visibleChildren.length === 1 ? styles.singleChild : ""} ${reducedMotion ? styles.reduced : ""}`}>
        {visibleChildren.map((child, index) => {
          const href = marketplaceCategoryHref(child.path);
          if (!href) return null;
          const mediaSrc = childCategoryMedia(child, parentMedia);
          const isActive = index === activeIndex;
          return (
            <Link
              className={`${styles.strip} ${isActive ? styles.activeStrip : ""}`}
              key={child.reference}
              href={href}
              style={{ flexGrow: isActive ? activeGrow : 1 }}
              onMouseEnter={() => onActiveChange(index)}
              onFocus={() => onActiveChange(index)}
              onClick={(event) => captureSourceMedia(categoryTransitionId(child.path), event.currentTarget, mediaSrc, child.name)}
              aria-label={`Browse ${child.name}`}
            >
              <Image alt="" fill sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 45vw" src={mediaSrc} className={styles.image} />
              <span className={styles.stripShade} />
              <span className={styles.stripCopy}>
                <span className={styles.stripOrdinal}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.stripTitle}>{child.name}</span>
                {child.description && <span className={styles.stripDetail}>{child.description}</span>}
                {Boolean(child.productCount && child.productCount > 0) && <span className={styles.stripDetail}>{child.productCount} products</span>}
                <span className={styles.stripBrowse}>Browse →</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
