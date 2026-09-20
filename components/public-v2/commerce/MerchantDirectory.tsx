"use client";

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
  return (
    <div className={styles.categoryAtlasPage}>
      {/* Search Header */}
        <div style={{ maxWidth: 540, marginBottom: "2rem" }}>
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
        <ul className={styles.commerceStoreGrid} aria-label="Marketplace stores">
          {stores.map((store, index) => {
            const href = marketplaceStoreHref(store.slug) ?? marketplaceStoresHref();
            return <li key={store.reference}>
              <Link className={styles.commerceStoreCard} href={href}>
                <div className={styles.commerceStoreMedia}>
                  <Image alt={store.name} fill priority={index < 3} sizes="(max-width: 767px) 100vw, 33vw" src={store.heroMediaReference ? `/api/catalog/media/${store.heroMediaReference}` : homeMedia.merchantPrepare.src} style={{ objectFit: "cover" }} />
                </div>
                <div className={styles.commerceStoreIdentity}>
                  {store.logoMediaReference && <span className={styles.commerceStoreLogo}><Image alt="" fill sizes="48px" src={`/api/catalog/media/${store.logoMediaReference}`} style={{ objectFit: "cover" }} /></span>}
                  <div><h2>{store.name}</h2><span className={styles.commerceStoreMeta}>{store.publishedOfferCount} {store.publishedOfferCount === 1 ? "product" : "products"}</span></div>
                </div>
                {store.description && <p className={styles.commerceStoreMeta}>{store.description}</p>}
              </Link>
            </li>;
          })}
        </ul>
      )}
    </div>
  );
}
