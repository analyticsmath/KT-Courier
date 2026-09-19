"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ktMediaV3 } from "../../media/kt-media-v3";
import styles from "../home-scenes.module.css";

export interface MarketplaceCategoryItem {
  id: string;
  title: string;
  tagline: string;
  image: string;
  altText?: string;
  href?: string;
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
  activeId?: string;
  onActiveIdChange?: (id: string) => void;
}

/**
 * Five-Panel Marketplace Field.
 * Emerging from the White Truck trailer takeover, the physical cargo rectangle
 * expands into a multi-image local commerce corridor across five vertical apertures.
 * Desktop: scroll alone owns panel territory (54% active, 11.5% inactive).
 * Mobile: touch-safe native horizontal snap corridor (82–88vw).
 * Honors storefront production lock with single global status CTA.
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
    displayItems[1]?.id || "fashion"
  );

  const activeId = controlledActiveId || internalActiveId;

  return (
    <section
      className={`${styles.marketplaceSection} ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="marketplace"
      aria-labelledby="marketplace-field-title"
    >
      <div className={styles.marketplaceHeader}>
        <h2
          id="marketplace-field-title"
          className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4 text-[var(--kt-white)]"
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

      {/* 5-Panel Corridor Container */}
      <div
        className={styles.panelsContainer}
        role="region"
        aria-label="Marketplace Categories Corridor"
      >
        {displayItems.map((cat) => {
          const isActive = activeId === cat.id;

          return (
            <div
              key={cat.id}
              id={`kt-market-panel-${cat.id}`}
              data-marketplace-panel-id={cat.id}
              data-marketplace-active={isActive ? "true" : "false"}
              className={`${styles.categoryPanel} ${
                isActive ? styles.categoryPanelActive : ""
              }`}
              aria-expanded={isActive}
              aria-label={`${cat.title} Category`}
            >
              <div className={styles.panelMediaFrame}>
                <Image
                  src={cat.image}
                  alt={cat.altText || cat.title}
                  fill
                  sizes="(max-width: 899px) 85vw, (max-width: 1440px) 55vw, 40vw"
                  className="object-cover"
                  style={{
                    objectPosition: isActive ? "center 52%" : "center 50%",
                    filter: isActive ? "brightness(1)" : "brightness(0.85)",
                  }}
                />
              </div>

              <div className={styles.panelOverlay} />

              <div className={styles.panelContent}>
                <h3 className={styles.panelTitle}>{cat.title}</h3>
                {isActive && (
                  <p className={`${styles.panelSub} max-w-md leading-snug`}>
                    {cat.tagline}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Single Global Marketplace Status CTA */}
      <div className="mt-8 px-[var(--kt-page-gutter)] flex items-center justify-end flex-wrap gap-4">
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
