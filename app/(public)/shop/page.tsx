import { MarketplaceLanding } from "@/components/public-v2/marketplace/MarketplaceLanding";
import { getStorefrontHome } from "@/lib/services/storefront-catalog.service";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const home = await getStorefrontHome();
  return <MarketplaceLanding categories={home.categories} products={home.newArrivals} stores={home.stores} />;
}
