"use client";
import Link from "next/link";
import styles from "../post-hero-rebuild.module.css";
export function ArrivalFinaleScene() {
  return <footer className={`${styles.chapter} ${styles.finale}`} data-kt-scene="finale" aria-labelledby="finale-heading" style={{ minHeight: "150svh" }}>
    <div className={styles.sticky} data-home-sticky-stage><div className={styles.finaleStage}>
      <div className={styles.finaleStreet} aria-hidden="true" />
      <p className={styles.finaleDelivered} data-finale-delivered>Delivered.</p>
      <div className={styles.finaleIdentity}><h2 id="finale-heading"><span>KT</span><span>COURIER</span></h2><p className={styles.finaleMotto}>Shop local. Send with KT.</p></div>
      <nav className={styles.finaleUtility} aria-label="KT Courier links" data-finale-utility>
        <Link href="/shop">Marketplace</Link><Link href="/services/parcel">Send a parcel</Link><Link href="/services/freight">Freight</Link><Link href="/contact">Contact</Link><Link href="/terms">Terms</Link><Link href="/privacy-policy">Privacy</Link>
      </nav>
      <p className={styles.legal} data-finale-legal>&copy; {new Date().getFullYear()} KT Couriers (Pty) Ltd. All rights reserved.</p>
    </div></div>
  </footer>;
}
