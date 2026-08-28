import Link from "next/link";
import { KtCouriersWordmark } from "@/components/public-v2/brand";
import { KtIconBack } from "@/components/public-v2/graphics/KtIcons";
import styles from "./auth-pages.module.css";

export function AuthHeader() {
  return (
    <>
      <a className={styles.skipLink} href="#main-content">
        Skip to account access
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link aria-label="KT Couriers home" className={styles.brandLink} href="/">
            <KtCouriersWordmark compactMark />
          </Link>
          <Link className={styles.backLink} href="/">
            <KtIconBack size={16} />
            Back to site
          </Link>
        </div>
      </header>
    </>
  );
}
