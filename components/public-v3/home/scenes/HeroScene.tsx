"use client";

import Link from "next/link";
import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";
import styles from "../home-scenes.module.css";

interface HeroSceneProps {
  className?: string;
}

/**
 * Scene 01 — Hero Truck & Brand Establish (Merged Immediate First View).
 * Displays the authoritative campaign frame on warm Freight Paper (#F1ECE2):
 * Giant KT / COURIER typography, complete white hero truck silhouette on desktop & mobile,
 * subtle road texture entering peripheral depth, concise human copy, and clear Shop & Send actions.
 */
export function HeroScene({ className = "" }: HeroSceneProps) {
  const roadTexture = ktMediaV3.editorial.route.gautengCorridor;

  return (
    <section
      className={`${styles.heroSection} ${className}`}
      data-kt-contrast="light"
      data-kt-scene="hero"
      data-motion="hero-stage"
      aria-label="KT Couriers Hero"
      style={{ "--kt-home-budget": 200 } as React.CSSProperties}
    >
      <div className={styles.heroStage} data-home-sticky-stage>
      {/* One campaign lockup, always behind the persistent truck actor. */}
      <div className={styles.heroTypographyBackground} aria-hidden="true">
        <div className={styles.heroBrandLockup}>
          <span className={styles.heroWordKt} data-motion="hero-kt">KT</span>
          <span className={styles.heroWordCourier} data-motion="hero-courier">COURIER</span>
        </div>
      </div>

      {/* Atmospheric Road Texture Plane (Enters under truck ground baseline) */}
      <div
        data-motion="hero-road"
        className="kt-hero-road-atmosphere pointer-events-none absolute inset-x-0 bottom-0 h-48 opacity-20 overflow-hidden z-0"
        aria-hidden="true"
      >
        <Image
          src={roadTexture.src}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-bottom filter grayscale contrast-125"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--kt-freight-paper)] via-transparent to-[var(--kt-freight-paper)]" />
      </div>

      {/* The reading state is complete before the truck enters. */}
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
