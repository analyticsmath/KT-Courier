import Link from "next/link";
import { KtCouriersWordmark } from "@/components/public-v2/brand";
import { PublicVisualRoot } from "@/components/public-v2/foundation/PublicVisualRoot";
import styles from "./public-errors.module.css";

export function PublicNotFound() {
  return (
    <PublicVisualRoot className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link aria-label="KT Couriers" className={styles.wordmark} href="/">
            <KtCouriersWordmark compactMark />
          </Link>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.mainInner}>
          <p className={styles.checkpoint}><span className={styles.checkpointDot} aria-hidden="true" />404</p>
          <h1 className={styles.title}>That route is not on this map.</h1>
          <p className={styles.copy}>The page may have moved, or the link may be incorrect. Choose a public route to continue.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/">Return home</Link>
            <Link className={styles.secondary} href="/services">Explore services</Link>
            <Link className={styles.secondary} href="/contact">Contact support</Link>
          </div>
        </div>
      </main>
      <footer className={styles.footer}><div className={styles.footerInner}>KT Couriers</div></footer>
    </PublicVisualRoot>
  );
}
