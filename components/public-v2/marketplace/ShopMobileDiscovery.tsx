import Image from "next/image";
import { CommerceSearchCommand } from "@/components/public-v2/commerce/CommerceSearchCommand";
import { ShopCategoryCircleRail } from "./ShopCategoryCircleRail";
import type { MarketplaceCategory } from "./MarketplaceLanding";
import styles from "./shop-flagship.module.css";

export function ShopMobileDiscovery({ categories }: { categories: readonly MarketplaceCategory[] }) {
  return <section className={styles.mobileDiscovery} aria-labelledby="mobile-shop-title">
    <div className={styles.mobileDiscoveryField}>
      <span className={styles.mobileDiscoveryEyebrow}>KT MARKETPLACE</span>
      <h1 id="mobile-shop-title">Discover local, differently.</h1>
      <div className={styles.mobileDiscoverySearch}><CommerceSearchCommand appearance="shop" /></div>
      <div className={styles.mobileMarketImage}><Image alt="A lively local marketplace" fill sizes="(max-width: 767px) calc(100vw - 32px), 1px" src="/media/public/home/kt-home-01-world-market.webp" /></div>
    </div>
    <div className={styles.mobileDiscoveryCategories}><ShopCategoryCircleRail categories={categories} /></div>
  </section>;
}
