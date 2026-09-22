"use client";

/* eslint-disable @next/next/no-img-element */

import { ktMediaV3 } from "../../media/kt-media-v3";
import styles from "../post-hero-rebuild.module.css";

export function NetworkRouteScene() {
  const route = ktMediaV3.pages.homepage.routePlane;
  return (
    <section className={`${styles.chapter} ${styles.network}`} data-kt-scene="network" aria-labelledby="network-heading" style={{ minHeight: "250svh" }}>
      <div className={styles.sticky} data-home-sticky-stage>
        <div className={styles.networkStage}>
          {/* The route photograph owns the world; the SVG only supplies deterministic travel geometry. */}
          <img className={styles.networkEnvironment} src={route.src} alt={route.alt} data-network-environment />
          <div className={styles.networkTint} />
          <div className={styles.networkCopy}><p className={styles.eyebrow}>On the way</p><h2 className={styles.heading} id="network-heading">The parcel keeps moving.</h2><p className={styles.body}>Collection, transportation and delivery stay connected on a route through Johannesburg, Gauteng and Pretoria.</p></div>
          <p className={styles.routeAnnotation} data-route-annotation>Johannesburg · Gauteng · Pretoria<br /><span>Service availability depends on location.</span></p>
          <div className={styles.networkProcess} data-network-process><span>Collection</span><span>Transportation</span><span>Delivery</span><small>Tracking, where available · Order status · Dispatch · Delivery progress</small></div>
          <svg className={styles.networkRoad} viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
            <path data-network-route-path d="M500 106 L500 385 C500 520 660 545 720 650 C785 765 690 850 430 950" strokeWidth="108" />
            <path d="M500 106 L500 385 C500 520 660 545 720 650 C785 765 690 850 430 950" strokeWidth="3" />
          </svg>
          <div className={styles.networkMask} data-route-overpass-mask aria-hidden="true" />
          <div className={styles.networkOcclusion} data-route-occluder="straight-angled" aria-hidden="true"><span>ROUTE SEAM</span></div>
          <div className={styles.networkOcclusion} data-route-occluder="angled-turning" aria-hidden="true"><span>ROUTE SEAM</span></div>
        </div>
      </div>
    </section>
  );
}
