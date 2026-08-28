"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CommerceSearchCommand } from "./CommerceSearchCommand";
import { marketplaceStoreHref, marketplaceStoresHref } from "@/lib/public-marketplace/routes";
import { homeMedia } from "@/components/public-v2/home/home-media";
import styles from "./commerce.module.css";

interface StoreDirectoryItem {
  reference: string;
  slug: string;
  name: string;
  description?: string;
  logoMediaReference?: string;
  heroMediaReference?: string;
  publishedOfferCount: number;
}

interface MerchantDirectoryProps {
  stores: readonly StoreDirectoryItem[];
  query?: string;
}

export function MerchantDirectory({ stores, query = "" }: MerchantDirectoryProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  const activeStore = stores[activeIdx] || stores[0];
  const activeHref = (activeStore ? marketplaceStoreHref(activeStore.slug) : null) ?? marketplaceStoresHref();

  return (
    <div className={styles.categoryAtlasPage}>
      {/* Search Header */}
      <div style={{ maxWidth: 540, marginBottom: "2.5rem" }}>
        <CommerceSearchCommand
          action={marketplaceStoresHref()}
          placeholder="Search stores..."
          query={query}
        />
      </div>

      {stores.length === 0 ? (
        <div style={{ padding: "3rem 0" }}>
          <h2 style={{ fontSize: "1.8rem", fontWeight: 560 }}>No matching storefronts</h2>
          <p style={{ color: "var(--kt-muted, #5f6763)", margin: "8px 0 24px" }}>
            Try a different search query or clear the filter to browse all storefronts.
          </p>
          <Link className={styles.sectionDirectLink} href={marketplaceStoresHref()}>
            Clear search &rarr;
          </Link>
        </div>
      ) : (
        <div className={styles.categoryAtlasLayout}>
          {/* Store List Column */}
          <ul className={styles.merchantNamesColumn} role="tablist">
            {stores.map((store, idx) => {
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

          {/* Sticky Active Store Stage */}
          {activeStore && (
            <div className={styles.merchantHeroStage} style={{ position: "sticky", top: "calc(var(--kt-header-h, 72px) + 24px)" }}>
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
                  <span>Visit Storefront</span> &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
