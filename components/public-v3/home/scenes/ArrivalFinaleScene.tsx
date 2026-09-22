"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ktMediaV3 } from "../../media/kt-media-v3";
import styles from "../post-hero-rebuild.module.css";

export function ArrivalFinaleScene() {
  const street = ktMediaV3.editorial.market.urbanStreet;
  return <footer className={`${styles.chapter} ${styles.finale}`} data-kt-scene="finale" aria-labelledby="finale-heading" style={{ minHeight: "135svh" }}>
    <div className={styles.sticky} data-home-sticky-stage><div className={styles.finaleStage}>
      {/* Finale begins on the outgoing Last-Mile environment before the identity rises. */}
      <div className={styles.finaleEnvironment} data-finale-environment data-finale-street><img src={street.src} alt="" /></div>
      <p className={styles.finaleDelivered} data-finale-delivered>Delivered.</p>
      <div className={styles.finaleIdentity} data-finale-identity><h2 id="finale-heading"><span>KT</span><span>COURIER</span></h2><p className={styles.finaleMotto}>Delivering Speed. Ensuring Trust.</p></div>
      <nav className={styles.finaleUtility} aria-label="KT Courier links" data-finale-utility><Link href="/shop">Marketplace</Link><Link href="/services/parcel">Send a parcel</Link><Link href="/services/freight">Freight</Link><Link href="/contact">Contact</Link></nav>
      <p className={styles.legal} data-finale-legal>&copy; {new Date().getFullYear()} KT Couriers (Pty) Ltd. All rights reserved.</p>
    </div></div>
  </footer>;
}
