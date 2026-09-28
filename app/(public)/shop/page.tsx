import { MarketplaceLanding } from "@/components/public-v2/marketplace/MarketplaceLanding";
import { getStorefrontHome, getStorefrontShopShelves } from "@/lib/services/storefront-catalog.service";
import { selectFeaturedMarketplaceCategories } from "@/lib/public-marketplace/featured-categories";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const home = await getStorefrontHome({ includeCollections: false });
  const categories = selectFeaturedMarketplaceCategories(home.categories);
  const shelves = await getStorefrontShopShelves(categories.map((category) => category.path));

  return (
    <MarketplaceLanding
      categories={categories}
      products={home.newArrivals}
      stores={home.stores}
      shelves={shelves}
    />
  );
}
