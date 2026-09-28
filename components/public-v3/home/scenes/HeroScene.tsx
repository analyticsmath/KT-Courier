"use client";

import Link from "next/link";
import { chapterBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";
import styles from "../home-scenes.module.css";

interface HeroSceneProps {
  className?: string;
}

/**
 * Scene 01 — Hero Van & Brand Establish (Merged Immediate First View).
 * Displays the authoritative campaign frame on the Signal White public canvas:
 * Giant KT / COURIER typography, the hero van, concise human copy, and Shop & Send actions.
 */
export function HeroScene({ className = "" }: HeroSceneProps) {
  return (
    <section
      className={`${styles.heroSection} ${className}`}
      data-kt-contrast="light"
      data-kt-scene="hero"
      data-motion="hero-stage"
      aria-label="KT Couriers Hero"
      style={{
        "--kt-home-budget": chapterBudgetVh("hero"),
        "--kt-home-mobile-budget": mobileChapterBudgetVh("hero"),
      } as React.CSSProperties}
    >
      <div className={styles.heroStage} data-home-sticky-stage>
      {/* One campaign lockup, always behind the persistent van actor. */}
      <div className={styles.heroTypographyBackground} aria-hidden="true">
        <div className={styles.heroBrandLockup}>
          <span className={styles.heroWordKt} data-motion="hero-kt">KT</span>
          <span className={styles.heroWordCourier} data-motion="hero-courier">COURIER</span>
        </div>
      </div>

      {/* The reading state is complete before the van enters. */}
      <div className={styles.heroActionsRow} data-motion="hero-actions">
        <div className={styles.heroCopyBlock} data-motion="hero-copy">
          <h1 className={styles.heroTagline}>Shop local. Send with KT.</h1>
          <p className={styles.heroLead}>
            One place to discover local stores, arrange deliveries and keep up with what’s moving.
          </p>
        </div>

        <div className={styles.heroCtas}>
          <Link href="/shop" className={`${styles.btnPrimary} kt-action-filled`}>
            Shop
          </Link>
          <Link href="/services/parcel" className={`${styles.btnSecondary} kt-action-outline`}>
            Send a parcel
          </Link>
        </div>
      </div>
      </div>
    </section>
  );
}
