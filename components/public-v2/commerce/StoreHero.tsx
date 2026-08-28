import Image from "next/image";
import Link from "next/link";
import { marketplaceHref, marketplaceStoresHref, marketplaceStoreCategoryHref } from "@/lib/public-marketplace/routes";
import { homeMedia } from "@/components/public-v2/home/home-media";
import styles from "./commerce.module.css";

interface StoreCategory {
  reference: string;
  path: string;
  name: string;
  productCount?: number;
}

interface StoreHeroProps {
  store: {
    slug: string;
    name: string;
    description?: string;
    logoMediaReference?: string;
    heroMediaReference?: string;
    publishedOfferCount: number;
    storeCategories?: readonly StoreCategory[];
  };
}

export function StoreHero({ store }: StoreHeroProps) {
  const categories = store.storeCategories ?? [];

  return (
    <section aria-labelledby="store-title" className={styles.storeHeroWrapper}>
      {/* Background Hero Media */}
      <div className={styles.storeHeroBackgroundMedia}>
        <Image
          alt={store.name}
          fill
          priority
          sizes="100vw"
          src={
            store.heroMediaReference
              ? `/api/catalog/media/${store.heroMediaReference}`
              : homeMedia.merchantPrepare.src
          }
          style={{ objectFit: "cover" }}
        />
      </div>

      {/* Brand Identity & Breadcrumbs Plane */}
      <div className={styles.commerceInner} style={{ position: "relative", zIndex: 5 }}>
        <div className={styles.storeHeroContentOverlay}>
          <nav aria-label="Breadcrumb" style={{ fontSize: "0.85rem", color: "var(--kt-muted, #5f6763)" }}>
            <Link href={marketplaceHref()} style={{ color: "inherit", textDecoration: "none" }}>
              Shop
            </Link>{" "}
            /{" "}
            <Link href={marketplaceStoresHref()} style={{ color: "inherit", textDecoration: "none" }}>
              Stores
            </Link>{" "}
            / <span aria-current="page" style={{ color: "var(--kt-carbon, #101210)", fontWeight: 600 }}>{store.name}</span>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {store.logoMediaReference && (
              <div className={styles.merchantLogoFrame} style={{ width: 56, height: 56 }}>
                <Image
                  alt={`${store.name} logo`}
                  fill
                  sizes="56px"
                  src={`/api/catalog/media/${store.logoMediaReference}`}
                  style={{ objectFit: "cover" }}
                />
              </div>
            )}
            <div>
              <h1 className={styles.storeHeroName} id="store-title">
                {store.name}
              </h1>
              <span style={{ fontSize: "0.85rem", color: "var(--kt-muted, #5f6763)" }}>
                {store.publishedOfferCount} {store.publishedOfferCount === 1 ? "product" : "products"} listed
              </span>
            </div>
          </div>

          {store.description && (
            <p className={styles.storeHeroDesc}>{store.description}</p>
          )}

          {categories.length > 0 && (
            <div className={styles.storeCategoryNav}>
              {categories.map((cat) => {
                const href = marketplaceStoreCategoryHref(store.slug, cat.path);
                if (!href) return null;
                return (
                  <Link
                    className={styles.subcategoryTile}
                    href={href}
                    key={cat.reference}
                  >
                    <span>{cat.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
