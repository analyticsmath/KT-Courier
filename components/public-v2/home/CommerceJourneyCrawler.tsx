"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { marketplaceHref, marketplaceCategoryHref } from "@/lib/public-marketplace/routes";
import { ktMedia } from "@/components/public-v2/media";
import { MaskCursor } from "@/components/public-v2/motion/cursor/MaskCursor";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./home-journey.module.css";

interface StorefrontCategoryItem {
  path: string;
  name: string;
}

interface CommerceJourneyCrawlerProps {
  categories?: readonly StorefrontCategoryItem[];
}

const FIVE_CATEGORIES = [
  {
    id: "fashion",
    title: "Fashion & Leathercraft",
    tagline: "Rosebank artisan markets & contemporary apparel",
    path: "/fashion",
    media: ktMedia.categories.fashion.hero,
    secondaryMedia: ktMedia.categories.fashion.streetLook1,
  },
  {
    id: "groceries",
    title: "Fresh Market Grocery",
    tagline: "Farm produce crates & daily market staples",
    path: "/grocery",
    media: ktMedia.categories.groceries.hero,
    secondaryMedia: ktMedia.categories.groceries.freshGreens,
  },
  {
    id: "food-dining",
    title: "Local Food & Kitchens",
    tagline: "Prepared bowls & direct culinary delivery",
    path: "/food",
    media: ktMedia.categories.foodDining.hero,
    secondaryMedia: ktMedia.categories.foodDining.hero,
  },
  {
    id: "homeware",
    title: "Artisanal Homeware",
    tagline: "Handcrafted ceramics & architectural decor",
    path: "/homeware",
    media: ktMedia.categories.homeLiving.hero,
    secondaryMedia: ktMedia.categories.homeLiving.interiorVessel,
  },
  {
    id: "wellness",
    title: "Botanical Wellness",
    tagline: "Natural apothecary & organic self-care",
    path: "/wellness",
    media: ktMedia.categories.healthWellness.hero,
    secondaryMedia: ktMedia.categories.healthWellness.apothecaryJars,
  },
] as const;

