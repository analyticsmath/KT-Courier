"use client";

import Image from "next/image";
import { ktMedia } from "@/components/public-v2/media";
import styles from "./home-journey.module.css";

export function ArrivalScene() {
  const courierArrival = ktMedia.home.courier.extendingHandoff;

  return (
    <section
      aria-labelledby="arrival-heading"
      className={styles.arrivalQuietScene}
      data-scene="arrival"
    >
      <div className={styles.arrivalContainer}>
        {/* Editorial Heading Block */}
        <div className={styles.arrivalHeader} data-actor="arrival-copy">
          <span className={styles.arrivalChapterTag}>
            STATE 13 — FINAL RESOLUTION
          </span>
          <h2 className={styles.arrivalTitle} id="arrival-heading">
            At the Doorstep
          </h2>
          <p className={styles.arrivalLead}>
            The route completes. Responsibility is delivered cleanly into the customer&apos;s hands.
          </p>
        </div>

        {/* Quiet Human Delivery Frame: Courier Extending Handoff */}
        <div className={styles.arrivalHumanStage} data-actor="arrival-stage">
          <div className={styles.arrivalCourierFrame} data-actor="arrival-media">
            <Image
              alt={courierArrival.alt}
              src={courierArrival.src}
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 650px"
              className="object-contain object-bottom"
            />
          </div>

          <div className={styles.arrivalWarmStatusBadge}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1A8754]" />
              <span className="text-xs font-mono font-bold text-[#111318] uppercase tracking-wider">
                DELIVERY COMPLETE · SIGNATURE RECORDED
              </span>
            </div>
            <span className="text-[11px] font-mono text-[#59626A] mt-0.5">
              Johannesburg &middot; Handoff Confirmed
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
