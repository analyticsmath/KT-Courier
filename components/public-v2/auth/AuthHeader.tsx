import Link from "next/link";
import styles from "./auth-pages.module.css";

export function AuthHeader() {
  return (
    <>
      <a className={styles.skipLink} href="#main-content">Skip to account access</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/" aria-label="KT Couriers home">
            <span className={styles.brandMark} aria-hidden="true">KT</span>
            KT Couriers
          </Link>
          <Link className={styles.backLink} href="/">
            Back to site
          </Link>
        </div>
      </header>
    </>
  );
}
