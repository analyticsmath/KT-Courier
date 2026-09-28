import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";
import { MarketplaceProductCard } from "@/components/public-v2/commerce/MarketplaceProductCard";
import styles from "./shop-flagship.module.css";

export function ShopShelfProductCard({ product, priority = false }: { product: StorefrontProductCard; priority?: boolean }) {
  return <MarketplaceProductCard variant="shelf" product={product} priority={priority} className={styles.productCard} />;
}
