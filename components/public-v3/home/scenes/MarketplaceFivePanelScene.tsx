"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ktMediaV3 } from "../../media/kt-media-v3";
import styles from "../home-scenes.module.css";

export interface MarketplaceCategoryItem {
  id: string;
  categoryWord?: string;
  title: string;
  tagline: string;
  image: string;
  altText?: string;
  href?: string;
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
  activeId?: string;
  onActiveIdChange?: (id: string) => void;
}

/**
 * Chapter 02 & 03 — Marketplace Horizontal World (Phase 3B).
 * True lateral journey replacing vertical column expansion:
 * - Active image territory: ~72vw desktop
 * - Next territory visible: ~20vw
 * - Giant active category word (FRESH, FASHION, FOOD, CRAFT, CARE) moves behind media
 * - Vertical scroll scrubs horizontal rail via GSAP ScrollTrigger
 * - Mobile: native horizontal scroll-snap corridor
 * - Honest storefront status link
 */
export function MarketplaceFivePanelScene({
  className = "",
  isStorefrontExposed = false,
  categories = [],
  activeId: controlledActiveId,
}: MarketplaceFivePanelSceneProps) {
  const displayItems =
    isStorefrontExposed && categories.length > 0 ? categories : FIVE_PANEL_MEDIA;

  const [internalActiveId] = useState<string>(
    displayItems[0]?.id || "grocery"
  );

  const activeId = controlledActiveId || internalActiveId;
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
    >
      {/* Header */}
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

      {/* Giant Active Category Word Plane (Moves behind media at slower rate) */}
      <div className={styles.marketplaceWordPlane} aria-hidden="true">
        <span
          data-motion="market-word"
          className={styles.marketplaceWord}
        >
          {activeCategoryWord}
        </span>
      </div>

      {/* Horizontal Rail Container */}
      <div
        className={styles.marketplaceRailWrapper}
        role="region"
        aria-label="Marketplace Horizontal Category Rail"
      >
        <div
          data-motion="market-rail"
          className={styles.marketplaceRail}
        >
          {displayItems.map((cat, idx) => {
            const isActive = activeId === cat.id;

            return (
              <article
                key={cat.id}
                id={`kt-market-card-${cat.id}`}
                data-marketplace-panel-id={cat.id}
                data-marketplace-index={idx}
                data-marketplace-active={isActive ? "true" : "false"}
                className={styles.marketplaceCard}
                aria-label={`${cat.title} Category`}
              >
                {/* Visual Media Frame (active image crop shifts 2-4% via GSAP) */}
                <div className={styles.marketplaceCardMedia}>
                  <Image
                    src={cat.image}
                    alt={cat.altText || cat.title}
                    fill
                    sizes="(max-width: 899px) 85vw, 75vw"
                    className={`${styles.marketplaceCardImg} kt-market-card-img`}
                    priority={idx === 0}
                  />
                  <div className={styles.marketplaceCardOverlay} />
                </div>

                {/* Narrative Copy */}
                <div
                  data-motion="market-copy"
                  className={styles.marketplaceCardContent}
                >
                  <h3 className={styles.marketplaceCardTitle}>{cat.title}</h3>
                  <p className={styles.marketplaceCardTagline}>
                    {cat.tagline}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Single Global Marketplace Status Link */}
      <div className="px-[var(--kt-page-gutter)] flex items-center justify-end z-20">
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 text-xs uppercase font-mono tracking-wider text-[var(--kt-brand-blue)] hover:text-white transition-colors"
        >
          {isStorefrontExposed ? "Browse all shops" : "Marketplace status"} &rarr;
        </Link>
      </div>
    </section>
  );
}
