"use client";

import { useRef } from "react";
import Link from "next/link";
import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";
import { MarketplaceProductCard } from "./MarketplaceProductCard";
import styles from "./commerce.module.css";

export function MarketplaceProductRail({ products, title, headingId, href, linkLabel }: {
  products: readonly StorefrontProductCard[];
  title: string;
  headingId: string;
  href?: string | null;
  linkLabel?: string;
}) {
  const trackRef = useRef<HTMLUListElement>(null);

  function advance(direction: -1 | 1) {
    const track = trackRef.current;
    const card = track?.firstElementChild as HTMLElement | null;
    if (!track || !card) return;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    track.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: "smooth" });
  }

  return <div className={styles.recommendationRail}>
    <div className={styles.recommendationHeader}>
      <h2 id={headingId}>{title}</h2>
      <div className={styles.recommendationActions}>
        {href && linkLabel && <Link className={styles.sectionDirectLink} href={href}>{linkLabel} &rarr;</Link>}
        <button type="button" aria-label={`Scroll ${title} left`} onClick={() => advance(-1)}>←</button>
        <button type="button" aria-label={`Scroll ${title} right`} onClick={() => advance(1)}>→</button>
      </div>
    </div>
    <div className={styles.recommendationDeck}>
      <ul aria-label={title} className={styles.recommendationTrack} ref={trackRef}>
        {products.map((product) => <MarketplaceProductCard key={product.productReference} variant="related" product={product} />)}
      </ul>
    </div>
  </div>;
}
