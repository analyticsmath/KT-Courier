import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";
import { marketplaceCategoryHref, marketplaceSearchHref } from "@/lib/public-marketplace/routes";
import { ShopCategoryFilm } from "./ShopCategoryFilm";
import { ShopBrowseCommand } from "./ShopBrowseCommand";
import { ShopProductShelf } from "./ShopProductShelf";
import { StoreCinema } from "./StoreCinema";
import styles from "./shop-flagship.module.css";

export type MarketplaceCategory = {
  reference: string; path: string; name: string; description?: string;
  imageReference?: string; productCount?: number;
};
export type MarketplaceStore = {
  reference: string; slug: string; name: string; description?: string;
  logoMediaReference?: string; heroMediaReference?: string; publishedOfferCount: number;
};
export type MarketplaceCollection = {
  reference: string; slug: string; name: string; description?: string;
  itemCount: number; coverMediaReference?: string;
};
export type ShopShelfData = { path: string; products: readonly StorefrontProductCard[] };

export function MarketplaceLanding({ categories, stores, products, shelves }: {
  categories: readonly MarketplaceCategory[];
  stores: readonly MarketplaceStore[];
  products: readonly StorefrontProductCard[];
  shelves: readonly ShopShelfData[];
}) {
  const categoryByPath = new Map(categories.map((category) => [category.path.replace(/^\/+|\/+$/g, ""), category]));
  return <main className={styles.shop} id="storefront-content">
    <ShopCategoryFilm categories={categories} />
    <ShopBrowseCommand categories={categories} />
    <div className={styles.shelves}>
      <ShopProductShelf title="New in the Market" href={marketplaceSearchHref()} linkLabel="Search all items" products={products} kind="new" priority />
      {shelves.map((shelf) => {
        const category = categoryByPath.get(shelf.path.replace(/^\/+|\/+$/g, ""));
        const href = category && marketplaceCategoryHref(category.path);
        return category && href ? <ShopProductShelf key={category.reference} title={category.name} href={href} products={shelf.products} kind="category" /> : null;
      })}
    </div>
    <StoreCinema mode="featured" stores={stores} />
  </main>;
}
