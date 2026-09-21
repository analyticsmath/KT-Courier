"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { chapterBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";
import styles from "../post-hero-scenes.module.css";

export function ArrivalFinaleScene({ className = "" }: { className?: string }) {
  const arrival = ktMediaV3.editorial.courier.physicalHandoff;
  const style = {
    "--kt-home-budget": `${chapterBudgetVh("finale")}svh`,
    "--kt-home-mobile-budget": `${mobileChapterBudgetVh("finale")}svh`,
  } as CSSProperties;

  return (
    <footer
      id="site-finale-horizon"
      className={`${styles.finaleSection} ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="finale"
      role="contentinfo"
      aria-label="KT Courier delivery and site information"
      style={style}
    >
      <div className={styles.finaleStickyStage} data-home-sticky-stage>
        <div className={styles.finaleArrivalImage} data-finale-arrival>
          <Image src={arrival.src} alt={arrival.alt} fill sizes="100vw" className="object-cover object-center" />
          <div />
        </div>
        <p className={styles.finaleDelivered} data-finale-delivered>Delivered.</p>
        <div className={styles.finaleBrandHorizon} data-finale-brand-horizon aria-hidden="true" />
        <div className={styles.finaleIdentity}>
          <h2 data-motion="finale-title" className={styles.finaleTitle}>
            <span>KT</span>
            <span>COURIER</span>
          </h2>
          <p className={styles.finaleMotto}>Shop local. Send anywhere. Move with KT.</p>
        </div>

        <nav className={styles.finaleUtility} data-motion="finale-utility" aria-label="KT Courier links">
          <Link href="/shop">Marketplace</Link>
          <Link href="/services/parcel">Send a parcel</Link>
          <Link href="/services/freight">Freight services</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy-policy">Privacy</Link>
        </nav>
        <div className={styles.finaleLegal} data-motion="finale-legal">
          <p>&copy; {new Date().getFullYear()} KT Couriers (Pty) Ltd. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
