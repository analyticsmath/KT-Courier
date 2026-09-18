"use client";

import Image from "next/image";
import { ktMedia } from "@/components/public-v2/media";
import styles from "./home-journey.module.css";

export function LocalCollectionScene() {
  const vanAsset = ktMedia.home.van.slidingDoorOpen;
  const courierApproach = ktMedia.home.courier.approachVehicle;

  return (
    <section
      aria-labelledby="collection-heading"
      className={styles.collectionScene}
      data-scene="collection"
    >
      <div className={styles.collectionContainer}>
        {/* Narrative indicator */}
        <div className={styles.collectionHeader} data-actor="collection-copy">
          <span className={styles.collectionChapterTag}>
            STATE 09 — LOCAL COLLECTION
          </span>
          <h2 className={styles.collectionHeadline} id="collection-heading">
            Neighborhood Van Arrival
          </h2>
          <p className={styles.collectionLead}>
            The last-mile collection van stages at the merchant curb. Side door slides open as courier accepts the parcel.
          </p>
        </div>

        {/* Spatial Stage: White Van Protagonist with Sliding Door Open + Approaching Courier */}
        <div className={styles.collectionVehicleStage} data-actor="collection-stage">
          {/* Dominant White Van Actor */}
          <div className={styles.collectionVanActor} data-actor="collection-van">
            <Image
              alt={vanAsset.alt}
              src={vanAsset.src}
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 75vw"
              className={styles.collectionVanImg}
            />
          </div>

          {/* Courier Approaching Vehicle with Parcel */}
          <div className={styles.collectionCourierActor} data-actor="collection-courier">
            <Image
              alt={courierApproach.alt}
              src={courierApproach.src}
              fill
              sizes="(max-width: 767px) 160px, 280px"
              className="object-contain object-bottom"
            />
          </div>
        </div>

        {/* Operational Status Evidence */}
        <div className={styles.collectionTelemetryRow}>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1A8754]" />
            <span className="text-[11px] font-mono tracking-wider text-[#111318]">
              COLLECTION CONFIRMED · ROUTE READY
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
