"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "../home-scenes.module.css";

const CATEGORIES = [
  {
    id: "fashion",
    title: "Fashion",
    tagline: "South African apparel, footwear and accessories.",
    image: "/media/public/images/jhb-fashion-brown-coat.webp",
    href: "/shop/categories/fashion",
  },
  {
    id: "food",
    title: "Food",
    tagline: "Local kitchens, pantry essentials and daily orders.",
    image: "/media/public/images/cape-town-market-food-bowl.webp",
    href: "/shop/categories/food",
  },
  {
    id: "grocery",
    title: "Grocery",
    tagline: "Fresh produce, market staples and regional goods.",
    image: "/media/public/images/cape-town-market-vegetables.webp",
    href: "/shop/categories/grocery",
  },
  {
    id: "home",
    title: "Home",
    tagline: "Handcrafted ceramics, decor and lifestyle pieces.",
    image: "/media/public/images/cape-town-market-ceramics.webp",
    href: "/shop/categories/home",
  },
  {
    id: "wellness",
    title: "Wellness",
    tagline: "Body care, natural botanicals and self-care essentials.",
    image: "/media/public/images/jhb-rosebank-plants.webp",
    href: "/shop/categories/wellness",
  },
];

interface MarketplaceFivePanelSceneProps {
  className?: string;
}

/**
 * Scene 03 — Five-Panel Marketplace Field.
 * Expresses commerce discovery through spatial territory rather than cards or carousels.
 * Active panel expands to 50–58% width while all other categories remain visible.
 */
export function MarketplaceFivePanelScene({
  className = "",
}: MarketplaceFivePanelSceneProps) {
  const [activeId, setActiveId] = useState<string>("fashion");

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
          Find something worth sending.
        </h2>
        <p className="text-base sm:text-lg text-[var(--kt-concrete)] max-w-xl">
          Browse local stores and everyday finds, then let KT take it from there.
        </p>
      </div>

      <div className={styles.panelsContainer} role="region" aria-label="Marketplace Categories">
        {CATEGORIES.map((cat) => {
          const isActive = activeId === cat.id;

          return (
            <div
              key={cat.id}
              className={`${styles.categoryPanel} ${
                isActive ? styles.categoryPanelActive : ""
              }`}
              onMouseEnter={() => setActiveId(cat.id)}
              onClick={() => setActiveId(cat.id)}
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
                  priority={cat.id === "fashion"}
                />
              </div>

              <div className={styles.panelOverlay} />

              <div className={styles.panelContent}>
                <h3 className={styles.panelTitle}>{cat.title}</h3>
                {isActive && <p className={styles.panelSub}>{cat.tagline}</p>}
                <Link href={cat.href} className={styles.panelLink}>
                  Explore {cat.title} &rarr;
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
