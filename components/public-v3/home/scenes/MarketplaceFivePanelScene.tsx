"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "../home-scenes.module.css";

export interface MarketplaceCategoryItem {
  id: string;
  title: string;
  tagline: string;
  image: string;
  href?: string;
}

const EDITORIAL_HOLDING_PANELS: MarketplaceCategoryItem[] = [
  {
    id: "fashion",
    title: "Fashion",
    tagline: "South African apparel, footwear and accessories.",
    image: "/media/public/images/jhb-fashion-brown-coat.webp",
  },
  {
    id: "food",
    title: "Food",
    tagline: "Local kitchens, pantry essentials and daily orders.",
    image: "/media/public/images/cape-town-market-food-bowl.webp",
  },
  {
    id: "grocery",
    title: "Grocery",
    tagline: "Fresh produce, market staples and regional goods.",
    image: "/media/public/images/cape-town-market-vegetables.webp",
  },
  {
    id: "home",
    title: "Home",
    tagline: "Handcrafted ceramics, decor and lifestyle pieces.",
    image: "/media/public/images/cape-town-market-ceramics.webp",
  },
  {
    id: "wellness",
    title: "Wellness",
    tagline: "Body care, natural botanicals and self-care essentials.",
    image: "/media/public/images/jhb-rosebank-plants.webp",
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
 * Scene — Five-Panel Marketplace Field.
 * Expresses commerce discovery through spatial territory rather than cards or carousels.
 * Honors storefront production lock: displays honest editorial anticipation when locked,
 * and derives real published categories when storefront exposure is permitted.
 */
export function MarketplaceFivePanelScene({
  className = "",
  isStorefrontExposed = false,
  categories = [],
  activeId: controlledActiveId,
  onActiveIdChange,
}: MarketplaceFivePanelSceneProps) {
  const displayItems =
    isStorefrontExposed && categories.length > 0
      ? categories
      : EDITORIAL_HOLDING_PANELS;

  const [internalActiveId, setInternalActiveId] = useState<string>(
    displayItems[0]?.id || "fashion"
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
        <h2
          id="marketplace-field-title"
          className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4"
        >
          {isStorefrontExposed
            ? "Find something worth sending."
            : "Marketplace coming together."}
        </h2>
        <p className="text-base sm:text-lg text-[var(--kt-concrete)] max-w-xl">
          {isStorefrontExposed
            ? "Browse local stores and everyday finds, then let KT take it from there."
            : "KT's local marketplace is being prepared for public browsing. Discover local shops and everyday items as merchant catalogs are activated."}
        </p>
      </div>

      <div
        className={styles.panelsContainer}
        role="region"
        aria-label="Marketplace Categories"
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
                  alt={cat.title}
                  fill
                  sizes="(max-width: 899px) 85vw, 40vw"
                  className="object-cover"
                  priority={idx === 0}
                />
              </div>

              <div className={styles.panelOverlay} />

              <div className={styles.panelContent}>
                <h3 className={styles.panelTitle}>{cat.title}</h3>
                {isActive && <p className={styles.panelSub}>{cat.tagline}</p>}
                {isStorefrontExposed && cat.href ? (
                  <Link href={cat.href} className={styles.panelLink}>
                    Explore {cat.title} &rarr;
                  </Link>
                ) : (
                  <Link href="/shop" className={styles.panelLink}>
                    Marketplace Status &rarr;
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
