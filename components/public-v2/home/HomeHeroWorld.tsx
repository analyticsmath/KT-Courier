"use client";

import Image from "next/image";
import Link from "next/link";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import { ktMedia } from "@/components/public-v2/media";
import styles from "./home-journey.module.css";

export function HomeHeroWorld() {
  const truckAsset = ktMedia.home.heroTruck.sideRight;

  return (
    <section
      aria-labelledby="hero-title"
      className={styles.heroPosterScene}
      data-kt-contrast="light"
      data-scene="hero"
    >
      {/* Background Plane: Oversized KT COURIERS Typography & Road Horizon */}
      <div className={styles.heroTypographyPlane} data-actor="hero-type-plane">
        <h1 className={styles.heroOversizedTitle} id="hero-title">
          <span className={styles.heroOversizedLine}>KT COURIERS</span>
        </h1>
        <div className={styles.heroGroundBaseline} data-actor="hero-baseline" />
      </div>

      {/* Foreground Protagonist: Long White Truck crossing and occluding typography */}
      <div className={styles.heroTruckForegroundStage} data-actor="hero-truck-stage">
        <div className={styles.heroTruckImageContainer} data-actor="hero-truck-actor">
          <Image
            alt={truckAsset.alt}
            src={truckAsset.src}
            fill
            priority
            sizes="(max-width: 767px) 150vw, (max-width: 1440px) 90vw, 1600px"
            className={styles.heroTruckImg}
          />
        </div>
      </div>

      {/* Spatial CTA Territories: Shop (Lower-Left) & Send (Lower-Right) */}
      <div className={styles.heroTerritoryGrid}>
        {/* Lower-Left Territory: Shop Intent */}
        <div className={styles.heroTerritoryShop} data-actor="hero-cta-shop">
          <Link
            href={marketplaceHref()}
            className={styles.heroActionCardShop}
            data-kt-sticky-mode="EXPLORE"
          >
            <span className={styles.heroActionBadge}>DISCOVER MARKETPLACE</span>
            <div className={styles.heroActionHeadingRow}>
              <span className={styles.heroActionTitle}>Shop Local Makers</span>
              <div className={styles.heroActionArrowCircle}>
                <KtIconArrowRight size={18} />
              </div>
            </div>
            <p className={styles.heroActionSubtitle}>
              Direct orders from verified South African artisans, kitchens & grocers.
            </p>
          </Link>
        </div>

        {/* Lower-Right Territory: Send Intent */}
        <div className={styles.heroTerritorySend} data-actor="hero-cta-send">
          <Link
            href="/services/pricing"
            className={styles.heroActionCardSend}
            data-kt-sticky-mode="QUOTE"
          >
            <span className={styles.heroActionBadgeSend}>DISPATCH & TRANSIT</span>
            <div className={styles.heroActionHeadingRow}>
              <span className={styles.heroActionTitle}>Send a Parcel</span>
              <div className={styles.heroActionArrowCircleSend}>
                <KtIconArrowRight size={18} />
              </div>
            </div>
            <p className={styles.heroActionSubtitle}>
              Calculated courier quotes and scheduled collection corridors.
            </p>
          </Link>
        </div>
      </div>

      {/* Mobile Decision Zone: Thumb-reachable dual action bar */}
      <div className={styles.heroMobileDecisionZone}>
        <Link href={marketplaceHref()} className={styles.heroMobileShopBtn}>
          <span>SHOP MAKERS</span>
          <KtIconArrowRight size={16} />
        </Link>
        <Link href="/services/pricing" className={styles.heroMobileSendBtn}>
          <span>SEND PARCEL</span>
          <KtIconArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
