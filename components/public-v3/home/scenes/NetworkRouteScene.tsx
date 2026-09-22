"use client";

import styles from "../post-hero-rebuild.module.css";

export function NetworkRouteScene() {
  return (
    <section className={`${styles.chapter} ${styles.network}`} data-kt-scene="network" aria-labelledby="network-heading" style={{ minHeight: "280svh" }}>
      <div className={styles.sticky} data-home-sticky-stage>
        <div className={styles.networkStage}>
          <div className={styles.networkCopy}>
            <p className={styles.eyebrow}>On the way</p>
            <h2 className={styles.heading} id="network-heading">The parcel keeps moving.</h2>
            <p className={styles.body}>From local order to moving route, each handoff keeps the journey going.</p>
          </div>
          <svg className={styles.networkRoad} viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
            <path data-network-route-path d="M500 106 L500 385 C500 520 660 545 720 650 C785 765 690 850 430 950" strokeWidth="245" />
            <path d="M500 106 L500 385 C500 520 660 545 720 650 C785 765 690 850 430 950" strokeWidth="4" />
          </svg>
          <div className={styles.networkMask} data-route-overpass-mask aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
