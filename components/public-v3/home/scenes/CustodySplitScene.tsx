"use client";

import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { chapterBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";
import styles from "../post-hero-scenes.module.css";

interface CustodySplitSceneProps {
  className?: string;
}

/**
 * Chapter 07 — Custody Split Vignette.
 * The physical seam between merchant preparation and courier transit.
 * Dual real documentary photographs: Merchant counter vs Courier digital manifest.
 * Zero HUD labels, zero neon lines — only authentic photographic territory split.
 */
export function CustodySplitScene({ className = "" }: CustodySplitSceneProps) {
  const merchantSide = ktMediaV3.pages.homepage.custodySplit.merchantSide;
  const courierSide = ktMediaV3.pages.homepage.custodySplit.courierSide;

  return (
    <section
      className={`${styles.custodySection} kt-custody-split-section ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="custody"
      aria-label="Custody Transfer"
      style={{ "--kt-home-budget": chapterBudgetVh("custody"), "--kt-home-mobile-budget": mobileChapterBudgetVh("custody") } as React.CSSProperties}
    >
      <div className="kt-home-sticky-stage kt-home-custody-sticky">
      <div className={styles.custodyCopy}><h2>In KT custody.</h2><p>One visible courier carries the responsibility from merchant counter into the delivery network.</p></div>
      <div className={`${styles.custodyPane} kt-custody-left`}>
        <Image
          src={merchantSide.src}
          alt={merchantSide.alt}
          fill
          sizes="50vw"
          className="kt-custody-merchant-img object-cover filter contrast-105 will-change-transform"
        />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      <div className={`${styles.custodyPane} kt-custody-right`}>
        <Image
          src={courierSide.src}
          alt={courierSide.alt}
          fill
          sizes="50vw"
          className="kt-custody-courier-img object-cover filter contrast-105 will-change-transform"
        />
        <div className="absolute inset-0 bg-black/25" />
      </div>

      {/* Persistent courier anchor bridges the two documentary worlds. */}
      <div
        data-actor-anchor="custody-courier"
        data-motion="custody-seam"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-64 sm:w-80 min-h-[300px] pointer-events-none"
      />
      </div>
    </section>
  );
}
