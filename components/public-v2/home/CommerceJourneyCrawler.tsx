"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { marketplaceHref, marketplaceCategoryHref } from "@/lib/public-marketplace/routes";
import { usePublicMotionPreference } from "@/components/public-v2/motion/usePublicMotionPreference";
import { homeMedia } from "./home-media";
import styles from "./home-journey.module.css";

interface StorefrontCategoryItem {
  path: string;
  name: string;
}

interface CrawlerItemConfig {
  id: string;
  name: string;
  defaultCategoryPath: string;
  media: (typeof homeMedia)[keyof typeof homeMedia];
}

const baseCrawlerItems: CrawlerItemConfig[] = [
  {
    id: "fashion",
    name: "Fashion & Lifestyle",
    defaultCategoryPath: "/fashion",
    media: homeMedia.fashion,
  },
  {
    id: "food",
    name: "Local Kitchens & Food",
    defaultCategoryPath: "/food",
    media: homeMedia.foodLocal,
  },
  {
    id: "grocery",
    name: "Fresh Market Grocery",
    defaultCategoryPath: "/grocery",
    media: homeMedia.grocery,
  },
  {
    id: "retail",
    name: "Local Retail & Goods",
    defaultCategoryPath: "/retail",
    media: homeMedia.retailLocal,
  },
  {
    id: "wellness",
    name: "Wellness & Self-Care",
    defaultCategoryPath: "/wellness",
    media: homeMedia.wellness,
  },
  {
    id: "homeware",
    name: "Homeware & Living",
    defaultCategoryPath: "/homeware",
    media: homeMedia.homeware,
  },
];

interface CommerceJourneyCrawlerProps {
  categories?: readonly StorefrontCategoryItem[];
}

export function CommerceJourneyCrawler({ categories = [] }: CommerceJourneyCrawlerProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLElement>(null);
  const { prefersReducedMotion } = usePublicMotionPreference();

  // Map each item to a verified category path if present in storefront, otherwise canonical /shop
  const validCategoryMap = new Map(categories.map((c) => [c.path.toLowerCase(), c.path]));

  const items = baseCrawlerItems.map((item) => {
    const matchedPath =
      validCategoryMap.get(item.defaultCategoryPath.toLowerCase()) ??
      validCategoryMap.get(`/${item.id}`) ??
      null;

    const href = matchedPath ? marketplaceCategoryHref(matchedPath) || marketplaceHref() : marketplaceHref();

    return {
      ...item,
      href,
    };
  });

  // Desktop Scroll-Driven Progress Calculation
  useEffect(() => {
    if (prefersReducedMotion || typeof window === "undefined") return;

    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (!isFinePointer) return;

    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalHeight = containerRef.current.offsetHeight - window.innerHeight;
      if (totalHeight <= 0) return;

      const progress = Math.max(0, Math.min(1, -rect.top / totalHeight));
      const nextIdx = Math.min(items.length - 1, Math.floor(progress * items.length));
      setActiveIdx(nextIdx);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [items.length, prefersReducedMotion]);

  return (
    <section
      aria-labelledby="crawler-heading"
      className={styles.crawlerScene}
      data-scene="crawler"
      ref={containerRef}
    >
      <div className={styles.crawlerStickyViewport}>
        <div className={styles.crawlerHeader}>
          <div>
            <h2 className={styles.crawlerTitle} id="crawler-heading">
              It starts with a choice.
            </h2>
            <p className={styles.crawlerSub}>
              Discover independent makers, neighborhood grocers, and local merchants.
            </p>
          </div>

          <Link className={styles.heroCommandPrimary} href={marketplaceHref()}>
            Explore marketplace &rarr;
          </Link>
        </div>

        <div className={styles.crawlerStageTrack} data-actor="crawler-track">
          {items.map((item, idx) => {
            const isActive = idx === activeIdx;
            const isPrev = idx < activeIdx;
            const itemClass = `${styles.crawlerItem} ${
              isActive
                ? styles.crawlerItemActive
                : isPrev
                ? styles.crawlerItemStrip
                : styles.crawlerItemWide
            }`;

            return (
              <Link
                className={itemClass}
                data-actor={idx === 0 ? "crawler-first-item" : isActive ? "crawler-active-item" : undefined}
                data-crawler-item={item.id}
                data-index={idx}
                href={item.href}
                key={item.id}
                onFocus={() => setActiveIdx(idx)}
                onMouseEnter={() => {
                  if (window.matchMedia("(pointer: fine)").matches) {
                    setActiveIdx(idx);
                  }
                }}
              >
                <div className={styles.crawlerImageFrame}>
                  <Image
                    alt={item.media.alt}
                    fill
                    sizes="(max-width: 767px) 82vw, (max-width: 1199px) 50vw, 680px"
                    src={item.media.src}
                    style={{
                      objectFit: "cover",
                      objectPosition:
                        "objectPosition" in item.media
                          ? (item.media as { objectPosition?: string }).objectPosition ?? "center"
                          : "center",
                    }}
                  />
                </div>

                <div className={styles.crawlerItemLabelBlock}>
                  <span className={styles.crawlerItemName}>{item.name}</span>
                  <span className={styles.crawlerItemAction}>View Category &rarr;</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