export function CommerceJourneyCrawler({ categories = [] }: CommerceJourneyCrawlerProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLElement>(null);
  const activeCategory = FIVE_CATEGORIES[activeIdx] || FIVE_CATEGORIES[0];

  // Map each category to verified path if present
  const validCategoryMap = new Map(categories.map((c) => [c.path.toLowerCase(), c.path]));

  const getHref = (catPath: string) => {
    const matched = validCategoryMap.get(catPath.toLowerCase()) ?? validCategoryMap.get(catPath);
    return matched ? marketplaceCategoryHref(matched) || marketplaceHref() : marketplaceHref();
  };

  return (
    <section
      aria-labelledby="marketplace-storyboard-heading"
      className={styles.trailerTakeoverSection}
      data-scene="crawler"
      ref={containerRef}
    >
      {/* STATE 05: Trailer Material Takeover Surface */}
      <div className={styles.trailerSurfaceTakeover} data-actor="trailer-takeover">
        <Image
          alt="White freight trailer material transition surface"
          src={ktMedia.home.heroTruck.cargoBoxMaterial.src}
          fill
          priority
          sizes="100vw"
          className={styles.trailerMaterialImg}
        />
        <div className={styles.trailerTakeoverOverlay} />
      </div>

      {/* STATE 06 & 07: 5-Category World as ONE Visual Object */}
      <div className={styles.marketplaceSpatialStage} data-actor="marketplace-stage">
        {/* Header Strip */}
        <div className={styles.marketplaceHeaderStrip}>
          <div>
            <span className={styles.marketplaceChapterLabel}>
              STATE 06 — COMMERCE IN MOTION
            </span>
            <h2 className={styles.marketplaceHeading} id="marketplace-storyboard-heading">
              Browse 5 Curated Worlds
            </h2>
          </div>
          <Link
            href={marketplaceHref()}
            className={styles.marketplaceAllLink}
            data-kt-sticky-mode="EXPLORE"
          >
            <span>Explore all categories</span>
            <KtIconArrowRight size={16} />
          </Link>
        </div>

        {/* The 5-Category Spatial Deck */}
        <div className={styles.spatialCategoryDeck} data-actor="crawler-track">
          {/* Left / Desktop Navigation Index */}
          <div className={styles.categoryIndexNav}>
            <ul className={styles.categoryIndexList} role="tablist">
              {FIVE_CATEGORIES.map((cat, idx) => {
                const isActive = idx === activeIdx;
                return (
                  <li key={cat.id}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveIdx(idx)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`${styles.categoryIndexBtn} ${
                        isActive ? styles.categoryIndexBtnActive : ""
                      }`}
                      data-kt-sticky-mode="VIEW"
                    >
                      <span className={styles.categoryIndexNumber}>0{idx + 1}</span>
                      <div className={styles.categoryIndexInfo}>
                        <span className={styles.categoryIndexTitle}>{cat.title}</span>
                        {isActive && (
                          <span className={styles.categoryIndexTagline}>{cat.tagline}</span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right / Center: Active Category Media Object with Mask Cursor */}
          <div className={styles.activeCategoryMediaTerritory} data-actor="crawler-active-item">
            <Link
              href={getHref(activeCategory.path)}
              className={styles.activeMediaLink}
              data-kt-sticky-mode="SHOP"
            >
              <MaskCursor
                revealContent={
                  <div className="relative w-full h-full bg-[#0E1012]">
                    <Image
                      alt={activeCategory.secondaryMedia.alt}
                      src={activeCategory.secondaryMedia.src}
                      fill
                      sizes="(max-width: 1023px) 100vw, 60vw"
                      className="object-cover brightness-110"
                    />
                    <div className="absolute top-4 left-4 z-20 px-2 py-1 bg-[#347CFB] text-white text-[10px] font-mono tracking-widest uppercase">
                      INSPECT PERSPECTIVE
                    </div>
                  </div>
                }
                className="w-full h-full rounded-[4px]"
                maskRadius={130}
              >
                <div className="relative w-full h-[480px] md:h-[580px] bg-[#111318]">
                  <Image
                    alt={activeCategory.media.alt}
                    src={activeCategory.media.src}
                    fill
                    priority
                    sizes="(max-width: 1023px) 100vw, 60vw"
                    className={styles.activeMediaImg}
                  />
                  <div className={styles.activeMediaBadgeBar}>
                    <span className={styles.activeCategoryLabel}>
                      {activeCategory.title}
                    </span>
                    <span className={styles.activeCategoryAction}>
                      Shop Category &rarr;
                    </span>
                  </div>
                </div>
              </MaskCursor>
            </Link>

            {/* Compressed Neighbor Media Previews (Depth & Context) */}
            <div className={styles.neighborContextStrip}>
              {FIVE_CATEGORIES.map((cat, idx) => {
                if (idx === activeIdx) return null;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveIdx(idx)}
                    className={styles.neighborThumbBtn}
                    data-kt-sticky-mode="SELECT"
                    aria-label={`Switch to ${cat.title}`}
                  >
                    <Image
                      alt={cat.media.alt}
                      src={cat.media.src}
                      fill
                      sizes="120px"
                      className="object-cover"
                    />
                    <span className={styles.neighborThumbLabel}>{cat.title.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile Horizontal Native Media Strip */}
        <div className={styles.mobileCategoryScrollSnap}>
          {FIVE_CATEGORIES.map((cat, idx) => (
            <Link
              key={cat.id}
              href={getHref(cat.path)}
              className={styles.mobileCategoryCard}
            >
              <div className={styles.mobileCategoryCardMedia}>
                <Image
                  alt={cat.media.alt}
                  src={cat.media.src}
                  fill
                  sizes="82vw"
                  className="object-cover"
                />
              </div>
              <div className={styles.mobileCategoryCardMeta}>
                <span className={styles.mobileCategoryCardNumber}>0{idx + 1}</span>
                <span className={styles.mobileCategoryCardTitle}>{cat.title}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
