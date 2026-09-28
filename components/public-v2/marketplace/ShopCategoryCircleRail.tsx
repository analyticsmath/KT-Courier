"use client";
import Image from "next/image";
import Link from "next/link";
import { shopCategoryMedia } from "./shop-category-media";
import { marketplaceCategoriesHref, marketplaceCategoryHref } from "@/lib/public-marketplace/routes";
import { categoryTransitionId } from "@/lib/public-marketplace/category-transition-id";
import { useTransitionContext } from "@/components/public-v2/motion/PublicTransitionRouter";
import type { MarketplaceCategory } from "./MarketplaceLanding";
import styles from "./shop-flagship.module.css";

export function ShopCategoryCircleRail({ categories }: { categories: readonly MarketplaceCategory[] }) {
  const { captureSourceMedia } = useTransitionContext();
  return <nav aria-label="Shop categories" className={styles.categoryNavigation}>
    <ul className={styles.circleRail}>{categories.map((category) => {
      const href = marketplaceCategoryHref(category.path);
      const src = shopCategoryMedia(category);
      if (!href) return null;
      return <li key={category.reference}><Link className={styles.circleLink} href={href} onClick={(event) => {
        if (src) captureSourceMedia(categoryTransitionId(category.path), event.currentTarget, src, category.name);
      }}>
        <span className={styles.circleMedia}>{src ? <Image alt="" fill sizes="(max-width: 767px) 84px, 136px" src={src} /> : null}</span>
        <span>{category.name}</span>
      </Link></li>;
    })}</ul>
    <Link className={styles.allCategories} href={marketplaceCategoriesHref()}>Explore all categories <span aria-hidden="true">→</span></Link>
  </nav>;
}
