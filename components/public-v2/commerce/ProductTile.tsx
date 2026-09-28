import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";
import { MarketplaceProductCard } from "./MarketplaceProductCard";

/** Compatibility adapter for callers that still use the old name. */
export function ProductTile({ product, priority = false }: { product: StorefrontProductCard; priority?: boolean }) {
  return <MarketplaceProductCard variant="grid" product={product} priority={priority} />;
}
