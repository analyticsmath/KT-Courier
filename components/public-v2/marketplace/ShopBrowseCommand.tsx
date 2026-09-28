import { CommerceSearchCommand } from "@/components/public-v2/commerce/CommerceSearchCommand";
import type { MarketplaceCategory } from "./MarketplaceLanding";
import { ShopCategoryCircleRail } from "./ShopCategoryCircleRail";
import styles from "./shop-flagship.module.css";

export function ShopBrowseCommand({ categories }: { categories: readonly MarketplaceCategory[] }) {
  return <section className={styles.command} aria-labelledby="shop-title">
    <h1 id="shop-title">Shop</h1>
    <div className={styles.search}><CommerceSearchCommand /></div>
    <ShopCategoryCircleRail categories={categories} />
  </section>;
}
