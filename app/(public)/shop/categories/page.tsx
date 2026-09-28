import type { Metadata } from "next";
import { CategoryAtlas } from "@/components/public-v2/commerce";
import { listStorefrontCategories } from "@/lib/services/storefront-catalog.service";
import { buildCinematicCategoryNavigation } from "@/lib/public-marketplace/category-navigation-model";

export const metadata: Metadata = {
  title: "Categories | KT Couriers Marketplace",
  description: "Browse published marketplace categories from local stores connected to KT Couriers.",
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categoryTaxonomy = await listStorefrontCategories();
  const categories = buildCinematicCategoryNavigation(categoryTaxonomy);

  return (
    <main id="storefront-content">
      <CategoryAtlas categories={categories} />
    </main>
  );
}
