"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { HomepageCategoryItem, HomepageProductItem } from "../data/home-storefront-presentation";
import { chapterBudgetVh, mobileChapterBudgetVh, type HomeChapter } from "../director/home-chapters";
import styles from "../home-cinematic.module.css";

const chapterStyle = (chapter: HomeChapter) => ({ "--film-budget": `${chapterBudgetVh(chapter)}svh`, "--film-mobile-budget": `${mobileChapterBudgetVh(chapter)}svh` }) as React.CSSProperties;

export function CommerceWorldScene({ categories, products, selectedCategoryId, selectedProductId, onCategorySelectionChange, onProductSelectionChange }: {
  categories: readonly HomepageCategoryItem[];
  products: readonly HomepageProductItem[];
  selectedCategoryId?: string;
  selectedProductId?: string;
  onCategorySelectionChange?: (id: string) => void;
  onProductSelectionChange?: (id: string) => void;
}) {
  const active = products.find((product) => product.id === selectedProductId) ?? products[0];
  return <section className={`${styles.chapter} ${styles.commerce}`} data-kt-scene="commerce" data-home-film aria-labelledby="cinematic-commerce-heading" style={chapterStyle("commerce")}>
    <div className={styles.sticky} data-home-sticky-stage>
      <div className={styles.marketplaceTakeover} data-marketplace-takeover aria-hidden="true" />
      <div className={styles.commerceOpening} data-cinematic-commerce-opening>
        <p className={styles.eyebrow}>KT Marketplace</p>
        <h2 id="cinematic-commerce-heading" className={styles.giant}>Made nearby.<br />Moved by KT.</h2>
      </div>
      {categories.length ? <>
        <div className={styles.categoryField} data-cinematic-category-field>
          <p className={styles.categoryFieldLabel}>Explore local categories</p>
          {categories.map((category, index) => <Link key={category.id} href={category.href} className={styles.categoryPlane} data-cinematic-category-plane={index} data-category-id={category.id} data-active={category.id === selectedCategoryId} onFocus={() => onCategorySelectionChange?.(category.id)}>
            <img src={category.image} alt={category.alt} />
            <span className={styles.categoryShade} />
            <span className={styles.categoryText}><small>{category.categoryWord}</small><strong>{category.title}</strong><span>{category.description}</span><em>Explore category ↗</em></span>
          </Link>)}
        </div>
        <div className={styles.mobileCategoryTerritory} data-cinematic-mobile-category-territory>
          <p className={styles.eyebrow}>Explore local categories</p>
          <div className={styles.mobileCategoryRail} data-cinematic-mobile-category-rail tabIndex={0} aria-label="Marketplace categories">
            {categories.map((category) => <Link key={category.id} href={category.href} className={styles.mobileCategoryCard} data-mobile-category-id={category.id} onFocus={() => onCategorySelectionChange?.(category.id)}><img src={category.image} alt={category.alt} /><span className={styles.categoryShade} /><span className={styles.categoryText}><small>{category.categoryWord}</small><strong>{category.title}</strong><span>{category.description}</span><em>Explore category ↗</em></span></Link>)}
          </div>
        </div>
      </> : <div className={styles.emptyCommerce}><p>Explore the KT marketplace.</p><Link href="/shop">Browse the shop ↗</Link></div>}
      {products.length ? <div className={styles.productWorld} data-cinematic-product-world>
        <div className={styles.productHeading}><p className={styles.eyebrow}>From the marketplace</p><h3 className={styles.giant}>Find it here.<br />Get it there.</h3></div>
        <div className={styles.productFan} data-cinematic-product-fan aria-label="Featured local products">
          {products.slice(0, 5).map((product, index) => <button key={product.id} type="button" className={styles.productPlane} data-cinematic-product-plane={index} data-product-id={product.id} data-active={product.id === active?.id} aria-label={`Select ${product.title}`} aria-pressed={product.id === active?.id} onFocus={() => onProductSelectionChange?.(product.id)} onClick={() => onProductSelectionChange?.(product.id)}><span data-commerce-selected-product-media={product.id === active?.id ? "active" : undefined}><img src={product.image} alt={product.imageAlt} /></span></button>)}
        </div>
        {active ? <div className={styles.productInfo} data-cinematic-product-info><span>{active.brandName ?? "Marketplace selection"}</span><strong>{active.title}</strong><Link href={active.href}>View product ↗</Link></div> : null}
      </div> : <div className={styles.emptyProducts}><Link href="/shop">Browse products in the marketplace ↗</Link></div>}
    </div>
  </section>;
}

