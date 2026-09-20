import { MarketplaceLanding } from "@/components/public-v2/marketplace/MarketplaceLanding";
import { getStorefrontHome } from "@/lib/services/storefront-catalog.service";
import { selectFeaturedMarketplaceCategories } from "@/lib/public-marketplace/featured-categories";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const home = await getStorefrontHome();
  const categories = selectFeaturedMarketplaceCategories(home.categories);

  return (
    <MarketplaceLanding
      categories={categories}
      products={home.newArrivals}
      stores={home.stores}
      collections={home.collections}
    />
  );
}
