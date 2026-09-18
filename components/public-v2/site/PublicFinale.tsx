"use client";

import Link from "next/link";
import Image from "next/image";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import { ktMedia } from "@/components/public-v2/media";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./public-shell.module.css";

export function PublicFinale() {
  const truckThumbnail = ktMedia.home.heroTruck.sideRight;

  return (
    <section
      aria-labelledby="finale-heading"
      className={styles.designedFinaleViewport}
      data-scene="finale"
    >
      <div className={styles.finaleViewportInner} data-actor="finale-card">
        {/* Enormous Cropped Brand Type Statement */}
        <div className={styles.finaleBrandTypography}>
          <span className={styles.finaleBrandOverline}>SOUTH AFRICAN COMMERCE IN MOTION</span>
          <h2 className={styles.finaleGiantType} id="finale-heading">
            KT COURIERS
          </h2>
        </div>

        {/* Dual Primary Intent Territory */}
        <div className={styles.finaleIntentGrid}>
          {/* Shop Intent */}
          <Link
            href={marketplaceHref()}
            className={styles.finaleShopIntentCard}
            data-kt-sticky-mode="MARKETPLACE"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono tracking-widest text-[#347CFB] uppercase font-bold">
                COMMERCE DISCOVERY
              </span>
              <div className={styles.finaleArrowCircle}>
                <KtIconArrowRight size={20} />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-[#F3F1EA] mt-3">
              Explore the Marketplace
            </h3>
            <p className="text-sm text-[#D9DEE2]/70 mt-1">
              Connect with independent stores, local creators, and culinary kitchens.
            </p>
          </Link>

          {/* Send Intent */}
          <Link
            href="/services/pricing"
            className={styles.finaleSendIntentCard}
            data-kt-sticky-mode="DISPATCH"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono tracking-widest text-[#347CFB] uppercase font-bold">
                TRANSIT OPERATIONS
              </span>
              <div className={styles.finaleArrowCircleSend}>
                <KtIconArrowRight size={20} />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-[#F3F1EA] mt-3">
              Book Courier Transit
            </h3>
            <p className="text-sm text-[#D9DEE2]/70 mt-1">
              Calculate shipping fees, schedule pickup corridors, and move freight.
            </p>
          </Link>
        </div>

        {/* Subtle Protagonist Callback Stamp */}
        <div className={styles.finaleProtagonistCallback}>
          <div className="relative w-28 h-14 opacity-70">
            <Image
              alt={truckThumbnail.alt}
              src={truckThumbnail.src}
              fill
              sizes="112px"
              className="object-contain"
            />
          </div>
          <span className="text-[10px] font-mono tracking-wider text-[#59626A] uppercase">
            FLAGSHIP CORRIDOR FLEET · GAUTENG &middot; WESTERN CAPE &middot; KZN
          </span>
        </div>
      </div>
    </section>
  );
}
