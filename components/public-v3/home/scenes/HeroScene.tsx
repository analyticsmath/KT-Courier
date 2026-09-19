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
      aria-label="KT Couriers Hero"
    >
      {/* Occlusion Plane: Giant KT / COURIER Typography Behind Truck */}
      <div className={styles.heroTypographyBackground} aria-hidden="true">
        <span className={styles.heroWordKt}>KT</span>
        <span className={styles.heroWordCourier}>COURIER</span>
      </div>

      {/* Atmospheric Road Texture Plane (Enters under truck ground baseline) */}
      <div
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

      {/* Persistent White Hero Truck Actor Anchor (Completely visible on mobile without clipping) */}
      <div
        data-actor-anchor="hero-truck"
        className={`${styles.heroTruckWrapper} min-h-[160px] sm:min-h-[260px] md:min-h-[360px] pointer-events-none relative`}
      >
        {/* Physical trailer cargo rectangle anchor calibrated strictly to cargo box (excluding cab and wheels) */}
        <div
          data-trailer-mask-anchor="true"
          className="absolute left-[18%] top-[18%] w-[50%] h-[52%] pointer-events-none"
        />
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
