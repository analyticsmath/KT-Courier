"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { marketplaceHref, marketplaceCategoryHref } from "@/lib/public-marketplace/routes";
import { homeMedia } from "./home-media";
import styles from "./home-journey.module.css";

interface CommerceItem {
  id: string;
  name: string;
  categoryPath: string;
  media: (typeof homeMedia)[keyof typeof homeMedia];
  geometry: "active" | "strip" | "wide";
}

const crawlerItems: CommerceItem[] = [
  {
    id: "fashion",
    name: "Fashion & Lifestyle",
    categoryPath: "/fashion",
    media: homeMedia.fashion,
    geometry: "active",
  },
  {
    id: "food",
    name: "Local Kitchens & Food",
    categoryPath: "/food",
    media: homeMedia.foodLocal,
    geometry: "wide",
  },
  {
    id: "grocery",
    name: "Fresh Market Grocery",
    categoryPath: "/grocery",
    media: homeMedia.grocery,
    geometry: "strip",
  },
  {
    id: "retail",
    name: "Local Retail & Goods",
    categoryPath: "/retail",
    media: homeMedia.retailLocal,
    geometry: "active",
  },
  {
    id: "wellness",
    name: "Wellness & Self-Care",
    categoryPath: "/wellness",
    media: homeMedia.wellness,
    geometry: "wide",
  },
  {
    id: "homeware",
    name: "Homeware & Living",
    categoryPath: "/homeware",
    media: homeMedia.homeware,
    geometry: "active",
  },
];

export function CommerceJourneyCrawler() {
  const [activeIdx, setActiveIdx] = useState(0);

  return (
    <section
      aria-labelledby="crawler-heading"
      className={styles.crawlerScene}
      data-scene="crawler"
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
          {crawlerItems.map((item, idx) => {
            const isActive = idx === activeIdx;
            const isPrev = idx < activeIdx;
            const itemClass = `${styles.crawlerItem} ${
              isActive
                ? styles.crawlerItemActive
                : isPrev
                ? styles.crawlerItemStrip
                : styles.crawlerItemWide
            }`;

            const href = marketplaceCategoryHref(item.categoryPath) || marketplaceHref();

            return (
              <Link
                className={itemClass}
                data-crawler-item={item.id}
                data-index={idx}
                href={href}
                key={item.id}
                onMouseEnter={() => setActiveIdx(idx)}
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
