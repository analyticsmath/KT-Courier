"use client";

import Link from "next/link";
import { WhiteTruckActor } from "../../actors/WhiteTruckActor";
import styles from "../home-scenes.module.css";

interface HeroSceneProps {
  className?: string;
}

/**
 * Scene 01 — Hero Truck & Brand Establish (Merged Immediate First View).
 * Displays the authoritative campaign frame:
 * Giant KT / COURIER typography, complete white hero truck silhouette on desktop & mobile,
 * concise human copy, and clear Shop & Send actions.
 */
export function HeroScene({ className = "" }: HeroSceneProps) {
  return (
    <section
      className={`${styles.heroSection} ${className}`}
      data-kt-contrast="light"
      data-kt-scene="hero"
      aria-label="KT Couriers Hero"
    >
      {/* Occlusion Plane: Giant KT / COURIER Typography Behind Truck */}
      <div className={styles.heroTypographyBackground} aria-hidden="true">
        <span className={styles.heroWordKt}>KT</span>
        <span className={styles.heroWordCourier}>COURIER</span>
      </div>

      {/* Persistent White Hero Truck Actor (Completely visible on mobile) */}
      <div className={styles.heroTruckWrapper}>
        <WhiteTruckActor stateId="wide-hero" isHero priority />
      </div>

      {/* Peripheral Human Copy & Primary Actions */}
      <div className={styles.heroActionsRow}>
        <div className={styles.heroCopyBlock}>
          <h1 className={styles.heroTagline}>Shop local. Send with KT.</h1>
          <p className={styles.heroLead}>
            One place to discover local stores, arrange deliveries and keep up with what’s moving.
          </p>
        </div>

        <div className={styles.heroCtas}>
          <Link href="/shop" className={styles.btnPrimary}>
            Shop
          </Link>
          <Link href="/services/parcel" className={styles.btnSecondary}>
            Send a parcel
          </Link>
        </div>
      </div>
    </section>
  );
}
