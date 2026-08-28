"use client";

import Link from "next/link";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import { KtIconArrowRight, KtIconArrowUpRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./public-shell.module.css";

export function PublicFinale() {
  return (
    <section aria-labelledby="finale-heading" className={styles.finaleSection}>
      <div className={styles.finaleInner}>
        <div className={styles.finaleTypographyBlock}>
          <span className={styles.finaleOverline}>Continuous movement</span>
          <h2 className={styles.finaleStatement} id="finale-heading">
            FROM CART<br />TO DOORSTEP.
          </h2>
          <p className={styles.finaleSub}>
            Marketplace goods and courier deliveries connected through one reliable regional network.
          </p>
        </div>

        <div className={styles.finaleCommands}>
          <Link className={styles.finalePrimaryLink} href={marketplaceHref()}>
            <span>Shop the marketplace</span>
            <KtIconArrowRight size={20} />
          </Link>
          <Link className={styles.finaleSecondaryLink} href="/account/request-delivery">
            <span>Send a delivery</span>
            <KtIconArrowUpRight size={20} />
          </Link>
        </div>
      </div>
    </section>
  );
}
