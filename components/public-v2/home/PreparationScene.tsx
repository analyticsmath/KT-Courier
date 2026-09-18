"use client";

import Image from "next/image";
import { ktMedia } from "@/components/public-v2/media";
import styles from "./home-journey.module.css";

export function PreparationScene() {
  return (
    <section
      aria-labelledby="prep-heading"
      className={styles.prepQuietScene}
      data-scene="preparation"
    >
      <div className={styles.prepContainer}>
        {/* Short, disciplined copy */}
        <div className={styles.prepHeaderBlock} data-actor="prep-copy">
          <span className={styles.prepChapterTag}>STATE 08 — PHYSICAL TRANSITION</span>
          <h2 className={styles.prepMainHeadline} id="prep-heading">
            Choice Becomes Object
          </h2>
          <p className={styles.prepShortLead}>
            The merchant packages, seals, and stages the order. Digital selection is now physical freight.
          </p>
        </div>

        {/* Spatial Dual Frame: Merchant Workspace & Packaging Detail */}
        <div className={styles.prepDualStage} data-actor="prep-stage">
          {/* Main Merchant Prep Workspace */}
          <div className={styles.prepMainFrame} data-actor="merchant-world">
            <Image
              alt="South African artisan preparing and packaging parcel in local workshop"
              src={ktMedia.documentary.pickup.src}
              fill
              sizes="(max-width: 1023px) 100vw, 65vw"
              className={styles.prepWorkshopImg}
            />
            <div className={styles.prepFrameBadge}>
              <span>ORDER STAGED · ROSEBANK WORKSHOP</span>
            </div>
          </div>

          {/* Connected Packaging Detail Actor */}
          <div className={styles.prepParcelDetailFrame} data-actor="package-actor">
            <div className="relative w-full h-full">
              <Image
                alt="Sealed dispatch parcel ready for courier handoff"
                src={ktMedia.documentary.handoffDetail.src}
                fill
                sizes="(max-width: 767px) 220px, 340px"
                className="object-cover"
              />
              <div className={styles.prepDetailLabel}>
                <span className="w-2 h-2 rounded-full bg-[#347CFB] animate-pulse" />
                <span>VERIFIED PARCEL #01</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
