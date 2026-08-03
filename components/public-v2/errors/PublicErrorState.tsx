"use client";

import Link from "next/link";
import { KtCouriersWordmark } from "@/components/public-v2/brand";
import { PublicVisualRoot } from "@/components/public-v2/foundation/PublicVisualRoot";
import styles from "./public-errors.module.css";

export function PublicErrorState({ onRetry }: { onRetry: () => void }) {
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
          <p className={styles.checkpoint}><span className={styles.checkpointDot} aria-hidden="true" />Unexpected interruption</p>
          <h1 className={styles.title}>We could not complete that page.</h1>
          <p className={styles.copy}>Please try again. If the issue continues, use the contact route and include only the details you are comfortable sharing.</p>
          <div className={styles.actions}>
            <button className={styles.primary} onClick={onRetry} type="button">Try again</button>
            <Link className={styles.secondary} href="/">Return home</Link>
            <Link className={styles.secondary} href="/contact">Contact support</Link>
          </div>
        </div>
      </main>
      <footer className={styles.footer}><div className={styles.footerInner}>KT Couriers</div></footer>
    </PublicVisualRoot>
  );
}
