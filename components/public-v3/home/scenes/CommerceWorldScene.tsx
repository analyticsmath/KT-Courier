"use client";

import Link from "next/link";
import type { HomepageCategoryItem, HomepageProductItem, HomepageStoreItem } from "../data/home-storefront-presentation";
import styles from "../post-hero-rebuild.module.css";

export function CommerceWorldScene({
  categories,
  stores,
  products,
  selectedCategoryId,
  onCategorySelectionChange,
  selectedStoreId,
  onStoreSelectionChange,
  selectedProductId,
  onProductSelectionChange,
}: {
  categories: readonly HomepageCategoryItem[];
  stores: readonly HomepageStoreItem[];
  products: readonly HomepageProductItem[];
  selectedCategoryId?: string;
  onCategorySelectionChange?: (id: string) => void;
  selectedStoreId?: string;
  onStoreSelectionChange?: (id: string) => void;
  selectedProductId?: string;
  onProductSelectionChange?: (id: string) => void;
}) {
  const categoryItems = categories.length ? categories : [];
  const activeCategory = categoryItems.find((item) => item.id === selectedCategoryId) ?? categoryItems[0];
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0];
  const activeProduct = products.find((product) => product.id === selectedProductId) ?? products[0];
  const handleCategoryKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!categoryItems.length || !onCategorySelectionChange) return;
    const currentIndex = Math.max(0, categoryItems.findIndex((item) => item.id === activeCategory?.id));
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = Math.min(categoryItems.length - 1, currentIndex + 1);
    if (event.key === "ArrowLeft") nextIndex = Math.max(0, currentIndex - 1);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = categoryItems.length - 1;
    if (event.key === "Enter") nextIndex = currentIndex;
    if (!["ArrowRight", "ArrowLeft", "Home", "End", "Enter"].includes(event.key)) return;
    event.preventDefault();
    const next = categoryItems[nextIndex];
    if (!next) return;
    onCategorySelectionChange(next.id);
    if (event.key !== "Enter") {
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-commerce-category-select]"));
      buttons[nextIndex]?.focus();
    }
  };
  return (
    <section className={`${styles.chapter} ${styles.commerce}`} data-kt-scene="commerce" aria-labelledby="commerce-heading" style={{ minHeight: "325svh" }}>
      <div className={styles.sticky} data-home-sticky-stage>
        <div className={styles.commerceViewport}>
          <header className={styles.commerceHeader}>
            <p className={styles.eyebrow}>Marketplace aperture</p>
            <h2 className={styles.heading} id="commerce-heading">Find something worth sending.</h2>
            <p className={styles.body}>Browse local stores and everyday finds, then let KT take it from there.</p>
          </header>

          {categoryItems.length ? (
            <div className={`${styles.commerceWorld} ${styles.categoryWorld}`} data-commerce-world="categories">
              <div className={styles.categoryRail} data-commerce-category-rail tabIndex={0} aria-label="Marketplace categories" onKeyDown={handleCategoryKeyDown}>
                <div className={styles.categoryTrack} data-commerce-category-track>
                  {categoryItems.map((category) => (
                    <article key={category.id} className={styles.category} data-commerce-category={category.id} data-active={category.id === activeCategory?.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={styles.categoryMedia} src={category.image} alt={category.alt} />
                      <div className={styles.categoryShade} />
                      <div className={styles.categoryCopy}>
                        <span className={styles.eyebrow}>{category.categoryWord}</span>
                        <h3>{category.title}</h3>
                        <p>{category.description}</p>
                        <Link href={category.href}>Explore category <span aria-hidden="true">↗</span></Link>
                      </div>
                      <button type="button" aria-label={`Select ${category.title}`} aria-pressed={category.id === activeCategory?.id} data-commerce-category-select={category.id} onClick={() => onCategorySelectionChange?.(category.id)} />
                    </article>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {stores.length >= 3 ? (
            <div className={`${styles.commerceWorld} ${styles.storeWorld}`} data-commerce-world="stores" data-commerce-stores>
              <div>
                <p className={styles.eyebrow}>Independent storefronts.</p>
                <p className={styles.body}>Local sellers, one delivery network.</p>
                <div className={styles.storeList} data-commerce-store-list role="listbox" aria-label="Independent storefronts">
                  {stores.map((store) => (
                    <button key={store.id} type="button" className={styles.storeRow} data-commerce-store={store.id} data-active={store.id === activeStore?.id} onClick={() => onStoreSelectionChange?.(store.id)}>
                      <strong>{store.name}</strong>
                      <span>{store.publishedOfferCount} published products</span>
                    </button>
                  ))}
                </div>
                {activeStore ? <Link href={activeStore.href}>Visit Store <span aria-hidden="true">↗</span></Link> : null}
              </div>
              {activeStore ? <div className={styles.storeMedia} data-commerce-store-media>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeStore.image} alt={`${activeStore.name} storefront`} />
              </div> : null}
            </div>
          ) : null}

          {products.length ? (
            <div className={`${styles.commerceWorld} ${styles.productWorld}`} data-commerce-world="products" data-commerce-products>
              <p className={styles.eyebrow}>Choose it. We’ll move it.</p>
              <div className={styles.fan} data-commerce-product-fan aria-label="New arrivals">
                {products.map((product) => (
                  <Link href={product.href} className={styles.product} data-commerce-product={product.id} data-active={product.id === activeProduct?.id} key={product.id} onFocus={() => onProductSelectionChange?.(product.id)}>
                    <div className={styles.productMedia}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={product.image} alt={product.imageAlt} />
                    </div>
                    <div className={styles.productMeta}>
                      {product.brandName ? <small>{product.brandName}</small> : null}
                      <strong>{product.title}</strong>
                      <span>{new Intl.NumberFormat("en-ZA", { style: "currency", currency: product.currency }).format(Number(product.priceAmount))}{product.priceFrom ? " · From" : ""}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