export function ParcelizationScene({ product }: { product?: HomepageProductItem }) {
  return <section className={`${styles.chapter} ${styles.parcel}`} data-kt-scene="parcelization" data-home-film aria-labelledby="cinematic-parcel-heading" style={chapterStyle("parcelization")}>
    <div className={styles.sticky} data-home-sticky-stage><div className={styles.parcelRead}>
      <p className={styles.eyebrow}>Your order</p><h2 id="cinematic-parcel-heading" className={styles.giant}>From the shop<br />to your door.</h2>
      {product ? <p className={styles.parcelProduct}>{product.title}</p> : <p className={styles.parcelProduct}>From the marketplace to the move.</p>}
    </div><span className={styles.boxTarget} data-cinematic-box-target aria-hidden="true" /></div>
  </section>;
}

export function NetworkRouteScene() {
  return <section className={`${styles.chapter} ${styles.network}`} data-kt-scene="network" data-home-film aria-labelledby="cinematic-network-heading" style={chapterStyle("network")}>
    <div className={styles.sticky} data-home-sticky-stage>
      <div className={styles.routeCopy} data-route-copy="moving"><p className={styles.eyebrow}>On the move</p><h2 id="cinematic-network-heading" className={styles.giant}>Every mile<br />accounted for.</h2></div>
      <p className={styles.routeMicro}>Collection → Delivery</p>
    </div>
  </section>;
}

export function FreightTransitionScene() {
  return <section className={`${styles.chapter} ${styles.freight}`} data-kt-scene="freight" data-home-film aria-labelledby="cinematic-freight-heading" style={chapterStyle("freight")}>
    <div className={styles.sticky} data-home-sticky-stage><div className={styles.freightReveal} data-cinematic-freight-reveal>
      <div className={styles.freightRead}><p className={styles.eyebrow}>KT for business</p><h2 id="cinematic-freight-heading" className={styles.giant}>More to move?<br />We&apos;re with you.</h2><p>From a single parcel to your larger loads.</p><div className={styles.freightLinks}><Link href="/services/freight">Explore freight ↗</Link><Link href="/services/business">Business services ↗</Link></div></div>
    </div></div>
  </section>;
}

export function LastMileDeliveryScene() {
  return <section className={`${styles.chapter} ${styles.lastMile}`} data-kt-scene="last-mile" data-home-film aria-labelledby="cinematic-last-mile-heading" style={chapterStyle("last-mile")}>
      <div className={styles.sticky} data-home-sticky-stage><div className={styles.lastMileCopy} data-cinematic-last-mile-copy><p className={styles.eyebrow}>At your door</p><h2 id="cinematic-last-mile-heading" className={styles.giant}>In good hands.</h2><p>One journey, right through to the handoff.</p></div><span className={styles.deliveryGround} aria-hidden="true" /></div>
  </section>;
}

export function ArrivalFinaleScene() {
  return <footer className={`${styles.chapter} ${styles.finale}`} data-kt-scene="finale" data-home-film aria-labelledby="cinematic-finale-heading" style={chapterStyle("finale")}>
    <div className={styles.sticky} data-home-sticky-stage>
      <p className={styles.delivered} data-cinematic-delivered>Delivered.</p>
      <div className={styles.finaleBrand} data-cinematic-finale-brand><h2 id="cinematic-finale-heading"><span>KT</span><span>COURIER</span></h2><p>Delivering Speed. Ensuring Trust.</p></div>
      <nav className={styles.finaleUtility} data-cinematic-finale-utility aria-label="KT Courier links"><Link href="/shop">Marketplace</Link><Link href="/services/parcel">Send a parcel</Link><Link href="/services/freight">Freight</Link><Link href="/contact">Contact</Link></nav>
      <p className={styles.legal} data-cinematic-finale-legal>&copy; {new Date().getFullYear()} KT Couriers (Pty) Ltd. All rights reserved.</p>
    </div>
  </footer>;
}
