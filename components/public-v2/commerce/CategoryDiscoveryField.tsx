"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { marketplaceCategoryHref, marketplaceCategoriesHref } from "@/lib/public-marketplace/routes";
import { ktMedia } from "@/components/public-v2/media";
import { storefrontCategoryMediaSrc } from "@/lib/storefront/category-media";
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

  const getCategoryMedia = (cat: CategoryDiscoveryItem) => {
    const authoritative = storefrontCategoryMediaSrc(cat.imageReference);
    if (authoritative) return authoritative;
    const pathLower = cat.path.toLowerCase();
    if (pathLower.includes("food")) return ktMedia.categories.foodDining.hero.src;
    if (pathLower.includes("groc")) return ktMedia.categories.groceries.hero.src;
    if (pathLower.includes("fash") || pathLower.includes("cloth")) return ktMedia.categories.fashion.hero.src;
    if (pathLower.includes("pharm") || pathLower.includes("well") || pathLower.includes("care")) return ktMedia.categories.healthWellness.hero.src;
    if (pathLower.includes("home")) return ktMedia.categories.homeLiving.hero.src;
    return ktMedia.categories.fashion.hero.src;
  };

  const handleCategoryClick = (e: React.MouseEvent<HTMLAnchorElement>, cat: CategoryDiscoveryItem) => {
    const target = e.currentTarget;
    const mediaSrc = getCategoryMedia(cat);
    captureSourceMedia(`category-${cat.path}`, target, mediaSrc, cat.name);
  };

  return (
    <section aria-labelledby="category-discovery-title" className={styles.categoryDiscoverySection}>
      <div className={styles.commerceInner}>
        <div className={styles.commerceSectionHeader}>
          <div>
            <h2 id="category-discovery-title" style={{ margin: 0, fontSize: "clamp(1.5rem, 2.5vw, 2.2rem)", letterSpacing: "-0.03em" }}>
              Shop by category
            </h2>
          </div>
          <Link className={styles.sectionDirectLink} href={marketplaceCategoriesHref()} data-kt-sticky-mode="ALL">
            All categories &rarr;
          </Link>
        </div>

        {/* Mobile Horizontal Snap Grid (Visible on phone/tablet) */}
        <div className="md:hidden mt-3 overflow-x-auto pb-3 flex gap-2.5 snap-x snap-mandatory scrollbar-none pr-2">
          {displayCategories.map((cat) => {
            const href = marketplaceCategoryHref(cat.path) ?? marketplaceCategoriesHref();
            return (
              <Link
                key={cat.reference}
                href={href}
                onClick={(e) => handleCategoryClick(e, cat)}
                className="snap-start flex-none w-[152px] h-[126px] sm:w-[168px] sm:h-[136px] relative rounded-xl overflow-hidden border border-[var(--commerce-line)] no-underline group"
              >
                <Image
                  alt={cat.name}
                  src={getCategoryMedia(cat)}
                  fill
                  sizes="(max-width: 639px) 152px, 168px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 flex flex-col justify-end">
                  <strong className="text-white text-[0.95rem] font-semibold leading-snug">
                    {cat.name}
                  </strong>
                  <span className="text-[11px] text-white/80 mt-0.5">
                    {Boolean(cat.productCount && cat.productCount > 0)
                      ? `${cat.productCount} products`
                      : "Explore collection"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Desktop 5-Category Discovery Split (Hidden on mobile) */}
        <div className="hidden md:grid relative w-full mt-6 grid-cols-[300px_1fr] gap-8 items-start">
          {/* Category Index Navigation */}
          <ul className="flex flex-col gap-2 m-0 p-0 list-none">
            {displayCategories.map((category, idx) => {
              const isActive = idx === activeIdx;
              const href = marketplaceCategoryHref(category.path) ?? marketplaceCategoriesHref();

              return (
                <li key={category.reference}>
                  <Link
                    className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-150 text-left no-underline ${
                      isActive
                        ? "bg-white border-[var(--kt-carbon,#101210)] shadow-sm text-[#111318]"
                        : "bg-transparent border-transparent hover:bg-white/60 text-[#59626A]"
                    }`}
                    href={href}
                    onClick={(e) => handleCategoryClick(e, category)}
                    onFocus={() => setActiveIdx(idx)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    data-kt-sticky-mode="VIEW"
                  >
                    <span className="font-mono text-xs font-bold text-[var(--commerce-muted)] mt-0.5">
                      0{idx + 1}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-bold text-[1.05rem] text-[#111318]">
                        {category.name}
                      </span>
                      <span className="text-xs text-[#59626A] mt-0.5">
                        {Boolean(category.productCount && category.productCount > 0)
                          ? `${category.productCount} products`
                          : "Explore collection"}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Active Category Stage */}
          <div className="flex flex-col gap-4">
            <Link
              aria-label={`Explore ${activeCat.name}`}
              href={activeHref}
              onClick={(e) => handleCategoryClick(e, activeCat)}
              className="relative block rounded-2xl overflow-hidden border border-[var(--commerce-line)] no-underline group"
              data-kt-sticky-mode="OPEN"
              data-kt-shared-target={`category-${activeCat.path}`}
            >
              <div className="relative w-full h-[440px]">
                <Image
                  alt={activeCat.name}
                  fill
                  priority
                  sizes="(max-width: 899px) 100vw, 65vw"
                  src={getCategoryMedia(activeCat)}
                  style={{ objectFit: "cover" }}
                  className="transition-transform duration-500 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent p-6 flex justify-between items-end">
                  <div className="max-w-[70%]">
                    <span className="text-white text-xl font-bold tracking-tight block">
                      {activeCat.name}
                    </span>
                    {activeCat.description && (
                      <p className="text-white/80 text-sm mt-1 line-clamp-2">
                        {activeCat.description}
                      </p>
                    )}
                  </div>
                  <span className="text-white text-xs font-semibold uppercase tracking-wider py-2 px-4 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 group-hover:bg-white group-hover:text-black transition-colors">
                    Explore &rarr;
                  </span>
                </div>
              </div>
            </Link>

            {/* Thumbnail Previews for Siblings */}
            <div className="grid grid-cols-4 gap-3">
              {displayCategories.map((cat, idx) => {
                if (idx === activeIdx) return null;
                return (
                  <button
                    key={cat.reference}
                    type="button"
                    onClick={() => setActiveIdx(idx)}
                    className="relative h-20 rounded-lg overflow-hidden border border-[var(--commerce-line)] hover:border-[var(--kt-carbon,#101210)] cursor-pointer bg-[#0E1012] p-0"
                    data-kt-sticky-mode="SELECT"
                    aria-label={`Switch to ${cat.name}`}
                  >
                    <Image
                      alt={cat.name}
                      src={getCategoryMedia(cat)}
                      fill
                      sizes="160px"
                      className="object-cover opacity-80 hover:opacity-100 transition-opacity"
                    />
                    <span className="absolute bottom-1.5 left-2 z-10 text-[11px] font-semibold text-white truncate max-w-[90%] drop-shadow">
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
