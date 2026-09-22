"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { HomepageCategoryItem, HomepageProductItem, HomepageStoreItem } from "../data/home-storefront-presentation";
import { commerceChapterBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";
import styles from "../post-hero-rebuild.module.css";

const zar = (product: HomepageProductItem) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: product.currency }).format(Number(product.priceAmount));

export function CommerceWorldScene({ categories, stores, products, selectedCategoryId, onCategorySelectionChange, selectedStoreId, onStoreSelectionChange, selectedProductId, onProductSelectionChange }: {
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
  const activeCategory = categories.find((item) => item.id === selectedCategoryId) ?? categories[0];
  const activeStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0];
  const activeProduct = products.find((product) => product.id === selectedProductId) ?? products[0];
  const hasStoreWorld = stores.length >= 3;
  const storeVisuals = activeStore ? [activeStore, ...stores.filter((store) => store.id !== activeStore.id)].slice(0, 3) : [];
  const handleCategoryKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!categories.length || !onCategorySelectionChange) return;
    const current = Math.max(0, categories.findIndex((item) => item.id === activeCategory?.id));
    const nextIndex = event.key === "ArrowRight" ? Math.min(categories.length - 1, current + 1) : event.key === "ArrowLeft" ? Math.max(0, current - 1) : event.key === "Home" ? 0 : event.key === "End" ? categories.length - 1 : current;
    if (!["ArrowRight", "ArrowLeft", "Home", "End", "Enter"].includes(event.key)) return;
    event.preventDefault();
    onCategorySelectionChange(categories[nextIndex]!.id);
    if (event.key !== "Enter") Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-commerce-category-select]"))[nextIndex]?.focus();
  };
  return (
    <section className={`${styles.chapter} ${styles.commerce}`} data-kt-scene="commerce" aria-labelledby="commerce-heading" style={{ "--kt-home-budget": `${commerceChapterBudgetVh(stores.length)}svh`, "--kt-home-mobile-budget": `${mobileChapterBudgetVh("commerce")}svh` } as React.CSSProperties}>
      <div className={styles.sticky} data-home-sticky-stage>
        <div className={styles.commerceViewport}>
          <header className={styles.commerceOpening} data-commerce-opening>
            <p className={styles.eyebrow}>Marketplace</p>
            <h2 className={styles.heading} id="commerce-heading">Find something worth sending.</h2>
            <p className={styles.body}>Browse local stores and everyday finds, then let KT take it from there.</p>
          </header>

          {categories.length ? <div className={`${styles.commerceWorld} ${styles.categoryWorld}`} data-commerce-world="categories">
            <div className={styles.categoryHeader}><p className={styles.eyebrow}>Category atlas</p><p className={styles.monoNote}>Local catalog · {categories.length} categories</p></div>
            <div className={styles.categoryRail} data-commerce-category-rail tabIndex={0} aria-label="Marketplace categories" onKeyDown={handleCategoryKeyDown}>
              <div className={styles.categoryTrack} data-commerce-category-track>
                {categories.map((category) => <article key={category.id} className={styles.category} data-commerce-category={category.id} data-active={category.id === activeCategory?.id} aria-label={`${category.title} category`}>
                  <img className={styles.categoryMedia} src={category.image} alt={category.alt} /><div className={styles.categoryShade} />
                  <button type="button" aria-label={`Select ${category.title}`} aria-pressed={category.id === activeCategory?.id} data-commerce-category-select={category.id} onClick={() => onCategorySelectionChange?.(category.id)} />
                </article>)}
              </div>
            </div>
            {activeCategory ? <div className={styles.categoryInfo} data-category-info><span className={styles.eyebrow}>{activeCategory.categoryWord}</span><h3>{activeCategory.title}</h3><p>{activeCategory.description}</p><Link href={activeCategory.href}>Explore category <span aria-hidden="true">↗</span></Link></div> : null}
          </div> : null}

          {hasStoreWorld && activeStore ? <div className={`${styles.commerceWorld} ${styles.storeWorld}`} data-commerce-world="stores" data-commerce-stores>
            <div className={styles.storeIndex}><p className={styles.eyebrow}>Store world</p><p className={styles.body}>Independent storefronts, one delivery network.</p><div className={styles.storeList} data-commerce-store-list role="listbox" aria-label="Independent storefronts">
              {stores.map((store) => <button key={store.id} type="button" className={styles.storeRow} data-commerce-store={store.id} data-active={store.id === activeStore.id} onClick={() => onStoreSelectionChange?.(store.id)}><strong>{store.name}</strong><span>{store.publishedOfferCount} published products</span></button>)}
            </div></div>
            <div className={styles.storeVisualField} data-commerce-store-rail>{storeVisuals.map((store, index) => <div key={store.id} className={styles.storeMedia} data-commerce-store-media={store.id} data-active={index === 0} data-store-distance={index}><img src={store.image} alt={`${store.name} storefront`} /></div>)}<div className={styles.storeInfo}><h3>{activeStore.name}</h3><p>{activeStore.publishedOfferCount} published products</p><Link href={activeStore.href}>Visit Store <span aria-hidden="true">↗</span></Link></div></div>
          </div> : null}

          {products.length && activeProduct ? <div className={`${styles.commerceWorld} ${styles.productWorld}`} data-commerce-world="products" data-commerce-products>
            <div className={styles.productHeader}><p className={styles.eyebrow}>Product fan</p><p className={styles.monoNote}>Choose it. We&apos;ll move it.</p></div>
            <div className={styles.fan} data-commerce-product-fan aria-label="New arrivals">{products.map((product) => <Link href={product.href} className={styles.product} data-commerce-product={product.id} data-active={product.id === activeProduct.id} key={product.id} onFocus={() => onProductSelectionChange?.(product.id)} onClick={() => onProductSelectionChange?.(product.id)}><div className={styles.productMedia} data-commerce-selected-product-media={product.id === activeProduct.id ? "active" : undefined}><img src={product.image} alt={product.imageAlt} /></div></Link>)}</div>
            <div className={styles.productInfo} data-product-info>{activeProduct.brandName ? <span className={styles.monoNote}>{activeProduct.brandName}</span> : null}<h3>{activeProduct.title}</h3><p>{zar(activeProduct)}{activeProduct.priceFrom ? " · From" : ""}</p><Link href={activeProduct.href}>View product <span aria-hidden="true">↗</span></Link></div>
          </div> : null}
        </div>
      </div>
    </section>
  );
}
