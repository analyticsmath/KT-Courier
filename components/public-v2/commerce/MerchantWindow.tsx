"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { marketplaceStoreHref, marketplaceStoresHref } from "@/lib/public-marketplace/routes";
import { homeMedia } from "@/components/public-v2/home/home-media";
import styles from "./commerce.module.css";

interface MerchantWindowStore {
  reference: string;
  slug: string;
  name: string;
  description?: string;
  logoMediaReference?: string;
  heroMediaReference?: string;
  publishedOfferCount: number;
}

interface MerchantWindowProps {
  stores: readonly MerchantWindowStore[];
}

export function MerchantWindow({ stores }: MerchantWindowProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!stores.length) return null;

  const activeStore = stores[activeIdx] || stores[0];
  const activeHref = (activeStore ? marketplaceStoreHref(activeStore.slug) : null) ?? marketplaceStoresHref();

  return (
    <section aria-labelledby="merchant-window-title" className={styles.merchantWindowSection}>
      <div className={styles.commerceInner}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <h2 className={styles.sectionTitleMain} id="merchant-window-title">
              Independent Storefronts
            </h2>
          </div>
          <Link className={styles.sectionDirectLink} href={marketplaceStoresHref()}>
            All storefronts &rarr;
          </Link>
        </div>

        <div className={styles.merchantWindowLayout}>
          {/* Merchant Names Stream */}
          <ul className={styles.merchantNamesColumn} role="tablist">
            {stores.slice(0, 6).map((store, idx) => {
              const isActive = idx === activeIdx;
              const href = marketplaceStoreHref(store.slug) ?? marketplaceStoresHref();

              return (
                <li key={store.reference}>
                  <Link
                    aria-selected={isActive}
                    className={`${styles.merchantNameRow} ${
                      isActive ? styles.merchantNameRowActive : ""
                    }`}
                    href={href}
                    onFocus={() => setActiveIdx(idx)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    role="tab"
                  >
                    <span className={styles.merchantNameTitle}>{store.name}</span>
                    <span className={styles.merchantOfferCount}>
                      {store.publishedOfferCount} {store.publishedOfferCount === 1 ? "product" : "products"} listed
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Active Store Hero Stage */}
          <div className={styles.merchantHeroStage}>
            <div className={styles.merchantHeroMediaFrame}>
              <Image
                alt={activeStore.name}
                fill
                priority
                sizes="(max-width: 899px) 100vw, 55vw"
                src={
                  activeStore.heroMediaReference
                    ? `/api/catalog/media/${activeStore.heroMediaReference}`
                    : homeMedia.merchantPrepare.src
                }
                style={{ objectFit: "cover" }}
              />
            </div>

            <div className={styles.merchantIdentityBar}>
              <div className={styles.merchantIdentityInfo}>
                {activeStore.logoMediaReference ? (
                  <div className={styles.merchantLogoFrame}>
                    <Image
                      alt={`${activeStore.name} logo`}
                      fill
                      sizes="48px"
                      src={`/api/catalog/media/${activeStore.logoMediaReference}`}
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                ) : null}
                <div className={styles.merchantDetailsText}>
                  <Link className={styles.merchantNameLink} href={activeHref}>
                    {activeStore.name}
                  </Link>
                  {activeStore.description ? (
                    <p className={styles.merchantDescSnippet}>
                      {activeStore.description}
                    </p>
                  ) : null}
                </div>
              </div>

              <Link className={styles.enterStoreButton} href={activeHref}>
                <span>Visit Store</span> &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
