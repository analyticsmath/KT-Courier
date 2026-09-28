import { CommerceSearchCommand } from "@/components/public-v2/commerce/CommerceSearchCommand";
import { ShopCategoryCircleRail } from "./ShopCategoryCircleRail";
import type { MarketplaceCategory } from "./MarketplaceLanding";
import styles from "./shop-flagship.module.css";

export function ShopMobileDiscovery({ categories }: { categories: readonly MarketplaceCategory[] }) {
  return <section className={styles.mobileDiscovery} aria-labelledby="mobile-shop-title">
    <div className={styles.mobileDiscoveryField}>
      <span className={styles.mobileDiscoveryEyebrow}>KT MARKETPLACE</span>
      <h1 id="mobile-shop-title">Discover local, differently.</h1>
      <div className={styles.mobileDiscoverySearch}><CommerceSearchCommand appearance="shop" showFilterButton filterHref="/shop/search?openFilters=1" /></div>
      <ShopCategoryCircleRail categories={categories} />
    </div>
  </section>;
}
