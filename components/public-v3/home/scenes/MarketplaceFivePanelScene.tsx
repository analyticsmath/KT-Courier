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

const FIVE_PANEL_MEDIA: MarketplaceCategoryItem[] = [
  {
    id: "grocery",
    title: "Produce & Grocery",
    tagline: "Farm-fresh vegetables, morning market crates and regional pantry staples.",
    image: ktMediaV3.editorial.grocery.fruitCrates.src,
    altText: ktMediaV3.editorial.grocery.fruitCrates.alt,
  },
  {
    id: "fashion",
    title: "Apparel & Leather",
    tagline: "South African leathercraft, tailored streetwear and local retail goods.",
    image: ktMediaV3.editorial.fashion.leatherBags.src,
    altText: ktMediaV3.editorial.fashion.leatherBags.alt,
  },
  {
    id: "food",
    title: "Kitchens & Dining",
    tagline: "Warm prepared meals, independent bakeries and daily artisan orders.",
    image: ktMediaV3.editorial.food.grainBowl.src,
    altText: ktMediaV3.editorial.food.grainBowl.alt,
  },
  {
    id: "home",
    title: "Ceramics & Living",
    tagline: "Handcrafted stoneware, architectural pottery and residential pieces.",
    image: ktMediaV3.editorial.ceramics.capeTownPlates.src,
    altText: ktMediaV3.editorial.ceramics.capeTownPlates.alt,
  },
  {
    id: "wellness",
    title: "Apothecary & Care",
    tagline: "Amber glass botanicals, organic skincare and sealed personal care.",
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
 * Chapter 03 — Five-Panel Marketplace Field.
 * Emerging from the White Truck trailer takeover, the physical cargo rectangle
 * expands into a multi-image local commerce corridor across five narrow vertical apertures.
 * Desktop: scroll selects active territory expanding to 52–58% with internal crop shifts.
 * Mobile: touch-safe 82–88vw snap corridor.
 * Honors storefront production lock with single global status CTA.
 */
export function MarketplaceFivePanelScene({
  className = "",
  isStorefrontExposed = false,
  categories = [],
  activeId: controlledActiveId,
  onActiveIdChange,
}: MarketplaceFivePanelSceneProps) {
  const displayItems =
    isStorefrontExposed && categories.length > 0 ? categories : FIVE_PANEL_MEDIA;

  const [internalActiveId, setInternalActiveId] = useState<string>(
    displayItems[1]?.id || "fashion"
  );

  const activeId = controlledActiveId || internalActiveId;

  const handleSelect = (id: string) => {
    setInternalActiveId(id);
    onActiveIdChange?.(id);
  };

  return (
    <section
      className={`${styles.marketplaceSection} ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="marketplace"
      aria-labelledby="marketplace-field-title"
    >
      <div className={styles.marketplaceHeader}>
        <span className="text-xs uppercase font-mono tracking-widest text-[var(--kt-concrete)] mb-3 block">
          Chapter 03 &bull; Local Commerce Corridor
        </span>
        <h2
          id="marketplace-field-title"
          className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4"
        >
          {isStorefrontExposed
            ? "Find something worth sending."
            : "Marketplace coming together."}
        </h2>
        <p className="text-base sm:text-lg text-[var(--kt-concrete)] max-w-xl leading-relaxed">
          {isStorefrontExposed
            ? "Browse local stores and everyday finds, then let KT take it from there."
            : "KT's local marketplace is being prepared for public browsing. Discover neighborhood makers and local merchants as catalogs are activated."}
        </p>
      </div>

      {/* 5-Panel Corridor Container */}
      <div
        className={styles.panelsContainer}
        role="region"
        aria-label="Marketplace Categories Corridor"
      >
        {displayItems.map((cat, idx) => {
          const isActive = activeId === cat.id;

          return (
            <div
              key={cat.id}
              id={`kt-market-panel-${cat.id}`}
              className={`${styles.categoryPanel} ${
                isActive ? styles.categoryPanelActive : ""
              }`}
              onMouseEnter={() => handleSelect(cat.id)}
              onClick={() => handleSelect(cat.id)}
              tabIndex={0}
              role="button"
              aria-expanded={isActive}
              aria-label={`${cat.title} Category`}
            >
              <div className={styles.panelMediaFrame}>
                <Image
                  src={cat.image}
                  alt={cat.altText || cat.title}
                  fill
                  sizes="(max-width: 899px) 85vw, (max-width: 1440px) 55vw, 40vw"
                  className={`object-cover transition-transform duration-700 ease-out ${
                    isActive ? "scale-105" : "scale-100 filter brightness-90"
                  }`}
                  priority={idx <= 1}
                />
              </div>

              <div className={styles.panelOverlay} />

              <div className={styles.panelContent}>
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--kt-concrete)] mb-1 block">
                  0{idx + 1} &bull; Sector
                </span>
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
      <div className="mt-8 px-[var(--kt-page-gutter)] flex items-center justify-between flex-wrap gap-4">
        <div className="text-xs text-[var(--kt-concrete)] font-mono">
          5 ACTIVE COMMERCE CATEGORIES &bull; VERIFIED MERCHANT NETWORK
        </div>
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
