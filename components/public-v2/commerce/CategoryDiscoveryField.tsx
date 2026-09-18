"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { marketplaceCategoryHref, marketplaceCategoriesHref } from "@/lib/public-marketplace/routes";
import { ktMedia } from "@/components/public-v2/media";
import { MaskCursor } from "@/components/public-v2/motion/cursor/MaskCursor";
import { useTransitionContext } from "@/components/public-v2/motion/PublicTransitionRouter";
import styles from "./commerce.module.css";

interface CategoryDiscoveryItem {
  reference: string;
  path: string;
  name: string;
  description?: string;
  imageReference?: string;
  productCount?: number;
}

interface CategoryDiscoveryFieldProps {
  categories: readonly CategoryDiscoveryItem[];
}

export function CategoryDiscoveryField({ categories }: CategoryDiscoveryFieldProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const { captureSourceMedia } = useTransitionContext();

  if (!categories.length) return null;

  const displayCategories = categories.slice(0, 5);
  const activeCat = displayCategories[activeIdx] || displayCategories[0];
  const activeHref = (activeCat ? marketplaceCategoryHref(activeCat.path) : null) ?? marketplaceCategoriesHref();

  // Primary authoritative media matching from ktMedia
  const getCategoryMedia = (cat: CategoryDiscoveryItem) => {
    if (cat.imageReference) {
      return `/api/catalog/media/${cat.imageReference}`;
    }
    const pathLower = cat.path.toLowerCase();
    if (pathLower.includes("food")) return ktMedia.categories.foodDining.hero.src;
    if (pathLower.includes("groc")) return ktMedia.categories.groceries.hero.src;
    if (pathLower.includes("fash") || pathLower.includes("cloth")) return ktMedia.categories.fashion.hero.src;
    if (pathLower.includes("well") || pathLower.includes("care")) return ktMedia.categories.healthWellness.hero.src;
    if (pathLower.includes("home")) return ktMedia.categories.homeLiving.hero.src;
    return ktMedia.categories.fashion.hero.src;
  };

  const getCategorySecondaryMedia = (cat: CategoryDiscoveryItem) => {
    const pathLower = cat.path.toLowerCase();
    if (pathLower.includes("fash")) return ktMedia.categories.fashion.streetLook1.src;
    if (pathLower.includes("groc")) return ktMedia.categories.groceries.freshGreens.src;
    if (pathLower.includes("well")) return ktMedia.categories.healthWellness.essentialOils.src;
    if (pathLower.includes("home")) return ktMedia.categories.homeLiving.interiorVessel.src;
    return ktMedia.categories.fashion.streetLook2.src;
  };

  const handleCategoryClick = (e: React.MouseEvent<HTMLAnchorElement>, cat: CategoryDiscoveryItem) => {
    const target = e.currentTarget;
    const mediaSrc = getCategoryMedia(cat);
    captureSourceMedia(`category-${cat.path}`, target, mediaSrc, cat.name);
  };

  return (
    <section aria-labelledby="category-discovery-title" className={styles.categoryDiscoverySection}>
      <div className={styles.commerceInner}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <span className="text-[11px] font-mono tracking-widest text-[#347CFB] uppercase font-bold block mb-1">
              FIVE CATEGORY ARCHITECTURE
            </span>
            <h2 className={styles.sectionTitleMain} id="category-discovery-title">
              Marketplace Worlds
            </h2>
          </div>
          <Link className={styles.sectionDirectLink} href={marketplaceCategoriesHref()} data-kt-sticky-mode="ALL">
            All categories &rarr;
          </Link>
        </div>

        {/* 5-Category World as ONE Interactive Visual Object with Depth & Overlap */}
        <div className="relative w-full mt-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 items-start">
          {/* Category Index Navigation */}
          <ul className="flex flex-col gap-2 m-0 p-0 list-none" role="tablist">
            {displayCategories.map((category, idx) => {
              const isActive = idx === activeIdx;
              const href = marketplaceCategoryHref(category.path) ?? marketplaceCategoriesHref();

              return (
                <li key={category.reference}>
                  <Link
                    aria-selected={isActive}
                    className={`flex items-start gap-3 p-4 rounded-[4px] border transition-all duration-150 text-left no-underline ${
                      isActive
                        ? "bg-white border-[#347CFB] shadow-sm text-[#111318]"
                        : "bg-transparent border-transparent hover:bg-white/60 hover:border-[#D9DEE2] text-[#59626A]"
                    }`}
                    href={href}
                    onClick={(e) => handleCategoryClick(e, category)}
                    onFocus={() => setActiveIdx(idx)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    role="tab"
                    data-kt-sticky-mode="VIEW"
                  >
                    <span className="font-mono text-xs font-bold text-[#347CFB] mt-0.5">
                      0{idx + 1}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-bold text-[1.05rem] text-[#111318]">
                        {category.name}
                      </span>
                      <span className="text-xs text-[#59626A] mt-0.5">
                        {typeof category.productCount === "number"
                          ? `${category.productCount} products`
                          : "Explore collection"}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Active Category Object with Mask Cursor & Depth Previews */}
          <div className="flex flex-col gap-4">
            <Link
              aria-label={`Explore ${activeCat.name}`}
              href={activeHref}
              onClick={(e) => handleCategoryClick(e, activeCat)}
              className="relative block rounded-[4px] overflow-hidden shadow-xl border border-[#D9DEE2]/40"
              data-kt-sticky-mode="OPEN"
              data-kt-shared-target={`category-${activeCat.path}`}
            >
              <MaskCursor
                revealContent={
                  <div className="relative w-full h-full bg-[#0E1012]">
                    <Image
                      alt={`${activeCat.name} alternate view`}
                      src={getCategorySecondaryMedia(activeCat)}
                      fill
                      sizes="(max-width: 1023px) 100vw, 65vw"
                      className="object-cover brightness-110"
                    />
                    <div className="absolute top-4 left-4 z-20 px-2 py-1 bg-[#347CFB] text-white text-[10px] font-mono tracking-widest uppercase">
                      INSPECT PERSPECTIVE
                    </div>
                  </div>
                }
                className="w-full h-[460px] md:h-[540px]"
                maskRadius={130}
              >
                <div className="relative w-full h-full bg-[#111318]">
                  <Image
                    alt={activeCat.name}
                    fill
                    priority
                    sizes="(max-width: 899px) 100vw, 65vw"
                    src={getCategoryMedia(activeCat)}
                    style={{ objectFit: "cover" }}
                    className="transition-transform duration-300 hover:scale-[1.02]"
                  />
                  <div className={styles.entryMediaOverlay}>
                    <div>
                      <span className={styles.mediaCategoryName}>{activeCat.name}</span>
                      {activeCat.description && (
                        <p style={{ fontSize: "0.85rem", color: "var(--kt-cool-300, #c9cecc)", margin: "4px 0 0" }}>
                          {activeCat.description}
                        </p>
                      )}
                    </div>
                    <span className={styles.mediaActionLink}>View Category &rarr;</span>
                  </div>
                </div>
              </MaskCursor>
            </Link>

            {/* Compressed Neighbor Previews */}
            <div className="grid grid-cols-4 gap-3">
              {displayCategories.map((cat, idx) => {
                if (idx === activeIdx) return null;
                return (
                  <button
                    key={cat.reference}
                    type="button"
                    onClick={() => setActiveIdx(idx)}
                    className="relative h-20 rounded-[2px] overflow-hidden border border-[#D9DEE2] hover:border-[#347CFB] cursor-pointer bg-[#0E1012] p-0"
                    data-kt-sticky-mode="SELECT"
                    aria-label={`Switch to ${cat.name}`}
                  >
                    <Image
                      alt={cat.name}
                      src={getCategoryMedia(cat)}
                      fill
                      sizes="160px"
                      className="object-cover opacity-85 hover:opacity-100 transition-opacity"
                    />
                    <span className="absolute bottom-1 left-2 z-10 text-[10px] font-bold text-white shadow-sm truncate max-w-[90%]">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
