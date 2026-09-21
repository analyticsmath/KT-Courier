"use client";

import Image from "next/image";
import Link from "next/link";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { marketplaceBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";
import styles from "../post-hero-scenes.module.css";

export interface MarketplaceCategoryItem {
  id: string;
  categoryWord?: string;
  title: string;
  tagline: string;
  image: string;
  altText?: string;
  href?: string;
  hasEditorialMedia?: boolean;
}

export const FIVE_PANEL_MEDIA: MarketplaceCategoryItem[] = [
  {
    id: "grocery",
    categoryWord: "FRESH",
    title: "Fresh produce",
    tagline: "Farm-fresh vegetables, morning market crates, and regional pantry staples.",
    image: ktMediaV3.editorial.grocery.fruitCrates.src,
    altText: ktMediaV3.editorial.grocery.fruitCrates.alt,
  },
  {
    id: "fashion",
    categoryWord: "FASHION",
    title: "Local fashion",
    tagline: "South African leathercraft, tailored streetwear, and local retail goods.",
    image: ktMediaV3.editorial.fashion.leatherBags.src,
    altText: ktMediaV3.editorial.fashion.leatherBags.alt,
  },
  {
    id: "food",
    categoryWord: "FOOD",
    title: "Food makers",
    tagline: "Warm prepared meals, independent bakeries, and daily artisan orders.",
    image: ktMediaV3.editorial.food.grainBowl.src,
    altText: ktMediaV3.editorial.food.grainBowl.alt,
  },
  {
    id: "home",
    categoryWord: "CRAFT",
    title: "Craft & home",
    tagline: "Handcrafted stoneware, architectural pottery, and residential pieces.",
    image: ktMediaV3.editorial.ceramics.capeTownPlates.src,
    altText: ktMediaV3.editorial.ceramics.capeTownPlates.alt,
  },
  {
    id: "wellness",
    categoryWord: "CARE",
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

/**
 * Chapter 02 & 03 — Marketplace Horizontal World (Phase 3B).
 * True lateral journey replacing vertical column expansion:
 * - Active image territory: ~72vw desktop
 * - Next territory visible: ~20vw
 * - Giant active category word (FRESH, FASHION, FOOD, CRAFT, CARE) moves behind media
 * - The homepage director resolves a normalized vertical-scroll rail position
 * - Mobile: native horizontal scroll-snap corridor
 * - Honest storefront status link
 */
export function MarketplaceFivePanelScene({
  className = "",
  isStorefrontExposed = false,
  categories = [],
  selectedMarketplaceId,
  onMarketplaceSelectionChange,
}: MarketplaceFivePanelSceneProps) {
  const displayItems = categories.length > 0 ? categories : FIVE_PANEL_MEDIA;
  const activeId = displayItems.some(({ id }) => id === selectedMarketplaceId)
    ? selectedMarketplaceId
    : displayItems[0]?.id;
  const activeItem =
    displayItems.find((item) => item.id === activeId) || displayItems[0];
  const activeCategoryWord = activeItem?.categoryWord || "FRESH";

  return (
    <section
      className={`${styles.marketplaceSection} ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="marketplace"
      data-motion="market-stage"
      aria-labelledby="marketplace-field-title"
      style={{ minHeight: `${marketplaceBudgetVh(displayItems.length)}svh`, "--kt-home-mobile-budget": mobileChapterBudgetVh("marketplace", displayItems.length) } as React.CSSProperties}
    >
      <div className={styles.marketplaceStickyStage} data-marketplace-sticky-stage>
      <div className={styles.marketplaceAtmosphere} aria-hidden="true">
        {displayItems.map((item) => (
          <div key={item.id} data-marketplace-backdrop={item.id} data-marketplace-backdrop-active={item.id === activeId} className={styles.marketplaceBackdrop} style={{ backgroundImage: `url(${item.image})` }} />
        ))}
        <div className={styles.marketplaceSlicePlane}>
          {Array.from({ length: 8 }, (_, index) => <span key={index} data-marketplace-slice style={{ "--slice": index } as React.CSSProperties} />)}
        </div>
      </div>
      <div className={styles.marketplaceHeader}>
        <h2
          id="marketplace-field-title"
          className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-3 text-[var(--kt-white)]"
        >
          {isStorefrontExposed
            ? "Find something worth sending."
            : "Marketplace coming together."}
        </h2>
        <p className="text-base sm:text-lg text-[var(--kt-concrete)] max-w-xl leading-relaxed">
          {isStorefrontExposed
            ? "Browse local stores and everyday finds, then let KT take it from there."
            : "Local merchant catalogues are being prepared for public browsing."}
        </p>
      </div>

      <div className={styles.marketplaceWordPlane} aria-hidden="true">
        <span
          data-motion="market-word"
          className={styles.marketplaceWord}
        >
          {activeCategoryWord}
        </span>
      </div>

      <div
        className={styles.marketplaceRailWrapper}
        data-marketplace-rail-wrapper
        role="region"
          aria-label="Marketplace category atlas"
      >
        <div
          data-motion="market-rail"
          className={styles.marketplaceRail}
        >
          {displayItems.map((cat, idx) => {
            const isActive = activeId === cat.id;
            const distance = Math.abs(idx - Math.max(0, displayItems.findIndex(({ id }) => id === activeId)));

            return (
              <article
                key={cat.id}
                id={`kt-market-card-${cat.id}`}
                data-marketplace-panel-id={cat.id}
                data-marketplace-index={idx}
                data-marketplace-active={isActive ? "true" : "false"}
                data-marketplace-distance={distance}
                className={styles.marketplaceCard}
                aria-label={`${cat.title} Category`}
              >
                <div className={styles.marketplaceCardMedia}>
                  <Image
                    src={cat.image}
                    alt={cat.altText || cat.title}
                    fill
                    sizes="(max-width: 899px) 85vw, 75vw"
                    className={`${styles.marketplaceCardImg} kt-market-card-img`}
                    preload={idx === 0}
                  />
                  <div className={styles.marketplaceCardOverlay} />
                </div>

                <div
                  data-motion="market-copy"
                  className={styles.marketplaceCardContent}
                >
                  <h3 className={styles.marketplaceCardTitle}>{cat.title}</h3>
                  <p className={styles.marketplaceCardTagline}>
                    {cat.tagline}
                  </p>
                  {cat.href ? <Link href={cat.href} className={styles.marketplacePanelLink}>Explore category <span aria-hidden="true">↗</span></Link> : null}
                </div>
                <button
                  type="button"
                  className={styles.marketplaceSelectionButton}
                  aria-label={`Preview ${cat.title}`}
                  aria-pressed={isActive}
                  onFocus={() => onMarketplaceSelectionChange?.(cat.id)}
                  onClick={() => onMarketplaceSelectionChange?.(cat.id)}
                />
              </article>
            );
          })}
        </div>
      </div>

      <div className={styles.marketplaceIndex} role="tablist" aria-label="Marketplace categories">
        {displayItems.map((cat, index) => (
          <button
            type="button"
            key={cat.id}
            role="tab"
            aria-selected={cat.id === activeId}
            className={styles.marketplaceIndexButton}
            data-marketplace-index-control={cat.id}
            onFocus={() => onMarketplaceSelectionChange?.(cat.id)}
            onClick={() => onMarketplaceSelectionChange?.(cat.id)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>{cat.title}
          </button>
        ))}
      </div>
      <div className={styles.marketplaceShopLink}>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 text-xs uppercase font-mono tracking-wider text-[var(--kt-brand-blue)] hover:text-white transition-colors"
        >
          {isStorefrontExposed ? "Browse all shops" : "Marketplace status"} &rarr;
        </Link>
      </div>
      </div>
    </section>
  );
}
