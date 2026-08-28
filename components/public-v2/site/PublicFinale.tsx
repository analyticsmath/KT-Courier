import Link from "next/link";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import { KtIconArrowRight, KtIconArrowUpRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./public-shell.module.css";

export function PublicFinale() {
  return (
    <section aria-labelledby="finale-heading" className={styles.finaleSection}>
      <h2 className={styles.finaleStatement} id="finale-heading">
        FROM CART TO DOORSTEP.
      </h2>
      <p className={styles.finaleSub}>
        Marketplace discovery and authenticated courier delivery connected through one reliable network.
      </p>
      <div className={styles.finaleActions}>
        <Link className={styles.finalePrimaryAction} href={marketplaceHref()}>
          Explore marketplace <KtIconArrowRight size={18} />
        </Link>
        <Link className={styles.finaleSecondaryAction} href="/account/request-delivery">
          Request delivery <KtIconArrowUpRight size={18} />
        </Link>
      </div>
    </section>
  );
}
