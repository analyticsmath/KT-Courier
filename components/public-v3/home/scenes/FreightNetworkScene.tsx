"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { chapterBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";
import styles from "../post-hero-scenes.module.css";

const SERVICES = [
  { name: "Road freight", detail: "Regional and long-haul movement" },
  { name: "Air cargo", detail: "Time-sensitive consignments" },
  { name: "Customs", detail: "Cross-border coordination" },
  { name: "Warehousing", detail: "Secure storage and handling" },
];

export function FreightNetworkScene({ className = "" }: { className?: string }) {
  const destination = ktMediaV3.editorial.courier.physicalHandoff;
  const style = {
    "--kt-home-budget": `${chapterBudgetVh("freight")}svh`,
    "--kt-home-mobile-budget": `${mobileChapterBudgetVh("freight")}svh`,
  } as CSSProperties;

  return (
    <section
      className={`${styles.freightSection} ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="freight"
      aria-labelledby="freight-heading"
      style={style}
    >
      <div className={styles.freightStickyStage} data-home-sticky-stage>
        <p className={styles.freightBackdropWord} aria-hidden="true">FREIGHT</p>
        <div className={styles.freightHeading}>
          <p>Across the network</p>
          <h2 id="freight-heading">Built for more than small parcels.</h2>
        </div>

        <div className={styles.freightServicePlane} data-motion="freight-services">
          <div className={styles.freightServiceIntro}>
            <span>KT Freight</span>
            <p>Capacity for the loads and routes that move business forward.</p>
          </div>
          <ul>
            {SERVICES.map((service) => (
              <li key={service.name}>
                <strong>{service.name}</strong>
                <span>{service.detail}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.freightDestination} data-freight-destination aria-hidden="true">
          <Image src={destination.src} alt="" fill sizes="100vw" className="object-cover object-center" />
          <div />
        </div>
      </div>
    </section>
  );
}
