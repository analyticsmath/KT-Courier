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
  const move = (direction: number) => track.current?.scrollBy({ left: direction * Math.min(track.current.clientWidth * .7, 900), behavior: "smooth" });
  return <section className={styles.shelf} aria-label={title} data-shelf-kind={kind}>
    <div className={styles.shelfHeader}><h2>{title}</h2><div className={styles.shelfTools}>
      <Link href={href}>{linkLabel} <span aria-hidden="true">→</span></Link>
      <div className={styles.shelfArrows}><button type="button" aria-label={`Scroll ${title} left`} onClick={() => move(-1)}>←</button><button type="button" aria-label={`Scroll ${title} right`} onClick={() => move(1)}>→</button></div>
    </div></div>
    <ul className={styles.productTrack} ref={track} aria-label={`${title} products`}>{products.map((product, index) => <ShopShelfProductCard key={`${product.productReference}-${index}`} product={product} priority={priority && index < 2} />)}</ul>
  </section>;
}
