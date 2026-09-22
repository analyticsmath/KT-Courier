"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ktMediaV3 } from "../../media/kt-media-v3";
import styles from "../post-hero-rebuild.module.css";

const ROUTES = [["Freight", "/services/freight"], ["Moving", "/services/moving"], ["Business", "/services/business"], ["Parcel", "/services/parcel"]] as const;

export function FreightTransitionScene() {
  const street = ktMediaV3.editorial.market.urbanStreet;
  return (
    <section className={`${styles.chapter} ${styles.freight}`} data-kt-scene="freight" aria-labelledby="freight-heading" style={{ minHeight: "240svh" }}>
      <div className={styles.sticky} data-home-sticky-stage>
        <div className={styles.freightStage}>
          <div className={styles.freightWorld} data-freight-local-street aria-hidden="true"><img src={street.src} alt="" /></div>
          <p className={styles.freightWord} data-freight-word aria-hidden="true">FREIGHT</p>
          <div className={styles.freightCopy}><p className={styles.eyebrow}>Business movement</p><h2 className={styles.heading} id="freight-heading">From parcels to business movement.</h2><p className={styles.body}>Scheduled collections, documents, parcels and stock movement, connected by the same delivery network.</p></div>
          <div className={styles.freightInfo} data-freight-info><span>KT / OPERATIONS</span><strong>Built for more than small parcels.</strong><small>Scheduled collections · Documents · Parcels · Stock movement</small></div>
          <div className={styles.freightTruck} data-freight-truck aria-hidden="true" />
          <nav className={styles.freightLinks} aria-label="KT service routes">{ROUTES.map(([label, href]) => <Link key={href} href={href}>{label} <span aria-hidden="true">↗</span></Link>)}</nav>
        </div>
      </div>
    </section>
  );
}
