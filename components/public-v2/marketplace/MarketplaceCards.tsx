import Image from "next/image";
import Link from "next/link";
import type { StorefrontDocument, StorefrontProductCard } from "@/lib/storefront/storefront-types";
import { availabilityLabel } from "@/lib/storefront/storefront-availability-policy";
import { marketplaceCategoryHref, marketplaceSearchHref, marketplaceStoreHref, marketplaceStoreCategoryHref, marketplaceProductHref } from "@/lib/public-marketplace/routes";
import styles from "./market-hall.module.css";

export type MarketplaceCategory = {
  reference: string;
  path: string;
  name: string;
  description?: string;
  imageReference?: string;
  productCount?: number;
};

export type MarketplaceStore = {
  reference: string;
  slug: string;
  name: string;
  description?: string;
  logoMediaReference?: string;
  heroMediaReference?: string;
  publishedOfferCount: number;
};

function formatPrice(amount: string, currency: "ZAR") {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(Number(amount));
}

export function MarketplaceSearchForm({ action = marketplaceSearchHref(), query = "", hidden = [] }: { action?: string; query?: string; hidden?: Array<{ name: string; value: string }> }) {
  return (
    <form action={action} className={styles.searchForm} role="search">
      {hidden.map((field) => <input key={`${field.name}:${field.value}`} name={field.name} type="hidden" value={field.value} />)}
      <label className="sr-only" htmlFor={`market-search-${action.replaceAll("/", "-")}`}>Search the marketplace</label>
      <input defaultValue={query} id={`market-search-${action.replaceAll("/", "-")}`} maxLength={160} name="q" placeholder="Search products" type="search" />
      <button type="submit">Search</button>
    </form>
  );
}

export function MarketplaceCategoryRail({ categories, label = "Categories", storeSlug }: { categories: readonly MarketplaceCategory[]; label?: string; storeSlug?: string }) {
  if (!categories.length) return null;
  return (
    <ul aria-label={label} className={styles.categoryRail}>
      {categories.flatMap((category) => {
        const href = storeSlug ? marketplaceStoreCategoryHref(storeSlug, category.path) : marketplaceCategoryHref(category.path);
        if (!href) return [];
        return <li key={category.reference}>
          <Link className={styles.categoryCard} href={href}>
            <strong>{category.name}</strong>
            {typeof category.productCount === "number" ? <span>{category.productCount} {category.productCount === 1 ? "product" : "products"}</span> : <span>Browse category</span>}
          </Link>
        </li>;
      })}
    </ul>
  );
}

function StoreMedia({ store }: { store: MarketplaceStore }) {
  if (!store.heroMediaReference) return <div aria-label={`${store.name} cover image unavailable`} className={styles.storeMediaUnavailable} role="img">Image unavailable</div>;
  return <Image alt="" fill sizes="(max-width: 639px) calc(100vw - 40px), (max-width: 899px) calc(50vw - 40px), 27vw" src={`/api/catalog/media/${store.heroMediaReference}`} />;
}

export function MarketplaceStoreGrid({ stores, label = "Stores" }: { stores: readonly MarketplaceStore[]; label?: string }) {
  if (!stores.length) return null;
  return (
    <ul aria-label={label} className={styles.storeGrid}>
      {stores.flatMap((store) => {
        const href = marketplaceStoreHref(store.slug);
        if (!href) return [];
        return <li className={styles.storeCard} key={store.reference}>
          <div className={styles.storeMedia}><StoreMedia store={store} /></div>
          <div className={styles.storeBody}>
            <div className={styles.storeIdentity}>
              {store.logoMediaReference ? <span className={styles.logo}><Image alt={`${store.name} logo`} fill sizes="38px" src={`/api/catalog/media/${store.logoMediaReference}`} /></span> : null}
              <div>
                <Link className={styles.storeName} href={href}>{store.name}</Link>
                <p className={styles.storeCount}>{store.publishedOfferCount} {store.publishedOfferCount === 1 ? "published product" : "published products"}</p>
              </div>
            </div>
            {store.description ? <p className={styles.storeDescription}>{store.description}</p> : null}
          </div>
        </li>;
      })}
    </ul>
  );
}

function ProductMedia({ product }: { product: StorefrontProductCard }) {
  if (!product.primaryMedia) return <div aria-label={`${product.title} image unavailable`} className={styles.productMediaUnavailable} role="img">Image unavailable</div>;
  return <Image alt={product.primaryMedia.alt} fill sizes="(max-width: 639px) calc(50vw - 25px), (max-width: 899px) calc(33vw - 28px), 21vw" src={`/api/catalog/media/${product.primaryMedia.publicReference}`} />;
}

export function MarketplaceProductGrid({ products, label = "Products" }: { products: readonly StorefrontProductCard[]; label?: string }) {
  if (!products.length) return null;
  return (
    <ul aria-label={label} className={styles.productGrid}>
      {products.flatMap((product) => {
        const href = marketplaceProductHref(product.productSlug, product.productReference);
        if (!href) return [];
        return <li className={styles.productCard} key={product.productReference}>
          <Link aria-label={`View ${product.title}`} href={href}>
            <div className={styles.productMedia}><ProductMedia product={product} /></div>
          </Link>
          <div className={styles.productBody}>
            {product.brandName ? <p className={styles.productMeta}>{product.brandName}</p> : null}
            <h3><Link href={href}>{product.title}</Link></h3>
            <p className={styles.price}>{product.price.from ? "From " : ""}{formatPrice(product.price.amount, product.price.currency)}<small>VAT included</small></p>
            <p className={styles.availability}>{availabilityLabel(product.availability)}</p>
            <p className={styles.storeCount}>Available from {product.storeCount} {product.storeCount === 1 ? "store" : "stores"}</p>
          </div>
        </li>;
      })}
    </ul>
  );
}

export function MarketplaceOfferList({ offers }: { offers: readonly StorefrontDocument[] }) {
  return (
    <ul className={styles.offerList}>
      {offers.flatMap((offer) => {
        const href = marketplaceStoreHref(offer.storeSlug);
        if (!href) return [];
        return <li key={offer.publicReference}>
          <div>
            <h3><Link className={styles.storeLink} href={href}>View store</Link></h3>
            <p>{offer.fulfilmentMode.replaceAll("_", " ").toLocaleLowerCase("en-ZA")} · {availabilityLabel(offer.availability)}</p>
          </div>
          <p className={styles.price}>{formatPrice(offer.price.amount, offer.price.currency)}<small>VAT included</small></p>
        </li>;
      })}
    </ul>
  );
}
