"use client";

/* eslint-disable @next/next/no-img-element */

import { ktMediaV3 } from "../../media/kt-media-v3";
import styles from "../post-hero-rebuild.module.css";

export function LastMileDeliveryScene() {
  const street = ktMediaV3.editorial.market.urbanStreet;
  return (
    <section className={`${styles.chapter} ${styles.lastMile}`} data-kt-scene="last-mile" aria-labelledby="last-mile-heading" style={{ minHeight: "340svh" }}>
      <div className={styles.sticky} data-home-sticky-stage>
        <div className={styles.lastMileStage}>
          {/* The same image is used by Freight's trailer reveal and Finale's opening hold. */}
          <img className={styles.streetEnvironment} src={street.src} alt={street.alt} data-last-mile-environment />
          <div className={styles.streetShade} />
          <div className={styles.lastMileCopy}><p className={styles.eyebrow}>Last mile</p><h2 className={styles.heading} id="last-mile-heading">Almost there.</h2><p className={styles.body}>The final distance is a human handoff.</p></div>
          <p className={styles.deliveryMarker} data-handoff-copy>Delivery / custody transfer</p>
          <div className={styles.vehicle} data-last-mile-vehicle aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
