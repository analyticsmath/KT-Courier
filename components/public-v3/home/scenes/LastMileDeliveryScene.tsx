"use client";

import styles from "../post-hero-rebuild.module.css";

export function LastMileDeliveryScene() {
  return (
    <section className={`${styles.chapter} ${styles.lastMile}`} data-kt-scene="last-mile" aria-labelledby="last-mile-heading" style={{ minHeight: "340svh" }}>
      <div className={styles.sticky} data-home-sticky-stage>
        <div className={styles.streetTexture} aria-hidden="true" />
        <div className={styles.lastMileCopy}>
          <p className={styles.eyebrow}>Almost there</p>
          <h2 className={styles.heading} id="last-mile-heading">Delivered</h2>
        </div>
        <div className={styles.vehicle} data-last-mile-vehicle aria-hidden="true" />
        <div className={styles.handoffCopy} data-handoff-copy>
          <p className={styles.body}>A human handoff closes the distance.</p>
        </div>
      </div>
    </section>
  );
}
