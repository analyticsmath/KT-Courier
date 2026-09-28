"use client";
import { useRef } from "react";
import Link from "next/link";
import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";
import { ShopShelfProductCard } from "./ShopShelfProductCard";
import styles from "./shop-flagship.module.css";

export function ShopProductShelf({ title, href, products, kind, linkLabel = "View all", priority = false }: {
  title: string; href: string; products: readonly StorefrontProductCard[];
  kind: "new" | "category"; linkLabel?: string; priority?: boolean;
}) {
  const track = useRef<HTMLUListElement>(null);
  if (!products.length) return null;
  const move = (direction: number) => {
    const rail = track.current;
    const card = rail?.firstElementChild as HTMLElement | null;
    if (rail && card) rail.scrollBy({ left: direction * card.getBoundingClientRect().width * 2.1, behavior: "smooth" });
  };
  return <section className={styles.shelf} aria-label={title} data-shelf-kind={kind}>
    <div className={styles.shelfInner}>
      <div className={styles.shelfHeader}><h2>{title}</h2><div className={styles.shelfTools}>
        <Link href={href}>{linkLabel} <span aria-hidden="true">→</span></Link>
        <div className={styles.shelfArrows}><button type="button" aria-label={`Scroll ${title} left`} onClick={() => move(-1)}>←</button><button type="button" aria-label={`Scroll ${title} right`} onClick={() => move(1)}>→</button></div>
      </div></div>
      <div className={styles.productDeck}>
        <ul className={styles.productTrack} ref={track} aria-label={`${title} products`}>{products.map((product, index) => <ShopShelfProductCard key={`${product.productReference}-${index}`} product={product} priority={priority && index < 3} shelf />)}</ul>
      </div>
    </div>
  </section>;
}
