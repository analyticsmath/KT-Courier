"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { marketplaceBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";
import styles from "../post-hero-scenes.module.css";

export interface MarketplaceCategoryItem {
  id: string;
  title: string;
  tagline: string;
  image: string;
  altText: string;
  categoryWord?: string;
  href?: string;
  hasEditorialMedia?: boolean;
}

export const FIVE_PANEL_MEDIA: MarketplaceCategoryItem[] = [
  {
    id: "grocery",
    title: "Fresh produce",
    tagline: "Farm-fresh vegetables, morning market crates, and regional pantry staples.",
    image: ktMediaV3.editorial.grocery.fruitCrates.src,
    altText: ktMediaV3.editorial.grocery.fruitCrates.alt,
  },
  {
    id: "fashion",
    title: "Local fashion",
    tagline: "South African leathercraft, tailored streetwear, and local retail goods.",
    image: ktMediaV3.editorial.fashion.leatherBags.src,
    altText: ktMediaV3.editorial.fashion.leatherBags.alt,
  },
  {
    id: "food",
    title: "Food makers",
    tagline: "Warm prepared meals, independent bakeries, and daily artisan orders.",
    image: ktMediaV3.editorial.food.grainBowl.src,
    altText: ktMediaV3.editorial.food.grainBowl.alt,
  },
  {
    id: "home",
    title: "Craft & home",
    tagline: "Handcrafted stoneware, architectural pottery, and residential pieces.",
    image: ktMediaV3.editorial.ceramics.capeTownPlates.src,
    altText: ktMediaV3.editorial.ceramics.capeTownPlates.alt,
  },
  {
    id: "wellness",
    title: "Personal care",
    tagline: "Amber glass botanicals, organic skincare, and sealed personal care.",
    image: ktMediaV3.editorial.wellness.apothecaryBottles.src,
    altText: ktMediaV3.editorial.wellness.apothecaryBottles.alt,
  },
];

interface MarketplaceFivePanelSceneProps {
  className?: string;
  isStorefrontExposed?: boolean;
  categories?: MarketplaceCategoryItem[];
  selectedMarketplaceId?: string;
  onMarketplaceSelectionChange?: (id: string) => void;
}

/** Marketplace Atlas: a quiet world whose category rail carries the movement. */
export function MarketplaceFivePanelScene({
  className = "",
  isStorefrontExposed = false,
  categories = [],
  selectedMarketplaceId,
  onMarketplaceSelectionChange,
}: MarketplaceFivePanelSceneProps) {
  const displayItems = categories.length > 0 ? categories : FIVE_PANEL_MEDIA;
  const activeIndex = Math.max(0, displayItems.findIndex(({ id }) => id === selectedMarketplaceId));
  const activeId = displayItems[activeIndex]?.id;
  const notifySelection = (id: string) => {
    onMarketplaceSelectionChange?.(id);
    window.dispatchEvent(new CustomEvent("kt-marketplace-user-selection", { detail: { id } }));
  };
  const sectionStyle = {
    "--kt-home-budget": `${marketplaceBudgetVh(displayItems.length)}svh`,
    "--kt-home-mobile-budget": `${mobileChapterBudgetVh("marketplace")}svh`,
  } as CSSProperties;

  return (
    <section
      className={`${styles.marketplaceSection} ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="marketplace"
      aria-labelledby="marketplace-field-title"
      style={sectionStyle}
    >
      <div className={styles.marketplaceStickyStage} data-marketplace-sticky-stage>
        <div className={styles.marketplaceHeader}>
          <h2 id="marketplace-field-title">
            {isStorefrontExposed ? "Find something worth sending." : "Marketplace coming together."}
          </h2>
          <p>
            {isStorefrontExposed
              ? "Browse local stores and everyday finds, then let KT take it from there."
              : "Local merchant catalogues are being prepared for public browsing."}
          </p>
        </div>

        <div
          className={styles.marketplaceRailWrapper}
          data-marketplace-rail-wrapper
          role="region"
          aria-label="Marketplace category atlas"
          tabIndex={0}
        >
          <div data-motion="market-rail" className={styles.marketplaceRail}>
            {displayItems.map((category, index) => {
              const isActive = activeId === category.id;
              return (
                <article
                  key={category.id}
                  id={`kt-market-card-${category.id}`}
                  data-marketplace-panel-id={category.id}
                  data-marketplace-index={index}
                  data-marketplace-active={isActive ? "true" : "false"}
                  data-marketplace-distance={Math.abs(index - activeIndex)}
                  className={styles.marketplaceCard}
                  aria-label={`${category.title} category`}
                >
                  <div className={styles.marketplaceCardMedia}>
                    <Image
                      src={category.image}
                      alt={category.altText || category.title}
                      fill
                      sizes="(max-width: 899px) 84vw, clamp(30rem, 42vw, 46rem)"
                      className={styles.marketplaceCardImg}
                      preload={index === 0}
                    />
                    <div className={styles.marketplaceCardOverlay} />
                  </div>
                  <div className={styles.marketplaceCardContent}>
                    {category.categoryWord ? <span>{category.categoryWord}</span> : null}
                    <h3>{category.title}</h3>
                    <p>{category.tagline}</p>
                    {category.href ? (
                      <Link href={category.href} className={styles.marketplacePanelLink}>
                        Explore category <span aria-hidden="true">↗</span>
                      </Link>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={styles.marketplaceSelectionButton}
                    aria-label={`Select ${category.title}`}
                    aria-pressed={isActive}
                    onFocus={() => notifySelection(category.id)}
                    onClick={() => notifySelection(category.id)}
                  />
                </article>
              );
            })}
          </div>
        </div>

        <div className={styles.marketplaceShopLink}>
          <Link href="/shop">
            {isStorefrontExposed ? "Browse all shops" : "Marketplace status"} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/** The sole Marketplace exit: the selected card opens into moving media strips. */
export function MarketplaceExitTransitionLayer({
  categories,
  selectedMarketplaceId,
}: {
  categories: readonly MarketplaceCategoryItem[];
  selectedMarketplaceId?: string;
}) {
  const displayItems = categories.length > 0 ? categories : FIVE_PANEL_MEDIA;
  const activeItem = displayItems.find(({ id }) => id === selectedMarketplaceId) ?? displayItems[0];
  const preparationImage = ktMediaV3.pages.homepage.preparation;

  return (
    <div className={styles.marketplaceExitSlices} data-marketplace-exit-slices aria-hidden="true">
      {Array.from({ length: 7 }, (_, index) => (
        <span key={index} data-marketplace-exit-slice={index}>
          <i
            data-marketplace-exit-outgoing
            style={activeItem ? { backgroundImage: `url("${activeItem.image}")` } : undefined}
          />
          <i
            data-marketplace-exit-incoming
            style={{ backgroundImage: `url("${preparationImage.src}")` }}
          />
        </span>
      ))}
    </div>
  );
}
